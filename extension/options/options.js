/**
 * Obsidian Web Clipper - Options Page Script
 */

// T001: Default AI Summary Prompt constant
const DEFAULT_SUMMARY_PROMPT = `# Role (角色设定)
你是一位资深的信息架构师和逻辑分析专家。你擅长从繁杂的文本中通过“去噪”、“归纳”和“演绎”的方法，提取出最核心的信息骨架。

# Context (背景)
我将提供一段来自网页的内容（可能包含HTML噪声、无关广告或非结构化文本）。你需要忽略干扰信息，专注于核心逻辑的提取。

# Goals (目标)
请对输入的内容进行深度总结，输出需严格遵守以下两个部分的格式要求：

## Part 1: Executive Summary (文章摘要)
* **语言**：简体中文。
* **要求**：用一段精炼的文字（200字以内），概括文章的**Core Thesis (核心主旨)**。必须开门见山，直接指出作者想要表达的最终结论或解决的核心问题。

## Part 2: Logical Argumentation (核心论证逻辑)
* **语言**：简体中文。
* **格式**：使用 Markdown 的层级列表。
* **深度要求**：
    * 必须识别出文章中的每一个 **Key Argument (关键论点)**。
    * 在每个论点之下，必须列出支持该论点的 **Evidence (论据)**，包括数据、案例、引用或逻辑推导过程。
    * **严禁遗漏**：只要是文中提到的具有逻辑支撑作用的观点，都必须列出。

# Output Format Example (输出示例)
**摘要：**
本文探讨了分布式系统中 CAP 定理的局限性，核心观点是......

**核心内容逻辑：**
1. **论点一：CAP 理论在现代云原生环境下的适用性降低**
    * *论据/细节：* Google Spanner 的论文证明了通过原子钟技术可以实现高可用的强一致性。
    * *论据/细节：* 引用了 Brewer 教授 2012 年的补充说明，强调“三选二”具有误导性。
2. **论点二：......**
    * *论据/细节：* ......

# Constraints (约束)
* 不要输出任何“根据文章内容”、“我分析如下”等废话，直接输出结果。
* 如果文中包含代码片段，简要概括代码的功能，不要照抄代码。
* 保持客观，不要加入你的主观评价。

# Input Text (输入文本)
{content}`;

