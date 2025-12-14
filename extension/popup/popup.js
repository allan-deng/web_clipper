/**
 * Obsidian Web Clipper - Popup Script
 * 
 * Handles popup UI interactions and communicates with background service worker.
 */

// DOM Elements
const elements = {
  statusIndicator: document.getElementById('status-indicator'),
  statusMessage: document.getElementById('status-message'),
  pageTitle: document.getElementById('page-title'),
  pageUrl: document.getElementById('page-url'),
  saveBtn: document.getElementById('save-btn'),
  progress: document.getElementById('progress'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  result: document.getElementById('result'),
  resultIcon: document.getElementById('result-icon'),
  resultMessage: document.getElementById('result-message'),
  resultPath: document.getElementById('result-path'),
  settingsLink: document.getElementById('settings-link')
};

// State
let isClipping = false;

/**
 * Initialize the popup
 */
async function init() {
  // Load current tab info
  await loadPageInfo();
  
  // Check server health
  await checkServerHealth();
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Load information about the current page
 */
async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      elements.pageTitle.textContent = tab.title || 'Untitled Page';
      elements.pageUrl.textContent = tab.url || '';
      
      // Enable save button if we have a valid URL
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        elements.saveBtn.disabled = false;
      } else {
        showStatusMessage('Cannot clip this page', 'warning');
      }
    }
  } catch (error) {
    console.error('Failed to load page info:', error);
    elements.pageTitle.textContent = 'Error loading page info';
  }
}

/**
 * Check if the backend server is healthy
 */
async function checkServerHealth() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
    
    if (response.healthy) {
      elements.statusIndicator.className = 'status-indicator status-ok';
    } else {
      elements.statusIndicator.className = 'status-indicator status-error';
      showStatusMessage('Backend server is not running. Please start it first.', 'error');
      elements.saveBtn.disabled = true;
    }
  } catch (error) {
    elements.statusIndicator.className = 'status-indicator status-error';
    showStatusMessage('Cannot connect to extension background', 'error');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Save button click
  elements.saveBtn.addEventListener('click', handleSaveClick);
  
  // Settings link click
  elements.settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

/**
 * Handle save button click
 */
async function handleSaveClick() {
  if (isClipping) return;
  
  isClipping = true;
  elements.saveBtn.disabled = true;
  
  // Show progress
  showProgress('Extracting content...');
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      throw new Error('No active tab found');
    }
    
    // Update progress
    updateProgress(20, 'Processing page...');
    
    // Send message to content script to start clipping
    const clipResponse = await chrome.tabs.sendMessage(tab.id, { type: 'START_CLIP' });
    
    if (!clipResponse.success) {
      throw new Error(clipResponse.error || 'Failed to extract content');
    }
    
    // Update progress
    updateProgress(60, 'Saving to Obsidian...');
    
    // Send clip data to background for saving
    const saveResponse = await chrome.runtime.sendMessage({
      type: 'SAVE_CLIP',
      data: clipResponse.data
    });
    
    if (!saveResponse.success) {
      throw new Error(saveResponse.error || 'Failed to save clip');
    }
    
    // Show success
    updateProgress(100, 'Done!');
    showResult(true, 'Saved successfully!', saveResponse.data.savedPath);
    
  } catch (error) {
    console.error('Clip failed:', error);
    showResult(false, error.message || 'Failed to save clip');
  } finally {
    isClipping = false;
    hideProgress();
  }
}

/**
 * Show a status message
 */
function showStatusMessage(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove('hidden');
}

/**
 * Hide the status message
 */
function hideStatusMessage() {
  elements.statusMessage.classList.add('hidden');
}

/**
 * Show progress indicator
 */
function showProgress(text) {
  elements.result.classList.add('hidden');
  elements.progress.classList.remove('hidden');
  elements.progressFill.style.width = '0%';
  elements.progressText.textContent = text;
}

/**
 * Update progress indicator
 */
function updateProgress(percent, text) {
  elements.progressFill.style.width = `${percent}%`;
  if (text) {
    elements.progressText.textContent = text;
  }
}

/**
 * Hide progress indicator
 */
function hideProgress() {
  setTimeout(() => {
    elements.progress.classList.add('hidden');
  }, 500);
}

/**
 * Show result (success or error)
 */
function showResult(success, message, path = '') {
  elements.result.classList.remove('hidden', 'success', 'error');
  elements.result.classList.add(success ? 'success' : 'error');
  
  elements.resultIcon.textContent = success ? '✅' : '❌';
  elements.resultMessage.textContent = message;
  elements.resultPath.textContent = path;
  
  // Re-enable save button after error
  if (!success) {
    elements.saveBtn.disabled = false;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
