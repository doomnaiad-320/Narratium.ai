import { Character } from "@/lib/core/character";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptAssembler } from "@/lib/core/prompt-assembler";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { getCharacterCompressorPromptZh, getCharacterCompressorPromptEn } from "@/lib/prompts/character-prompts";
import { CharacterHistory } from "@/lib/core/character-history";
import { DialogueOptions } from "@/lib/models/character-dialogue-model";

export class CharacterDialogue {
  character: Character;
  history: CharacterHistory;
  llm: any;
  dialogueChain: RunnablePassthrough | null = null;
  language: "zh" | "en" = "zh";
  promptAssembler: PromptAssembler;

  constructor(character: Character) {
    this.character = character;
    this.history = new CharacterHistory(this.language);
    this.llm = null;
    this.promptAssembler = new PromptAssembler({ language: this.language });
  }

  async initialize(options?: DialogueOptions): Promise<void> {
    try {
      if (options?.language) {
        this.language = options.language;
        this.history = new CharacterHistory(options.language);
      }

      this.promptAssembler = new PromptAssembler({
        language: this.language,
        contextWindow: options?.contextWindow || 5,
      });
      
      this.setupLLM(options);
      this.setupDialogueChain();
    } catch (error) {
      console.error("Failed to initialize character dialogue:", error);
      throw new Error("Failed to initialize character dialogue");
    }
  }

  async getFirstMessage(): Promise<string[]> {
    const firstMessage = await this.character.getFirstMessage();
    return firstMessage;
  }

  setupLLM(options?: DialogueOptions): void {
    if (!options) {
      return;
    }
    const {
      modelName,
      apiKey,
      baseUrl,
      llmType,
      temperature = 0.7,
      streaming = false,
    } = options;

    const safeModel = modelName && modelName.trim() ? modelName.trim() : "";

    type LLMSettings = {
      temperature: number;
      maxTokens?: number;
      timeout?: number;
      maxRetries: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      topK?: number;
      repeatPenalty?: number;
    };
    
    let llmSettings: LLMSettings = {
      temperature: temperature || 0.9,
      maxRetries: 2,
      topP: 0.7,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 40,
      repeatPenalty: 1.1,
    };
    
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const savedSettings = localStorage.getItem("llmSettings");
        if (savedSettings) {
          llmSettings = {
            temperature: 0.9,
            maxTokens: undefined,
            timeout: undefined,
            maxRetries: 2,
            topP: 0.7,
            frequencyPenalty: 0,
            presencePenalty: 0,
            topK: 40,
            repeatPenalty: 1.1,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to load LLM settings from localStorage, using defaults", error);
    }

    if (llmType === "openai") {
      this.llm = new ChatOpenAI({
        modelName: safeModel,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
        },
        temperature: llmSettings.temperature,
        maxTokens: llmSettings.maxTokens,
        timeout: llmSettings.timeout,
        maxRetries: llmSettings.maxRetries,
        topP: llmSettings.topP,
        frequencyPenalty: llmSettings.frequencyPenalty,
        presencePenalty: llmSettings.presencePenalty,
        streaming: false,
        streamUsage: false,
      });
    } else if (llmType === "ollama") {
      // Ensure proper URL formatting for Windows compatibility
      let finalBaseUrl = baseUrl && baseUrl.trim() ? baseUrl.trim() : "http://localhost:11434";
      if (finalBaseUrl === "localhost:11434" || finalBaseUrl === "11434") {
        finalBaseUrl = "http://localhost:11434";
      } else if (finalBaseUrl.startsWith("localhost:") && !finalBaseUrl.startsWith("http://")) {
        finalBaseUrl = "http://" + finalBaseUrl;
      } else if (!finalBaseUrl.startsWith("http://") && !finalBaseUrl.startsWith("https://")) {
        finalBaseUrl = "http://" + finalBaseUrl;
      }
      if (finalBaseUrl.endsWith("/")) {
        finalBaseUrl = finalBaseUrl.slice(0, -1);
      }

      this.llm = new ChatOllama({
        model: safeModel,
        baseUrl: finalBaseUrl,
        temperature: llmSettings.temperature,
        topK: llmSettings.topK,
        topP: llmSettings.topP,
        frequencyPenalty: llmSettings.frequencyPenalty,
        presencePenalty: llmSettings.presencePenalty,
        repeatPenalty: llmSettings.repeatPenalty,
        streaming: false,
      });
    }
  }

  setupDialogueChain(): void {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const dialoguePrompt = ChatPromptTemplate.fromMessages([
      ["system", "{system_message}"],
      ["human", "{user_message}"],
    ]);

    this.dialogueChain = RunnablePassthrough.assign({
      system_message: (input: any) => input.system_message,
      user_message: (input: any) => input.user_message,
    })
      .pipe(dialoguePrompt)
      .pipe(this.llm)
      .pipe(new StringOutputParser());
  }
  
  async compressStory(userInput: string, story: string): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    this.llm.streaming = false;
    
    try {
      let compressorPrompt;
      if (this.language === "zh") {
        compressorPrompt = ChatPromptTemplate.fromMessages([
          ["system", ""],
          ["user", getCharacterCompressorPromptZh(userInput, story)],
        ]);
      } else {
        compressorPrompt = ChatPromptTemplate.fromMessages([
          ["system", ""],
          ["user", getCharacterCompressorPromptEn(userInput, story)],
        ]);
      }
      
      const compressorChain = compressorPrompt
        .pipe(this.llm)
        .pipe(new StringOutputParser());
      const compressedStory = await compressorChain.invoke({});
      
      return compressedStory;
    } catch (error) {
      console.error("Error compressing story:", error);
      throw new Error(`Failed to compress story: ${error}`);
    }
  }
}

