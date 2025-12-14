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
    // Inject highlight styles
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
      .owc-selection-menu {
        position: fixed;
        z-index: 2147483647;
        background: #1e1e1e;
        border: 1px solid #404040;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        padding: 8px;
        display: none;
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
        const note = prompt('Add a note:');
        if (note !== null) {
          addHighlight(text, note);
        }
        menu.style.display = 'none';
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
      
      selection.removeAllRanges();
    }
  }

  console.log('Obsidian Web Clipper: Content script loaded');
}
