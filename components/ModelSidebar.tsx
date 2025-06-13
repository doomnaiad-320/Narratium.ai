"use client";

import { useState, useEffect } from "react";
import "@/app/styles/fantasy-ui.css";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";

interface ModelSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

type LLMType = "openai" | "ollama";

interface APIConfig {
  id: string;
  name: string;
  type: LLMType;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export default function ModelSidebar({ isOpen, toggleSidebar }: ModelSidebarProps) {
  const { t, fontClass, serifFontClass } = useLanguage();
  
  const [configs, setConfigs] = useState<APIConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string>("");
  const [showNewConfigForm, setShowNewConfigForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string>("");
  const [editingName, setEditingName] = useState("");
  const [showEditHint, setShowEditHint] = useState(true);
  
  const [llmType, setLlmType] = useState<LLMType>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [openaiModelList, setOpenaiModelList] = useState<string[]>([]);
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [getModelListSuccess, setGetModelListSuccess] = useState(false);
  const [getModelListError, setGetModelListError] = useState(false);

  const [modelListEmpty, setModelListEmpty] = useState(false);
  
  const ollamaModelOptions = [
    "llama3.3:8b",
    "llama3.3:70b",
    "qwen2.5:7b",
    "mistral-nemo",
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedConfigsStr = localStorage.getItem("apiConfigs");
    let mergedConfigs: APIConfig[] = [];

    if (savedConfigsStr) {
      try {
        mergedConfigs = JSON.parse(savedConfigsStr) as APIConfig[];
      } catch (e) {
        console.error("Error parsing saved API configs", e);
      }
    }

    const storedActiveId = localStorage.getItem("activeConfigId");
    const activeIdCandidate = storedActiveId && mergedConfigs.some((c) => c.id === storedActiveId)
      ? storedActiveId
      : (mergedConfigs[0]?.id || "");

    setConfigs(mergedConfigs);
    setActiveConfigId(activeIdCandidate);

    if (mergedConfigs.length > 0) {
      loadConfigToForm(mergedConfigs.find((c) => c.id === activeIdCandidate)!);
    }
  }, []);

  const loadConfigToForm = (config: APIConfig) => {
    setLlmType(config.type);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setApiKey(config.apiKey || "");
    if (config.baseUrl && config.apiKey) {
      handleGetModelList(config.baseUrl, config.apiKey);
    }
  };

  const generateId = () => `api_${Date.now()}`;

  const handleCreateConfig = () => {
    setLlmType("openai");
    setBaseUrl("");
    setModel("");
    setApiKey("");
    setShowNewConfigForm(true);
    setActiveConfigId("");
  };
  
  const handleCancelCreate = () => {
    setShowNewConfigForm(false);
    if (configs.length > 0 && activeConfigId) {
      const selectedConfig = configs.find(c => c.id === activeConfigId);
      if (selectedConfig) {
        loadConfigToForm(selectedConfig);
      } else {
        setActiveConfigId(configs[0].id);
        loadConfigToForm(configs[0]);
      }
    } else if (configs.length > 0) {
      setActiveConfigId(configs[0].id);
      loadConfigToForm(configs[0]);
    }
  };

  const handleSave = () => {
    if (showNewConfigForm) {
      const configName = generateConfigName(llmType, model);
      
      const newConfig: APIConfig = {
        id: generateId(),
        name: configName,
        type: llmType,
        baseUrl,
        model,
        apiKey: llmType === "openai" ? apiKey : undefined,
      };

      const currentConfigs = Array.isArray(configs) ? configs : [];
      const updatedConfigs = [...currentConfigs, newConfig];
      setConfigs(updatedConfigs);
      setActiveConfigId(newConfig.id);
      setShowNewConfigForm(false);

      localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
      localStorage.setItem("activeConfigId", newConfig.id);
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
      
      return;
    } else {
      if (!Array.isArray(configs)) {
        setConfigs([]);
        console.error("Configs is not an array", configs);
        return;
      }
      
      const updatedConfigs = configs.map(config => {
        if (config.id === activeConfigId) {
          return {
            ...config,
            type: llmType,
            baseUrl,
            model,
            apiKey: llmType === "openai" ? apiKey : undefined,
          };
        }
        return config;
      });

      setConfigs(updatedConfigs);
      localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
    }

    localStorage.setItem("llmType", llmType);
    localStorage.setItem(llmType === "openai" ? "openaiBaseUrl" : "ollamaBaseUrl", baseUrl);
    localStorage.setItem(llmType === "openai" ? "openaiModel" : "ollamaModel", model);
    if (llmType === "openai") {
      localStorage.setItem("openaiApiKey", apiKey);
      localStorage.setItem("apiKey", apiKey);
    }
    localStorage.setItem("modelBaseUrl", baseUrl);
    localStorage.setItem("modelName", model);

    if (!showNewConfigForm) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    }
  };

