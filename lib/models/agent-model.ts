export enum AgentCapability {
  SEARCH = "search",     // Search and collect information
  PLAN = "plan",         // Create generation plan and structure  
  OUTPUT = "output",     // Generate final content
  ASK = "ask",          // Ask user for additional information
  VALIDATE = "validate", // Validate content quality and consistency
  REFINE = "refine",     // Refine and improve content based on feedback
  ANALYZE = "analyze"    // Analyze user requirements and existing content
}

export enum AgentTaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  WAITING_FOR_USER = "waiting_for_user" // New status for when agent is waiting for user input
}

export interface AgentStep {
  id: string;
  capability: AgentCapability;
  input: any;
  output: any;
  reasoning?: string; // Agent's reasoning for this step
  status: AgentTaskStatus;
  executionOrder: number;
  timestamp: string;
  // For ASK capability
  userQuestion?: string;
  userResponse?: any;
  isWaitingForUser?: boolean;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  messageType: "text" | "task_request" | "task_result" | "step_update" | "user_question" | "user_response";
  metadata?: {
    capability?: AgentCapability;
    reasoning?: string;
    attachments?: any[];
    questionId?: string; // Link to specific question
    stepId?: string;     // Link to specific step
  };
  timestamp: string;
}

// Tool definition interface
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  inputSchema: any; // JSON schema for input validation
  outputSchema: any; // JSON schema for output validation
  execute: (input: any, context: AgentExecutionContext) => Promise<any>;
}

// Simplified conversation structure for character+worldbook generation
export interface AgentConversation {
  id: string;
  title: string;
  status: AgentTaskStatus;
  
  // All messages in chronological order
  messages: AgentMessage[];
  
  // Current execution steps for active task
  currentSteps: AgentStep[];
  
  // Tools available for this conversation
  availableTools: string[]; // Tool IDs
  
  // Final output when task is completed (character + worldbook together)
  output?: {
    characterData?: any;
    worldbookData?: any;
    combinedData?: any; // For cases where they're integrated
  };
  
  // Execution metadata
  metadata: {
    iterations: number;
    totalTokens?: number;
    executionTime?: number;
    modelUsed?: string;
    temperature?: number;
    toolsUsed?: string[]; // Track which tools were used
  };
  
  // User context and preferences
  context: {
    userPreferences?: any;
    referenceData?: any;
    constraints?: any;
    pendingQuestions?: Array<{
      id: string;
      question: string;
      stepId: string;
      timestamp: string;
    }>;
    toolUsageHistory?: Array<{
      toolId: string;
      stepId: string;
      input: any;
      output: any;
      timestamp: string;
      executionTime: number;
    }>;
  };
  
  created_at: string;
  updated_at: string;
}

// Runtime execution context for a conversation
export interface AgentExecutionContext {
  conversationId: string;
  currentStepIndex: number;
  workingMemory: Record<string, any>;
  availableTools: AgentTool[];
  constraints: {
    maxTokens?: number;
    timeoutMs?: number;
    maxSteps?: number;
  };
  // Current LLM configuration
  llmConfig?: {
    modelName: string;
    apiKey: string;
    baseUrl?: string;
    llmType: "openai" | "ollama";
    temperature?: number;
  };
} 
