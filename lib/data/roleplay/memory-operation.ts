import { readData, writeData, MEMORY_ENTRIES_FILE, MEMORY_EMBEDDINGS_FILE } from "@/lib/data/local-storage";
import { 
  MemoryEntry, 
  MemoryType, 
  MemorySearchQuery, 
  MemoryAnalytics,
  MemoryRAGConfig, 
} from "@/lib/models/memory-model";
import { v4 as uuidv4 } from "uuid";

export interface MemoryRecord {
  id: string;
  characterId: string;
  entries: MemoryEntry[];
  config: MemoryRAGConfig;
  created_at: string;
  updated_at: string;
}

export interface EmbeddingRecord {
  id: string; // Same as memory entry ID
  characterId: string;
  embedding: number[];
  model: string; // Which embedding model was used
  created_at: string;
}

export class LocalMemoryOperations {
  /**
   * Create a new memory entry for a character
   */
  static async createMemoryEntry(
    characterId: string, 
    type: MemoryType,
    content: string,
    metadata: any = {},
    tags: string[] = [],
    importance: number = 0.5,
  ): Promise<MemoryEntry> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    
    const memoryEntry: MemoryEntry = {
      id: uuidv4(),
      characterId,
      type,
      content,
      metadata: {
        source: "manual",
        confidence: 1.0,
        ...metadata,
      },
      tags,
      importance,
      accessCount: 0,
      lastAccessed: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Find existing character record or create new one
    let characterRecord = memoryRecords.find(
      (record: MemoryRecord) => record.characterId === characterId,
    );

    if (!characterRecord) {
      characterRecord = {
        id: uuidv4(),
        characterId,
        entries: [memoryEntry],
        config: this.getDefaultRAGConfig(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryRecords.push(characterRecord);
    } else {
      characterRecord.entries.push(memoryEntry);
      characterRecord.updated_at = new Date().toISOString();
    }

    await writeData(MEMORY_ENTRIES_FILE, memoryRecords);
    return memoryEntry;
  }

  /**
   * Get all memory entries for a character
   */
  static async getMemoryEntriesByCharacter(characterId: string): Promise<MemoryEntry[]> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    const characterRecord = memoryRecords.find(
      (record: MemoryRecord) => record.characterId === characterId,
    );
    
    return characterRecord ? characterRecord.entries : [];
  }

  /**
   * Get a specific memory entry by ID
   */
  static async getMemoryEntryById(entryId: string): Promise<MemoryEntry | null> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    
    for (const record of memoryRecords) {
      const entry = record.entries.find((entry: MemoryEntry) => entry.id === entryId);
      if (entry) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * Update a memory entry
   */
  static async updateMemoryEntry(
    entryId: string, 
    updates: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | null> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    
    for (const record of memoryRecords) {
      const entryIndex = record.entries.findIndex((entry: MemoryEntry) => entry.id === entryId);
      if (entryIndex !== -1) {
        record.entries[entryIndex] = {
          ...record.entries[entryIndex],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        record.updated_at = new Date().toISOString();
        
        await writeData(MEMORY_ENTRIES_FILE, memoryRecords);
        return record.entries[entryIndex];
      }
    }
    
    return null;
  }

  /**
   * Delete a memory entry
   */
  static async deleteMemoryEntry(entryId: string): Promise<boolean> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    
    for (const record of memoryRecords) {
      const entryIndex = record.entries.findIndex((entry: MemoryEntry) => entry.id === entryId);
      if (entryIndex !== -1) {
        record.entries.splice(entryIndex, 1);
        record.updated_at = new Date().toISOString();
        
        await writeData(MEMORY_ENTRIES_FILE, memoryRecords);
        
        // Also delete embedding if exists
        await this.deleteEmbedding(entryId);
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Increment access count for a memory entry
   */
  static async incrementAccessCount(entryId: string): Promise<void> {
    const entry = await this.getMemoryEntryById(entryId);
    if (entry) {
      await this.updateMemoryEntry(entryId, {
        accessCount: entry.accessCount + 1,
        lastAccessed: new Date().toISOString(),
      });
    }
  }

  /**
   * Search memories by text (basic search, not vector search)
   */
  static async searchMemoriesByText(query: MemorySearchQuery): Promise<MemoryEntry[]> {
    const entries = await this.getMemoryEntriesByCharacter(query.characterId);
    const lowerQuery = query.query.toLowerCase();
    
    let filteredEntries = entries.filter((entry: MemoryEntry) => {
      // Text search
      const matchesText = entry.content.toLowerCase().includes(lowerQuery) ||
                         entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
      
      // Type filter
      const matchesType = !query.types || query.types.includes(entry.type);
      
      // Tag filter
      const matchesTags = !query.tags || query.tags.some(tag => 
        entry.tags.includes(tag),
      );
      
      return matchesText && matchesType && matchesTags;
    });

    // Sort by importance and access count
    filteredEntries.sort((a: MemoryEntry, b: MemoryEntry) => {
      return (b.importance * 0.7 + (b.accessCount / 100) * 0.3) - 
             (a.importance * 0.7 + (a.accessCount / 100) * 0.3);
    });

    // Apply max results limit
    if (query.maxResults) {
      filteredEntries = filteredEntries.slice(0, query.maxResults);
    }

    return filteredEntries;
  }

  /**
   * Store vector embedding for a memory entry
   */
  static async storeEmbedding(
    entryId: string, 
    characterId: string,
    embedding: number[], 
    model: string,
  ): Promise<void> {
    const embeddingRecords = await readData(MEMORY_EMBEDDINGS_FILE);
    
    const embeddingRecord: EmbeddingRecord = {
      id: entryId,
      characterId,
      embedding,
      model,
      created_at: new Date().toISOString(),
    };
    
    // Remove existing embedding if exists
    const existingIndex = embeddingRecords.findIndex(
      (record: EmbeddingRecord) => record.id === entryId,
    );
    
    if (existingIndex !== -1) {
      embeddingRecords[existingIndex] = embeddingRecord;
    } else {
      embeddingRecords.push(embeddingRecord);
    }
    
    await writeData(MEMORY_EMBEDDINGS_FILE, embeddingRecords);
  }

  /**
   * Get embedding for a memory entry
   */
  static async getEmbedding(entryId: string): Promise<EmbeddingRecord | null> {
    const embeddingRecords = await readData(MEMORY_EMBEDDINGS_FILE);
    const embedding = embeddingRecords.find(
      (record: EmbeddingRecord) => record.id === entryId,
    );
    
    return embedding || null;
  }

  /**
   * Get all embeddings for a character
   */
  static async getEmbeddingsByCharacter(characterId: string): Promise<EmbeddingRecord[]> {
    const embeddingRecords = await readData(MEMORY_EMBEDDINGS_FILE);
    return embeddingRecords.filter(
      (record: EmbeddingRecord) => record.characterId === characterId,
    );
  }

  /**
   * Delete embedding
   */
  static async deleteEmbedding(entryId: string): Promise<boolean> {
    const embeddingRecords = await readData(MEMORY_EMBEDDINGS_FILE);
    const index = embeddingRecords.findIndex(
      (record: EmbeddingRecord) => record.id === entryId,
    );
    
    if (index !== -1) {
      embeddingRecords.splice(index, 1);
      await writeData(MEMORY_EMBEDDINGS_FILE, embeddingRecords);
      return true;
    }
    
    return false;
  }

  /**
   * Get memory analytics for a character
   */
  static async getMemoryAnalytics(characterId: string): Promise<MemoryAnalytics> {
    const entries = await this.getMemoryEntriesByCharacter(characterId);
    
    const entriesByType: Record<MemoryType, number> = {
      [MemoryType.FACT]: 0,
      [MemoryType.RELATIONSHIP]: 0,
      [MemoryType.EVENT]: 0,
      [MemoryType.PREFERENCE]: 0,
      [MemoryType.EMOTION]: 0,
      [MemoryType.GEOGRAPHY]: 0,
      [MemoryType.CONCEPT]: 0,
      [MemoryType.DIALOGUE]: 0,
    };

    let totalImportance = 0;
    let oldestEntry: MemoryEntry | undefined;
    let newestEntry: MemoryEntry | undefined;

    for (const entry of entries) {
      entriesByType[entry.type]++;
      totalImportance += entry.importance;

      if (!oldestEntry || new Date(entry.created_at) < new Date(oldestEntry.created_at)) {
        oldestEntry = entry;
      }
      if (!newestEntry || new Date(entry.created_at) > new Date(newestEntry.created_at)) {
        newestEntry = entry;
      }
    }

    const mostAccessedEntries = entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    return {
      totalEntries: entries.length,
      entriesByType,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      mostAccessedEntries,
      oldestEntry,
      newestEntry,
      memoryDensity: entries.length > 0 ? this.calculateMemoryDensity(entries) : 0,
    };
  }

  /**
   * Get RAG configuration for a character
   */
  static async getRAGConfig(characterId: string): Promise<MemoryRAGConfig> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    const characterRecord = memoryRecords.find(
      (record: MemoryRecord) => record.characterId === characterId,
    );
    
    return characterRecord?.config || this.getDefaultRAGConfig();
  }

  /**
   * Update RAG configuration for a character
   */
  static async updateRAGConfig(
    characterId: string, 
    config: Partial<MemoryRAGConfig>,
  ): Promise<MemoryRAGConfig> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    let characterRecord = memoryRecords.find(
      (record: MemoryRecord) => record.characterId === characterId,
    );

    if (!characterRecord) {
      characterRecord = {
        id: uuidv4(),
        characterId,
        entries: [],
        config: { ...this.getDefaultRAGConfig(), ...config },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryRecords.push(characterRecord);
    } else {
      characterRecord.config = { ...characterRecord.config, ...config };
      characterRecord.updated_at = new Date().toISOString();
    }

    await writeData(MEMORY_ENTRIES_FILE, memoryRecords);
    return characterRecord.config;
  }

  /**
   * Clear all memories for a character
   */
  static async clearCharacterMemories(characterId: string): Promise<void> {
    const memoryRecords = await readData(MEMORY_ENTRIES_FILE);
    const characterRecordIndex = memoryRecords.findIndex(
      (record: MemoryRecord) => record.characterId === characterId,
    );

    if (characterRecordIndex !== -1) {
      memoryRecords.splice(characterRecordIndex, 1);
      await writeData(MEMORY_ENTRIES_FILE, memoryRecords);
    }

    // Also clear embeddings
    const embeddingRecords = await readData(MEMORY_EMBEDDINGS_FILE);
    const filteredEmbeddings = embeddingRecords.filter(
      (record: EmbeddingRecord) => record.characterId !== characterId,
    );
    await writeData(MEMORY_EMBEDDINGS_FILE, filteredEmbeddings);
  }

  /**
   * Get default RAG configuration
   */
  private static getDefaultRAGConfig(): MemoryRAGConfig {
    return {
      embeddingModel: "text-embedding-3-small",
      chunkSize: 512,
      chunkOverlap: 50,
      topK: 5,
      similarityThreshold: 0.7,
      enableHybridSearch: true,
    };
  }

  /**
   * Calculate memory density (memories per day)
   */
  private static calculateMemoryDensity(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;

    const oldest = Math.min(...entries.map(e => new Date(e.created_at).getTime()));
    const newest = Math.max(...entries.map(e => new Date(e.created_at).getTime()));
    const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);
    
    return daysDiff > 0 ? entries.length / daysDiff : entries.length;
  }
} 