// DOM Elements
const elements = {
  status: document.getElementById('status'),
  serverUrl: document.getElementById('serverUrl'),
  authToken: document.getElementById('authToken'),
  aiEnabled: document.getElementById('aiEnabled'),
  aiSettings: document.getElementById('aiSettings'),
  aiProvider: document.getElementById('aiProvider'),
  aiApiKey: document.getElementById('aiApiKey'),
  aiModel: document.getElementById('aiModel'),
  // T014-T016: OpenRouter elements
  openrouterApiKey: document.getElementById('openrouterApiKey'),
  openrouterModel: document.getElementById('openrouterModel'),
  // T024-T025: Custom prompt elements
  customPrompt: document.getElementById('customPrompt'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
  promptCharCount: document.getElementById('promptCharCount'),
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn')
};

/**
 * Initialize options page
 */
async function init() {
  // Load saved settings
  await loadSettings();
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Load saved settings from storage
 */
async function loadSettings() {
  // T002: Load all settings from Chrome Storage
  const config = await chrome.storage.local.get([
    'serverUrl',
    'authToken',
    'aiEnabled',
    'aiProvider',
    'aiApiKey',
    'aiModel',
    // T021: OpenRouter settings
    'openrouterApiKey',
    'openrouterModel',
    // T027: Custom prompt setting
    'customSummaryPrompt'
  ]);
  
  elements.serverUrl.value = config.serverUrl || 'http://localhost:18080';
  elements.authToken.value = config.authToken || '';
  elements.aiEnabled.checked = config.aiEnabled || false;
  elements.aiProvider.value = config.aiProvider || 'openai';
  elements.aiApiKey.value = config.aiApiKey || '';
  elements.aiModel.value = config.aiModel || 'gpt-4';
  
  // T021: Load OpenRouter settings
  if (elements.openrouterApiKey) {
    elements.openrouterApiKey.value = config.openrouterApiKey || '';
  }
  if (elements.openrouterModel) {
    elements.openrouterModel.value = config.openrouterModel || 'openai/gpt-4o';
  }
  
  // T027: Load custom prompt - show default if none saved
  if (elements.customPrompt) {
    elements.customPrompt.value = config.customSummaryPrompt || DEFAULT_SUMMARY_PROMPT;
  }
  
  // Update AI settings visibility
  updateAiSettingsVisibility();
  
  // T017: Render AI provider specific UI
  renderAIProviderUI();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // AI toggle
  elements.aiEnabled.addEventListener('change', updateAiSettingsVisibility);
  
  // T018: AI provider change - update model options and UI
  elements.aiProvider.addEventListener('change', () => {
    updateModelOptions();
    renderAIProviderUI();
  });
  
  // Save button
  elements.saveBtn.addEventListener('click', saveSettings);
  
  // Test button
  elements.testBtn.addEventListener('click', testConnection);
  
  // T029: Reset prompt button
  if (elements.resetPromptBtn) {
    elements.resetPromptBtn.addEventListener('click', resetPromptToDefault);
  }
  
  // T031: Prompt character counter
  if (elements.customPrompt && elements.promptCharCount) {
    elements.customPrompt.addEventListener('input', updatePromptCharCount);
    updatePromptCharCount();
  }
}

/**
 * Update prompt character count display
 */
function updatePromptCharCount() {
  if (elements.customPrompt && elements.promptCharCount) {
    const count = elements.customPrompt.value.length;
    elements.promptCharCount.textContent = `${count} / 2000`;
    
    if (count > 2000) {
      elements.promptCharCount.classList.add('error');
    } else {
      elements.promptCharCount.classList.remove('error');
    }
  }
}

/**
 * Update AI settings section visibility
 */
function updateAiSettingsVisibility() {
  if (elements.aiEnabled.checked) {
    elements.aiSettings.classList.add('enabled');
  } else {
    elements.aiSettings.classList.remove('enabled');
  }
}

/**
 * Update model options based on provider
 */
function updateModelOptions() {
  const provider = elements.aiProvider.value;
  const modelSelect = elements.aiModel;
  
  // Skip if model select doesn't exist
  if (!modelSelect) return;
  
  // Clear existing options
  modelSelect.innerHTML = '';
  
  if (provider === 'openai') {
    addOption(modelSelect, 'gpt-4', 'GPT-4');
    addOption(modelSelect, 'gpt-4-turbo', 'GPT-4 Turbo');
    addOption(modelSelect, 'gpt-3.5-turbo', 'GPT-3.5 Turbo');
  } else if (provider === 'anthropic') {
    addOption(modelSelect, 'claude-3-opus-20240229', 'Claude 3 Opus');
    addOption(modelSelect, 'claude-3-sonnet-20240229', 'Claude 3 Sonnet');
    addOption(modelSelect, 'claude-3-haiku-20240307', 'Claude 3 Haiku');
  }
  // T014: OpenRouter uses custom text input, not dropdown
}

/**
 * Add an option to a select element
 */
function addOption(select, value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  select.appendChild(option);
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  // T003, T020, T030: Save all settings to Chrome Storage
  try {
    const settings = {
      serverUrl: elements.serverUrl.value.trim(),
      authToken: elements.authToken.value,
      aiEnabled: elements.aiEnabled.checked,
      aiProvider: elements.aiProvider.value,
      aiApiKey: elements.aiApiKey.value,
      aiModel: elements.aiModel.value
    };
    
    // T020: Save OpenRouter settings
    if (elements.openrouterApiKey) {
      settings.openrouterApiKey = elements.openrouterApiKey.value;
    }
    if (elements.openrouterModel) {
      settings.openrouterModel = elements.openrouterModel.value;
    }
    
    // T030: Save custom prompt (empty means use default)
    if (elements.customPrompt) {
      const promptValue = elements.customPrompt.value.trim();
      // T031: Validate prompt length (max 2000 chars)
      if (promptValue.length > 2000) {
        showStatus('Prompt 长度不能超过 2000 字符', 'error');
        return;
      }
      // Store null if empty to indicate "use default"
      settings.customSummaryPrompt = promptValue || null;
    }
    
    // Validate server URL
    if (!settings.serverUrl) {
      showStatus('Server URL is required', 'error');
      return;
    }
    
    try {
      new URL(settings.serverUrl);
    } catch {
      showStatus('Invalid server URL format', 'error');
      return;
    }
    
    // T019: Validate OpenRouter model format if OpenRouter selected
    if (settings.aiProvider === 'openrouter' && settings.openrouterModel) {
      if (!validateOpenRouterModel(settings.openrouterModel)) {
        showStatus('OpenRouter 模型名称格式不正确。请使用 "provider/model-name" 格式（如 openai/gpt-4o）', 'error');
        return;
      }
    }
    
    // Save to storage (use local instead of sync for larger storage)
    await chrome.storage.local.set(settings);
    
    // Notify background script
    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      data: settings
    });
    
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus(`Failed to save settings: ${error.message}`, 'error');
  }
}

