/**
 * AI Service
 * 
 * Handles AI-powered summarization using OpenAI or Anthropic APIs.
 * Generates article summaries, key points, and auto-tags.
 */

/**
 * AI Summary result
 * @typedef {Object} AISummaryResult
 * @property {string[]} keyPoints - Core arguments/points (3-7)
 * @property {Object[]} evidence - Supporting quotes
 * @property {string} mermaidDiagram - Mermaid diagram code
 * @property {string[]} tags - Auto-generated tags (3-5)
 * @property {string} status - SUCCESS, PENDING, or FAILED
 */

/**
 * Supported AI providers
 */
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic'
};

/**
 * Get AI configuration from storage
 * @returns {Promise<Object>} AI configuration
 */
async function getAIConfig() {
  const config = await chrome.storage.sync.get([
    'aiEnabled',
    'aiProvider',
    'aiApiKey',
    'aiModel'
  ]);
  
  return {
    enabled: config.aiEnabled || false,
    provider: config.aiProvider || AI_PROVIDERS.OPENAI,
    apiKey: config.aiApiKey || '',
    model: config.aiModel || 'gpt-4'
  };
}

/**
 * Check if AI service is available
 * @returns {Promise<boolean>} Whether AI is enabled and configured
 */
export async function isAIAvailable() {
  const config = await getAIConfig();
  return config.enabled && config.apiKey.length > 0;
}

/**
 * Generate AI summary for article content
 * @param {string} title - Article title
 * @param {string} content - Article text content
 * @returns {Promise<AISummaryResult>} Generated summary
 */
export async function generateSummary(title, content) {
  const config = await getAIConfig();
  
  if (!config.enabled || !config.apiKey) {
    return createPendingResult();
  }
  
  try {
    // Truncate content if too long (max ~4000 tokens worth)
    const truncatedContent = truncateContent(content, 12000);
    
    const prompt = buildSummaryPrompt(title, truncatedContent);
    
    let response;
    if (config.provider === AI_PROVIDERS.ANTHROPIC) {
      response = await callAnthropic(config.apiKey, config.model, prompt);
    } else {
      response = await callOpenAI(config.apiKey, config.model, prompt);
    }
    
    return parseSummaryResponse(response);
    
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return createFailedResult(error.message);
  }
}

/**
 * Generate auto-tags for article
 * @param {string} title - Article title
 * @param {string} content - Article text content
 * @returns {Promise<string[]>} Generated tags
 */
export async function generateTags(title, content) {
  const config = await getAIConfig();
  
  if (!config.enabled || !config.apiKey) {
    return [];
  }
  
  try {
    const truncatedContent = truncateContent(content, 4000);
    const prompt = buildTagsPrompt(title, truncatedContent);
    
    let response;
    if (config.provider === AI_PROVIDERS.ANTHROPIC) {
      response = await callAnthropic(config.apiKey, config.model, prompt);
    } else {
      response = await callOpenAI(config.apiKey, config.model, prompt);
    }
    
    return parseTagsResponse(response);
    
  } catch (error) {
    console.error('AI tag generation failed:', error);
    return [];
  }
}

/**
 * Call OpenAI API
 * @param {string} apiKey - API key
 * @param {string} model - Model name
 * @param {string} prompt - Prompt text
 * @returns {Promise<string>} Response text
 */
async function callOpenAI(apiKey, model, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing and summarizing articles. Always respond in JSON format as specified.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Call Anthropic API
 * @param {string} apiKey - API key
 * @param {string} model - Model name
 * @param {string} prompt - Prompt text
 * @returns {Promise<string>} Response text
 */
async function callAnthropic(apiKey, model, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Build prompt for summary generation
 */
function buildSummaryPrompt(title, content) {
  return `Analyze the following article and provide a structured summary.

Title: ${title}

Content:
${content}

Please respond with a JSON object containing:
1. "keyPoints": An array of 3-7 core arguments or main points (each as a string)
2. "evidence": An array of objects with "point" (which keyPoint it supports) and "quote" (exact quote from article)
3. "mermaidDiagram": A Mermaid diagram (flowchart or mindmap) showing the logical structure of the article

Response format:
{
  "keyPoints": ["point 1", "point 2", ...],
  "evidence": [{"point": "point 1", "quote": "..."}, ...],
  "mermaidDiagram": "graph TD\\n    A[Main Topic] --> B[Subtopic]\\n    ..."
}

Important:
- Write keyPoints in the same language as the article
- Keep quotes short (under 100 characters)
- Make the Mermaid diagram simple but meaningful
- Respond ONLY with valid JSON, no additional text`;
}

/**
 * Build prompt for tag generation
 */
function buildTagsPrompt(title, content) {
  return `Based on the following article, generate 3-5 relevant tags for categorization.

Title: ${title}

Content (excerpt):
${content}

Requirements:
- Generate 3-5 tags
- Tags should be concise (1-3 words each)
- Use the same language as the article
- Focus on main topics, concepts, or categories
- Avoid overly generic tags

Response format (JSON array only):
["tag1", "tag2", "tag3"]

Respond ONLY with the JSON array, no additional text.`;
}

/**
 * Parse summary response from AI
 */
function parseSummaryResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 7) : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 5) : [],
      mermaidDiagram: typeof parsed.mermaidDiagram === 'string' ? parsed.mermaidDiagram : '',
      status: 'SUCCESS'
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return createFailedResult('Failed to parse AI response');
  }
}

/**
 * Parse tags response from AI
 */
function parseTagsResponse(response) {
  try {
    // Try to extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (Array.isArray(parsed)) {
      return parsed
        .filter(tag => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 5);
    }
    
    return [];
  } catch (error) {
    console.error('Failed to parse tags response:', error);
    return [];
  }
}

/**
 * Truncate content to approximate token limit
 */
function truncateContent(content, maxChars) {
  if (content.length <= maxChars) {
    return content;
  }
  
  // Try to truncate at a sentence boundary
  const truncated = content.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('。');
  const lastPeriod = truncated.lastIndexOf('. ');
  const cutPoint = Math.max(lastSentence, lastPeriod);
  
  if (cutPoint > maxChars * 0.7) {
    return truncated.substring(0, cutPoint + 1);
  }
  
  return truncated + '...';
}

/**
 * Create a pending result (AI not available)
 */
function createPendingResult() {
  return {
    keyPoints: [],
    evidence: [],
    mermaidDiagram: '',
    status: 'PENDING'
  };
}

/**
 * Create a failed result
 */
function createFailedResult(error) {
  return {
    keyPoints: [],
    evidence: [],
    mermaidDiagram: '',
    status: 'FAILED',
    error: error
  };
}

export default {
  isAIAvailable,
  generateSummary,
  generateTags,
  AI_PROVIDERS
};
