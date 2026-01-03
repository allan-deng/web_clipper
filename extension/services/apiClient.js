/**
 * API Client for communicating with the Web Clipper backend
 */

export class ApiClient {
  /**
   * Create an API client
   * @param {string} serverUrl - Base URL of the backend server
   * @param {string} authToken - Bearer token for authentication
   */
  constructor(serverUrl, authToken) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authToken = authToken;
  }

  /**
   * Make an authenticated request to the API
   * @param {string} endpoint - API endpoint (e.g., '/api/v1/save')
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.serverUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.msg || `HTTP ${response.status}`,
          data.code || response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network error or other fetch error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ApiError('Cannot connect to server. Is the backend running?', 0);
      }
      
      throw new ApiError(error.message, 0);
    }
  }

  /**
   * Check if the backend server is healthy
   * @returns {Promise<boolean>} True if healthy
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Save a web clip to the backend
   * @param {Object} clipData - The clip data to save
   * @returns {Promise<Object>} Save result
   */
  async save(clipData) {
    const response = await this.request('/api/v1/save', {
      method: 'POST',
      body: JSON.stringify(clipData)
    });

    if (response.code !== 0) {
      throw new ApiError(response.msg, response.code);
    }

    return response.data;
  }
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  /**
   * Create an API error
   * @param {string} message - Error message
   * @param {number} code - Error code from the API
   */
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }

  /**
   * Get a user-friendly error message based on error code
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    switch (this.code) {
      case 0:
        return this.message; // Network error or unknown
      case 1001:
        return 'Authentication failed. Please check your auth token in settings.';
      case 1002:
        return 'Invalid request format.';
      case 2001:
        return 'Failed to create directory in vault.';
      case 2002:
        return 'Failed to write markdown file.';
      case 2003:
        return 'Failed to save one or more images.';
      case 2004:
        return 'Permission denied. Check vault directory permissions.';
      case 3001:
        return 'Security error: Invalid filename detected.';
      default:
        return this.message || 'An unknown error occurred.';
    }
  }
}

// Export for use in other modules
export default ApiClient;
