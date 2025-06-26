import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { MemoryNodeTools } from "./MemoryNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class MemoryStorageNode extends NodeBase {
  static readonly nodeName = "memoryStorage";
  static readonly description = "Extract and store new memories from conversation asynchronously";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(MemoryNodeTools);
    super(config);
    this.toolClass = MemoryNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.AFTER;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const characterId = input.characterId;
    const userInput = input.userInput || "";
    const fullResponse = input.fullResponse || input.replacedText || "";
    const conversationContext = input.conversationContext || "";
    const apiKey = input.apiKey;
    const baseUrl = input.baseUrl;
    const language = input.language || "zh";
    const enableMemoryStorage = input.enableMemoryStorage !== false; // Default to true

    // Pass through all input data first (for immediate response)
    const outputData = {
      replacedText: input.replacedText,
      screenContent: input.screenContent,
      fullResponse: input.fullResponse,
      nextPrompts: input.nextPrompts,
      event: input.event,
      presetId: input.presetId,
      memoryStorageResult: null as any,
      characterId,
      userInput,
      language,
    };

    // Early return if memory storage is disabled
    if (!enableMemoryStorage) {
      console.log("Memory storage disabled, skipping...");
      outputData.memoryStorageResult = { 
        success: true, 
        message: "Memory storage disabled",
        extractedCount: 0, 
      };
      return outputData;
    }

    // Validate required inputs
    if (!characterId || !apiKey || !userInput || !fullResponse) {
      const error = !characterId ? "Character ID required" : 
        !apiKey ? "API key required" : 
          "Insufficient conversation data";
      
      console.warn(`Memory storage validation failed: ${error}`);
      outputData.memoryStorageResult = { 
        success: false, 
        error,
        extractedCount: 0, 
      };
      return outputData;
    }

    try {
      console.log("Starting memory extraction and storage...");
      
      // Extract and store memories using the tool
      const extractionResult = await this.executeTool(
        "extractAndStoreMemories",
        characterId,
        userInput,
        fullResponse,
        conversationContext,
        apiKey,
        baseUrl,
        language,
      ) as {
        success: boolean;
        extractedCount: number;
        extractedMemories?: any[];
        confidence?: number;
        reasoning?: string;
        error?: string;
      };

      outputData.memoryStorageResult = extractionResult;

      console.log(`Memory storage completed: ${extractionResult.extractedCount} memories extracted`);

    } catch (error) {
      console.error("Memory storage failed:", error);
      
      // Don't fail the entire workflow if memory storage fails
      outputData.memoryStorageResult = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        extractedCount: 0,
      };
    }

    return outputData;
  }
} 
