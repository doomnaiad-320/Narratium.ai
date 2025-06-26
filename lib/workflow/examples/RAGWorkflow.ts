import { BaseWorkflow, WorkflowConfig } from "@/lib/workflow/BaseWorkflow";
import { NodeCategory } from "@/lib/nodeflow/types";
import { UserInputNode } from "@/lib/nodeflow/UserInputNode/UserInputNode";
import { PresetNode } from "@/lib/nodeflow/PresetNode/PresetNode";
import { ContextNode } from "@/lib/nodeflow/ContextNode/ContextNode";
import { MemoryRetrievalNode } from "@/lib/nodeflow/MemoryNode/MemoryRetrievalNode";
import { WorldBookNode } from "@/lib/nodeflow/WorldBookNode/WorldBookNode";
import { LLMNode } from "@/lib/nodeflow/LLMNode/LLMNode";
import { RegexNode } from "@/lib/nodeflow/RegexNode/RegexNode";
import { OutputNode } from "@/lib/nodeflow/OutputNode/OutputNode";
import { MemoryStorageNode } from "@/lib/nodeflow/MemoryNode/MemoryStorageNode";

/**
 * CorrectRAGWorkflow - Enhanced execution architecture with AFTER nodes
 * 
 * Execution Flow:
 * 1. ENTRY -> MIDDLE nodes execute sequentially (userInput -> preset -> context -> memoryRetrieval -> worldBook -> llm -> regex)
 * 2. EXIT node (output) executes and workflow returns immediately to user
 * 3. AFTER nodes (memoryStorage) execute in background asynchronously
 * 
 * Benefits:
 * - User receives immediate response after output node
 * - Memory storage happens asynchronously without blocking user experience
 * - Maintains data consistency while improving response time
 * 
 * Usage:
 * ```typescript
 * const result = await workflowEngine.execute(params, context, {
 *   executeAfterNodes: true,  // Execute memory storage in background (default: true)
 *   awaitAfterNodes: false    // Don't wait for memory storage (default: false)
 * });
 * // User receives result immediately while memory storage continues in background
 * ```
 */

export interface CorrectRAGWorkflowParams {
  characterId: string;
  userInput: string;
  number?: number;
  language?: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType?: "openai" | "ollama";
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  fastModel?: boolean;
  // Memory-specific parameters
  maxMemories?: number;
  enableMemoryStorage?: boolean;
}

export class CorrectRAGWorkflow extends BaseWorkflow {
  protected getNodeRegistry() {
    return {
      "userInput": {
        nodeClass: UserInputNode,
      },
      "preset": {
        nodeClass: PresetNode,
      },
      "context": {
        nodeClass: ContextNode,
      },
      "memoryRetrieval": {
        nodeClass: MemoryRetrievalNode,
      },
      "worldBook": {
        nodeClass: WorldBookNode,
      },
      "llm": {
        nodeClass: LLMNode,
      },
      "regex": {
        nodeClass: RegexNode,
      },
      "output": {
        nodeClass: OutputNode,
      },
      "memoryStorage": {
        nodeClass: MemoryStorageNode,
      },
    };
  }

  protected getWorkflowConfig(): WorkflowConfig {
    return {
      id: "correct-rag-workflow",
      name: "Correct RAG Workflow - Early return with background AFTER nodes",
      nodes: [
        {
          id: "user-input-1",
          name: "userInput",
          category: NodeCategory.ENTRY,
          next: ["preset-1"],
          initParams: [
            "characterId", 
            "userInput", 
            "number", 
            "language", 
            "username", 
            "modelName", 
            "apiKey", 
            "baseUrl", 
            "llmType", 
            "temperature", 
            "fastModel",
            "maxMemories",
            "enableMemoryStorage",
          ],
          inputFields: [],
          outputFields: [
            "characterId", 
            "userInput", 
            "number", 
            "language", 
            "username", 
            "modelName", 
            "apiKey", 
            "baseUrl", 
            "llmType", 
            "temperature", 
            "fastModel",
            "maxMemories",
            "enableMemoryStorage",
          ],
        },
        {
          id: "preset-1",
          name: "preset",
          category: NodeCategory.MIDDLE,
          next: ["context-1"],
          initParams: [],
          inputFields: ["characterId", "language", "username", "number", "fastModel"],
          outputFields: ["systemMessage", "userMessage", "presetId"],
        },
        {
          id: "context-1",
          name: "context",
          category: NodeCategory.MIDDLE,
          next: ["memory-retrieval-1"],
          initParams: [],
          inputFields: ["userMessage", "characterId", "userInput"],
          outputFields: ["userMessage", "conversationContext"],
        },
        {
          id: "memory-retrieval-1",
          name: "memoryRetrieval",
          category: NodeCategory.MIDDLE,
          next: ["world-book-1"],
          initParams: [],
          inputFields: ["characterId", "userInput", "systemMessage", "apiKey", "baseUrl", "language", "maxMemories", "username"],
          outputFields: ["systemMessage", "memoryPrompt"],
        },
        {
          id: "world-book-1",
          name: "worldBook",
          category: NodeCategory.MIDDLE,
          next: ["llm-1"],
          initParams: [],
          inputFields: ["systemMessage", "userMessage", "characterId", "language", "username", "userInput"],
          outputFields: ["systemMessage", "userMessage"],
          inputMapping: {
            "userInput": "currentUserInput",
          },
        },
        {
          id: "llm-1",
          name: "llm",
          category: NodeCategory.MIDDLE,
          next: ["regex-1"],
          initParams: [],
          inputFields: ["systemMessage", "userMessage", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "language"],
          outputFields: ["llmResponse"],
        },
        {
          id: "regex-1",
          name: "regex",
          category: NodeCategory.MIDDLE,
          next: ["output-1"],
          initParams: [],
          inputFields: ["llmResponse", "characterId"],
          outputFields: ["replacedText", "screenContent", "fullResponse", "nextPrompts", "event"], // 只输出处理后的内容
        },
        {
          id: "output-1",
          name: "output",
          category: NodeCategory.EXIT, // EXIT: Workflow returns immediately after this node
          next: [], // No next nodes - workflow completes here for user response
          initParams: [],
          inputFields: [
            "replacedText", 
            "screenContent", 
            "fullResponse", 
            "nextPrompts", 
            "event", 
            "presetId",
          ],
          outputFields: [
            "replacedText", 
            "screenContent", 
            "fullResponse", 
            "nextPrompts", 
            "event", 
            "presetId",
          ], // User receives immediate response with these fields
        },
        {
          id: "memory-storage-1",
          name: "memoryStorage",
          category: NodeCategory.AFTER, // AFTER: Executes in background after EXIT nodes complete
          next: [], // Terminal node in background execution
          initParams: [],
          inputFields: [
            // AFTER nodes have access to all data from the main workflow context
            "characterId",
            "userInput",
            "fullResponse",
            "conversationContext",
            "apiKey",
            "baseUrl",
            "language",
            "enableMemoryStorage",
            "replacedText",
            "screenContent", 
            "nextPrompts",
            "event",
            "presetId",
          ],
          outputFields: [
            // AFTER nodes don't need to output data since user already received response
          ],
        },
      ],
    };
  }
} 
