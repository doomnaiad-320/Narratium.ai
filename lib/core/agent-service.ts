import { AgentEngine } from "./agent-engine";
import { AgentConversationOperations } from "@/lib/data/agent-operation";
import { AgentConversation, AgentTaskStatus } from "@/lib/models/agent-model";

/**
 * Agent Service - High-level API for character+worldbook generation
 */
export class AgentService {
  private engines: Map<string, AgentEngine> = new Map();

  /**
   * Start a new character generation conversation
   */
  async startGeneration(
    title: string,
    userInput: string,
    llmConfig: {
      modelName: string;
      apiKey: string;
      baseUrl?: string;
      llmType: "openai" | "ollama";
      temperature?: number;
    },
  ): Promise<{
    conversationId: string;
    success: boolean;
    result?: any;
    error?: string;
    needsUserInput?: boolean;
  }> {
    try {
      // Create new conversation
      const conversation = await AgentConversationOperations.createConversation(title);
      
      // Create and initialize agent engine
      const engine = new AgentEngine(conversation.id, llmConfig);
      this.engines.set(conversation.id, engine);
      
      // Execute workflow
      const result = await engine.executeWorkflow(userInput);
      
      return {
        conversationId: conversation.id,
        success: result.success,
        result: result.result,
        error: result.error,
        needsUserInput: result.needsUserInput || false,
      };
      
    } catch (error) {
      console.error("Failed to start generation:", error);
      return {
        conversationId: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Continue generation with user response
   */
  async continueGeneration(
    conversationId: string,
    userResponse: string,
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    needsUserInput?: boolean;
  }> {
    try {
      let engine = this.engines.get(conversationId);
      
      if (!engine) {
        // Recreate engine from conversation data
        const conversation = await AgentConversationOperations.getConversationById(conversationId);
        if (!conversation) {
          throw new Error("Conversation not found");
        }
        
        // Would need to reconstruct LLM config from conversation metadata
        // For now, throw error - in production you'd store LLM config in conversation
        throw new Error("Engine not found and cannot reconstruct LLM config");
      }
      
      const result = await engine.continueWorkflow(userResponse);
      
      return {
        success: result.success,
        result: result.result,
        error: result.error,
        needsUserInput: result.needsUserInput || false,
      };
      
    } catch (error) {
      console.error("Failed to continue generation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get conversation status and messages
   */
  async getConversationStatus(conversationId: string): Promise<{
    conversation: AgentConversation | null;
    messages: any[];
    currentStep?: string;
    progress?: number;
  }> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        return {
          conversation: null,
          messages: [],
        };
      }
      
      const messages = await AgentConversationOperations.getConversationHistory(conversationId);
      const currentSteps = await AgentConversationOperations.getCurrentSteps(conversationId);
      
      // Calculate progress based on steps completed
      const totalExpectedSteps = 6; // ANALYZE, SEARCH, PLAN, OUTPUT, VALIDATE, REFINE
      const completedSteps = currentSteps.filter(step => step.status === AgentTaskStatus.COMPLETED).length;
      const progress = Math.min((completedSteps / totalExpectedSteps) * 100, 100);
      
      const currentStep = currentSteps.length > 0 
        ? currentSteps[currentSteps.length - 1]?.capability 
        : undefined;
      
      return {
        conversation,
        messages,
        currentStep,
        progress,
      };
      
    } catch (error) {
      console.error("Failed to get conversation status:", error);
      return {
        conversation: null,
        messages: [],
      };
    }
  }

  /**
   * List all conversations for a user
   */
  async listConversations(): Promise<AgentConversation[]> {
    try {
      return await AgentConversationOperations.getAllConversations();
    } catch (error) {
      console.error("Failed to list conversations:", error);
      return [];
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      // Remove engine from memory
      this.engines.delete(conversationId);
      
      // Delete from storage
      return await AgentConversationOperations.deleteConversation(conversationId);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      return false;
    }
  }

  /**
   * Export conversation data
   */
  async exportConversation(conversationId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        return {
          success: false,
          error: "Conversation not found",
        };
      }
      
      const messages = await AgentConversationOperations.getConversationHistory(conversationId);
      const steps = await AgentConversationOperations.getCurrentSteps(conversationId);
      
      const exportData = {
        conversation,
        messages,
        steps,
        exportedAt: new Date().toISOString(),
      };
      
      return {
        success: true,
        data: exportData,
      };
      
    } catch (error) {
      console.error("Failed to export conversation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(): Promise<{
    totalConversations: number;
    completedGenerations: number;
    successRate: number;
    averageStepsPerGeneration: number;
    mostUsedTools: Array<{ toolId: string; usage: number }>;
  }> {
    try {
      const conversations = await AgentConversationOperations.getAllConversations();
      const stats = await AgentConversationOperations.getConversationStats();
      
      const completedGenerations = stats.completedWithBothData;
      const successRate = conversations.length > 0 
        ? (completedGenerations / conversations.length) * 100 
        : 0;
      
      // Calculate average steps per generation
      let totalSteps = 0;
      for (const conv of conversations) {
        const steps = await AgentConversationOperations.getCurrentSteps(conv.id);
        totalSteps += steps.length;
      }
      const averageStepsPerGeneration = conversations.length > 0 
        ? totalSteps / conversations.length 
        : 0;
      
      // Get tool usage data (simplified for now)
      const mostUsedTools: Array<{ toolId: string; usage: number }> = [];
      
      return {
        totalConversations: conversations.length,
        completedGenerations,
        successRate,
        averageStepsPerGeneration,
        mostUsedTools,
      };
      
    } catch (error) {
      console.error("Failed to get generation stats:", error);
      return {
        totalConversations: 0,
        completedGenerations: 0,
        successRate: 0,
        averageStepsPerGeneration: 0,
        mostUsedTools: [],
      };
    }
  }

  /**
   * Cleanup resources for a conversation
   */
  async cleanup(conversationId: string): Promise<void> {
    this.engines.delete(conversationId);
  }

  /**
   * Get engine for conversation (for advanced usage)
   */
  getEngine(conversationId: string): AgentEngine | undefined {
    return this.engines.get(conversationId);
  }
}

// Singleton instance
export const agentService = new AgentService(); 
