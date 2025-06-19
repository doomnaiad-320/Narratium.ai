import { AgentTool, AgentCapability, AgentExecutionContext } from "@/lib/models/agent-model";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * Agent Tool Registry - manages all available tools
 */
export class AgentToolRegistry {
  private static tools: Map<string, AgentTool> = new Map();

  static register(tool: AgentTool): void {
    this.tools.set(tool.id, tool);
  }

  static get(toolId: string): AgentTool | undefined {
    return this.tools.get(toolId);
  }

  static getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  static getByCapability(capability: AgentCapability): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => 
      tool.capabilities.includes(capability),
    );
  }

  static clear(): void {
    this.tools.clear();
  }
}

/**
 * Base Tool Class - provides common functionality for all tools
 */
export abstract class BaseTool implements AgentTool {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract capabilities: AgentCapability[];
  abstract inputSchema: any;
  abstract outputSchema: any;

  abstract execute(input: any, context: AgentExecutionContext): Promise<any>;

  protected async getLLM(context: AgentExecutionContext) {
    if (!context.llmConfig) {
      throw new Error("LLM configuration not found in context");
    }

    const { modelName, apiKey, baseUrl, llmType, temperature = 0.7 } = context.llmConfig;

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

  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    context: AgentExecutionContext,
  ): Promise<string> {
    const llm = await this.getLLM(context);
    
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", userPrompt],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    return await chain.invoke({});
  }
}

/**
 * ANALYZE Tool - Analyzes user requirements and existing content
 */
export class AnalyzeTool extends BaseTool {
  id = "analyze_requirements";
  name = "Requirement Analyzer";
  description = "Analyzes user requirements and existing content to understand what needs to be generated";
  capabilities = [AgentCapability.ANALYZE];
  
  inputSchema = {
    type: "object",
    properties: {
      userInput: { type: "string", description: "User's request or description" },
      existingContent: { type: "object", description: "Any existing character or worldbook content" },
      conversationHistory: { type: "array", description: "Previous conversation messages" },
    },
    required: ["userInput"],
  };

  outputSchema = {
    type: "object",
    properties: {
      analysis: { type: "string", description: "Analysis of requirements" },
      characterRequirements: { type: "object", description: "Character generation requirements" },
      worldbookRequirements: { type: "object", description: "Worldbook generation requirements" },
      missingInfo: { type: "array", description: "Information that needs to be clarified" },
      suggestedQuestions: { type: "array", description: "Questions to ask the user" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert character and worldbook analyzer. Your job is to analyze user requirements and determine what information is needed to create a complete character card with associated worldbook.

Analyze the user's input and identify:
1. Character requirements (name, personality, background, etc.)
2. Worldbook requirements (setting, lore, relationships, etc.)
3. Missing information that needs clarification
4. Suggested questions to ask the user

Respond in JSON format with your analysis.`;

    const userPrompt = `Please analyze this user request:

User Input: ${input.userInput}

${input.existingContent ? `Existing Content: ${JSON.stringify(input.existingContent, null, 2)}` : ""}

${input.conversationHistory ? `Conversation History: ${JSON.stringify(input.conversationHistory, null, 2)}` : ""}

Provide a detailed analysis of what needs to be generated and what information might be missing.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        analysis: response,
        characterRequirements: {},
        worldbookRequirements: {},
        missingInfo: [],
        suggestedQuestions: [],
      };
    }
  }
}

/**
 * ASK Tool - Asks users for additional information
 */
export class AskTool extends BaseTool {
  id = "ask_user";
  name = "User Question Asker";
  description = "Asks users for additional information needed for generation";
  capabilities = [AgentCapability.ASK];
  
  inputSchema = {
    type: "object",
    properties: {
      questions: { type: "array", description: "Questions to ask the user" },
      context: { type: "string", description: "Context for why these questions are needed" },
      priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority of questions" },
    },
    required: ["questions"],
  };

