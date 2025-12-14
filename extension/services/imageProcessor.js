/**
 * Image Processor Service
 * 
 * Downloads images from web pages, converts them to Base64,
 * and generates hash-based filenames for local storage.
 */

import { sha256 } from '../utils/hash.js';

// Maximum image size in bytes (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Download timeout in milliseconds (30 seconds)
const DOWNLOAD_TIMEOUT = 30000;

/**
 * Asset status enum
 */
export const AssetStatus = {
  SUCCESS: 'SUCCESS',
  SKIPPED_TOO_LARGE: 'SKIPPED_TOO_LARGE',
  FAILED_DOWNLOAD: 'FAILED_DOWNLOAD',
  FAILED_CORS: 'FAILED_CORS'
};

/**
 * Processed asset result
 * @typedef {Object} ProcessedAsset
 * @property {string|null} filename - Generated filename (null if failed)
 * @property {string} originalUrl - Original image URL
 * @property {string|null} base64 - Base64 encoded data (null if failed)
 * @property {string|null} mimeType - MIME type
 * @property {number} size - File size in bytes
 * @property {string} status - Processing status
 */

/**
 * Process all images in HTML content
 * @param {string} html - HTML content with images
 * @returns {Promise<{html: string, assets: ProcessedAsset[]}>} Processed HTML and assets
 */
export async function processImages(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const images = tempDiv.querySelectorAll('img');
  const assets = [];
  const urlToFilename = new Map();
  
  // Process images in parallel with concurrency limit
  const imagePromises = Array.from(images).map(async (img) => {
    const src = img.src || img.getAttribute('data-src');
    
    if (!src) {
      return null;
    }
    
    // Skip data URLs (already inline)
    if (src.startsWith('data:')) {
      return null;
    }
    
    // Skip already processed URLs
    if (urlToFilename.has(src)) {
      return { img, filename: urlToFilename.get(src), src };
    }
    
    try {
      const asset = await downloadImage(src);
      
      if (asset.status === AssetStatus.SUCCESS && asset.filename) {
        urlToFilename.set(src, asset.filename);
      }
      
      assets.push(asset);
      return { img, filename: asset.filename, src, status: asset.status };
    } catch (error) {
      console.warn(`Failed to process image ${src}:`, error);
      const failedAsset = {
        filename: null,
        originalUrl: src,
        base64: null,
        mimeType: null,
        size: 0,
        status: AssetStatus.FAILED_DOWNLOAD
      };
      assets.push(failedAsset);
      return { img, filename: null, src, status: AssetStatus.FAILED_DOWNLOAD };
    }
  });
  
  const results = await Promise.all(imagePromises);
  
  // Update image sources in HTML
  for (const result of results) {
    if (result && result.filename && result.status === AssetStatus.SUCCESS) {
      result.img.src = `./assets/${result.filename}`;
      result.img.removeAttribute('data-src');
      result.img.removeAttribute('srcset');
      result.img.removeAttribute('data-srcset');
    }
  }
  
  return {
    html: tempDiv.innerHTML,
    assets
  };
}

/**
 * Download a single image and convert to Base64
 * @param {string} url - Image URL
 * @returns {Promise<ProcessedAsset>} Processed asset
 */
export async function downloadImage(url) {
  // Create AbortController for timeout
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
    
    // Get content type
    const contentType = response.headers.get('content-type') || 'image/png';
    const mimeType = contentType.split(';')[0].trim();
    
    // Check if it's actually an image
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Not an image: ${mimeType}`);
    }
    
    // Get blob
    const blob = await response.blob();
    
    // Check size limit
    if (blob.size > MAX_IMAGE_SIZE) {
      return {
        filename: null,
        originalUrl: url,
        base64: null,
        mimeType: mimeType,
        size: blob.size,
        status: AssetStatus.SKIPPED_TOO_LARGE
      };
    }
    
    // Convert to Base64
    const base64DataUrl = await blobToBase64(blob);
    const base64Data = base64DataUrl.split(',')[1]; // Remove data URL prefix
    
    // Generate filename from content hash
    const hash = await sha256(base64Data);
    const ext = getExtensionFromMimeType(mimeType);
    const filename = `${hash.substring(0, 8)}.${ext}`;
    
    return {
      filename,
      originalUrl: url,
      base64: base64Data,
      mimeType,
      size: blob.size,
      status: AssetStatus.SUCCESS
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Determine error type
    let status = AssetStatus.FAILED_DOWNLOAD;
    if (error.name === 'AbortError') {
      status = AssetStatus.FAILED_DOWNLOAD;
    } else if (error.message.includes('CORS') || error.message.includes('blocked')) {
      status = AssetStatus.FAILED_CORS;
    }
    
    return {
      filename: null,
      originalUrl: url,
      base64: null,
      mimeType: null,
      size: 0,
      status
    };
  }
}

/**
 * Convert Blob to Base64 data URL
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>} Base64 data URL
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
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} File extension
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/tiff': 'tiff',
    'image/avif': 'avif'
  };
  
  return mimeToExt[mimeType] || 'png';
}

/**
 * Get MIME type from file extension
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
export function getMimeTypeFromExtension(extension) {
  const extToMime = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'avif': 'image/avif'
  };
  
  return extToMime[extension.toLowerCase()] || 'image/png';
}

export default {
  processImages,
  downloadImage,
  AssetStatus,
  getMimeTypeFromExtension
};
