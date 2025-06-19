import { 
  readData, 
  writeData, 
  AGENT_CONVERSATIONS_FILE, 
} from "@/lib/data/local-storage";
import { 
  AgentConversation, 
  AgentStep, 
  AgentMessage,
  AgentTaskStatus,
  AgentCapability,
} from "@/lib/models/agent-model";
import { v4 as uuidv4 } from "uuid";

export class AgentConversationOperations {
  /**
   * Create a new agent conversation for character+worldbook generation
   */
  static async createConversation(title: string): Promise<AgentConversation> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    
    const newConversation: AgentConversation = {
      id: uuidv4(),
      title,
      status: AgentTaskStatus.PENDING,
      messages: [],
      currentSteps: [],
      availableTools: [],
      metadata: {
        iterations: 0,
      },
      context: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    conversations.push(newConversation);
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    
    return newConversation;
  }

  /**
   * Get conversation by ID
   */
  static async getConversationById(id: string): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    return conversations.find((conv: AgentConversation) => conv.id === id) || null;
  }

  /**
   * Get all conversations
   */
  static async getAllConversations(): Promise<AgentConversation[]> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    return conversations.sort((a: AgentConversation, b: AgentConversation) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }

  /**
   * Add message to conversation
   */
  static async addMessage(
    conversationId: string, 
    message: Omit<AgentMessage, "id" | "timestamp">,
  ): Promise<AgentMessage> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const newMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    
    conversations[index].messages.push(newMessage);
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return newMessage;
  }

  /**
   * Add execution step to conversation
   */
  static async addStep(
    conversationId: string,
    step: Omit<AgentStep, "id" | "timestamp">,
  ): Promise<AgentStep> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const newStep: AgentStep = {
      ...step,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    
    conversations[index].currentSteps.push(newStep);
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return newStep;
  }

  /**
   * Update conversation status
   */
  static async updateStatus(conversationId: string, status: AgentTaskStatus): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) return null;
    
    conversations[index].status = status;
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversations[index];
  }

  /**
   * Update conversation output when task is completed
   */
  static async updateOutput(
    conversationId: string, 
    output: { characterData?: any; worldbookData?: any; combinedData?: any },
  ): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) return null;
    
    conversations[index].output = output;
    conversations[index].status = AgentTaskStatus.COMPLETED;
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversations[index];
  }

  /**
   * Update conversation metadata
   */
  static async updateMetadata(
    conversationId: string, 
    metadata: Partial<AgentConversation["metadata"]>,
  ): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) return null;
    
    conversations[index].metadata = { 
      ...conversations[index].metadata, 
      ...metadata, 
    };
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversations[index];
  }

  /**
   * Update conversation context
   */
  static async updateContext(
    conversationId: string, 
    context: Partial<AgentConversation["context"]>,
  ): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) return null;
    
    conversations[index].context = { 
      ...conversations[index].context, 
      ...context, 
    };
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversations[index];
  }

  /**
   * Update entire conversation
   */
  static async updateConversation(conversation: AgentConversation): Promise<AgentConversation> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversation.id);
    
    if (index === -1) {
      throw new Error(`Conversation ${conversation.id} not found`);
    }
    
    conversation.updated_at = new Date().toISOString();
    conversations[index] = conversation;
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversation;
  }

  /**
   * Clear current steps (when starting a new execution)
   */
  static async clearCurrentSteps(conversationId: string): Promise<AgentConversation | null> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const index = conversations.findIndex((conv: AgentConversation) => conv.id === conversationId);
    
    if (index === -1) return null;
    
    conversations[index].currentSteps = [];
    conversations[index].updated_at = new Date().toISOString();
    
    await writeData(AGENT_CONVERSATIONS_FILE, conversations);
    return conversations[index];
  }

  /**
   * Get conversation history (messages only)
   */
  static async getConversationHistory(conversationId: string, limit?: number): Promise<AgentMessage[]> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return [];
    
    const messages = conversation.messages.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * Get current execution steps
   */
  static async getCurrentSteps(conversationId: string): Promise<AgentStep[]> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return [];
    
    return conversation.currentSteps.sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Get step by capability from current steps
   */
  static async getStepByCapability(conversationId: string, capability: AgentCapability): Promise<AgentStep | null> {
    const steps = await this.getCurrentSteps(conversationId);
    return steps.find(step => step.capability === capability) || null;
  }

  /**
   * Delete conversation
   */
  static async deleteConversation(id: string): Promise<boolean> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const filteredConversations = conversations.filter((conv: AgentConversation) => conv.id !== id);
    
    if (filteredConversations.length === conversations.length) return false;
    
    await writeData(AGENT_CONVERSATIONS_FILE, filteredConversations);
    return true;
  }

  /**
   * Clean up completed conversations older than specified days
   */
  static async cleanupOldConversations(daysOld: number = 30): Promise<number> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const conversationsToKeep = conversations.filter((conv: AgentConversation) => {
      if (conv.status !== AgentTaskStatus.COMPLETED) return true;
      return new Date(conv.updated_at) > cutoffDate;
    });
    
    const deletedCount = conversations.length - conversationsToKeep.length;
    
    if (deletedCount > 0) {
      await writeData(AGENT_CONVERSATIONS_FILE, conversationsToKeep);
    }
    
    return deletedCount;
  }

  /**
   * Get conversation statistics
   */
  static async getConversationStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    completedWithCharacterData: number;
    completedWithWorldbookData: number;
    completedWithBothData: number;
  }> {
    const conversations = await readData(AGENT_CONVERSATIONS_FILE);
    
    const stats = {
      total: conversations.length,
      byStatus: {} as Record<string, number>,
      completedWithCharacterData: 0,
      completedWithWorldbookData: 0,
      completedWithBothData: 0,
    };
    
    conversations.forEach((conv: AgentConversation) => {
      // Count by status
      stats.byStatus[conv.status] = (stats.byStatus[conv.status] || 0) + 1;
      
      // Count completed conversations with different types of output
      if (conv.status === AgentTaskStatus.COMPLETED && conv.output) {
        if (conv.output.characterData) stats.completedWithCharacterData++;
        if (conv.output.worldbookData) stats.completedWithWorldbookData++;
        if (conv.output.characterData && conv.output.worldbookData) stats.completedWithBothData++;
      }
    });
    
    return stats;
  }
}