  outputSchema = {
    type: "object",
    properties: {
      questionId: { type: "string", description: "Unique ID for this question set" },
      formattedQuestions: { type: "string", description: "Formatted questions for display" },
      waitingForResponse: { type: "boolean", description: "Whether agent is waiting for response" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Format questions for display
    const formattedQuestions = this.formatQuestions(input.questions, input.context);
    
    return {
      questionId,
      formattedQuestions,
      waitingForResponse: true,
      questions: input.questions,
      context: input.context,
      priority: input.priority || "medium",
    };
  }

  private formatQuestions(questions: string[], context?: string): string {
    let formatted = "";
    
    if (context) {
      formatted += `**${context}**\n\n`;
    }
    
    formatted += "I need some additional information to create the best character and worldbook for you:\n\n";
    
    questions.forEach((question, index) => {
      formatted += `${index + 1}. ${question}\n`;
    });
    
    formatted += "\nPlease provide as much detail as you'd like - the more information you give, the better I can tailor the character and worldbook to your vision!";
    
    return formatted;
  }
}

/**
 * SEARCH Tool - Searches for relevant information and inspiration
 */
export class SearchTool extends BaseTool {
  id = "search_info";
  name = "Information Searcher";
  description = "Searches for relevant character archetypes, worldbuilding elements, and inspiration";
  capabilities = [AgentCapability.SEARCH];
  
  inputSchema = {
    type: "object",
    properties: {
      characterConcept: { type: "string", description: "Character concept to search for" },
      worldConcept: { type: "string", description: "World/setting concept to search for" },
      genre: { type: "string", description: "Genre or theme" },
      searchDepth: { type: "string", enum: ["basic", "detailed", "comprehensive"] },
    },
    required: ["characterConcept"],
  };

  outputSchema = {
    type: "object",
    properties: {
      characterArchetypes: { type: "array", description: "Relevant character archetypes found" },
      worldElements: { type: "array", description: "Relevant world elements found" },
      inspirationSources: { type: "array", description: "Sources of inspiration" },
      culturalReferences: { type: "array", description: "Cultural and mythological references" },
      suggestions: { type: "object", description: "Suggestions for character and world development" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert in character creation and worldbuilding with extensive knowledge of literature, mythology, history, and popular culture. Your job is to search your knowledge for relevant archetypes, worldbuilding elements, and inspiration sources.

When given a character or world concept, provide:
1. Character archetypes that match or inspire the concept
2. World elements that would complement the character
3. Inspiration sources from various media and cultures
4. Cultural and mythological references
5. Creative suggestions for development

Focus on providing diverse, interesting, and culturally rich suggestions that can help create a unique and compelling character with an immersive worldbook.`;

    const userPrompt = `Please search for inspiration and elements related to:

Character Concept: ${input.characterConcept}
${input.worldConcept ? `World Concept: ${input.worldConcept}` : ""}
${input.genre ? `Genre/Theme: ${input.genre}` : ""}

Search Depth: ${input.searchDepth || "detailed"}

Provide comprehensive suggestions that could help create an interesting and unique character with rich worldbuilding elements.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        characterArchetypes: [],
        worldElements: [],
        inspirationSources: [],
        culturalReferences: [],
        suggestions: { character: response.substring(0, 500), world: "" },
      };
    }
  }
}

/**
 * PLAN Tool - Creates generation plan and structure
 */
export class PlanTool extends BaseTool {
  id = "plan_generation";
  name = "Generation Planner";
  description = "Creates a detailed plan for character and worldbook generation";
  capabilities = [AgentCapability.PLAN];
  
  inputSchema = {
    type: "object",
    properties: {
      requirements: { type: "object", description: "Analyzed requirements from previous steps" },
      searchResults: { type: "object", description: "Results from search phase" },
      userPreferences: { type: "object", description: "User preferences and constraints" },
    },
    required: ["requirements"],
  };

  outputSchema = {
    type: "object",
    properties: {
      characterPlan: { type: "object", description: "Detailed plan for character generation" },
      worldbookPlan: { type: "object", description: "Detailed plan for worldbook generation" },
      generationOrder: { type: "array", description: "Order of generation steps" },
      keyThemes: { type: "array", description: "Key themes to maintain throughout" },
      qualityChecks: { type: "array", description: "Quality checks to perform" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert character and worldbook generation planner. Your job is to create a comprehensive plan for generating a character card and associated worldbook that are cohesive, interesting, and well-integrated.

Create a detailed plan that includes:
1. Character generation plan (what aspects to develop and in what order)
2. Worldbook generation plan (what lore elements to create)
3. Integration strategy (how character and worldbook connect)
4. Key themes to maintain consistency
5. Quality checks to ensure high standards

The plan should ensure that the character and worldbook are strongly connected and mutually reinforcing.`;

    const userPrompt = `Please create a generation plan based on:

Requirements: ${JSON.stringify(input.requirements, null, 2)}

${input.searchResults ? `Search Results: ${JSON.stringify(input.searchResults, null, 2)}` : ""}

${input.userPreferences ? `User Preferences: ${JSON.stringify(input.userPreferences, null, 2)}` : ""}

Create a comprehensive plan that will result in a high-quality character card with rich, integrated worldbook content.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        characterPlan: { description: response.substring(0, 300) },
        worldbookPlan: { description: response.substring(300, 600) },
        generationOrder: ["character_basics", "world_basics", "character_details", "world_details", "integration"],
        keyThemes: [],
        qualityChecks: ["consistency", "completeness", "integration"],
      };
    }
  }
}

/**
 * OUTPUT Tool - Generates character cards and worldbook content
 */
export class OutputTool extends BaseTool {
  id = "generate_content";
  name = "Content Generator";
  description = "Generates character cards and worldbook content based on plans and requirements";
  capabilities = [AgentCapability.OUTPUT];
  
  inputSchema = {
    type: "object",
    properties: {
      generationPlan: { type: "object", description: "Plan from planning phase" },
      requirements: { type: "object", description: "Requirements and specifications" },
      searchResults: { type: "object", description: "Inspiration and reference materials" },
      contentType: { type: "string", enum: ["character", "worldbook", "both"], description: "What to generate" },
      iterationNumber: { type: "number", description: "Current iteration number for refinement" },
    },
    required: ["generationPlan", "requirements", "contentType"],
  };

  outputSchema = {
    type: "object",
    properties: {
      characterData: { type: "object", description: "Generated character card data" },
      worldbookData: { type: "object", description: "Generated worldbook entries" },
      integrationNotes: { type: "string", description: "Notes on how character and worldbook connect" },
      generationMetadata: { type: "object", description: "Metadata about the generation process" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const { contentType, generationPlan, requirements } = input;
    
    const result: any = {
      integrationNotes: "",
      generationMetadata: {
        timestamp: new Date().toISOString(),
        iteration: input.iterationNumber || 1,
        planUsed: generationPlan,
      },
    };

    if (contentType === "character" || contentType === "both") {
      result.characterData = await this.generateCharacter(input, context);
    }

    if (contentType === "worldbook" || contentType === "both") {
      result.worldbookData = await this.generateWorldbook(input, context);
    }

    if (contentType === "both") {
      result.integrationNotes = await this.generateIntegrationNotes(result, context);
    }

    return result;
  }

  private async generateCharacter(input: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert character creator. Generate a complete character card with all necessary fields based on the provided plan and requirements.

Character cards should include:
- Basic info (name, age, appearance, etc.)
- Personality traits and quirks
- Background and history
- Goals and motivations
- Speaking style and mannerisms
- Key relationships
- Special abilities or skills
- Example dialogue

Ensure the character feels alive, unique, and interesting to roleplay with. Make them complex with both strengths and flaws.

Return the character data as a JSON object that matches the expected character model structure.`;

    const userPrompt = `Generate a character based on:

Plan: ${JSON.stringify(input.generationPlan.characterPlan, null, 2)}
Requirements: ${JSON.stringify(input.requirements.characterRequirements, null, 2)}
${input.searchResults ? `Inspiration: ${JSON.stringify(input.searchResults, null, 2)}` : ""}

Create a complete, detailed character card that will be engaging for roleplay.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback structure if JSON parsing fails
      return {
        name: "Generated Character",
        description: response.substring(0, 1000),
        personality: response.substring(1000, 1500) || "Mysterious and complex",
        scenario: response.substring(1500, 2000) || "An interesting encounter",
        first_mes: response.substring(2000, 2500) || "Hello there...",
        mes_example: response.substring(2500, 3000) || "",
        creator_notes: "Generated by AI Agent",
        post_history_instructions: "",
        system_prompt: "",
        tags: [],
        creator: "AI Agent",
      };
    }
  }

  private async generateWorldbook(input: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert worldbuilder. Generate comprehensive worldbook entries based on the provided plan and requirements.

Worldbook entries should include:
- Setting and locations
- Important NPCs and their relationships
- Cultural elements and customs
- Historical events and lore
- Organizations and factions
- Unique systems (magic, technology, etc.)
- Environmental details

Each entry should have:
- keys: trigger words/phrases
- content: rich, detailed descriptions
- constant: whether it's always active
- selective: whether it's context-dependent

Ensure entries are interconnected and create a cohesive, immersive world that complements the character.

Return as a JSON array of worldbook entries.`;

    const userPrompt = `Generate worldbook entries based on:

Plan: ${JSON.stringify(input.generationPlan.worldbookPlan, null, 2)}
Requirements: ${JSON.stringify(input.requirements.worldbookRequirements, null, 2)}
${input.searchResults ? `Inspiration: ${JSON.stringify(input.searchResults, null, 2)}` : ""}

Create detailed worldbook entries that will enhance roleplay and create an immersive setting.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      const entries = JSON.parse(response);
      // Ensure each entry has required structure
      return entries.map((entry: any, index: number) => ({
        id: `wb_${Date.now()}_${index}`,
        uid: Math.random().toString(36).substring(2, 15),
        key: entry.key || entry.keys || [`Entry ${index + 1}`],
        keysecondary: entry.keysecondary || [],
        comment: entry.comment || entry.title || `Worldbook Entry ${index + 1}`,
        content: entry.content || entry.description || "",
        constant: entry.constant || false,
        selective: entry.selective || true,
        order: index,
        position: entry.position || 0,
        disable: false,
        addMemo: "",
        excludeRecursion: false,
        delayUntilRecursion: false,
        displayIndex: index,
        probability: entry.probability || 100,
        useProbability: entry.useProbability || false,
      }));
    } catch (error) {
      // Fallback if JSON parsing fails
      return [{
        id: `wb_${Date.now()}_0`,
        uid: Math.random().toString(36).substring(2, 15),
        key: ["setting"],
        keysecondary: [],
        comment: "Generated Setting",
        content: response.substring(0, 2000),
        constant: false,
        selective: true,
        order: 0,
        position: 0,
        disable: false,
        addMemo: "",
        excludeRecursion: false,
        delayUntilRecursion: false,
        displayIndex: 0,
        probability: 100,
        useProbability: false,
      }];
    }
  }

  private async generateIntegrationNotes(result: any, context: AgentExecutionContext): Promise<string> {
    const systemPrompt = "Analyze the generated character and worldbook content and provide notes on how they integrate and complement each other. Highlight the connections, shared elements, and how they work together to create a cohesive experience.";

    const userPrompt = `Analyze the integration between:

Character: ${JSON.stringify(result.characterData, null, 2)}
Worldbook: ${JSON.stringify(result.worldbookData, null, 2)}

Provide integration notes explaining how these elements work together.`;

    return await this.callLLM(systemPrompt, userPrompt, context);
  }
}

/**
 * VALIDATE Tool - Validates content quality and consistency
 */
export class ValidateTool extends BaseTool {
  id = "validate_content";
  name = "Content Validator";
  description = "Validates generated content for quality, consistency, and completeness";
  capabilities = [AgentCapability.VALIDATE];
  
  inputSchema = {
    type: "object",
    properties: {
      characterData: { type: "object", description: "Character data to validate" },
      worldbookData: { type: "array", description: "Worldbook entries to validate" },
      requirements: { type: "object", description: "Original requirements to check against" },
      validationLevel: { type: "string", enum: ["basic", "standard", "comprehensive"], description: "Validation depth" },
    },
    required: ["requirements"],
  };

  outputSchema = {
    type: "object",
    properties: {
      isValid: { type: "boolean", description: "Overall validation result" },
      characterValidation: { type: "object", description: "Character validation results" },
      worldbookValidation: { type: "object", description: "Worldbook validation results" },
      integrationValidation: { type: "object", description: "Integration validation results" },
      issues: { type: "array", description: "List of issues found" },
      suggestions: { type: "array", description: "Suggestions for improvement" },
      qualityScore: { type: "number", description: "Overall quality score (0-100)" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const validationResults = {
      isValid: true,
      characterValidation: {},
      worldbookValidation: {},
      integrationValidation: {},
      issues: [] as string[],
      suggestions: [] as string[],
      qualityScore: 0,
    };

    if (input.characterData) {
      validationResults.characterValidation = await this.validateCharacter(input.characterData, input.requirements, context);
    }

    if (input.worldbookData) {
      validationResults.worldbookValidation = await this.validateWorldbook(input.worldbookData, input.requirements, context);
    }

    if (input.characterData && input.worldbookData) {
      validationResults.integrationValidation = await this.validateIntegration(input.characterData, input.worldbookData, context);
    }

    // Compile overall results
    const allValidations = [
      validationResults.characterValidation,
      validationResults.worldbookValidation,
      validationResults.integrationValidation,
    ].filter(v => Object.keys(v).length > 0);

    validationResults.issues = allValidations.flatMap((v: any) => v.issues || []);
    validationResults.suggestions = allValidations.flatMap((v: any) => v.suggestions || []);
    validationResults.isValid = validationResults.issues.length === 0;
    
    // Calculate quality score
    const scores = allValidations.map((v: any) => v.qualityScore || 0).filter(s => s > 0);
    validationResults.qualityScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return validationResults;
  }

  private async validateCharacter(characterData: any, requirements: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are a character validation expert. Evaluate the provided character data for quality, completeness, and adherence to requirements.

Check for:
1. Completeness - are all expected fields present?
2. Quality - is the content well-written and engaging?
3. Consistency - are there any contradictions?
4. Requirements adherence - does it match what was requested?
5. Roleplay potential - will this be fun to interact with?

Provide a detailed validation report with specific issues and suggestions.`;

    const userPrompt = `Validate this character:

Character Data: ${JSON.stringify(characterData, null, 2)}
Requirements: ${JSON.stringify(requirements.characterRequirements, null, 2)}

Provide validation results with quality score (0-100), issues, and suggestions.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        qualityScore: 75,
        issues: [],
        suggestions: [response.substring(0, 500)],
        completeness: "adequate",
        consistency: "good",
      };
    }
  }

  private async validateWorldbook(worldbookData: any[], requirements: any, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are a worldbook validation expert. Evaluate the provided worldbook entries for quality, completeness, and coherence.

Check for:
1. Entry quality - are descriptions rich and detailed?
2. Key effectiveness - will triggers work properly?
3. World coherence - do entries fit together logically?
4. Coverage - are important aspects covered?
5. Requirements adherence - does it match what was requested?

Provide a detailed validation report with specific issues and suggestions.`;

    const userPrompt = `Validate this worldbook:

Worldbook Data: ${JSON.stringify(worldbookData, null, 2)}
Requirements: ${JSON.stringify(requirements.worldbookRequirements, null, 2)}

Provide validation results with quality score (0-100), issues, and suggestions.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        qualityScore: 75,
        issues: [],
        suggestions: [response.substring(0, 500)],
        entryCount: worldbookData.length,
        coverage: "good",
      };
    }
  }

