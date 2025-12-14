/**
 * HTML to Markdown Converter Service
 * 
 * Uses Turndown.js to convert HTML content to Markdown format.
 */

/**
 * Converter options
 * @typedef {Object} ConverterOptions
 * @property {string} headingStyle - 'atx' (# style) or 'setext' (underline style)
 * @property {string} codeBlockStyle - 'fenced' (```) or 'indented'
 * @property {string} bulletListMarker - '-', '*', or '+'
 * @property {boolean} preserveImageDimensions - Keep width/height attributes
 */

/**
 * Default converter options
 */
const defaultOptions = {
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
  preserveImageDimensions: false
};

/**
 * Create a configured Turndown instance
 * @param {ConverterOptions} options - Converter options
 * @returns {TurndownService} Configured Turndown instance
 */
export function createConverter(options = {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  
  if (typeof TurndownService === 'undefined') {
    throw new Error('TurndownService is not available');
  }
  
  const turndownService = new TurndownService(mergedOptions);
  
  // Add custom rules
  addCustomRules(turndownService);
  
  return turndownService;
}

/**
 * Add custom conversion rules
 * @param {TurndownService} turndownService - Turndown instance
 */
function addCustomRules(turndownService) {
  // Preserve code block language
  turndownService.addRule('fencedCodeBlock', {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement: function (content, node, options) {
      const codeElement = node.firstChild;
      const className = codeElement.getAttribute('class') || '';
      const languageMatch = className.match(/language-(\w+)/);
      const language = languageMatch ? languageMatch[1] : '';
      
      const code = codeElement.textContent || '';
      const fence = '```';
      
      return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
    }
  });
  
  // Handle figure elements with captions
  turndownService.addRule('figure', {
    filter: 'figure',
    replacement: function (content, node) {
      const img = node.querySelector('img');
      const figcaption = node.querySelector('figcaption');
      
      if (!img) {
        return content;
      }
      
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || '';
      const caption = figcaption ? figcaption.textContent.trim() : alt;
      
      return `\n\n![${caption}](${src})\n\n`;
    }
  });
  
  // Handle strikethrough
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: function (content) {
      return '~~' + content + '~~';
    }
  });
  
  // Handle subscript
  turndownService.addRule('subscript', {
    filter: 'sub',
    replacement: function (content) {
      return '~' + content + '~';
    }
  });
  
  // Handle superscript
  turndownService.addRule('superscript', {
    filter: 'sup',
    replacement: function (content) {
      return '^' + content + '^';
    }
  });
  
  // Handle mark/highlight
  turndownService.addRule('mark', {
    filter: 'mark',
    replacement: function (content) {
      return '==' + content + '==';
    }
  });
  
  // Handle keyboard input
  turndownService.addRule('kbd', {
    filter: 'kbd',
    replacement: function (content) {
      return '`' + content + '`';
    }
  });
  
  // Remove empty links
  turndownService.addRule('emptyLink', {
    filter: function (node) {
      return node.nodeName === 'A' && !node.textContent.trim() && !node.querySelector('img');
    },
    replacement: function () {
      return '';
    }
  });
  
  // Handle tables better
  turndownService.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: function (content, node) {
      return ' ' + content.trim().replace(/\n/g, ' ') + ' |';
    }
  });
  
  // Keep certain elements as-is
  turndownService.keep(['iframe', 'video', 'audio']);
  
  // Remove unwanted elements
  turndownService.remove(['script', 'style', 'noscript', 'nav', 'footer', 'header']);
}

/**
 * Convert HTML to Markdown
 * @param {string} html - HTML content
 * @param {ConverterOptions} options - Converter options
 * @returns {string} Markdown content
 */
export function convertToMarkdown(html, options = {}) {
  if (!html) {
    return '';
  }
  
  try {
    const converter = createConverter(options);
    let markdown = converter.turndown(html);
    
    // Post-processing cleanup
    markdown = cleanupMarkdown(markdown);
    
    return markdown;
  } catch (error) {
    console.error('Markdown conversion failed:', error);
    // Fallback: strip HTML tags
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Clean up converted Markdown
 * @param {string} markdown - Raw markdown
 * @returns {string} Cleaned markdown
 */
function cleanupMarkdown(markdown) {
  return markdown
    // Remove excessive blank lines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Fix spacing around headers
    .replace(/\n(#+)\s*/g, '\n\n$1 ')
    // Ensure proper spacing after lists
    .replace(/(\n- [^\n]+)\n([^-\n])/g, '$1\n\n$2')
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, '')
    // Ensure file ends with newline
    .trim() + '\n';
}

/**
 * Convert HTML element to Markdown
 * @param {Element} element - DOM element
 * @param {ConverterOptions} options - Converter options
 * @returns {string} Markdown content
 */
export function convertElementToMarkdown(element, options = {}) {
  if (!element) {
    return '';
  }
  
  return convertToMarkdown(element.innerHTML, options);
}

export default {
  createConverter,
  convertToMarkdown,
  convertElementToMarkdown
};