/**
 * Agent Tool Operations - manages tool usage and tracking within conversations
 */
export class AgentToolOperations {
  private static dbName = "Narratium_Agent_DB";
  private static storeName = "agent_tools";

  /**
   * Track tool usage in a conversation
   */
  static async recordToolUsage(
    conversationId: string,
    toolId: string,
    input: any,
    output: any,
    stepId: string,
    executionTime?: number,
  ): Promise<void> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      // Update tool usage in metadata
      if (!conversation.metadata.toolsUsed) {
        conversation.metadata.toolsUsed = [];
      }
      
      if (!conversation.metadata.toolsUsed.includes(toolId)) {
        conversation.metadata.toolsUsed.push(toolId);
      }

      // Record detailed tool usage
      const toolUsage = {
        toolId,
        stepId,
        input,
        output,
        timestamp: new Date().toISOString(),
        executionTime: executionTime || 0,
      };

      if (!conversation.context.toolUsageHistory) {
        conversation.context.toolUsageHistory = [];
      }
      conversation.context.toolUsageHistory.push(toolUsage);

      await AgentConversationOperations.updateConversation(conversation);
    } catch (error) {
      console.error("Failed to record tool usage:", error);
      throw error;
    }
  }

  /**
   * Get tool usage statistics for a conversation
   */
  static async getToolUsageStats(conversationId: string): Promise<{
    totalToolCalls: number;
    toolsUsed: string[];
    executionTimeByTool: Record<string, number>;
    mostUsedTool?: string;
  }> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const toolHistory = conversation.context.toolUsageHistory || [];
      const toolsUsed = conversation.metadata.toolsUsed || [];
      
      const executionTimeByTool: Record<string, number> = {};
      const toolCallCounts: Record<string, number> = {};

      toolHistory.forEach((usage: any) => {
        if (!executionTimeByTool[usage.toolId]) {
          executionTimeByTool[usage.toolId] = 0;
        }
        if (!toolCallCounts[usage.toolId]) {
          toolCallCounts[usage.toolId] = 0;
        }
        
        executionTimeByTool[usage.toolId] += usage.executionTime || 0;
        toolCallCounts[usage.toolId]++;
      });

      const mostUsedTool = Object.keys(toolCallCounts).reduce((a, b) => 
        toolCallCounts[a] > toolCallCounts[b] ? a : b, 
      Object.keys(toolCallCounts)[0],
      );

      return {
        totalToolCalls: toolHistory.length,
        toolsUsed,
        executionTimeByTool,
        mostUsedTool,
      };
    } catch (error) {
      console.error("Failed to get tool usage stats:", error);
      throw error;
    }
  }

  /**
   * Get available tools for a conversation
   */
  static async getAvailableTools(conversationId: string): Promise<string[]> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      return conversation.availableTools || [];
    } catch (error) {
      console.error("Failed to get available tools:", error);
      throw error;
    }
  }

  /**
   * Set available tools for a conversation
   */
  static async setAvailableTools(conversationId: string, toolIds: string[]): Promise<void> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      conversation.availableTools = toolIds;
      await AgentConversationOperations.updateConversation(conversation);
    } catch (error) {
      console.error("Failed to set available tools:", error);
      throw error;
    }
  }

  /**
   * Clear tool usage history for a conversation
   */
  static async clearToolHistory(conversationId: string): Promise<void> {
    try {
      const conversation = await AgentConversationOperations.getConversationById(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      conversation.context.toolUsageHistory = [];
      conversation.metadata.toolsUsed = [];
      await AgentConversationOperations.updateConversation(conversation);
    } catch (error) {
      console.error("Failed to clear tool history:", error);
      throw error;
    }
  }

  /**
   * Get tool performance metrics across all conversations
   */
  static async getGlobalToolMetrics(): Promise<{
    toolUsageFrequency: Record<string, number>;
    averageExecutionTime: Record<string, number>;
    successRates: Record<string, number>;
    totalConversationsUsingTools: number;
  }> {
    try {
      const conversations = await AgentConversationOperations.getAllConversations();
      
      const toolUsageFrequency: Record<string, number> = {};
      const totalExecutionTime: Record<string, number> = {};
      const toolCallCounts: Record<string, number> = {};
      const toolSuccesses: Record<string, number> = {};
      let conversationsWithTools = 0;

      conversations.forEach(conversation => {
        const toolHistory = conversation.context.toolUsageHistory || [];
        if (toolHistory.length > 0) {
          conversationsWithTools++;
        }

        toolHistory.forEach((usage: any) => {
          const toolId = usage.toolId;
          
          if (!toolUsageFrequency[toolId]) {
            toolUsageFrequency[toolId] = 0;
            totalExecutionTime[toolId] = 0;
            toolCallCounts[toolId] = 0;
            toolSuccesses[toolId] = 0;
          }
          
          toolUsageFrequency[toolId]++;
          totalExecutionTime[toolId] += usage.executionTime || 0;
          toolCallCounts[toolId]++;
          
          // Consider a tool call successful if it has output
          if (usage.output) {
            toolSuccesses[toolId]++;
          }
        });
      });

      const averageExecutionTime: Record<string, number> = {};
      const successRates: Record<string, number> = {};

      Object.keys(toolCallCounts).forEach(toolId => {
        averageExecutionTime[toolId] = totalExecutionTime[toolId] / toolCallCounts[toolId];
        successRates[toolId] = (toolSuccesses[toolId] / toolCallCounts[toolId]) * 100;
      });

      return {
        toolUsageFrequency,
        averageExecutionTime,
        successRates,
        totalConversationsUsingTools: conversationsWithTools,
      };
    } catch (error) {
      console.error("Failed to get global tool metrics:", error);
      throw error;
    }
  }
} 
