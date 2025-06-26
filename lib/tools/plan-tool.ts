import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseTool } from "./base-tool";
import { ToolType, ToolExecutionContext, ToolExecutionResult, PlanTask } from "@/lib/models/agent-model";
import { PlanPoolOperations } from "@/lib/data/agent/plan-pool-operations";
import { ThoughtBufferOperations } from "@/lib/data/agent/thought-buffer-operations";

/**
 * Plan Tool - Core planning and replanning functionality
 * This tool is called at the beginning and when replanning is needed
 */
export class PlanTool extends BaseTool {
  readonly toolType = ToolType.PLAN;
  readonly name = "Plan Manager";
  readonly description = "Create initial plans and update execution strategy based on current progress";

  async executeTask(task: PlanTask, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const planType = task.parameters.type || "initial";
    
    if (planType === "initial") {
      return await this.createInitialPlan(task, context);
    } else if (planType === "replan") {
      return await this.updatePlan(task, context);
    } else if (planType === "evaluate") {
      return await this.evaluateProgress(task, context);
    }

    return {
      success: false,
      error: "Unknown plan type",
      should_continue: true,
    };
  }

  /**
   * Create the initial execution plan
   */
  private async createInitialPlan(task: PlanTask, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    await this.addThought(
      context.conversation_id,
      "reasoning",
      "Creating initial execution plan based on user request",
      task.id,
    );

    try {
      const planData = await this.generatePlanWithLLM(context, "initial");
      
      // Create goal tree
      for (const goal of planData.goals || []) {
        await PlanPoolOperations.addGoal(context.conversation_id, {
          description: goal.description,
          type: goal.type,
          parent_id: goal.parent_id,
          children: [],
          status: "pending",
          metadata: goal.metadata || {},
        });
      }
      
      // Create initial tasks
      for (const taskData of planData.tasks || []) {
        await PlanPoolOperations.addTask(context.conversation_id, {
          description: taskData.description,
          tool: taskData.tool,
          parameters: taskData.parameters || {},
          dependencies: taskData.dependencies || [],
          status: "pending",
          reasoning: taskData.reasoning,
          priority: taskData.priority || 5,
        });
      }

      // Record planning decision
      await ThoughtBufferOperations.addDecision(context.conversation_id, {
        decision: "Created initial execution plan",
        reasoning: planData.reasoning || "Initial planning completed based on user request",
        alternatives_considered: planData.alternatives || [],
        confidence: planData.confidence || 0.8,
      });

      await this.addMessage(
        context.conversation_id,
        "agent",
        `📋 **Initial Plan Created**\n\n**Goals:** ${planData.goals?.length || 0}\n**Tasks:** ${planData.tasks?.length || 0}\n\n${planData.reasoning}`,
        "agent_thinking",
      );

      return {
        success: true,
        result: {
          plan_type: "initial",
          goals_created: planData.goals?.length || 0,
          tasks_created: planData.tasks?.length || 0,
          reasoning: planData.reasoning,
        },
        should_continue: true,
      };

    } catch (error) {
      console.error("Initial planning failed:", error);
      
      // Create fallback plan
      await this.createFallbackPlan(context);
      
      return {
        success: true,
        result: { plan_type: "fallback" },
        should_continue: true,
      };
    }
  }

  /**
   * Update the current plan based on progress
   */
  private async updatePlan(task: PlanTask, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    await this.addThought(
      context.conversation_id,
      "reasoning",
      "Evaluating current progress and updating execution plan",
      task.id,
    );

    try {
      const planUpdate = await this.generatePlanWithLLM(context, "replan");
      
      // Add new tasks if any
      for (const taskData of planUpdate.new_tasks || []) {
        await PlanPoolOperations.addTask(context.conversation_id, {
          description: taskData.description,
          tool: taskData.tool,
          parameters: taskData.parameters || {},
          dependencies: taskData.dependencies || [],
          status: "pending",
          reasoning: taskData.reasoning,
          priority: taskData.priority || 5,
        });
      }

      // Update plan context
      if (planUpdate.context_updates) {
        await PlanPoolOperations.updatePlanContext(context.conversation_id, planUpdate.context_updates);
      }

      // Record replanning decision
      await ThoughtBufferOperations.addDecision(context.conversation_id, {
        decision: "Updated execution plan",
        reasoning: planUpdate.reasoning || "Plan updated based on current progress",
        alternatives_considered: planUpdate.alternatives || [],
        confidence: planUpdate.confidence || 0.7,
      });

      await this.addMessage(
        context.conversation_id,
        "agent",
        `🔄 **Plan Updated**\n\n**New Tasks:** ${planUpdate.new_tasks?.length || 0}\n\n${planUpdate.reasoning}`,
        "agent_thinking",
      );

      return {
        success: true,
        result: {
          plan_type: "update",
          new_tasks: planUpdate.new_tasks?.length || 0,
          reasoning: planUpdate.reasoning,
        },
        should_continue: true,
      };

    } catch (error) {
      console.error("Plan update failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Plan update failed",
        should_continue: true,
      };
    }
  }

