import { 
  AgentConversation, 
  AgentStep, 
  AgentMessage, 
  AgentTaskStatus, 
  AgentCapability,
  AgentExecutionContext,
  AgentTool,
} from "@/lib/models/agent-model";
import { 
  AgentConversationOperations, 
  AgentToolOperations, 
} from "@/lib/data/agent-operation";
import { 
  AgentToolRegistry, 
  registerAllTools, 
} from "@/lib/core/agent-tools";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { v4 as uuidv4 } from "uuid";

/**
 * Agent Decision - represents what the agent decides to do next
 */
interface AgentDecision {
  action: "use_tool" | "ask_user" | "complete_task" | "request_clarification";
  toolId?: string;
  toolInput?: any;
  message?: string;
  reasoning?: string;
  isComplete?: boolean;
  result?: any;
}

/**
 * Agent Execution Engine - Flexible, model-driven workflow
 */
export class AgentEngine {
  private context: AgentExecutionContext;
  private conversationId: string;
  private maxIterations: number = 15;

  constructor(conversationId: string, llmConfig: {
    modelName: string;
    apiKey: string;
    baseUrl?: string;
    llmType: "openai" | "ollama";
    temperature?: number;
  }) {
    this.conversationId = conversationId;
    this.context = {
      conversationId,
      currentStepIndex: 0,
      workingMemory: {},
      availableTools: [],
      constraints: {
        maxTokens: 8192,
        timeoutMs: 300000, // 5 minutes
        maxSteps: this.maxIterations,
      },
      llmConfig,
    };
  }

  /**
   * Initialize the engine and prepare tools
   */
  async initialize(): Promise<void> {
    // Register all available tools
    registerAllTools();
    
    // Load available tools for this conversation
    const toolIds = await AgentToolOperations.getAvailableTools(this.conversationId);
    this.context.availableTools = toolIds.map(id => AgentToolRegistry.get(id)).filter(Boolean) as AgentTool[];
    
    // If no tools are configured, use default set
    if (this.context.availableTools.length === 0) {
      const defaultTools = [
        "analyze_requirements",
        "ask_user", 
        "search_info",
        "plan_generation",
        "generate_content",
        "validate_content",
        "refine_content",
      ];
      
      await AgentToolOperations.setAvailableTools(this.conversationId, defaultTools);
      this.context.availableTools = defaultTools.map(id => AgentToolRegistry.get(id)).filter(Boolean) as AgentTool[];
    }
  }

  /**
   * Execute a flexible, AI-driven workflow
   */
  async executeWorkflow(userInput: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    needsUserInput?: boolean;
    message?: string;
    stepsExecuted: AgentStep[];
  }> {
    try {
      await this.initialize();
      
      // Update conversation status
      await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.IN_PROGRESS);
      
      // Add user input message
      await AgentConversationOperations.addMessage(this.conversationId, {
        role: "user",
        content: userInput,
        messageType: "task_request",
      });

      // Clear previous steps
      await AgentConversationOperations.clearCurrentSteps(this.conversationId);
      
      // Initialize working memory with user input
      this.context.workingMemory.userInput = userInput;
      this.context.workingMemory.conversationHistory = await AgentConversationOperations.getConversationHistory(this.conversationId);
      
      const stepsExecuted: AgentStep[] = [];
      let currentIteration = 0;

      // Start with initial analysis
      const initialAnalysis = await this.executeStep(AgentCapability.ANALYZE, {
        userInput,
        conversationHistory: this.context.workingMemory.conversationHistory,
      });
      stepsExecuted.push(initialAnalysis);

      // Main decision loop - let AI decide what to do next
      while (currentIteration < this.maxIterations) {
        currentIteration++;
        
        // Get AI decision on next action
        const decision = await this.getNextDecision();
        
        // Execute the decision
        const result = await this.executeDecision(decision, stepsExecuted);
        
        if (result.shouldStop) {
          break;
        }
      }

      // Check if we have a complete result
      const finalResult = this.context.workingMemory.finalOutput;
      
      if (finalResult) {
        // Update conversation with final output
        await AgentConversationOperations.updateOutput(this.conversationId, finalResult);
        
        await AgentConversationOperations.addMessage(this.conversationId, {
          role: "agent",
          content: "Character and worldbook generation completed successfully!",
          messageType: "task_result",
          metadata: {
            attachments: [finalResult],
          },
        });

        return {
          success: true,
          result: finalResult,
          needsUserInput: false,
          message: "Generation completed successfully!",
          stepsExecuted,
        };
      } else {
        // Check if we're waiting for user input
        const isWaitingForUser = stepsExecuted.some(step => 
          step.capability === AgentCapability.ASK && step.output?.waitingForResponse,
        );

        if (isWaitingForUser) {
          await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.WAITING_FOR_USER);
          
          const askStep = stepsExecuted.find(step => 
            step.capability === AgentCapability.ASK && step.output?.waitingForResponse,
          );

          return {
            success: true,
            result: askStep?.output,
            needsUserInput: true,
            message: askStep?.output?.formattedQuestions || "I need more information from you.",
            stepsExecuted,
          };
        }

        // If we reach max iterations without completion
        await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.FAILED);
        