  const generateConfigName = (type: LLMType, model: string): string => {
    const currentConfigs = Array.isArray(configs) ? configs : [];

    let modelName = model && model.trim() ? model : (type === "openai" ? "OpenAI" : "Ollama");
    
    if (modelName.length > 15) {
      modelName = modelName.substring(0, 15);
    }
    
    const sameModelConfigs = currentConfigs.filter(config => {
      if (config.model === model) return true;
      
      const namePattern = new RegExp(`【\\d+】${modelName}`);
      return namePattern.test(config.name);
    });
    
    if (sameModelConfigs.length === 0) {
      return `【1】${modelName}`;
    }
    
    let maxNumber = 0;
    sameModelConfigs.forEach(config => {
      const match = config.name.match(/【(\d+)】/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    return `【${maxNumber + 1}】${modelName}`;
  };

  const handleDeleteConfig = (id: string) => {
    const updatedConfigs = configs.filter(config => config.id !== id);
    setConfigs(updatedConfigs);

    if (id === activeConfigId) {
      if (updatedConfigs.length > 0) {
        setActiveConfigId(updatedConfigs[0].id);
        loadConfigToForm(updatedConfigs[0]);
      } else {
        setActiveConfigId("");
        setLlmType("openai");
        setBaseUrl("");
        setModel("");
        setApiKey("");
      }
    }

    localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
    if (id === activeConfigId) {
      localStorage.setItem("activeConfigId", updatedConfigs.length > 0 ? updatedConfigs[0].id : "");
    }
  };

  const handleSwitchConfig = (id: string) => {
    if (id === activeConfigId) return;
    
    setActiveConfigId(id);
    const selectedConfig = configs.find(config => config.id === id);
    if (selectedConfig) {
      loadConfigToForm(selectedConfig);
      localStorage.setItem("activeConfigId", id);
      setShowNewConfigForm(false);
    }
  };

  const handleGetModelList = async (baseUrl: string, apiKey: string) => {
    if (llmType === "ollama") return; // Skip for Ollama
    
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });
      const data = await response.json();
      const modelList = data.data?.map((item: any) => item.id) || [];
  
      setOpenaiModelList(modelList);
      setModelListEmpty(modelList.length === 0);
  
      setGetModelListSuccess(true);
      setTimeout(() => setGetModelListSuccess(false), 2000);
    } catch (error) {
      setGetModelListError(true);
      setModelListEmpty(true);
      setTimeout(() => setGetModelListError(false), 2000);
    }
  };

  const handleStartEditName = (config: APIConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConfigId(config.id);
    setEditingName(config.name);
    setShowEditHint(false);
  };

  const handleSaveName = () => {
    if (!editingName.trim()) return;

    const updatedConfigs = configs.map(config => {
      if (config.id === editingConfigId) {
        return { ...config, name: editingName.trim() };
      }
      return config;
    });

    setConfigs(updatedConfigs);
    localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
    setEditingConfigId("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setEditingConfigId("");
    }
  };

