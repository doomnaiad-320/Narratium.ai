import { 
  MemoryEntry, 
  MemoryType, 
  MemorySearchResult, 
  MemoryContext,
  MemoryRAGConfig,
  MemoryAnalytics,
} from "@/lib/models/memory-model";
import { LocalMemoryOperations } from "@/lib/data/roleplay/memory-operation";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export interface RAGGenerationOptions {
  characterId: string;
  currentUserInput: string;
  conversationContext?: string;
  maxMemories?: number;
  includeTypes?: MemoryType[];
  language?: "zh" | "en";
}

export interface MemoryExtractionResult {
  memories: MemoryEntry[];
  confidence: number;
  reasoning: string;
}

/**
 * Advanced Memory Manager with RAG capabilities using LangChain
 * Handles vector embeddings, semantic search, and intelligent memory retrieval
 */
export class MemoryManager {
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  
  constructor(
    private apiKey: string,
    private baseUrl?: string,
  ) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: this.apiKey,
      modelName: "text-embedding-3-small",
      configuration: this.baseUrl ? { baseURL: this.baseUrl } : undefined,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });
  }

  /**
   * Create and store a new memory with automatic embedding generation
   */
  async createMemory(
    characterId: string,
    type: MemoryType,
    content: string,
    metadata: any = {},
    tags: string[] = [],
    importance: number = 0.5,
  ): Promise<MemoryEntry> {
    // Create the memory entry
    const memoryEntry = await LocalMemoryOperations.createMemoryEntry(
      characterId,
      type,
      content,
      metadata,
      tags,
      importance,
    );

    // Generate and store embedding
    try {
      await this.generateAndStoreEmbedding(memoryEntry);
    } catch (error) {
      console.warn(`Failed to generate embedding for memory ${memoryEntry.id}:`, error);
    }

    return memoryEntry;
  }

  /**
   * Perform semantic search on memories using vector embeddings
   */
  async semanticSearch(
    characterId: string,
    query: string,
    options: {
      topK?: number;
      similarityThreshold?: number;
      includeTypes?: MemoryType[];
      excludeRecent?: boolean; // Exclude very recent memories
    } = {},
  ): Promise<MemorySearchResult[]> {
    const {
      topK = 5,
      similarityThreshold = 0.7,
      includeTypes,
      excludeRecent = false,
    } = options;

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(query);
      
      // Get all embeddings for the character
      const characterEmbeddings = await LocalMemoryOperations.getEmbeddingsByCharacter(characterId);
      const characterMemories = await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId);
      
      // Calculate similarities
      const similarities: Array<{
        entry: MemoryEntry;
        score: number;
        embeddingId: string;
      }> = [];

      for (const embeddingRecord of characterEmbeddings) {
        const memory = characterMemories.find(m => m.id === embeddingRecord.id);
        if (!memory) continue;

        // Apply type filter
        if (includeTypes && !includeTypes.includes(memory.type)) continue;

        // Exclude very recent memories (last 2 entries) to avoid repetition
        if (excludeRecent) {
          const recentMemories = characterMemories
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 2);
          if (recentMemories.find(rm => rm.id === memory.id)) continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embeddingRecord.embedding);
        
        if (similarity >= similarityThreshold) {
          similarities.push({
            entry: memory,
            score: similarity,
            embeddingId: embeddingRecord.id,
          });
        }
      }

      // Sort by similarity score and importance
      similarities.sort((a, b) => {
        const aScore = a.score * 0.8 + a.entry.importance * 0.2;
        const bScore = b.score * 0.8 + b.entry.importance * 0.2;
        return bScore - aScore;
      });

      // Take top K results
      const topResults = similarities.slice(0, topK);

      // Generate reasoning for each result
      const results: MemorySearchResult[] = await Promise.all(
        topResults.map(async (result) => {
          const reasoning = await this.generateRelevanceReasoning(
            query,
            result.entry,
            result.score,
          );

          // Update access count
          await LocalMemoryOperations.incrementAccessCount(result.entry.id);

          return {
            entry: result.entry,
            score: result.score,
            reasoning,
          };
        }),
      );

      return results;
    } catch (error) {
      console.error("Semantic search failed:", error);
      // Fallback to text search
      return this.fallbackTextSearch(characterId, query, topK);
    }
  }

  /**
   * Hybrid search combining vector similarity and keyword matching
   */
  async hybridSearch(
    characterId: string,
    query: string,
    options: {
      topK?: number;
      similarityThreshold?: number;
      includeTypes?: MemoryType[];
      alpha?: number; // Balance between semantic (0) and keyword (1) search
    } = {},
  ): Promise<MemorySearchResult[]> {
    const { 
      topK = 5, 
      similarityThreshold = 0.6,
      includeTypes,
      alpha = 0.7, // Favor semantic search
    } = options;

    // Get semantic search results
    const semanticResults = await this.semanticSearch(characterId, query, {
      topK: topK * 2, // Get more results to combine
      similarityThreshold: similarityThreshold * 0.8, // Lower threshold for combination
      includeTypes,
    });

    // Get keyword search results
    const keywordResults = await this.keywordSearch(characterId, query, {
      topK: topK * 2,
      includeTypes,
    });

    // Combine and rerank results
    const combinedResults = this.combineSearchResults(
      semanticResults,
      keywordResults,
      alpha,
    );

    return combinedResults.slice(0, topK);
  }

  /**
   * Extract memories automatically from dialogue content
   */
  async extractMemoriesFromDialogue(
    characterId: string,
    userMessage: string,
    assistantMessage: string,
    context?: string,
  ): Promise<MemoryExtractionResult> {
    const llm = new ChatOpenAI({
      apiKey: this.apiKey,
      modelName: "gpt-4o-mini",
      temperature: 0.1,
      configuration: this.baseUrl ? { baseURL: this.baseUrl } : undefined,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `You are an expert memory extraction system for character AI. Analyze the conversation and extract important memories that should be stored for future reference.

Extract memories that are:
- Factual information (names, dates, locations, numbers)
- Character preferences or habits
- Relationship dynamics or important interactions
- Significant events or experiences
- Emotional states or reactions
- Geographic or spatial information
- Important concepts or abstract ideas
- Memorable dialogue or quotes

For each memory, provide:
1. Type: one of [fact, relationship, event, preference, emotion, geography, concept, dialogue]
2. Content: clear, specific description
3. Importance: 0.0-1.0 (higher = more important)
4. Tags: relevant keywords
5. Confidence: 0.0-1.0 (how confident you are this is worth remembering)

Return as JSON array of memory objects. If no important memories found, return empty array.

Example output:
[
  {
    "type": "fact",
    "content": "User's name is Alice and she works as a software engineer",
    "importance": 0.8,
    "tags": ["name", "job", "Alice", "engineer"],
    "confidence": 0.9
  }
]`],
      ["human", `Context: ${context || "No additional context"}

User: ${userMessage}
Assistant: ${assistantMessage}

Extract important memories from this conversation:`],
      ["human", `Context: ${context || "No additional context"}

User: ${userMessage}
Assistant: ${assistantMessage}

Extract important memories from this conversation:`],
    ]);

    try {
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      const extractedMemories = JSON.parse(response);
      if (!Array.isArray(extractedMemories)) {
        return { memories: [], confidence: 0, reasoning: "Invalid response format" };
      }

      // Create memory entries
      const memories: MemoryEntry[] = [];
      for (const memoryData of extractedMemories) {
        if (memoryData.confidence >= 0.6) { // Only store high-confidence memories
          const memory = await this.createMemory(
            characterId,
            memoryData.type,
            memoryData.content,
            {
              source: "dialogue_extraction",
              confidence: memoryData.confidence,
              context: context,
              originalUserMessage: userMessage,
              originalAssistantMessage: assistantMessage,
            },
            memoryData.tags,
            memoryData.importance,
          );
          memories.push(memory);
        }
      }

      const avgConfidence = extractedMemories.length > 0 
        ? extractedMemories.reduce((sum, m) => sum + m.confidence, 0) / extractedMemories.length
        : 0;

      return {
        memories,
        confidence: avgConfidence,
        reasoning: `Extracted ${memories.length} memories from dialogue with average confidence ${avgConfidence.toFixed(2)}`,
      };

    } catch (error) {
      console.error("Memory extraction failed:", error);
      return { 
        memories: [], 
        confidence: 0, 
        reasoning: `Memory extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`, 
      };
    }
  }

  /**
   * Generate contextual memory prompt for LLM
   */
  async generateMemoryContext(options: RAGGenerationOptions): Promise<MemoryContext> {
    const { 
      characterId, 
      currentUserInput, 
      conversationContext,
      maxMemories = 5,
      includeTypes,
      language = "zh",
    } = options;

    // Search for relevant memories
    const searchResults = await this.hybridSearch(characterId, currentUserInput, {
      topK: maxMemories,
      includeTypes,
      similarityThreshold: 0.6,
    });

    // Format memory prompt
    const memoryPrompt = this.formatMemoryPrompt(searchResults, language);

    // Get total memory count
    const totalMemoryCount = (await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId)).length;

    // Get RAG config
    const config = await LocalMemoryOperations.getRAGConfig(characterId);

    return {
      activeMemories: searchResults.map(r => r.entry),
      searchResults,
      memoryPrompt,
      totalMemoryCount,
      config,
    };
  }

  /**
   * Generate and store embedding for a memory entry
   */
  private async generateAndStoreEmbedding(memoryEntry: MemoryEntry): Promise<void> {
    try {
      // Combine content with metadata for richer embeddings
      const embeddingText = this.prepareTextForEmbedding(memoryEntry);
      
      // Generate embedding
      const embedding = await this.embeddings.embedQuery(embeddingText);
      
      // Store embedding
      await LocalMemoryOperations.storeEmbedding(
        memoryEntry.id,
        memoryEntry.characterId,
        embedding,
        "text-embedding-3-small",
      );
    } catch (error) {
      console.error(`Failed to generate embedding for memory ${memoryEntry.id}:`, error);
      throw error;
    }
  }

  /**
   * Prepare text for embedding by combining content with metadata
   */
  private prepareTextForEmbedding(memoryEntry: MemoryEntry): string {
    const parts = [
      memoryEntry.content,
      `Type: ${memoryEntry.type}`,
      `Tags: ${memoryEntry.tags.join(", ")}`,
    ];

    if (memoryEntry.metadata.context) {
      parts.push(`Context: ${memoryEntry.metadata.context}`);
    }

    if (memoryEntry.metadata.temporalContext?.timeframe) {
      parts.push(`Time: ${memoryEntry.metadata.temporalContext.timeframe}`);
    }

    if (memoryEntry.metadata.spatialContext?.location) {
      parts.push(`Location: ${memoryEntry.metadata.spatialContext.location}`);
    }

    return parts.join(" | ");
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same length");
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate reasoning for why a memory is relevant
   */
  private async generateRelevanceReasoning(
    query: string,
    memory: MemoryEntry,
    score: number,
  ): Promise<string> {
    // For performance, use a simple rule-based approach
    const reasons = [];
    
    if (score > 0.9) {
      reasons.push("highly semantically similar");
    } else if (score > 0.8) {
      reasons.push("semantically related");
    } else {
      reasons.push("potentially relevant");
    }

    if (memory.importance > 0.8) {
      reasons.push("marked as important");
    }

    if (memory.accessCount > 5) {
      reasons.push("frequently accessed");
    }

    const queryLower = query.toLowerCase();
    const contentLower = memory.content.toLowerCase();
    
    if (memory.tags.some(tag => queryLower.includes(tag.toLowerCase()))) {
      reasons.push("matches tags");
    }

    if (queryLower.split(" ").some(word => contentLower.includes(word))) {
      reasons.push("contains keywords");
    }

    return `Relevant because: ${reasons.join(", ")} (similarity: ${(score * 100).toFixed(1)}%)`;
  }

  /**
   * Keyword-based search for memories
   */
  private async keywordSearch(
    characterId: string,
    query: string,
    options: { topK?: number; includeTypes?: MemoryType[] } = {},
  ): Promise<MemorySearchResult[]> {
    const searchQuery = {
      query,
      characterId,
      types: options.includeTypes,
      maxResults: options.topK || 5,
    };

    const entries = await LocalMemoryOperations.searchMemoriesByText(searchQuery);
    
    return entries.map(entry => ({
      entry,
      score: this.calculateKeywordScore(query, entry),
      reasoning: "Keyword match",
    }));
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(query: string, memory: MemoryEntry): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = memory.content.toLowerCase().split(/\s+/);
    const tagWords = memory.tags.map(tag => tag.toLowerCase());
    
    let matches = 0;
    let totalWords = queryWords.length;
    
    for (const queryWord of queryWords) {
      if (contentWords.some(word => word.includes(queryWord)) ||
          tagWords.some(tag => tag.includes(queryWord))) {
        matches++;
      }
    }
    
    const baseScore = matches / totalWords;
    return Math.min(baseScore * memory.importance * 1.2, 1.0);
  }

  /**
   * Combine semantic and keyword search results
   */
  private combineSearchResults(
    semanticResults: MemorySearchResult[],
    keywordResults: MemorySearchResult[],
    alpha: number = 0.7,
  ): MemorySearchResult[] {
    const resultMap = new Map<string, MemorySearchResult>();

    // Add semantic results
    for (const result of semanticResults) {
      resultMap.set(result.entry.id, {
        ...result,
        score: result.score * alpha,
      });
    }

    // Combine with keyword results
    for (const result of keywordResults) {
      const existing = resultMap.get(result.entry.id);
      if (existing) {
        // Combine scores
        existing.score = existing.score + (result.score * (1 - alpha));
        existing.reasoning = `${existing.reasoning} + ${result.reasoning}`;
      } else {
        resultMap.set(result.entry.id, {
          ...result,
          score: result.score * (1 - alpha),
        });
      }
    }

    // Sort by combined score
    return Array.from(resultMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Fallback text search when vector search fails
   */
  private async fallbackTextSearch(
    characterId: string,
    query: string,
    topK: number,
  ): Promise<MemorySearchResult[]> {
    console.warn("Using fallback text search due to vector search failure");
    return this.keywordSearch(characterId, query, { topK });
  }

  /**
   * Format memory prompt for LLM consumption
   */
  private formatMemoryPrompt(results: MemorySearchResult[], language: "zh" | "en"): string {
    if (results.length === 0) {
      return language === "zh" ? "无相关记忆" : "No relevant memories";
    }

    const header = language === "zh" ? "相关记忆：" : "Relevant memories:";
    const memoryTexts = results.map((result, index) => {
      const typeLabel = language === "zh" ? this.getChineseTypeLabel(result.entry.type) : result.entry.type;
      return `${index + 1}. [${typeLabel}] ${result.entry.content}`;
    });

    return `${header}\n${memoryTexts.join("\n")}`;
  }

  /**
   * Get Chinese labels for memory types
   */
  private getChineseTypeLabel(type: MemoryType): string {
    const labels: Record<MemoryType, string> = {
      [MemoryType.FACT]: "事实",
      [MemoryType.RELATIONSHIP]: "关系",
      [MemoryType.EVENT]: "事件",
      [MemoryType.PREFERENCE]: "偏好",
      [MemoryType.EMOTION]: "情感",
      [MemoryType.GEOGRAPHY]: "地理",
      [MemoryType.CONCEPT]: "概念",
      [MemoryType.DIALOGUE]: "对话",
    };
    return labels[type] || type;
  }

  /**
   * Get memory analytics for a character
   */
  async getAnalytics(characterId: string): Promise<MemoryAnalytics> {
    return LocalMemoryOperations.getMemoryAnalytics(characterId);
  }

  /**
   * Update RAG configuration
   */
  async updateRAGConfig(characterId: string, config: Partial<MemoryRAGConfig>): Promise<MemoryRAGConfig> {
    return LocalMemoryOperations.updateRAGConfig(characterId, config);
  }

  /**
   * Rebuild embeddings for all memories of a character (useful after config changes)
   */
  async rebuildEmbeddings(characterId: string): Promise<{ success: number; failed: number }> {
    const memories = await LocalMemoryOperations.getMemoryEntriesByCharacter(characterId);
    let success = 0;
    let failed = 0;

    for (const memory of memories) {
      try {
        await this.generateAndStoreEmbedding(memory);
        success++;
      } catch (error) {
        console.error(`Failed to regenerate embedding for memory ${memory.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
} 
