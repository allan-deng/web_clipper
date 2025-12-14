/**
 * Content Extractor Service
 * 
 * Uses Readability.js to extract main article content from web pages.
 */

/**
 * Content extraction result
 * @typedef {Object} ExtractionResult
 * @property {string} title - Article title
 * @property {string} content - Cleaned HTML content
 * @property {string} textContent - Plain text content
 * @property {string} excerpt - Short excerpt
 * @property {string} byline - Author information
 * @property {number} length - Content length
 */

/**
 * Extract main article content from the current page
 * @returns {ExtractionResult} Extracted content
 */
export function extractContent() {
  // Clone the document to avoid modifying the original
  const documentClone = document.cloneNode(true);
  
  // Remove script and style elements from clone
  const scripts = documentClone.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());
  
  // Try to use Readability if available
  if (typeof Readability !== 'undefined') {
    try {
      const reader = new Readability(documentClone, {
        charThreshold: 100,
        classesToPreserve: ['highlight', 'code', 'pre']
      });
      
      const article = reader.parse();
      
      if (article && article.content) {
        return {
          title: article.title || document.title || 'Untitled',
          content: article.content,
          textContent: article.textContent || '',
          excerpt: article.excerpt || '',
          byline: article.byline || '',
          length: article.length || 0
        };
      }
    } catch (error) {
      console.warn('Readability extraction failed:', error);
    }
  }
  
  // Fallback: extract content manually
  return extractFallback();
}

/**
 * Fallback extraction when Readability is not available or fails
 * @returns {ExtractionResult} Extracted content
 */
function extractFallback() {
  // Try to find article content by common selectors
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post',
    '.article'
  ];
  
  let contentElement = null;
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 200) {
      contentElement = element;
      break;
    }
  }
  
  // If no content element found, use body
  if (!contentElement) {
    contentElement = document.body;
  }
  
  // Clone and clean the content
  const clone = contentElement.cloneNode(true);
  
  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'noscript', 'iframe',
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.navigation', '.menu', '.comments',
    '.advertisement', '.ad', '.social-share',
    '[role="navigation"]', '[role="banner"]'
  ];
  
  for (const selector of unwantedSelectors) {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  }
  
  const title = extractTitle();
  const content = clone.innerHTML;
  const textContent = clone.textContent || '';
  
  return {
    title,
    content,
    textContent,
    excerpt: textContent.substring(0, 200).trim(),
    byline: extractByline(),
    length: textContent.length
  };
}

/**
 * Extract article title
 * @returns {string} Article title
 */
function extractTitle() {
  // Try various sources for title
  const sources = [
    () => document.querySelector('h1')?.textContent,
    () => document.querySelector('[property="og:title"]')?.getAttribute('content'),
    () => document.querySelector('[name="twitter:title"]')?.getAttribute('content'),
    () => document.querySelector('title')?.textContent,
    () => document.title
  ];
  
  for (const getTitle of sources) {
    try {
      const title = getTitle();
      if (title && title.trim()) {
        // Clean up title
        return title.trim()
          .replace(/\s+/g, ' ')
          .replace(/\|.*$/, '')
          .replace(/-.*$/, '')
          .trim() || 'Untitled';
      }
    } catch (e) {
      continue;
    }
  }
  
  return 'Untitled';
}

/**
 * Extract author/byline information
 * @returns {string} Author information
 */
function extractByline() {
  const selectors = [
    '[rel="author"]',
    '.author',
    '.byline',
    '[property="article:author"]',
    '[name="author"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent || element.getAttribute('content');
      if (text && text.trim()) {
        return text.trim();
      }
    }
  }
  
  return '';
}

/**
 * Extract page metadata
 * @returns {Object} Page metadata
 */
export function extractMetadata() {
  return {
    title: extractTitle(),
    url: window.location.href,
    domain: window.location.hostname,
    description: getMetaContent('description') || getMetaContent('og:description') || '',
    image: getMetaContent('og:image') || '',
    publishedTime: getMetaContent('article:published_time') || '',
    author: extractByline()
  };
}

/**
 * Get content from a meta tag
 * @param {string} name - Meta tag name or property
 * @returns {string|null} Meta content
 */
function getMetaContent(name) {
  const meta = document.querySelector(
    `meta[name="${name}"], meta[property="${name}"]`
  );
  return meta?.getAttribute('content') || null;
}

export default {
  extractContent,
  extractMetadata
};
