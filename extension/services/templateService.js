/**
 * Template Service for Markdown Generation
 * 
 * Provides a simple placeholder-based template system for generating
 * Markdown documents from web clip data.
 */

/**
 * Default Markdown template with all supported placeholders
 */
export const DEFAULT_TEMPLATE = `---
title: "{{title}}"
url: "{{url}}"
date: {{date}}
tags:
{{tags}}
---

{{ai_summary}}

{{highlights}}

## 正文

{{content}}`;

/**
 * Maximum allowed template length (characters)
 */
export const MAX_TEMPLATE_LENGTH = 5000;

/**
 * Supported placeholders and their descriptions
 */
export const PLACEHOLDER_DOCS = [
  { placeholder: '{{title}}', description: '文章标题' },
  { placeholder: '{{url}}', description: '原始网页 URL' },
  { placeholder: '{{domain}}', description: '来源域名' },
  { placeholder: '{{date}}', description: '保存日期 (YYYY-MM-DD)' },
  { placeholder: '{{datetime}}', description: '保存时间 (ISO 8601)' },
  { placeholder: '{{tags}}', description: '标签列表 (YAML 格式)' },
  { placeholder: '{{ai_summary}}', description: 'AI 摘要 (如有)' },
  { placeholder: '{{highlights}}', description: '高亮笔记 (如有)' },
  { placeholder: '{{content}}', description: '正文内容' }
];

/**
 * Render a template with the given data
 * @param {string} template - The template string with {{placeholder}} syntax
 * @param {Object} data - The data object containing values for placeholders
 * @returns {string} The rendered template
 */
export function renderTemplate(template, data) {
  if (!template) {
    template = DEFAULT_TEMPLATE;
  }

  // Prepare all placeholder values
  const values = {
    title: escapeYamlString(data.title || ''),
    url: escapeYamlString(data.url || ''),
    domain: data.domain || '',
    date: formatDate(data.savedAt || data.datetime),
    datetime: data.savedAt || data.datetime || new Date().toISOString(),
    tags: formatTags(data.tags),
    ai_summary: formatAISummary(data.aiSummary),
    highlights: formatHighlights(data.highlights),
    content: data.content || data.markdown || ''
  };

  // Replace all placeholders
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }

  return result;
}

/**
 * Format date from ISO 8601 timestamp to YYYY-MM-DD
 * @param {string} datetime - ISO 8601 timestamp
 * @returns {string} Formatted date
 */
function formatDate(datetime) {
  if (!datetime) {
    return new Date().toISOString().split('T')[0];
  }
  
  try {
    const date = new Date(datetime);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Format tags array to YAML list format
 * @param {string[]} tags - Array of tag strings
 * @returns {string} YAML formatted tags
 */
function formatTags(tags) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  
  return tags.map(tag => `  - ${tag}`).join('\n');
}

/**
 * Format AI summary for template
 * @param {Object|string} aiSummary - AI summary object or raw text
 * @returns {string} Formatted AI summary section
 */
function formatAISummary(aiSummary) {
  if (!aiSummary) {
    return '';
  }

  // Handle raw text string
  if (typeof aiSummary === 'string') {
    if (!aiSummary.trim()) {
      return '';
    }
    return `## 摘要\n\n${aiSummary}\n\n---\n`;
  }

  // Handle object with status
  if (aiSummary.status !== 'SUCCESS') {
    return '';
  }

  // Use rawText if available
  if (aiSummary.rawText && aiSummary.rawText.trim()) {
    return `## 摘要\n\n${aiSummary.rawText}\n\n---\n`;
  }

  return '';
}

/**
 * Format highlights array for template
 * @param {Object[]} highlights - Array of highlight objects
 * @returns {string} Formatted highlights section
 */
function formatHighlights(highlights) {
  if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
    return '';
  }

  // Sort by position
  const sorted = [...highlights].sort((a, b) => (a.position || 0) - (b.position || 0));

  const lines = ['## 我的笔记', ''];
  
  for (const highlight of sorted) {
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
 * Escape special characters in YAML string values
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeYamlString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Load template from Chrome Storage
 * @returns {Promise<string>} The saved template or default template
 */
export async function loadTemplate() {
  try {
    const config = await chrome.storage.local.get(['markdownTemplate']);
    return config.markdownTemplate || DEFAULT_TEMPLATE;
  } catch (error) {
    console.warn('Failed to load template from storage:', error);
    return DEFAULT_TEMPLATE;
  }
}

/**
 * Save template to Chrome Storage
 * @param {string} template - The template to save
 * @returns {Promise<void>}
 */
export async function saveTemplate(template) {
  if (template && template.length > MAX_TEMPLATE_LENGTH) {
    throw new Error(`模版长度不能超过 ${MAX_TEMPLATE_LENGTH} 字符`);
  }
  
  await chrome.storage.local.set({ 
    markdownTemplate: template || null 
  });
}

/**
 * Generate complete Markdown from clip data using the saved template
 * @param {Object} clipData - The clip data object
 * @returns {Promise<string>} The rendered Markdown
 */
export async function generateMarkdown(clipData) {
  const template = await loadTemplate();
  
  // Prepare data for template
  const data = {
    title: clipData.metadata?.title || '',
    url: clipData.metadata?.url || '',
    domain: clipData.metadata?.domain || '',
    savedAt: clipData.metadata?.savedAt || new Date().toISOString(),
    tags: clipData.metadata?.tags || [],
    aiSummary: clipData.content?.aiSummary || clipData.aiSummary || null,
    highlights: clipData.content?.highlights || clipData.highlights || [],
    content: clipData.content?.markdown || clipData.markdown || ''
  };

  return renderTemplate(template, data);
}

export default {
  DEFAULT_TEMPLATE,
  MAX_TEMPLATE_LENGTH,
  PLACEHOLDER_DOCS,
  renderTemplate,
  loadTemplate,
  saveTemplate,
  generateMarkdown
};