  return (
    <div
      className={`h-full magic-border border-l border-[#534741] breathing-bg text-[#d0d0d0] transition-all duration-300 overflow-hidden ${isOpen ? "w-64" : "w-0"
      }`}
    >
      <div className={`w-64 h-full ${isOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-300 overflow-y-auto fantasy-scrollbar`}>
        <div className="flex justify-between items-center p-3 border-b border-[#534741] bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a]">
          <h1 className={`text-base magical-text ${serifFontClass}`}>{t("modelSettings.title")}</h1>
          <button
            onClick={() => {trackButtonClick("ModelSidebar", "关闭模型设置"); toggleSidebar();}}
            className="w-6 h-6 flex items-center justify-center text-[#f4e8c1] bg-[#1c1c1c] rounded-md border border-[#333333] shadow-inner transition-all duration-300 hover:bg-[#252525] hover:border-[#444444] hover:text-amber-400 hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          <div className="mb-3">
            <div className="flex justify-between items-center mb-2">
              <label className={`text-[#f4e8c1] text-xs font-medium ${fontClass}`}>
                {t("modelSettings.configurations") || "API Configurations"}
              </label>
              <button 
                onClick={(e) => {trackButtonClick("ModelSidebar", "创建新配置"); handleCreateConfig();}}
                className="text-xs text-[#d1a35c] hover:text-[#f4e8c1] transition-all duration-200 px-2 py-1 rounded border border-[#534741] hover:border-[#d1a35c] hover:shadow-[0_0_6px_rgba(209,163,92,0.2)] flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("modelSettings.newConfig") || "New Config"}
              </button>
            </div>
            
            {configs.length > 0 && (
              <div className="mb-3 flex flex-col gap-1.5 max-h-50 overflow-y-auto fantasy-scrollbar pr-1">
                {configs.map((config, idx) => (
                  <div 
                    key={config.id} 
                    className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer text-sm transition-all duration-200 group ${
                      activeConfigId === config.id 
                        ? "bg-[#3a3632] border border-[#d1a35c] shadow-[0_0_8px_rgba(209,163,92,0.2)]" 
                        : "bg-[#292929] hover:bg-[#333333] border border-transparent hover:border-[#534741]"
                    }`}
                    onClick={() => handleSwitchConfig(config.id)}
                  >
                    <div className="relative flex items-center flex-1 min-w-0 group/name">
                      {editingConfigId === config.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={handleSaveName}
                          onKeyDown={handleKeyDown}
                          className="bg-[#1c1c1c] border border-[#534741] rounded py-0.5 px-1 text-xs text-[#f4e8c1] w-full focus:border-[#d1a35c] focus:outline-none"
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span 
                            className="text-xs truncate cursor-text hover:text-[#f4e8c1] transition-colors" 
                            onDoubleClick={(e) => handleStartEditName(config, e)}
                          >
                            {config.name}
                          </span>
                          {showEditHint && (
                            <span
                              className={`absolute ${idx === 0 ? "top-full mt-1" : "-top-6"} left-0 z-20 bg-[#2a2522] text-[#d1a35c] text-[10px] px-2 py-1 rounded border border-[#d1a35c] whitespace-nowrap opacity-0 group-hover/name:opacity-100 transition-all duration-200 pointer-events-none shadow-[0_0_8px_rgba(209,163,92,0.2)]`}
                            >
                              {t("modelSettings.doubleClickToEditName")}
                            </span>
                          )}
                          <span className="ml-2 text-xs text-[#8a8a8a] px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#333333] flex-shrink-0">{config.type}</span>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={(e) => { trackButtonClick("ModelSidebar", "删除配置"); e.stopPropagation(); handleDeleteConfig(config.id); }}
                      className="text-red-400 hover:text-red-300 text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!showNewConfigForm && activeConfigId && (
            <div className="border border-[#534741] rounded-md p-2.5 mb-3 bg-[#1c1c1c] bg-opacity-50 backdrop-blur-sm">
              <div className="mb-1.5">
                <span className="text-xs text-[#8a8a8a]">{t("modelSettings.llmType") || "API Type"}:</span>
                <span className="ml-2 text-xs text-[#f4e8c1]">{llmType === "openai" ? "OpenAI API" : "Ollama API"}</span>
              </div>
              <div className="mb-1.5">
                <span className="text-xs text-[#8a8a8a]">{t("modelSettings.baseUrl") || "Base URL"}:</span>
                <span className="ml-2 text-xs text-[#f4e8c1] break-all">
                  {baseUrl.includes("://") ? "http://api-server/v1" : baseUrl}
                </span>
              </div>
              {llmType === "openai" && (
                <div className="mb-1.5">
                  <span className="text-xs text-[#8a8a8a]">{t("modelSettings.apiKey") || "API Key"}:</span>
                  <span className="ml-2 text-xs text-[#f4e8c1]">{"•".repeat(Math.min(10, apiKey.length))}</span>
                </div>
              )}
              <div className="mb-1.5">
                <label className="text-xs text-[#8a8a8a] mr-2">{t("modelSettings.model") || "Model"}:</label>
                {llmType === "openai" && !modelListEmpty ? (
                  <select
                    value={model}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setModel(newModel);
                      const updatedConfigs = configs.map(config => {
                        if (config.id === activeConfigId) {
                          return { ...config, model: newModel };
                        }
                        return config;
                      });
                      setConfigs(updatedConfigs);
                      localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
                      localStorage.setItem(llmType === "openai" ? "openaiModel" : "ollamaModel", newModel);
                      localStorage.setItem("modelName", newModel);
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 2000);
                    }}
                    className="bg-[#292929] border border-[#534741] rounded py-0.5 px-1.5 text-[#f4e8c1] text-xs max-w-[200px] truncate focus:border-[#d1a35c] focus:outline-none transition-colors"
                    style={{ textOverflow: "ellipsis" }}
                  >
                    <option value="" disabled className="truncate">{t("modelSettings.selectModel") || "Select a model..."}</option>
                    {openaiModelList.map((option) => (
                      <option key={option} value={option} className="truncate">{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => {
                      const newModel = e.target.value;
                      setModel(newModel);
                      const updatedConfigs = configs.map(config => {
                        if (config.id === activeConfigId) {
                          return { ...config, model: newModel };
                        }
                        return config;
                      });
                      setConfigs(updatedConfigs);
                      localStorage.setItem("apiConfigs", JSON.stringify(updatedConfigs));
                      localStorage.setItem(llmType === "openai" ? "openaiModel" : "ollamaModel", newModel);
                      localStorage.setItem("modelName", newModel);
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 2000);
                    }}
                    className="bg-[#292929] border border-[#534741] rounded py-0.5 px-1.5 text-[#f4e8c1] text-xs max-w-[200px] focus:border-[#d1a35c] focus:outline-none transition-colors"
                    placeholder={llmType === "openai" ? "gpt-4-turbo, claude-3-opus-20240229..." : "llama3, mistral, mixtral..."}
                  />
                )}
              </div>
            </div>
          )}

          {showNewConfigForm && (
            <div className="mb-4">
              <div className="mb-4">
                <label className={`block text-[#f4e8c1] text-xs font-medium mb-2 ${fontClass}`}>
                  {t("modelSettings.llmType") || "API Type"}
                </label>
                <select
                  value={llmType}
                  onChange={(e) => {
                    setLlmType(e.target.value as LLMType);
                  }}
                  className="w-full bg-[#292929] border border-[#534741] rounded py-1.5 px-2 text-xs text-[#d0d0d0] leading-tight focus:outline-none focus:border-[#d1a35c] transition-colors"
                >
                  <option value="openai">OpenAI API</option>
                  <option value="ollama">Ollama API</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="baseUrl" className={`block text-[#f4e8c1] text-xs font-medium mb-2 ${fontClass}`}>
                  {t("modelSettings.baseUrl")}
                </label>
                <input
                  type="text"
                  id="baseUrl"
                  className="bg-[#292929] border border-[#534741] rounded w-full py-1.5 px-2 text-xs text-[#d0d0d0] leading-tight focus:outline-none focus:border-[#d1a35c] transition-colors"
                  placeholder={llmType === "openai" ? "https://api.openai.com/v1" : "http://localhost:11434"}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              {llmType === "openai" && (
                <div className="mb-4">
                  <label htmlFor="apiKey" className={`block text-[#f4e8c1] text-xs font-medium mb-2 ${fontClass}`}>
                    {t("modelSettings.apiKey") || "API Key"}
                  </label>
                  <input
                    type="text"
                    id="apiKey"
                    className="bg-[#292929] border border-[#534741] rounded w-full py-1.5 px-2 text-xs text-[#d0d0d0] leading-tight focus:outline-none focus:border-[#d1a35c] transition-colors"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              <div className="mb-4">
                <div className="relative">
                  {llmType === "openai" && (
                    <button 
                      className={`bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-normal py-1.5 px-2 text-xs rounded-md border border-[#d1a35c] w-full transition-colors magical-text ${fontClass}`} 
                      onClick={() => handleGetModelList(baseUrl, apiKey)}
                    >{t("modelSettings.getModelList") || "Get Model List"}</button>
                  )}
                  
                  {getModelListSuccess && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 mr-2 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-white text-xs ${fontClass}`}>
                          {t("modelSettings.getModelListSuccess") || "Get Model List Success"}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {getModelListError && (
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 mr-2 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className={`text-white text-xs ${fontClass}`}>
                          {t("modelSettings.getModelListError") || "Get Model List Error"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="model" className={`block text-[#f4e8c1] text-xs font-medium mb-2 ${fontClass}`}>
                  {t("modelSettings.model")}
                </label>
                <input
                  type="text"
                  id="model"
                  className="bg-[#292929] border border-[#534741] rounded w-full py-1.5 px-2 text-xs text-[#d0d0d0] leading-tight focus:outline-none focus:border-[#d1a35c] transition-colors"
                  placeholder={llmType === "openai" ? "gpt-4-turbo, claude-3-opus-20240229..." : "llama3, mistral, mixtral..."}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                {llmType === "openai" && (
                  <div className="mt-2 text-xs text-[#8a8a8a]">
                    <p className={`mb-1 ${fontClass}`}>{t("modelSettings.modelList") || "Model List"}</p>
                    <select
                      value={model}
                      onChange={(e) => {
                        trackButtonClick("ModelSidebar", t("modelSettings.selectModel") || "Select a model...");
                        setModel(e.target.value);
                      }}
                      className="w-full bg-[#292929] border border-[#534741] rounded py-2 px-3 text-[#d0d0d0] text-sm leading-tight focus:outline-none focus:border-[#d1a35c] transition-colors"
                    >
                      <option value="" disabled className="text-[#8a8a8a]">
                        {t("modelSettings.selectModel") || "Select a model..."}
                      </option>
                      {openaiModelList.map((option) => (
                        <option
                          key={option}
                          value={option}
                          className="bg-[#292929] text-[#d0d0d0]"
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={(e) => {trackButtonClick("ModelSidebar", "创建配置"); e.stopPropagation(); handleSave();}}
                  className={`flex-1 bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-medium py-1.5 px-2 text-xs rounded border border-[#d1a35c] transition-colors magical-text ${fontClass}`}
                >
                  {t("modelSettings.createConfig") || "Create Configuration"}
                </button>
                <button
                  onClick={() => {trackButtonClick("cancel_create_config_btn", "取消创建配置"); handleCancelCreate();}}
                  className={`px-2 py-1.5 bg-[#292929] text-xs text-[#d0d0d0] rounded border border-[#534741] hover:bg-[#333333] transition-colors ${fontClass}`}
                >
                  {t("common.cancel") || "Cancel"}
                </button>
              </div>
            </div>
          )}

          {!showNewConfigForm && activeConfigId && (
            <div className="relative">
              <button
                onClick={(e) => {trackButtonClick("ModelSidebar", "保存配置"); e.stopPropagation(); handleSave();}}
                className={`bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-normal py-1.5 px-2 text-xs rounded-md border border-[#d1a35c] w-full transition-all duration-200 hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass}`}
              >
                {t("modelSettings.saveSettings") || "Save Settings"}
              </button>

              {saveSuccess && (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-[#333333] bg-opacity-80 rounded transition-opacity backdrop-blur-sm">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className={`text-white text-xs ${fontClass}`}>
                      {t("modelSettings.settingsSaved") || "Settings Saved"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {configs.length === 0 && !showNewConfigForm && (
            <div className="flex flex-col items-center justify-center py-3">
              <p className="text-xs text-[#8a8a8a] mb-2">
                {t("modelSettings.noConfigs") || "No API configurations yet"}
              </p>
              <button
                onClick={(e) => { trackButtonClick("ModelSidebar", "创建第一个配置"); e.stopPropagation(); handleCreateConfig(); }}
                className={`bg-[#3e3a3a] hover:bg-[#534741] text-[#f4e8c1] font-normal py-1.5 px-2 text-xs rounded border border-[#d1a35c] transition-all duration-200 hover:shadow-[0_0_8px_rgba(209,163,92,0.2)] ${fontClass} flex items-center justify-center gap-1 w-full max-w-[200px]`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("modelSettings.createFirstConfig") || "Create Your First Configuration"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
