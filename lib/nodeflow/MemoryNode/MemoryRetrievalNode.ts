import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { MemoryNodeTools } from "./MemoryNodeTools";
import { NodeToolRegistry } from "../NodeTool";

export class MemoryRetrievalNode extends NodeBase {
  static readonly nodeName = "memoryRetrieval";
  static readonly description = "Retrieve relevant memories for current conversation context";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(MemoryNodeTools);
    super(config);
    this.toolClass = MemoryNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    const characterId = input.characterId;
    const userInput = input.userInput || "";
    const systemMessage = input.systemMessage || "";
    const apiKey = input.apiKey;
    const baseUrl = input.baseUrl;
    const language = input.language || "zh";
    const maxMemories = input.maxMemories || 5;

    if (!characterId) {
      throw new Error("Character ID is required for MemoryRetrievalNode");
    }

    if (!apiKey) {
      throw new Error("API key is required for MemoryRetrievalNode");
    }

    if (!systemMessage) {
      throw new Error("System message is required for MemoryRetrievalNode");
    }

    // Use the memory tool to retrieve and enhance system message with memories
    const result = await this.executeTool(
      "retrieveAndEnhanceSystemMessage",
      characterId,
      userInput,
      systemMessage,
      apiKey,
      baseUrl,
      language,
      maxMemories,
    ) as {
      enhancedSystemMessage: string;
      memoryPrompt: string;
      retrievedMemories: any[];
      memoryCount: number;
    };

    return {
      systemMessage: result.enhancedSystemMessage,
      memoryPrompt: result.memoryPrompt,
      retrievedMemories: result.retrievedMemories,
      memoryCount: result.memoryCount,
      characterId,
      userInput,
      language,
      username: input.username,
    };
  }
} 
 