  /**
   * Evaluate current progress and determine next steps
   */
  private async evaluateProgress(task: PlanTask, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    await this.addThought(
      context.conversation_id,
      "reasoning",
      "Evaluating current progress to determine completion status",
      task.id,
    );

    const hasCharacterData = !!context.current_result.character_data;
    const hasWorldbookData = !!context.current_result.worldbook_data && context.current_result.worldbook_data.length > 0;
    const completedTasks = context.plan_pool.completed_tasks.length;
    const pendingTasks = context.plan_pool.current_tasks.filter(t => t.status === "pending").length;

    const evaluationResult = {
      character_completed: hasCharacterData,
      worldbook_completed: hasWorldbookData,
      completed_tasks: completedTasks,
      pending_tasks: pendingTasks,
      overall_progress: completedTasks / (completedTasks + pendingTasks) * 100,
      is_complete: hasCharacterData && hasWorldbookData,
      next_action: this.determineNextAction(hasCharacterData, hasWorldbookData, pendingTasks),
    };

    await this.addMessage(
      context.conversation_id,
      "agent",
      `📊 **Progress Evaluation**\n\n✅ Character: ${hasCharacterData ? "Complete" : "Pending"}\n✅ Worldbook: ${hasWorldbookData ? "Complete" : "Pending"}\n📈 Progress: ${evaluationResult.overall_progress.toFixed(1)}%\n🎯 Next: ${evaluationResult.next_action}`,
      "agent_thinking",
    );

    return {
      success: true,
      result: evaluationResult,
      should_continue: !evaluationResult.is_complete,
    };
  }

  /**
   * Generate plan using LLM
   */
  private async generatePlanWithLLM(context: ToolExecutionContext, type: "initial" | "replan"): Promise<any> {
    const llm = this.createLLM(context.llm_config);
    
    const prompt = type === "initial" 
      ? this.createInitialPlanningPrompt(context)
      : this.createReplanningPrompt(context);
    
    const response = await prompt.pipe(llm).pipe(new StringOutputParser()).invoke({});
    return JSON.parse(response);
  }

