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
  copyBtn: document.getElementById('copy-btn'),
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
let isCopying = false;

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
      
      // Enable buttons if we have a valid URL
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        elements.saveBtn.disabled = false;
        elements.copyBtn.disabled = false;
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
  
  // Copy button click
  elements.copyBtn.addEventListener('click', handleCopyClick);
  
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
    
    // Get clip data for modification
    let clipData = clipResponse.data;
    
    // Generate AI Summary if enabled
    try {
      const config = await chrome.storage.local.get(['aiEnabled']);
      console.log('Save to Obsidian - AI Enabled:', config.aiEnabled);
      
      if (config.aiEnabled) {
        updateProgress(40, 'Generating AI summary...');
        
        // Extract plain text for AI from markdown content
        const contentForAI = extractPlainTextForAI(clipData.content.markdown);
        console.log('Content for AI length:', contentForAI?.length || 0);
        
        if (contentForAI && contentForAI.length > 100) {
          const aiSummaryText = await generateAISummary(contentForAI);
          
          if (aiSummaryText) {
            // Parse AI summary into structured format for backend
            clipData.content.aiSummary = {
              evidence: [],
              mermaidDiagram: '',
              status: 'SUCCESS',
              rawText: aiSummaryText  // Store raw text for fallback
            };
            
            // finalMarkdown = insertAISummaryIntoMarkdown(clipData.content.markdown, aiSummary);
            console.log('AI summary generated for Save to Obsidian');
          }
        } else {
          console.log('Content too short for AI summary');
        }
      }
    } catch (aiError) {
      console.warn('AI summary generation failed, continuing without it:', aiError);
      // Continue without AI summary
    }
    
    // Update progress
    updateProgress(60, 'Saving to Obsidian...');
    
    // Send clip data to background for saving
    const saveResponse = await chrome.runtime.sendMessage({
      type: 'SAVE_CLIP',
      data: clipData
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

/**
 * Handle copy button click
 */
async function handleCopyClick() {
  console.log('=== handleCopyClick called ===');
  if (isCopying) return;
  
  isCopying = true;
  const originalText = elements.copyBtn.querySelector('.btn-text').textContent;
  
  // Disable button and show processing state (FR-009)
  elements.copyBtn.disabled = true;
  elements.copyBtn.classList.add('btn-processing');
  elements.copyBtn.querySelector('.btn-text').textContent = '处理中...';
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) {
      throw new Error('No active tab found');
    }
    
    // Send message to content script to extract content
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'COPY_TO_CLIPBOARD' });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to extract content');
    }
    
    let finalMarkdown = response.markdown;
    
    // Try to generate AI summary if enabled
    try {
      console.log('=== Checking AI Summary Settings ===');
      const config = await chrome.storage.local.get(['aiEnabled']);
      console.log('aiEnabled from storage:', config.aiEnabled);
      
      if (config.aiEnabled) {
        elements.copyBtn.querySelector('.btn-text').textContent = '生成摘要...';
        
        // Extract plain text content for AI (remove frontmatter and markdown syntax)
        const contentForAI = extractPlainTextForAI(response.markdown);
        console.log('Content for AI length:', contentForAI?.length || 0);
        
        if (contentForAI && contentForAI.length > 100) {
          const aiSummary = await generateAISummary(contentForAI);
          
          if (aiSummary) {
            // Insert AI summary after frontmatter
            finalMarkdown = insertAISummaryIntoMarkdown(response.markdown, aiSummary);
            console.log('AI summary inserted into markdown');
          }
        } else {
          console.log('Content too short for AI summary (< 100 chars)');
        }
      } else {
        console.log('AI summary is disabled in settings');
      }
    } catch (aiError) {
      console.warn('AI summary generation failed, continuing without it:', aiError);
      // Continue without AI summary - don't fail the whole copy operation
    }
    
    // Write to clipboard in popup context (has focus)
    try {
      await navigator.clipboard.writeText(finalMarkdown);
    } catch (clipboardError) {
      console.error('Clipboard write failed:', clipboardError);
      throw new Error('无法访问剪贴板，请检查浏览器权限设置');
    }
    
    // Show success state (FR-006)
    elements.copyBtn.classList.remove('btn-processing');
    elements.copyBtn.classList.add('btn-success');
    elements.copyBtn.querySelector('.btn-text').textContent = '已复制!';
    
    // Reset button after 2 seconds (FR-010)
    setTimeout(() => {
      elements.copyBtn.classList.remove('btn-success');
      elements.copyBtn.querySelector('.btn-text').textContent = originalText;
      elements.copyBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Copy failed:', error);
    
    // Show error state (FR-007)
    elements.copyBtn.classList.remove('btn-processing');
    elements.copyBtn.classList.add('btn-error');
    elements.copyBtn.querySelector('.btn-text').textContent = error.message || '复制失败';
    
    // Reset button after 3 seconds
    setTimeout(() => {
      elements.copyBtn.classList.remove('btn-error');
      elements.copyBtn.querySelector('.btn-text').textContent = originalText;
      elements.copyBtn.disabled = false;
    }, 3000);
  } finally {
    isCopying = false;
  }
}

