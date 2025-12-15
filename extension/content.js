/**
 * Obsidian Web Clipper - Content Script
 * 
 * Runs in the context of web pages to extract content, process images,
 * and manage highlights. Communicates with background service worker.
 */

// Prevent multiple injections
if (window.__obsidianWebClipperLoaded) {
  console.log('Obsidian Web Clipper: Already loaded');
} else {
  window.__obsidianWebClipperLoaded = true;

  // Configuration
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const DOWNLOAD_TIMEOUT = 30000; // 30 seconds

  // Highlight storage
  let highlights = [];
  let highlightIdCounter = 0;

  // UI state for highlight interactions
  let tooltipElement = null;
  let editorElement = null;
  let hideTooltipTimeout = null;
  let currentEditingHighlightId = null;

  // Initialize highlight mode
  initHighlightMode();

  /**
   * Message listener for commands from popup/background
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Indicate async response
  });

  /**
   * Handle incoming messages
   */
  async function handleMessage(message) {
    switch (message.type) {
      case 'START_CLIP':
        return await handleStartClip();
      
      case 'COPY_TO_CLIPBOARD':
        return await handleCopyToClipboard();
      
      case 'GET_PAGE_INFO':
        return getPageInfo();
      
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Get basic page information
   */
  function getPageInfo() {
    return {
      success: true,
      data: {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname
      }
    };
  }

  /**
   * Start the clipping process
   */
  async function handleStartClip() {
    try {
      const clipData = await extractAndProcessContent();
      
      return {
        success: true,
        data: clipData
      };
    } catch (error) {
      console.error('Clip extraction failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle copy to clipboard request
   * Extracts content, converts to Markdown with frontmatter, and returns it
   * (Clipboard write is done in popup context where it has focus)
   */
  async function handleCopyToClipboard() {
    try {
      console.log('Starting content extraction for clipboard...');
      
      // Extract content (reusing existing extraction logic)
      const extractedContent = await extractContentForClipboard();
      
      if (!extractedContent || !extractedContent.markdown) {
        return {
          success: false,
          error: '此页面没有可提取的文章内容',
          errorType: 'NO_CONTENT'
        };
      }
      
      // Generate frontmatter
      const frontmatter = generateClipboardFrontmatter(extractedContent.metadata);
      
      // Generate highlights section if there are any
      const highlightsSection = generateHighlightsSection(extractedContent.highlights);
      
      // Assemble full markdown (frontmatter + highlights + content)
      let fullMarkdown = frontmatter + '\n';
      
      if (highlightsSection) {
        fullMarkdown += highlightsSection + '\n';
      }
      
      fullMarkdown += '## 正文\n\n' + extractedContent.markdown;
      
      console.log(`Content extracted successfully with ${extractedContent.highlights?.length || 0} highlights`);
      
      // Return the markdown content - clipboard write will happen in popup
      return { 
        success: true, 
        markdown: fullMarkdown 
      };
      
    } catch (error) {
      console.error('Content extraction failed:', error);
      return {
        success: false,
        error: error.message || '内容提取失败，请重试',
        errorType: 'EXTRACTION_FAILED'
      };
    }
  }

  /**
   * Extract content specifically for clipboard (without image processing)
   * This is a lighter version that doesn't download images
   */
  async function extractContentForClipboard() {
    console.log('Extracting content for clipboard...');

    // Get basic metadata
    const metadata = {
      title: extractTitle(),
      url: window.location.href,
      domain: window.location.hostname,
      clippedAt: new Date().toISOString()
    };

    // Clone document for Readability processing
    const documentClone = document.cloneNode(true);
    
    // Remove scripts and styles from clone
    documentClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    // Extract article content using Readability
    let articleHtml = '';
    
    if (typeof Readability !== 'undefined') {
      try {
        const reader = new Readability(documentClone, {
          charThreshold: 100
        });
        const article = reader.parse();
        
        if (article) {
          metadata.title = article.title || metadata.title;
          articleHtml = article.content || '';
          console.log('Readability extraction successful for clipboard');
        }
      } catch (error) {
        console.warn('Readability extraction failed:', error);
      }
    }
    
    // Fallback if Readability fails
    if (!articleHtml) {
      console.log('Using fallback extraction for clipboard...');
      articleHtml = extractFallback();
    }
    
    // Check if we have content
    if (!articleHtml || articleHtml.trim().length < 50) {
      return null;
    }

    // Convert HTML to Markdown (keep original image URLs, no base64 conversion)
    let markdown = '';
    
    if (typeof TurndownService !== 'undefined') {
      try {
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-'
        });
        
        // Add custom rules
        addTurndownRules(turndownService);
        
        markdown = turndownService.turndown(articleHtml);
        markdown = cleanupMarkdown(markdown);
      } catch (error) {
        console.warn('Turndown conversion failed:', error);
        markdown = stripHtml(articleHtml);
      }
    } else {
      console.warn('TurndownService not available');
      markdown = stripHtml(articleHtml);
    }

    return {
      metadata,
      markdown,
      highlights: collectHighlights()
    };
  }

  /**
   * Generate YAML frontmatter for clipboard copy
   */
  function generateClipboardFrontmatter(metadata) {
    const lines = ['---'];
    
    lines.push(`title: "${escapeYamlString(metadata.title)}"`);
    lines.push(`source: "${escapeYamlString(metadata.url)}"`);
    lines.push(`clipped: "${metadata.clippedAt}"`);
    
    lines.push('---');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Escape special characters in YAML string values
   */
  function escapeYamlString(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Generate highlights/notes section for clipboard copy
   * @param {Array} highlightsList - Array of highlight objects
   * @returns {string} Markdown section for highlights
   */
  function generateHighlightsSection(highlightsList) {
    if (!highlightsList || highlightsList.length === 0) {
      return '';
    }
    
    const lines = ['## 我的笔记', ''];
    
    // Sort highlights by position
    const sortedHighlights = [...highlightsList].sort((a, b) => a.position - b.position);
    
    for (const highlight of sortedHighlights) {
      lines.push(`> **高亮**: ${highlight.text}`);
      if (highlight.note) {
        lines.push(`> `);
        lines.push(`> 💬 批注: ${highlight.note}`);
      }
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Extract and process page content
   */
  async function extractAndProcessContent() {
    console.log('Starting content extraction...');

    // Get basic metadata
    const metadata = {
      title: extractTitle(),
      url: window.location.href,
      domain: window.location.hostname,
      savedAt: new Date().toISOString(),
      tags: [] // Will be populated by AI in Phase 5
    };

    console.log('Metadata extracted:', metadata.title);

    // Clone document for Readability processing
    const documentClone = document.cloneNode(true);
    
    // Remove scripts and styles from clone
    documentClone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    // Extract article content using Readability
    let articleHtml = '';
    
    if (typeof Readability !== 'undefined') {
      try {
        const reader = new Readability(documentClone, {
          charThreshold: 100
        });
        const article = reader.parse();
        
        if (article) {
          metadata.title = article.title || metadata.title;
          articleHtml = article.content || '';
          console.log('Readability extraction successful');
        }
      } catch (error) {
        console.warn('Readability extraction failed:', error);
      }
    }
    
    // Fallback if Readability fails
    if (!articleHtml) {
      console.log('Using fallback extraction...');
      articleHtml = extractFallback();
    }

    // Process images and convert to base64
    console.log('Processing images...');
    const { html: processedHtml, assets } = await processImages(articleHtml);
    
    console.log(`Processed ${assets.length} images, ${assets.filter(a => a.base64).length} successful`);

    // Convert HTML to Markdown
    console.log('Converting to Markdown...');
    let markdown = '';
    
    if (typeof TurndownService !== 'undefined') {
      try {
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-'
        });
        
        // Add custom rules
        addTurndownRules(turndownService);
        
        markdown = turndownService.turndown(processedHtml);
        markdown = cleanupMarkdown(markdown);
      } catch (error) {
        console.warn('Turndown conversion failed:', error);
        markdown = stripHtml(processedHtml);
      }
    } else {
      console.warn('TurndownService not available');
      markdown = stripHtml(processedHtml);
    }

    // Collect highlights (placeholder for Phase 4)
    const highlights = collectHighlights();

    // Build the clip data structure
    const clipData = {
      metadata,
      content: {
        markdown,
        aiSummary: null, // Will be implemented in Phase 5
        highlights
      },
      assets: assets.filter(a => a.base64) // Only include successfully downloaded images
    };

    console.log('Clip data ready');
    return clipData;
  }

  /**
   * Extract article title
   */
  function extractTitle() {
    const sources = [
      () => document.querySelector('h1')?.textContent?.trim(),
      () => document.querySelector('[property="og:title"]')?.getAttribute('content'),
      () => document.querySelector('[name="twitter:title"]')?.getAttribute('content'),
      () => {
        const title = document.title;
        // Remove common suffixes like " | Site Name"
        return title.split(/[\|\-–—]/)[0].trim();
      }
    ];
    
    for (const getTitle of sources) {
      try {
        const title = getTitle();
        if (title && title.length > 0) {
          return title.substring(0, 200); // Limit length
        }
      } catch (e) {
        continue;
      }
    }
    
    return 'Untitled';
  }

  /**
   * Fallback content extraction
   */
  function extractFallback() {
    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        const clone = element.cloneNode(true);
        // Remove nav, sidebar, footer from clone
        clone.querySelectorAll('nav, aside, footer, .sidebar, .comments').forEach(el => el.remove());
        return clone.innerHTML;
      }
    }
    
    // Ultimate fallback: body content
    const body = document.body.cloneNode(true);
    body.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
    return body.innerHTML;
  }

  /**
   * Process images in the HTML content
   */
  async function processImages(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const images = tempDiv.querySelectorAll('img');
    const assets = [];
    const urlToFilename = new Map();
    
    for (const img of images) {
      const src = img.src || img.getAttribute('data-src');
      
      if (!src || src.startsWith('data:')) {
        continue;
      }
      
      // Skip already processed URLs
      if (urlToFilename.has(src)) {
        img.src = `./assets/${urlToFilename.get(src)}`;
        continue;
      }
      
      try {
        const asset = await downloadImage(src);
        assets.push(asset);
        
        if (asset.status === 'SUCCESS' && asset.filename) {
          urlToFilename.set(src, asset.filename);
          img.src = `./assets/${asset.filename}`;
          img.removeAttribute('data-src');
          img.removeAttribute('srcset');
        }
      } catch (error) {
        console.warn(`Failed to process image ${src}:`, error);
        assets.push({
          filename: null,
          originalUrl: src,
          base64: null,
          mimeType: null,
          status: 'FAILED_DOWNLOAD'
        });
      }
    }
    
    return {
      html: tempDiv.innerHTML,
      assets
    };
  }

  /**
   * Download an image and convert to base64
   */
  async function downloadImage(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || 'image/png';
      const mimeType = contentType.split(';')[0].trim();
      
      if (!mimeType.startsWith('image/')) {
        throw new Error(`Not an image: ${mimeType}`);
      }
      
      const blob = await response.blob();
      
      if (blob.size > MAX_IMAGE_SIZE) {
        return {
          filename: null,
          originalUrl: url,
          base64: null,
          mimeType: mimeType,
          status: 'SKIPPED_TOO_LARGE'
        };
      }
      
      const base64DataUrl = await blobToBase64(blob);
      const base64Data = base64DataUrl.split(',')[1];
      
      const hash = await sha256(base64Data);
      const ext = getExtFromMimeType(mimeType);
      const filename = `${hash.substring(0, 8)}.${ext}`;
      
      return {
        filename,
        originalUrl: url,
        base64: base64Data,
        mimeType,
        status: 'SUCCESS'
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      return {
        filename: null,
        originalUrl: url,
        base64: null,
        mimeType: null,
        status: error.name === 'AbortError' ? 'FAILED_TIMEOUT' : 'FAILED_DOWNLOAD'
      };
    }
  }

  /**
   * Convert blob to base64 data URL
   */
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate SHA-256 hash of a string
   */
  async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get file extension from MIME type
   */
  function getExtFromMimeType(mimeType) {
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp'
    };
    return map[mimeType] || 'png';
  }

  /**
   * Add custom rules to Turndown
   */
  function addTurndownRules(turndownService) {
    // Handle code blocks with language
    turndownService.addRule('fencedCodeBlock', {
      filter: function (node) {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: function (content, node) {
        const codeElement = node.firstChild;
        const className = codeElement.getAttribute('class') || '';
        const languageMatch = className.match(/language-(\w+)/);
        const language = languageMatch ? languageMatch[1] : '';
        const code = codeElement.textContent || '';
        
        return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      }
    });
    
    // Handle strikethrough
    turndownService.addRule('strikethrough', {
      filter: ['del', 's', 'strike'],
      replacement: function (content) {
        return '~~' + content + '~~';
      }
    });
    
    // Remove unwanted elements
    turndownService.remove(['script', 'style', 'noscript', 'iframe']);
  }

  /**
   * Clean up converted Markdown
   */
  function cleanupMarkdown(markdown) {
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();
  }

  /**
   * Strip HTML tags (fallback)
   */
  function stripHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || '';
  }

  /**
   * Collect user highlights from the page
   */
  function collectHighlights() {
    return highlights.map(h => ({
      text: h.text,
      note: h.note || null,
      color: h.color,
      position: h.position
    }));
  }

  /**
   * Initialize highlight mode
   */
  function initHighlightMode() {
    // Inject highlight styles (minimal - main styles come from CSS file)
    // T006: Removed inline background style to use CSS file transparency
    const style = document.createElement('style');
    style.textContent = `
      .owc-highlight {
        background-color: rgba(255, 235, 59, 0.4);
        border-radius: 2px;
        padding: 0 2px;
        cursor: pointer;
      }
      .owc-highlight.has-note::after {
        content: '💬';
        font-size: 10px;
        position: relative;
        top: -5px;
      }
      .owc-menu-btn {
        background: transparent;
        border: none;
        padding: 8px;
        cursor: pointer;
        border-radius: 4px;
        font-size: 16px;
      }
      .owc-menu-btn:hover {
        background: #7c3aed;
      }
    `;
    document.head.appendChild(style);

    // Create selection menu
    const menu = document.createElement('div');
    menu.className = 'owc-selection-menu';
    menu.innerHTML = `
      <button class="owc-menu-btn" data-action="highlight" title="Highlight">🖍️</button>
      <button class="owc-menu-btn" data-action="note" title="Add note">📝</button>
    `;
    document.body.appendChild(menu);

    // Handle text selection
    document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text.length > 0 && !e.target.closest('.owc-selection-menu')) {
        menu.style.display = 'flex';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY + 10}px`;
        menu.dataset.text = text;
      } else if (!e.target.closest('.owc-selection-menu')) {
        menu.style.display = 'none';
      }
    });

    // Handle menu actions
    menu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const text = menu.dataset.text;
      
      if (action === 'highlight' && text) {
        addHighlight(text, null);
        menu.style.display = 'none';
      } else if (action === 'note' && text) {
        // T010: Use custom editor instead of browser prompt
        const selection = window.getSelection();
        let targetPosition = null;
        let range = null;
        
        if (selection.rangeCount > 0) {
          range = selection.getRangeAt(0).cloneRange(); // Clone the range to preserve it
          const rect = range.getBoundingClientRect();
          targetPosition = {
            left: rect.left,
            top: rect.bottom + 8
          };
        }
        
        menu.style.display = 'none';
        showNoteEditorForNewHighlight(text, targetPosition, range);
      }
    });
  }

  /**
   * Add a highlight
   */
  function addHighlight(text, note) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const wrapper = document.createElement('span');
      wrapper.className = 'owc-highlight' + (note ? ' has-note' : '');
      wrapper.dataset.highlightId = ++highlightIdCounter;
      
      try {
        range.surroundContents(wrapper);
      } catch (e) {
        const contents = range.extractContents();
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
      }
      
      highlights.push({
        id: highlightIdCounter,
        text,
        note,
        color: '#ffeb3b',
        position: highlights.length
      });
      
      // Initialize interaction events for the new highlight
      initHighlightInteractions(wrapper);
      
      selection.removeAllRanges();
    }
  }

  /**
   * Ensure tooltip container exists in DOM
   */
  function ensureTooltipContainer() {
    if (!tooltipElement) {
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'owc-note-tooltip';
      tooltipElement.style.display = 'none';
      document.body.appendChild(tooltipElement);
    }
    return tooltipElement;
  }

  /**
   * Ensure editor container exists in DOM
   */
  function ensureEditorContainer() {
    if (!editorElement) {
      editorElement = document.createElement('div');
      editorElement.className = 'owc-note-editor';
      editorElement.style.display = 'none';
      document.body.appendChild(editorElement);
    }
    return editorElement;
  }

  /**
   * Calculate tooltip/editor position with viewport boundary detection
   * @param {Element} targetElement - The highlight element to position near
   * @param {number} width - Width of the popup (default 250 for tooltip, 300 for editor)
   * @param {number} maxHeight - Max height of the popup
   * @returns {{left: number, top: number}}
   */
  function getTooltipPosition(targetElement, width = 250, maxHeight = 200) {
    if (!targetElement) {
      return { left: 0, top: 0 };
    }

    const rect = targetElement.getBoundingClientRect();
    const gap = 8; // Gap between element and popup

    let left = rect.left;
    let top = rect.bottom + gap;

    // Right boundary check - ensure popup doesn't overflow right edge
    if (left + width > window.innerWidth) {
      left = window.innerWidth - width - 10;
    }

    // Left boundary check - ensure popup doesn't overflow left edge
    if (left < 10) {
      left = 10;
    }

    // Bottom boundary check - if not enough space below, show above
    if (top + maxHeight > window.innerHeight) {
      top = rect.top - maxHeight - gap;
      // If still out of view (not enough space above), position at top
      if (top < 10) {
        top = 10;
      }
    }

    return { left, top };
  }

  /**
   * Find highlight data by ID
   * @param {number|string} highlightId - The highlight ID to find
   * @returns {Object|null} The highlight object or null if not found
   */
  function getHighlightById(highlightId) {
    const id = parseInt(highlightId, 10);
    return highlights.find(h => h.id === id) || null;
  }

  /**
   * Initialize interaction events for a highlight element
   * @param {Element} highlightEl - The highlight span element
   */
  function initHighlightInteractions(highlightEl) {
    if (!highlightEl || highlightEl.dataset.interactionsInitialized) {
      return;
    }

    const highlightId = highlightEl.dataset.highlightId;
    if (!highlightId) {
      return;
    }

    // Mark as initialized to prevent duplicate bindings
    highlightEl.dataset.interactionsInitialized = 'true';

    // Mouseenter - show tooltip if note exists
    highlightEl.addEventListener('mouseenter', () => {
      const highlight = getHighlightById(highlightId);
      if (highlight && highlight.note) {
        showNoteTooltip(highlight, highlightEl);
      }
    });

    // Mouseleave - hide tooltip with delay
    highlightEl.addEventListener('mouseleave', () => {
      hideNoteTooltipDelayed();
    });

    // Click - show editor
    highlightEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideNoteTooltip();
      const highlight = getHighlightById(highlightId);
      if (highlight) {
        showNoteEditor(highlight, highlightEl);
      }
    });
  }

  /**
   * Create and configure the tooltip element content
   * @param {Object} highlight - The highlight data object
   * @returns {Element} The configured tooltip element
   */
  function createTooltipElement(highlight) {
    const tooltip = ensureTooltipContainer();
    tooltip.innerHTML = `
      <div class="owc-note-tooltip-content">${escapeHtml(highlight.note || '')}</div>
    `;
    return tooltip;
  }

  /**
   * Show note tooltip near the highlight element
   * @param {Object} highlight - The highlight data object
   * @param {Element} targetElement - The highlight span element
   */
  function showNoteTooltip(highlight, targetElement) {
    if (!highlight || !highlight.note || !targetElement) {
      return;
    }

    // Clear any pending hide timeout
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }

    const tooltip = createTooltipElement(highlight);
    const position = getTooltipPosition(targetElement, 250, 200);

    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
    tooltip.style.display = 'block';

    // Add event listeners for tooltip hover (to keep it open when mouse enters tooltip)
    tooltip.onmouseenter = () => {
      if (hideTooltipTimeout) {
        clearTimeout(hideTooltipTimeout);
        hideTooltipTimeout = null;
      }
    };

    tooltip.onmouseleave = () => {
      hideNoteTooltipDelayed();
    };
  }

  /**
   * Hide note tooltip immediately
   */
  function hideNoteTooltip() {
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = null;
    }

    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
  }

  /**
   * Hide note tooltip with delay (300ms)
   * Allows user to move mouse into tooltip
   */
  function hideNoteTooltipDelayed() {
    if (hideTooltipTimeout) {
      clearTimeout(hideTooltipTimeout);
    }

    hideTooltipTimeout = setTimeout(() => {
      hideNoteTooltip();
    }, 300);
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create and configure the editor element content
   * @param {Object} highlight - The highlight data object
   * @returns {Element} The configured editor element
   */
  function createEditorElement(highlight) {
    const editor = ensureEditorContainer();
    editor.innerHTML = `
      <div class="owc-note-editor-header">
        <span class="owc-note-editor-title">编辑笔记</span>
      </div>
      <textarea class="owc-note-editor-textarea" placeholder="添加笔记...">${escapeHtml(highlight.note || '')}</textarea>
      <div class="owc-note-editor-actions">
        <div class="owc-note-editor-actions-left">
          <button class="owc-editor-btn delete" data-action="delete">删除高亮</button>
        </div>
        <div class="owc-note-editor-actions-right">
          <button class="owc-editor-btn cancel" data-action="cancel">取消</button>
          <button class="owc-editor-btn save" data-action="save">保存</button>
        </div>
      </div>
      <div class="owc-editor-hint">Enter 保存 · Escape 取消</div>
      <div class="owc-delete-confirmation" style="display: none;">
        <p style="color: #ef4444; margin: 0 0 12px 0; font-size: 13px;">确定要删除这个高亮吗？此操作不可撤销。</p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="owc-editor-btn cancel" data-action="cancel-delete">取消</button>
          <button class="owc-editor-btn delete" style="background: #ef4444; color: white; border: none;" data-action="confirm-delete">确认删除</button>
        </div>
      </div>
    `;
    return editor;
  }

  /**
   * Show note editor near the highlight element
   * @param {Object} highlight - The highlight data object
   * @param {Element} targetElement - The highlight span element
   */
  function showNoteEditor(highlight, targetElement) {
    if (!highlight || !targetElement) {
      return;
    }

    // Store current editing highlight ID
    currentEditingHighlightId = highlight.id;

    const editor = createEditorElement(highlight);
    const position = getTooltipPosition(targetElement, 300, 250);

    editor.style.left = `${position.left}px`;
    editor.style.top = `${position.top}px`;
    editor.style.display = 'block';

    // Focus textarea
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 50);
    }

    // Bind editor events
    bindEditorEvents(editor, highlight, targetElement);
  }

  /**
   * Bind events to editor buttons and textarea
   * @param {Element} editor - The editor element
   * @param {Object} highlight - The highlight data object
   * @param {Element} targetElement - The highlight span element
   */
  function bindEditorEvents(editor, highlight, targetElement) {
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    const saveBtn = editor.querySelector('[data-action="save"]');
    const cancelBtn = editor.querySelector('[data-action="cancel"]');
    const deleteBtn = editor.querySelector('[data-action="delete"]');
    const cancelDeleteBtn = editor.querySelector('[data-action="cancel-delete"]');
    const confirmDeleteBtn = editor.querySelector('[data-action="confirm-delete"]');
    const confirmationDiv = editor.querySelector('.owc-delete-confirmation');
    const editorContent = editor.querySelector('.owc-note-editor-header');

    // Save button
    if (saveBtn) {
      saveBtn.onclick = () => {
        saveNoteFromEditor(highlight.id, textarea.value);
        hideNoteEditor();
      };
    }

    // Cancel button
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        hideNoteEditor();
      };
    }

    // Delete button - show confirmation
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        showDeleteConfirmation(editor);
      };
    }

    // Cancel delete
    if (cancelDeleteBtn) {
      cancelDeleteBtn.onclick = () => {
        hideDeleteConfirmation(editor);
      };
    }

    // Confirm delete
    if (confirmDeleteBtn) {
      confirmDeleteBtn.onclick = () => {
        removeHighlight(highlight.id);
        hideNoteEditor();
      };
    }

    // Keyboard shortcuts
    if (textarea) {
      textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          saveNoteFromEditor(highlight.id, textarea.value);
          hideNoteEditor();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideNoteEditor();
        }
      };
    }

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }

  /**
   * Handle click outside editor to close it
   */
  function handleOutsideClick(e) {
    if (editorElement && !editorElement.contains(e.target) && 
        !e.target.closest('.owc-highlight')) {
      hideNoteEditor();
    }
  }

  /**
   * Hide note editor
   */
  function hideNoteEditor() {
    if (editorElement) {
      editorElement.style.display = 'none';
    }
    currentEditingHighlightId = null;
    document.removeEventListener('click', handleOutsideClick);
  }

  /**
   * Save note content from editor to highlight
   * @param {number} highlightId - The highlight ID
   * @param {string} noteContent - The new note content
   */
  function saveNoteFromEditor(highlightId, noteContent) {
    updateHighlightNote(highlightId, noteContent);
  }

  /**
   * Update highlight note in the highlights array
   * @param {number} highlightId - The highlight ID
   * @param {string} newNote - The new note content
   */
  function updateHighlightNote(highlightId, newNote) {
    const id = parseInt(highlightId, 10);
    const highlight = highlights.find(h => h.id === id);
    
    if (highlight) {
      highlight.note = newNote || null;
      
      // Update DOM element class
      const highlightEl = document.querySelector(`[data-highlight-id="${id}"]`);
      if (highlightEl) {
        if (newNote && newNote.trim()) {
          highlightEl.classList.add('has-note');
        } else {
          highlightEl.classList.remove('has-note');
        }
      }
    }
  }

  /**
   * Show delete confirmation in editor
   * @param {Element} editor - The editor element
   */
  function showDeleteConfirmation(editor) {
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    const actions = editor.querySelector('.owc-note-editor-actions');
    const hint = editor.querySelector('.owc-editor-hint');
    const confirmation = editor.querySelector('.owc-delete-confirmation');

    if (textarea) textarea.style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (hint) hint.style.display = 'none';
    if (confirmation) confirmation.style.display = 'block';
  }

  /**
   * Hide delete confirmation, return to edit mode
   * @param {Element} editor - The editor element
   */
  function hideDeleteConfirmation(editor) {
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    const actions = editor.querySelector('.owc-note-editor-actions');
    const hint = editor.querySelector('.owc-editor-hint');
    const confirmation = editor.querySelector('.owc-delete-confirmation');

    if (textarea) textarea.style.display = 'block';
    if (actions) actions.style.display = 'flex';
    if (hint) hint.style.display = 'block';
    if (confirmation) confirmation.style.display = 'none';
  }

  /**
   * Remove highlight from DOM and highlights array
   * @param {number} highlightId - The highlight ID to remove
   */
  function removeHighlight(highlightId) {
    const id = parseInt(highlightId, 10);
    const wrapper = document.querySelector(`[data-highlight-id="${id}"]`);
    
    if (wrapper && wrapper.parentNode) {
      // Create text node with original content
      const textNode = document.createTextNode(wrapper.textContent);
      // Replace wrapper with text node
      wrapper.parentNode.replaceChild(textNode, wrapper);
    }

    // Remove from highlights array
    highlights = highlights.filter(h => h.id !== id);
  }

  // ===== T007-T013: Note Editor for New Highlights =====

  // State for pending new highlight
  let pendingHighlightText = null;
  let pendingHighlightRange = null; // Store the selection range

  /**
   * T007: Show note editor for creating a new highlight with note
   * @param {string} text - The selected text to highlight
   * @param {{left: number, top: number}} position - Position to show editor
   * @param {Range} range - The selection range to preserve
   */
  function showNoteEditorForNewHighlight(text, position, range) {
    if (!text) return;
    
    // Store pending text and range
    pendingHighlightText = text;
    pendingHighlightRange = range;
    
    // Create editor element for new highlight (T008: no delete button)
    const editor = createNewHighlightEditorElement();
    
    // Position the editor
    const editorWidth = 300;
    const editorHeight = 200;
    let left = position?.left || 100;
    let top = position?.top || 100;
    
    // Boundary checks
    if (left + editorWidth > window.innerWidth) {
      left = window.innerWidth - editorWidth - 10;
    }
    if (left < 10) left = 10;
    if (top + editorHeight > window.innerHeight) {
      top = window.innerHeight - editorHeight - 10;
    }
    if (top < 10) top = 10;
    
    editor.style.left = `${left}px`;
    editor.style.top = `${top}px`;
    editor.style.display = 'block';
    
    // Focus textarea
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
      }, 50);
    }
    
    // Bind events
    bindNewHighlightEditorEvents(editor);
  }

  /**
   * T008: Create editor element for new highlight (without delete button)
   * @returns {Element} The configured editor element
   */
  function createNewHighlightEditorElement() {
    const editor = ensureEditorContainer();
    editor.innerHTML = `
      <div class="owc-note-editor-header">
        <span class="owc-note-editor-title">添加笔记</span>
      </div>
      <textarea class="owc-note-editor-textarea" placeholder="输入笔记内容..."></textarea>
      <div class="owc-note-editor-actions">
        <div class="owc-note-editor-actions-left"></div>
        <div class="owc-note-editor-actions-right">
          <button class="owc-editor-btn cancel" data-action="cancel">取消</button>
          <button class="owc-editor-btn save" data-action="save">保存</button>
        </div>
      </div>
      <div class="owc-editor-hint">Enter 保存 · Escape 取消</div>
    `;
    return editor;
  }

  /**
   * T011-T013: Bind events for new highlight editor
   * @param {Element} editor - The editor element
   */
  function bindNewHighlightEditorEvents(editor) {
    const textarea = editor.querySelector('.owc-note-editor-textarea');
    const saveBtn = editor.querySelector('[data-action="save"]');
    const cancelBtn = editor.querySelector('[data-action="cancel"]');

    // T011: Save button - create highlight with note
    if (saveBtn) {
      saveBtn.onclick = () => {
        const note = textarea ? textarea.value.trim() : '';
        if (pendingHighlightText && pendingHighlightRange) {
          // T009: Create highlight with note using stored range
          saveNewHighlightWithNote(pendingHighlightText, note, pendingHighlightRange);
        }
        hideNoteEditor();
        pendingHighlightText = null;
        pendingHighlightRange = null;
      };
    }

    // T012: Cancel button - close without creating highlight
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        hideNoteEditor();
        pendingHighlightText = null;
        pendingHighlightRange = null;
      };
    }

    // T013: Keyboard shortcuts - Enter to save, Escape to cancel
    if (textarea) {
      textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const note = textarea.value.trim();
          if (pendingHighlightText && pendingHighlightRange) {
            saveNewHighlightWithNote(pendingHighlightText, note, pendingHighlightRange);
          }
          hideNoteEditor();
          pendingHighlightText = null;
          pendingHighlightRange = null;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideNoteEditor();
          pendingHighlightText = null;
          pendingHighlightRange = null;
        }
      };
    }

    // Click outside to cancel
    setTimeout(() => {
      document.addEventListener('click', handleNewHighlightOutsideClick);
    }, 100);
  }

  /**
   * Handle click outside new highlight editor
   */
  function handleNewHighlightOutsideClick(e) {
    if (editorElement && !editorElement.contains(e.target) && 
        !e.target.closest('.owc-selection-menu')) {
      hideNoteEditor();
      pendingHighlightText = null;
      pendingHighlightRange = null;
      document.removeEventListener('click', handleNewHighlightOutsideClick);
    }
  }

  /**
   * T009: Create a new highlight with the given note using stored range
   * @param {string} text - The text to highlight
   * @param {string} note - The note content
   * @param {Range} range - The stored selection range
   */
  function saveNewHighlightWithNote(text, note, range) {
    if (!range) return;
    
    const wrapper = document.createElement('span');
    wrapper.className = 'owc-highlight' + (note ? ' has-note' : '');
    wrapper.dataset.highlightId = ++highlightIdCounter;
    
    try {
      range.surroundContents(wrapper);
    } catch (e) {
      // Handle complex selections that cross element boundaries
      const contents = range.extractContents();
      wrapper.appendChild(contents);
      range.insertNode(wrapper);
    }
    
    highlights.push({
      id: highlightIdCounter,
      text,
      note: note || null,
      color: '#ffeb3b',
      position: highlights.length
    });
    
    // Initialize interaction events for the new highlight
    initHighlightInteractions(wrapper);
  }

  console.log('Obsidian Web Clipper: Content script loaded');
}