/**
 * Test connection to the server
 */
async function testConnection() {
  try {
    elements.testBtn.disabled = true;
    elements.testBtn.textContent = '🔄 Testing...';
    
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
    
    if (response.healthy) {
      showStatus('Connection successful! Server is running.', 'success');
    } else {
      showStatus(`Connection failed: ${response.error || 'Server not responding'}`, 'error');
    }
  } catch (error) {
    showStatus(`Connection test failed: ${error.message}`, 'error');
  } finally {
    elements.testBtn.disabled = false;
    elements.testBtn.textContent = '🔍 Test Connection';
  }
}

/**
 * Show a status message
 */
function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');
  
  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      elements.status.classList.add('hidden');
    }, 3000);
  }
}

/**
 * T017: Render AI Provider specific UI based on selected provider
 * Shows/hides OpenRouter model input based on provider selection
 */
function renderAIProviderUI() {
  const provider = elements.aiProvider ? elements.aiProvider.value : 'openai';
  const openrouterGroup = document.getElementById('openrouterGroup');
  const openaiModelGroup = document.getElementById('openaiModelGroup');
  
  if (provider === 'openrouter') {
    // Show OpenRouter specific fields
    if (openrouterGroup) {
      openrouterGroup.classList.remove('hidden');
    }
    if (openaiModelGroup) {
      openaiModelGroup.classList.add('hidden');
    }
  } else {
    // Hide OpenRouter fields, show standard model dropdown
    if (openrouterGroup) {
      openrouterGroup.classList.add('hidden');
    }
    if (openaiModelGroup) {
      openaiModelGroup.classList.remove('hidden');
    }
    // Update model options for selected provider
    updateModelOptions();
  }
}

/**
 * T019: Validate OpenRouter model name format
 * Format should be "provider/model-name" (e.g., "openai/gpt-4o")
 * @param {string} model - The model name to validate
 * @returns {boolean} True if valid format
 */
function validateOpenRouterModel(model) {
  if (!model || typeof model !== 'string') {
    return false;
  }
  
  // Must contain exactly one "/" with non-empty parts before and after
  const parts = model.trim().split('/');
  if (parts.length !== 2) {
    return false;
  }
  
  const [provider, modelName] = parts;
  return provider.length > 0 && modelName.length > 0;
}

/**
 * T028: Reset prompt to default value
 */
function resetPromptToDefault() {
  if (elements.customPrompt) {
    elements.customPrompt.value = DEFAULT_SUMMARY_PROMPT;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