  /**
   * Create initial planning prompt
   */
  private createInitialPlanningPrompt(context: ToolExecutionContext) {
    const availableTools = ["ASK_USER", "SEARCH", "OUTPUT", "UPDATE_PLAN"];
    const toolsDescription = availableTools.map(tool => {
      switch (tool) {
      case "ASK_USER": return "- ASK_USER: Ask user for additional information or clarification";
      case "SEARCH": return "- SEARCH: Search for inspiration, references, and creative ideas";
      case "OUTPUT": return "- OUTPUT: Generate character data and worldbook entries";
      case "UPDATE_PLAN": return "- UPDATE_PLAN: Update the current execution plan";
      default: return `- ${tool}: Unknown tool`;
      }
    }).join("\n");

    const systemPrompt = `You are an intelligent planning agent for character and worldbook generation. Create a detailed execution plan.

Available tools:
${toolsDescription}

Create a plan with goals and tasks. Respond in JSON format:
{
  "reasoning": "Your reasoning for this plan",
  "confidence": 0.8,
  "goals": [
    {
      "description": "Goal description",
      "type": "main_goal|sub_goal",
      "parent_id": "parent_goal_id_if_any",
      "metadata": {}
    }
  ],
  "tasks": [
    {
      "description": "Task description", 
      "tool": "TOOL_NAME",
      "parameters": {"type": "specific_type"},
      "dependencies": [],
      "priority": 1-10,
      "reasoning": "Why this task is needed"
    }
  ],
  "alternatives": ["Alternative approaches considered"]
}`;

    return ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: ${context.plan_pool.context.user_request}

Create an initial plan to generate a character and worldbook. Focus on:
1. Understanding user requirements first
2. Gathering inspiration and references
3. Generating character data
4. Creating worldbook entries

Make the plan comprehensive but efficient.`],
    ]);
  }

  /**
   * Create replanning prompt
   */
  private createReplanningPrompt(context: ToolExecutionContext) {
    const availableTools = ["ASK_USER", "SEARCH", "OUTPUT", "UPDATE_PLAN"];
    const toolsDescription = availableTools.map(tool => {
      switch (tool) {
      case "ASK_USER": return "- ASK_USER: Ask user for additional information or clarification";
      case "SEARCH": return "- SEARCH: Search for inspiration, references, and creative ideas";
      case "OUTPUT": return "- OUTPUT: Generate character data and worldbook entries";
      case "UPDATE_PLAN": return "- UPDATE_PLAN: Update the current execution plan";
      default: return `- ${tool}: Unknown tool`;
      }
    }).join("\n");

    const systemPrompt = `You are updating an existing plan based on current progress. Analyze what has been completed and what still needs to be done.

Available tools:
${toolsDescription}

Current state:
- Completed tasks: ${context.plan_pool.completed_tasks.length}
- Current tasks: ${context.plan_pool.current_tasks.length}
- Character data: ${context.current_result.character_data ? "Generated" : "Not generated"}
- Worldbook data: ${context.current_result.worldbook_data ? "Generated" : "Not generated"}

Respond in JSON format:
{
  "reasoning": "Why these updates are needed",
  "confidence": 0.7,
  "new_tasks": [
    {
      "description": "New task description",
      "tool": "TOOL_NAME", 
      "parameters": {"type": "specific_type"},
      "dependencies": [],
      "priority": 1-10,
      "reasoning": "Why this task is needed"
    }
  ],
  "context_updates": {
    "current_focus": "What to focus on next"
  },
  "alternatives": ["Alternative approaches considered"]
}`;

    return ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `Current plan status:
Completed: ${JSON.stringify(context.plan_pool.completed_tasks.map(t => t.description))}
Pending: ${JSON.stringify(context.plan_pool.current_tasks.map(t => t.description))}
Current focus: ${context.plan_pool.context.current_focus}

What should be done next to complete the character and worldbook generation?`],
    ]);
  }

  /**
   * Create fallback plan when LLM planning fails
   */
  private async createFallbackPlan(context: ToolExecutionContext): Promise<void> {
    const basicTasks = [
      {
        description: "Gather user requirements and preferences",
        tool: ToolType.ASK_USER,
        parameters: { type: "requirements_gathering" },
        dependencies: [],
        status: "pending" as const,
        priority: 10,
        reasoning: "Need to understand user requirements",
      },
      {
        description: "Search for creative inspiration",
        tool: ToolType.SEARCH,
        parameters: { type: "inspiration" },
        dependencies: [],
        status: "pending" as const,
        priority: 8,
        reasoning: "Gather creative inspiration",
      },
      {
        description: "Generate character data",
        tool: ToolType.OUTPUT,
        parameters: { type: "character" },
        dependencies: [],
        status: "pending" as const,
        priority: 6,
        reasoning: "Create the character",
      },
      {
        description: "Generate worldbook entries",
        tool: ToolType.OUTPUT,
        parameters: { type: "worldbook" },
        dependencies: [],
        status: "pending" as const,
        priority: 5,
        reasoning: "Create the worldbook",
      },
    ];

    for (const task of basicTasks) {
      await PlanPoolOperations.addTask(context.conversation_id, task);
    }
  }

  /**
   * Determine next action based on current state
   */
  private determineNextAction(hasCharacter: boolean, hasWorldbook: boolean, pendingTasks: number): string {
    if (!hasCharacter && !hasWorldbook) {
      return "Start with character generation";
    } else if (hasCharacter && !hasWorldbook) {
      return "Focus on worldbook creation";
    } else if (!hasCharacter && hasWorldbook) {
      return "Complete character creation";
    } else if (pendingTasks > 0) {
      return "Complete remaining tasks";
    } else {
      return "Generation complete";
    }
  }
} 
