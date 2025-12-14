/**
 * Obsidian Web Clipper - Options Page Script
 */

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
  const config = await chrome.storage.sync.get([
    'serverUrl',
    'authToken',
    'aiEnabled',
    'aiProvider',
    'aiApiKey',
    'aiModel'
  ]);
  
  elements.serverUrl.value = config.serverUrl || 'http://localhost:18080';
  elements.authToken.value = config.authToken || '';
  elements.aiEnabled.checked = config.aiEnabled || false;
  elements.aiProvider.value = config.aiProvider || 'openai';
  elements.aiApiKey.value = config.aiApiKey || '';
  elements.aiModel.value = config.aiModel || 'gpt-4';
  
  // Update AI settings visibility
  updateAiSettingsVisibility();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // AI toggle
  elements.aiEnabled.addEventListener('change', updateAiSettingsVisibility);
  
  // AI provider change - update model options
  elements.aiProvider.addEventListener('change', updateModelOptions);
  
  // Save button
  elements.saveBtn.addEventListener('click', saveSettings);
  
  // Test button
  elements.testBtn.addEventListener('click', testConnection);
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
  try {
    const settings = {
      serverUrl: elements.serverUrl.value.trim(),
      authToken: elements.authToken.value,
      aiEnabled: elements.aiEnabled.checked,
      aiProvider: elements.aiProvider.value,
      aiApiKey: elements.aiApiKey.value,
      aiModel: elements.aiModel.value
    };
    
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
    
    // Save to storage
    await chrome.storage.sync.set(settings);
    
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
