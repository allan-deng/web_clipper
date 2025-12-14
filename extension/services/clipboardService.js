/**
 * Clipboard Service - Handles clipboard operations
 * 
 * Uses the modern Clipboard API (navigator.clipboard.writeText)
 * for secure, async clipboard access.
 */

// Error type constants
export const ClipboardErrorType = {
  CLIPBOARD_DENIED: 'CLIPBOARD_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// User-friendly error messages (Chinese)
const ERROR_MESSAGES = {
  [ClipboardErrorType.CLIPBOARD_DENIED]: '无法访问剪贴板，请检查浏览器权限设置',
  [ClipboardErrorType.UNKNOWN_ERROR]: '复制失败，请重试'
};

/**
 * Copy text to the system clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<{success: boolean, error?: string, errorType?: string}>}
 */
export async function copyToClipboard(text) {
  if (!text) {
    return {
      success: false,
      error: '没有内容可复制',
      errorType: ClipboardErrorType.UNKNOWN_ERROR
    };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('Clipboard write failed:', error);
    
    // Determine error type
    let errorType = ClipboardErrorType.UNKNOWN_ERROR;
    
    if (error.name === 'NotAllowedError' || 
        error.message.includes('permission') ||
        error.message.includes('denied')) {
      errorType = ClipboardErrorType.CLIPBOARD_DENIED;
    }
    
    return {
      success: false,
      error: ERROR_MESSAGES[errorType],
      errorType
    };
  }
}

/**
 * Get user-friendly error message for an error type
 * @param {string} errorType - The error type constant
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(errorType) {
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES[ClipboardErrorType.UNKNOWN_ERROR];
}

export default {
  copyToClipboard,
  getErrorMessage,
  ClipboardErrorType
};
