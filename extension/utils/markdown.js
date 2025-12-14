/**
 * Markdown formatting utilities
 */

/**
 * Generate YAML frontmatter for article metadata
 * @param {Object} metadata - Article metadata
 * @returns {string} YAML frontmatter string
 */
export function generateFrontmatter(metadata) {
  const lines = ['---'];
  
  lines.push(`title: "${escapeYamlString(metadata.title)}"`);
  lines.push(`url: "${escapeYamlString(metadata.url)}"`);
  lines.push(`date: ${extractDate(metadata.savedAt)}`);
  lines.push(`source: "${escapeYamlString(metadata.domain)}"`);
  
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push('tags:');
    for (const tag of metadata.tags) {
      lines.push(`  - ${tag}`);
    }
  }
  
  lines.push('---');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate AI summary section
 * @param {Object} aiSummary - AI summary data
 * @returns {string} Markdown section for AI summary
 */
export function generateAISummarySection(aiSummary) {
  if (!aiSummary) {
    return '';
  }
  
  const lines = ['## AI 摘要', ''];
  
  if (aiSummary.status === 'PENDING') {
    lines.push('<!-- AI_PENDING: 摘要待生成 -->');
    lines.push('');
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }
  
  if (aiSummary.status !== 'SUCCESS') {
    return '';
  }
  
  // Key points
  if (aiSummary.keyPoints && aiSummary.keyPoints.length > 0) {
    lines.push('### 核心观点');
    lines.push('');
    for (const point of aiSummary.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }
  
  // Evidence/quotes
  if (aiSummary.evidence && aiSummary.evidence.length > 0) {
    lines.push('### 论据引用');
    lines.push('');
    for (const evidence of aiSummary.evidence) {
      lines.push(`> **${evidence.point}**`);
      lines.push(`> `);
      lines.push(`> "${evidence.quote}"`);
      lines.push('');
    }
  }
  
  // Mermaid diagram
  if (aiSummary.mermaidDiagram) {
    lines.push('### 逻辑关系图');
    lines.push('');
    lines.push('```mermaid');
    lines.push(aiSummary.mermaidDiagram);
    lines.push('```');
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate highlights/notes section
 * @param {Array} highlights - Array of highlight objects
 * @returns {string} Markdown section for highlights
 */
export function generateHighlightsSection(highlights) {
  if (!highlights || highlights.length === 0) {
    return '';
  }
  
  const lines = ['## 我的笔记', ''];
  
  // Sort highlights by position
  const sortedHighlights = [...highlights].sort((a, b) => a.position - b.position);
  
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
 * Assemble complete markdown document
 * @param {Object} metadata - Article metadata
 * @param {Object} content - Content with markdown, aiSummary, highlights
 * @returns {string} Complete markdown document
 */
export function assembleMarkdown(metadata, content) {
  const parts = [];
  
  // Frontmatter
  parts.push(generateFrontmatter(metadata));
  
  // AI Summary (if available)
  if (content.aiSummary) {
    parts.push(generateAISummarySection(content.aiSummary));
  }
  
  // Highlights section (if any)
  if (content.highlights && content.highlights.length > 0) {
    parts.push(generateHighlightsSection(content.highlights));
  }
  
  // Main content
  parts.push('## 正文');
  parts.push('');
  parts.push(content.markdown);
  
  return parts.join('\n');
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
 * Extract date from ISO 8601 timestamp
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {string} Date in YYYY-MM-DD format
 */
function extractDate(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export default {
  generateFrontmatter,
  generateAISummarySection,
  generateHighlightsSection,
  assembleMarkdown
};