/**
 * Extract plain text content for AI processing
 * Removes frontmatter and markdown syntax
 */
function extractPlainTextForAI(markdown) {
  if (!markdown) return '';
  
  // Remove YAML frontmatter
  let content = markdown.replace(/^---[\s\S]*?---\n*/m, '');
  
  // Remove section headers we added
  content = content.replace(/^## (我的笔记|正文)\s*\n/gm, '');
  
  // Remove markdown links but keep text
  content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images
  content = content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  // Remove blockquotes markers
  content = content.replace(/^>\s*/gm, '');
  
  // Remove horizontal rules
  content = content.replace(/^---+\s*$/gm, '');
  
  // Trim and limit length for AI (to avoid token limits)
  content = content.trim();
  if (content.length > 50000) {
    content = content.substring(0, 50000) + '...';
  }
  
  return content;
}

/**
 * Insert AI summary into markdown after frontmatter
 */
function insertAISummaryIntoMarkdown(markdown, aiSummary) {
  if (!aiSummary) return markdown;
  
  // Find the end of frontmatter
  const frontmatterEnd = markdown.indexOf('---', 4);
  if (frontmatterEnd === -1) {
    // No frontmatter, prepend summary
    return `## 摘要\n\n${aiSummary}\n\n---\n\n${markdown}`;
  }
  
  // Insert after frontmatter
  const afterFrontmatter = frontmatterEnd + 3;
  const before = markdown.substring(0, afterFrontmatter);
  const after = markdown.substring(afterFrontmatter);
  
  return `${before}\n\n## 摘要\n\n${aiSummary}\n\n---\n${after}`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// ===== T022-T023: OpenRouter API Support =====

/**
 * T022: Call OpenRouter API for AI summary
 * @param {string} content - The content to summarize
 * @param {string} model - The model name (e.g., "openai/gpt-4o")
 * @param {string} apiKey - The OpenRouter API key
 * @param {string} prompt - The summary prompt
 * @returns {Promise<string>} The generated summary
 */
async function callOpenRouterAPI(content, model, apiKey, prompt) {
  const fullPrompt = prompt.replace('{content}', content);
  
  // Log the final prompt for debugging
  console.log('=== AI Summary Request ===');
  console.log('Model:', model);
  console.log('Prompt template:', prompt);
  console.log('Full prompt (first 5000 chars):', fullPrompt.substring(0, 5000) + (fullPrompt.length > 5000 ? '...' : ''));
  console.log('Full prompt length:', fullPrompt.length);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': chrome.runtime.getURL(''),
      'X-Title': 'Obsidian Web Clipper'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: fullPrompt }]
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
    console.error('OpenRouter API error:', errorMsg);
    throw new Error(`OpenRouter API error: ${errorMsg}`);
  }
  
  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content || '';
  
  console.log('=== AI Summary Response ===');
  console.log('Summary:', summary);
  
  return summary;
}

/**
 * T023: Generate AI summary based on provider settings
 * @param {string} content - The content to summarize
 * @returns {Promise<string>} The generated summary
 */
async function generateAISummary(content) {
  // Load settings
  const config = await chrome.storage.local.get([
    'aiEnabled',
    'aiProvider',
    'aiApiKey',
    'aiModel',
    'openrouterApiKey',
    'openrouterModel',
    'customSummaryPrompt'
  ]);
  
  console.log('=== AI Summary Configuration ===');
  console.log('AI Enabled:', config.aiEnabled);
  console.log('AI Provider:', config.aiProvider);
  console.log('OpenRouter Model:', config.openrouterModel);
  console.log('Custom Prompt Set:', !!config.customSummaryPrompt);
  
  if (!config.aiEnabled) {
    console.log('AI is disabled, skipping summary generation');
    return null;
  }
  
  // Get prompt (use default if not set)
  const DEFAULT_PROMPT = `# Role (角色设定)
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
  
  const prompt = config.customSummaryPrompt || DEFAULT_PROMPT;
  console.log('Using prompt:', config.customSummaryPrompt ? 'Custom' : 'Default');
  
  if (config.aiProvider === 'openrouter') {
    // Use OpenRouter
    if (!config.openrouterApiKey || !config.openrouterModel) {
      console.error('OpenRouter API key or model not configured');
      throw new Error('OpenRouter API key and model are required');
    }
    return await callOpenRouterAPI(content, config.openrouterModel, config.openrouterApiKey, prompt);
  } else if (config.aiProvider === 'openai') {
    // Use OpenAI (existing implementation would go here)
    // For now, placeholder
    console.error('OpenAI provider not yet implemented');
    throw new Error('OpenAI provider not yet implemented in this version');
  } else {
    console.error('Unknown AI provider:', config.aiProvider);
    throw new Error(`Unknown AI provider: ${config.aiProvider}`);
  }
}
