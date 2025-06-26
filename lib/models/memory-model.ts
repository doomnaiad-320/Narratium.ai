// Memory System Models - RAG-based persistent memory for characters
// Supports vector embeddings, semantic search, and contextual retrieval

export interface MemoryEntry {
  id: string;
  characterId: string;
  type: MemoryType;
  content: string;
  metadata: MemoryMetadata;
  embedding?: number[]; // Vector embedding for semantic search
  tags: string[];
  importance: number; // 0-1, higher = more important
  accessCount: number; // How often this memory has been accessed
  lastAccessed: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export enum MemoryType {
  FACT = "fact", // Factual information (dates, names, locations)
  RELATIONSHIP = "relationship", // Character relationships and dynamics
  EVENT = "event", // Significant events or experiences
  PREFERENCE = "preference", // Character preferences and habits
  EMOTION = "emotion", // Emotional states and reactions
  GEOGRAPHY = "geography", // Locations and spatial information
  CONCEPT = "concept", // Abstract concepts or ideas
  DIALOGUE = "dialogue", // Important conversations or quotes
}

export interface MemoryMetadata {
  source: string; // Where this memory came from (dialogue, manual, etc.)
  confidence: number; // 0-1, confidence in memory accuracy
  context?: string; // Additional context information
  relatedEntries?: string[]; // IDs of related memory entries
  temporalContext?: TemporalContext; // Time-related information
  spatialContext?: SpatialContext; // Location-related information
  participants?: string[]; // Characters involved in this memory
  emotional_weight?: number; // Emotional significance (0-1)
}

export interface TemporalContext {
  timeframe?: string; // "recent", "distant past", "childhood", etc.
  sequence?: number; // Order in a sequence of events
  relativityToPresent?: string; // How this relates to current timeline
}

export interface SpatialContext {
  location?: string; // Specific location name
  locationType?: string; // "home", "workplace", "public", etc.
  proximity?: string; // "nearby", "distant", "unknown"
}

// RAG Configuration
export interface MemoryRAGConfig {
  embeddingModel: string; // Model used for embeddings
  chunkSize: number; // Text chunk size for processing
  chunkOverlap: number; // Overlap between chunks
  topK: number; // Number of top results to retrieve
  similarityThreshold: number; // Minimum similarity score (0-1)
  rerankerModel?: string; // Optional reranker model
  enableHybridSearch: boolean; // Combine vector + keyword search
}

// Search and Retrieval
export interface MemorySearchQuery {
  query: string;
  characterId: string;
  types?: MemoryType[]; // Filter by memory types
  tags?: string[]; // Filter by tags
  timeframe?: string; // Filter by time period
  maxResults?: number; // Maximum results to return
  includeMetadata?: boolean; // Include full metadata in results
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number; // Similarity score (0-1)
  reasoning?: string; // Why this result was relevant
}

// Memory Context for workflow
export interface MemoryContext {
  activeMemories: MemoryEntry[]; // Currently relevant memories
  searchResults?: MemorySearchResult[]; // Last search results
  memoryPrompt?: string; // Formatted memory context for LLM
  totalMemoryCount: number; // Total memories for character
  config: MemoryRAGConfig;
}

// Memory Operations Results
export interface MemoryOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  affectedCount?: number;
}

// Memory Analytics
export interface MemoryAnalytics {
  totalEntries: number;
  entriesByType: Record<MemoryType, number>;
  averageImportance: number;
  mostAccessedEntries: MemoryEntry[];
  oldestEntry?: MemoryEntry;
  newestEntry?: MemoryEntry;
  memoryDensity: number; // Memories per day/conversation
} 
