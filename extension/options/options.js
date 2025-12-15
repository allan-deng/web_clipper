/**
 * Obsidian Web Clipper - Options Page Script
 */

// T001: Default AI Summary Prompt constant
const DEFAULT_SUMMARY_PROMPT = `请为以下网页内容生成一个简洁的摘要：

要求：
1. 摘要长度在 100-200 字之间
2. 突出文章的核心观点
3. 使用与原文相同的语言

内容：
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