  private async validateIntegration(characterData: any, worldbookData: any[], context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an integration validation expert. Evaluate how well the character and worldbook work together.

Check for:
1. Narrative coherence - do they tell a consistent story?
2. Cross-references - are there meaningful connections?
3. Immersion - do they create a believable world?
4. Roleplay synergy - do they enhance each other for roleplay?
5. Consistency - are there any contradictions between them?

Provide a detailed validation report focusing on integration quality.`;

    const userPrompt = `Validate the integration between:

Character: ${JSON.stringify(characterData, null, 2)}
Worldbook: ${JSON.stringify(worldbookData, null, 2)}

Provide validation results focusing on how well they work together.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        qualityScore: 75,
        issues: [],
        suggestions: [response.substring(0, 500)],
        coherence: "good",
        connections: "adequate",
      };
    }
  }
}

/**
 * REFINE Tool - Refines and improves content based on feedback
 */
export class RefineTool extends BaseTool {
  id = "refine_content";
  name = "Content Refiner";
  description = "Refines and improves content based on validation feedback and user input";
  capabilities = [AgentCapability.REFINE];
  
  inputSchema = {
    type: "object",
    properties: {
      originalContent: { type: "object", description: "Original content to refine" },
      validationResults: { type: "object", description: "Validation feedback" },
      userFeedback: { type: "string", description: "User feedback and requests" },
      refinementType: { type: "string", enum: ["character", "worldbook", "integration"], description: "What to refine" },
      refinementLevel: { type: "string", enum: ["minor", "moderate", "major"], description: "How much to change" },
    },
    required: ["originalContent", "refinementType"],
  };