        return {
          success: false,
          error: "Maximum iterations reached without completion",
          stepsExecuted,
        };
      }
      
    } catch (error) {
      console.error("Workflow execution failed:", error);
      
      await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.FAILED);
      
      await AgentConversationOperations.addMessage(this.conversationId, {
        role: "agent",
        content: `Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        messageType: "task_result",
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stepsExecuted: [],
      };
    }
  }

  /**
   * Continue workflow after user response - also AI-driven
   */
  async continueWorkflow(userResponse: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    needsUserInput?: boolean;
    message?: string;
    stepsExecuted: AgentStep[];
  }> {
    try {
      await this.initialize();
      
      // Add user response message
      await AgentConversationOperations.addMessage(this.conversationId, {
        role: "user",
        content: userResponse,
        messageType: "user_response",
      });
      
      // Update conversation status
      await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.IN_PROGRESS);
      
      // Update working memory with user response
      this.context.workingMemory.userResponse = userResponse;
      this.context.workingMemory.conversationHistory = await AgentConversationOperations.getConversationHistory(this.conversationId);
      
      const stepsExecuted: AgentStep[] = [];
      let currentIteration = 0;

      // Continue with AI-driven decisions
      while (currentIteration < this.maxIterations) {
        currentIteration++;
        
        const decision = await this.getNextDecision();
        const result = await this.executeDecision(decision, stepsExecuted);
        
        if (result.shouldStop) {
          break;
        }
      }

      // Handle completion or continuation logic (same as executeWorkflow)
      const finalResult = this.context.workingMemory.finalOutput;
      
      if (finalResult) {
        await AgentConversationOperations.updateOutput(this.conversationId, finalResult);
        
        await AgentConversationOperations.addMessage(this.conversationId, {
          role: "agent",
          content: "Character and worldbook generation completed successfully!",
          messageType: "task_result",
          metadata: {
            attachments: [finalResult],
          },
        });

        return {
          success: true,
          result: finalResult,
          needsUserInput: false,
          message: "Generation completed successfully!",
          stepsExecuted,
        };
      } else {
        const isWaitingForUser = stepsExecuted.some(step => 
          step.capability === AgentCapability.ASK && step.output?.waitingForResponse,
        );

        if (isWaitingForUser) {
          await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.WAITING_FOR_USER);
          
          const askStep = stepsExecuted.find(step => 
            step.capability === AgentCapability.ASK && step.output?.waitingForResponse,
          );

          return {
            success: true,
            result: askStep?.output,
            needsUserInput: true,
            message: askStep?.output?.formattedQuestions || "I need more information from you.",
            stepsExecuted,
          };
        }

        return {
          success: false,
          error: "Workflow continuation failed to complete",
          stepsExecuted,
        };
      }
      
    } catch (error) {
      console.error("Workflow continuation failed:", error);
      
      await AgentConversationOperations.updateStatus(this.conversationId, AgentTaskStatus.FAILED);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stepsExecuted: [],
      };
    }
  }

  /**
   * Use AI to decide what to do next based on current state
   */
  private async getNextDecision(): Promise<AgentDecision> {
    const llm = await this.getLLM();
    
    const availableToolsInfo = this.context.availableTools.map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      capabilities: tool.capabilities,
    }));

    const systemPrompt = `You are an intelligent agent that generates character cards and worldbooks. You have access to various tools and must decide what to do next based on the current situation.

Available tools:
${JSON.stringify(availableToolsInfo, null, 2)}

Current working memory (what you know so far):
${JSON.stringify(this.context.workingMemory, null, 2)}

Based on the current situation, decide what to do next. You can:
1. use_tool - Use one of the available tools
2. ask_user - Ask the user for more information
3. complete_task - Mark the task as complete if you have generated both character and worldbook
4. request_clarification - Ask for clarification if something is unclear

Respond with a JSON object containing:
- action: one of the actions above
- toolId: if using a tool, specify which one
- toolInput: if using a tool, specify the input parameters
- message: a message to explain your decision
- reasoning: your reasoning for this decision
- isComplete: true if the task is complete (character + worldbook generated)
- result: if completing, provide the final result

Focus on creating both a character card AND worldbook entries that work together seamlessly.`;

    const userPrompt = `What should I do next to help complete this character and worldbook generation task?

Current status: ${this.getCurrentStatus()}

Make your decision and respond with the appropriate JSON.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    const response = await chain.invoke({});

    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback decision if JSON parsing fails
      console.warn("Failed to parse AI decision, using fallback:", error);
      return {
        action: "complete_task",
        message: "Unable to parse decision, completing with available data",
        reasoning: "JSON parsing failed",
        isComplete: true,
      };
    }
  }

  /**
   * Execute the AI's decision
   */
  private async executeDecision(decision: AgentDecision, stepsExecuted: AgentStep[]): Promise<{
    shouldStop: boolean;
  }> {
    switch (decision.action) {
    case "use_tool":
      if (decision.toolId && decision.toolInput) {
        const tool = this.context.availableTools.find(t => t.id === decision.toolId);
        if (tool) {
          // Find the primary capability of this tool
          const capability = tool.capabilities[0];
          const step = await this.executeStep(capability, decision.toolInput, decision.reasoning);
          stepsExecuted.push(step);
            
          // Update working memory based on tool output
          this.updateWorkingMemoryFromTool(tool.id, step.output);
        }
      }
      break;

    case "ask_user":
      const askTool = this.context.availableTools.find(t => t.capabilities.includes(AgentCapability.ASK));
      if (askTool && decision.message) {
        const step = await this.executeStep(AgentCapability.ASK, {
          questions: [decision.message],
          context: "Need additional information",
          priority: "high",
        }, decision.reasoning);
        stepsExecuted.push(step);
        return { shouldStop: true }; // Stop and wait for user
      }
      break;

    case "complete_task":
      if (decision.isComplete && decision.result) {
        this.context.workingMemory.finalOutput = decision.result;
      } else {
        // Try to finalize with whatever we have
        this.finalizeOutput();
      }
        
      // Add completion message
      await AgentConversationOperations.addMessage(this.conversationId, {
        role: "agent",
        content: decision.message || "Task completed.",
        messageType: "task_result",
      });
        
      return { shouldStop: true };

    case "request_clarification":
      await AgentConversationOperations.addMessage(this.conversationId, {
        role: "agent",
        content: decision.message || "I need clarification to proceed.",
        messageType: "step_update",
      });
      return { shouldStop: true };
    }

    return { shouldStop: false };
  }

  /**
   * Execute a single step with a specific capability
   */
  private async executeStep(capability: AgentCapability, input: any, reasoning?: string): Promise<AgentStep> {
    const tool = this.context.availableTools.find(t => t.capabilities.includes(capability));
    
    if (!tool) {
      throw new Error(`No tool available for capability: ${capability}`);
    }
    
    const stepId = uuidv4();
    const startTime = Date.now();
    
    try {
      // Execute the tool
      const output = await tool.execute(input, this.context);
      const executionTime = Date.now() - startTime;
      
      // Create step record
      const step: AgentStep = {
        id: stepId,
        capability,
        input,
        output,
        reasoning,
        status: AgentTaskStatus.COMPLETED,
        executionOrder: this.context.currentStepIndex++,
        timestamp: new Date().toISOString(),
      };
      
      // Record tool usage
      await AgentToolOperations.recordToolUsage(
        this.conversationId,
        tool.id,
        input,
        output,
        stepId,
        executionTime,
      );
      
      // Add step to conversation
      await AgentConversationOperations.addStep(this.conversationId, step);
      
      // Add agent message for this step (unless it's ASK which handles its own messaging)
      if (capability !== AgentCapability.ASK) {
        await AgentConversationOperations.addMessage(this.conversationId, {
          role: "agent",
          content: this.formatStepMessage(capability, output),
          messageType: "step_update",
          metadata: {
            capability,
            stepId,
            reasoning,
          },
        });
      }
      
      return step;
      
    } catch (error) {
      const step: AgentStep = {
        id: stepId,
        capability,
        input,
        output: null,
        reasoning,
        status: AgentTaskStatus.FAILED,
        executionOrder: this.context.currentStepIndex++,
        timestamp: new Date().toISOString(),
      };
      
      await AgentConversationOperations.addStep(this.conversationId, step);
      throw error;
    }
  }

  /**
   * Get LLM instance
   */
  private async getLLM() {
    if (!this.context.llmConfig) {
      throw new Error("LLM configuration not found in context");
    }

    const { modelName, apiKey, baseUrl, llmType, temperature = 0.7 } = this.context.llmConfig;

    if (llmType === "openai") {
      return new ChatOpenAI({
        modelName,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl,
        },
        temperature,
        streaming: false,
      });
    } else if (llmType === "ollama") {
      return new ChatOllama({
        model: modelName,
        baseUrl: baseUrl || "http://localhost:11434",
        temperature,
        streaming: false,
      });
    }

    throw new Error(`Unsupported LLM type: ${llmType}`);
  }

  /**
   * Get current status summary
   */
  private getCurrentStatus(): string {
    const memory = this.context.workingMemory;
    let status = "Starting character and worldbook generation.\n";
    
    if (memory.requirements) status += "✓ Requirements analyzed\n";
    if (memory.inspiration) status += "✓ Inspiration gathered\n";
    if (memory.plan) status += "✓ Generation plan created\n";
    if (memory.generatedContent) status += "✓ Content generated\n";
    if (memory.validation) status += "✓ Content validated\n";
    if (memory.finalOutput) status += "✓ Task completed\n";
    
    return status;
  }

  /**
   * Update working memory based on tool output
   */
  private updateWorkingMemoryFromTool(toolId: string, output: any): void {
    switch (toolId) {
    case "analyze_requirements":
      this.context.workingMemory.requirements = output;
      break;
    case "search_info":
      this.context.workingMemory.inspiration = output;
      break;
    case "plan_generation":
      this.context.workingMemory.plan = output;
      break;
    case "generate_content":
      this.context.workingMemory.generatedContent = output;
      break;
    case "validate_content":
      this.context.workingMemory.validation = output;
      break;
    case "refine_content":
      this.context.workingMemory.generatedContent = output.refinedContent;
      break;
    }
  }

  /**
   * Try to finalize output with whatever data we have
   */
  private finalizeOutput(): void {
    const memory = this.context.workingMemory;
    
    if (memory.generatedContent) {
      this.context.workingMemory.finalOutput = memory.generatedContent;
    } else {
      // Create minimal output structure
      this.context.workingMemory.finalOutput = {
        characterData: memory.requirements?.characterRequirements || {},
        worldbookData: memory.requirements?.worldbookRequirements || [],
        combinedData: {
          status: "incomplete",
          availableData: Object.keys(memory),
        },
      };
    }
  }

  /**
   * Format step output into human-readable message
   */
  private formatStepMessage(capability: AgentCapability, output: any): string {
    switch (capability) {
    case AgentCapability.ANALYZE:
      return `I've analyzed your request. ${output?.analysis || "Analysis completed."}`;
    case AgentCapability.SEARCH:
      return "I've found some great inspiration and references for your character and world.";
    case AgentCapability.PLAN:
      return "I've created a detailed plan for generating your character and worldbook.";
    case AgentCapability.OUTPUT:
      return "I've generated your character card and worldbook entries.";
    case AgentCapability.VALIDATE:
      const score = output?.qualityScore || 0;
      return `I've validated the content. Quality score: ${score}/100`;
    case AgentCapability.REFINE:
      return "I've refined and improved the content based on validation feedback.";
    default:
      return "Step completed.";
    }
  }

  /**
   * Get current execution context
   */
  getContext(): AgentExecutionContext {
    return { ...this.context };
  }

  /**
   * Get working memory
   */
  getWorkingMemory(): Record<string, any> {
    return { ...this.context.workingMemory };
  }
}
