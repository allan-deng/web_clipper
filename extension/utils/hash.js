/**
 * Hash utility functions for generating file names
 */

/**
 * Generate SHA-256 hash of a string
 * @param {string} str - The string to hash
 * @returns {Promise<string>} Hexadecimal hash string
 */
export async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate SHA-256 hash of an ArrayBuffer
 * @param {ArrayBuffer} buffer - The buffer to hash
 * @returns {Promise<string>} Hexadecimal hash string
 */
export async function sha256Buffer(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a short hash (first 8 characters) suitable for filenames
 * @param {string} str - The string to hash
 * @returns {Promise<string>} Short hash string
 */
export async function shortHash(str) {
  const hash = await sha256(str);
  return hash.substring(0, 8);
}

/**
 * Generate a unique filename from URL using hash
 * @param {string} url - The URL to hash
 * @param {string} extension - File extension (e.g., 'png', 'jpg')
 * @returns {Promise<string>} Filename in format {hash}.{ext}
 */
export async function hashFilename(url, extension) {
  const hash = await shortHash(url);
  return `${hash}.${extension}`;
}

export default {
  sha256,
  sha256Buffer,
  shortHash,
  hashFilename
};