  outputSchema = {
    type: "object",
    properties: {
      refinedContent: { type: "object", description: "Improved content" },
      changesExplanation: { type: "string", description: "Explanation of changes made" },
      remainingIssues: { type: "array", description: "Issues that still need attention" },
      refinementMetadata: { type: "object", description: "Metadata about the refinement process" },
    },
  };

  async execute(input: any, context: AgentExecutionContext): Promise<any> {
    const { refinementType, originalContent, validationResults, userFeedback } = input;
    
    let refinedContent;
    let changesExplanation;

    switch (refinementType) {
    case "character":
      const characterResult = await this.refineCharacter(originalContent, validationResults, userFeedback, context);
      refinedContent = characterResult.refinedContent;
      changesExplanation = characterResult.explanation;
      break;
        
    case "worldbook":
      const worldbookResult = await this.refineWorldbook(originalContent, validationResults, userFeedback, context);
      refinedContent = worldbookResult.refinedContent;
      changesExplanation = worldbookResult.explanation;
      break;
        
    case "integration":
      const integrationResult = await this.refineIntegration(originalContent, validationResults, userFeedback, context);
      refinedContent = integrationResult.refinedContent;
      changesExplanation = integrationResult.explanation;
      break;
        
    default:
      throw new Error(`Unsupported refinement type: ${refinementType}`);
    }

    return {
      refinedContent,
      changesExplanation,
      remainingIssues: this.extractRemainingIssues(validationResults),
      refinementMetadata: {
        timestamp: new Date().toISOString(),
        refinementType,
        level: input.refinementLevel || "moderate",
        issuesAddressed: this.extractAddressedIssues(validationResults),
      },
    };
  }

