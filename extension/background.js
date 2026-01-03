/**
 * Web Clipper - Background Service Worker
 * 
 * Handles message passing between content scripts, popup, and the backend API.
 * Runs as a Manifest V3 Service Worker.
 */

// Import API client
import { ApiClient } from './services/apiClient.js';

// Initialize API client
let apiClient = null;

/**
 * Initialize the API client with stored configuration
 */
async function initApiClient() {
  const config = await chrome.storage.sync.get(['serverUrl', 'authToken']);
  apiClient = new ApiClient(
    config.serverUrl || 'http://localhost:18080',
    config.authToken || ''
  );
}

// Initialize on startup
initApiClient();

// Listen for storage changes to update API client
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.serverUrl || changes.authToken) {
      initApiClient();
    }
  }
});

/**
 * Message handler for communication with content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    });
  
  // Return true to indicate we'll send response asynchronously
  return true;
});

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'SAVE_CLIP':
      return await handleSaveClip(message.data);
    
    case 'CHECK_HEALTH':
      return await handleHealthCheck();
    
    case 'GET_CONFIG':
      return await handleGetConfig();
    
    case 'SAVE_CONFIG':
      return await handleSaveConfig(message.data);
    
    case 'TRIGGER_CLIP':
      return await handleTriggerClip(sender.tab?.id);
    
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}

/**
 * Handle save clip request from content script
 */
async function handleSaveClip(data) {
  if (!apiClient) {
    await initApiClient();
  }
  
  try {
    const result = await apiClient.save(data);
    return { success: true, data: result };
  } catch (error) {
    console.error('Save failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if the backend server is healthy
 */
async function handleHealthCheck() {
  if (!apiClient) {
    await initApiClient();
  }
  
  try {
    const healthy = await apiClient.checkHealth();
    return { success: true, healthy };
  } catch (error) {
    return { success: false, healthy: false, error: error.message };
  }
}

/**
 * Get current configuration
 */
async function handleGetConfig() {
  const config = await chrome.storage.sync.get([
    'serverUrl',
    'authToken',
    'aiEnabled',
    'aiProvider',
    'aiApiKey',
    'aiModel'
  ]);
  
  return {
    success: true,
    config: {
      serverUrl: config.serverUrl || 'http://localhost:18080',
      authToken: config.authToken || '',
      aiEnabled: config.aiEnabled || false,
      aiProvider: config.aiProvider || 'openai',
      aiApiKey: config.aiApiKey || '',
      aiModel: config.aiModel || 'gpt-4'
    }
  };
}

/**
 * Save configuration
 */
async function handleSaveConfig(config) {
  await chrome.storage.sync.set(config);
  await initApiClient(); // Reinitialize with new config
  return { success: true };
}

/**
 * Trigger clipping on the active tab
 */
async function handleTriggerClip(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }
  
  if (!tabId) {
    throw new Error('No active tab found');
  }
  
  // Send message to content script to start clipping
  const response = await chrome.tabs.sendMessage(tabId, { type: 'START_CLIP' });
  return response;
}

// Log service worker lifecycle events
console.log('Web Clipper background service worker started');