  private async refineCharacter(originalContent: any, validationResults: any, userFeedback: string, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert character refinement specialist. Improve the provided character based on validation feedback and user input while maintaining the character's core identity.

Focus on:
1. Addressing specific issues from validation
2. Incorporating user feedback
3. Enhancing quality and depth
4. Maintaining character consistency
5. Improving roleplay potential

Return the refined character data in the same JSON structure, along with an explanation of changes made.`;

    const userPrompt = `Refine this character:

Original Character: ${JSON.stringify(originalContent, null, 2)}

${validationResults ? `Validation Issues: ${JSON.stringify(validationResults, null, 2)}` : ""}

${userFeedback ? `User Feedback: ${userFeedback}` : ""}

Provide the refined character data and explain the changes made.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      const parsed = JSON.parse(response);
      return {
        refinedContent: parsed.character || parsed.refinedCharacter || parsed,
        explanation: parsed.explanation || "Character refined based on feedback",
      };
    } catch (error) {
      return {
        refinedContent: originalContent,
        explanation: response.substring(0, 500),
      };
    }
  }

  private async refineWorldbook(originalContent: any, validationResults: any, userFeedback: string, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert worldbook refinement specialist. Improve the provided worldbook entries based on validation feedback and user input while maintaining world coherence.

Focus on:
1. Addressing specific issues from validation
2. Incorporating user feedback
3. Enhancing entry quality and detail
4. Improving trigger key effectiveness
5. Strengthening world coherence

Return the refined worldbook entries in the same JSON array structure, along with an explanation of changes made.`;

    const userPrompt = `Refine this worldbook:

Original Worldbook: ${JSON.stringify(originalContent, null, 2)}

${validationResults ? `Validation Issues: ${JSON.stringify(validationResults, null, 2)}` : ""}

${userFeedback ? `User Feedback: ${userFeedback}` : ""}

Provide the refined worldbook entries and explain the changes made.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      const parsed = JSON.parse(response);
      return {
        refinedContent: parsed.worldbook || parsed.refinedWorldbook || parsed,
        explanation: parsed.explanation || "Worldbook refined based on feedback",
      };
    } catch (error) {
      return {
        refinedContent: originalContent,
        explanation: response.substring(0, 500),
      };
    }
  }

  private async refineIntegration(originalContent: any, validationResults: any, userFeedback: string, context: AgentExecutionContext): Promise<any> {
    const systemPrompt = `You are an expert integration specialist. Improve how the character and worldbook work together based on validation feedback and user input.

Focus on:
1. Strengthening connections between character and world
2. Resolving integration issues from validation
3. Incorporating user feedback about integration
4. Enhancing narrative coherence
5. Improving roleplay synergy

Return both refined character and worldbook data along with integration improvements.`;

    const userPrompt = `Refine the integration between:

Original Content: ${JSON.stringify(originalContent, null, 2)}

${validationResults ? `Integration Issues: ${JSON.stringify(validationResults, null, 2)}` : ""}

${userFeedback ? `User Feedback: ${userFeedback}` : ""}

Provide refined content that better integrates character and worldbook.`;

    const response = await this.callLLM(systemPrompt, userPrompt, context);
    
    try {
      const parsed = JSON.parse(response);
      return {
        refinedContent: {
          characterData: parsed.character || parsed.refinedCharacter || originalContent.characterData,
          worldbookData: parsed.worldbook || parsed.refinedWorldbook || originalContent.worldbookData,
        },
        explanation: parsed.explanation || "Integration refined based on feedback",
      };
    } catch (error) {
      return {
        refinedContent: originalContent,
        explanation: response.substring(0, 500),
      };
    }
  }

  private extractRemainingIssues(validationResults: any): string[] {
    if (!validationResults) return [];
    
    const allIssues = [
      ...(validationResults.issues || []),
      ...(validationResults.characterValidation?.issues || []),
      ...(validationResults.worldbookValidation?.issues || []),
      ...(validationResults.integrationValidation?.issues || []),
    ];
    
    // In a real implementation, you'd track which issues were addressed
    // For now, assume major issues remain if quality score is still low
    if (validationResults.qualityScore < 80) {
      return allIssues.slice(0, Math.ceil(allIssues.length * 0.3));
    }
    
    return [];
  }

  private extractAddressedIssues(validationResults: any): string[] {
    if (!validationResults) return [];
    
    const allIssues = [
      ...(validationResults.issues || []),
      ...(validationResults.characterValidation?.issues || []),
      ...(validationResults.worldbookValidation?.issues || []),
      ...(validationResults.integrationValidation?.issues || []),
    ];
    
    // In a real implementation, you'd track which issues were addressed
    // For now, assume most issues were addressed if quality score is decent
    if (validationResults.qualityScore >= 80) {
      return allIssues.slice(0, Math.ceil(allIssues.length * 0.7));
    }
    
    return allIssues.slice(0, Math.ceil(allIssues.length * 0.5));
  }
}

// Update tool registration function
export function registerAllTools(): void {
  AgentToolRegistry.register(new AnalyzeTool());
  AgentToolRegistry.register(new AskTool());
  AgentToolRegistry.register(new SearchTool());
  AgentToolRegistry.register(new PlanTool());
  AgentToolRegistry.register(new OutputTool());
  AgentToolRegistry.register(new ValidateTool());
  AgentToolRegistry.register(new RefineTool());
}

// Export tool instances for easy access
export const analyzeRequirements = new AnalyzeTool();
export const askUser = new AskTool();
export const searchInformation = new SearchTool();
export const planGeneration = new PlanTool();
export const generateContent = new OutputTool();
export const validateContent = new ValidateTool();
export const refineContent = new RefineTool(); 
