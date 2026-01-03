// Package services provides business logic services for the Web Clipper server.
package services

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Sanitizer handles filename and path sanitization for security
type Sanitizer struct {
	maxFilenameLength int
	maxTitleLength    int
}

// NewSanitizer creates a new Sanitizer with default settings
func NewSanitizer() *Sanitizer {
	return &Sanitizer{
		maxFilenameLength: 100,
		maxTitleLength:    100,
	}
}

// illegalCharsRegex matches characters that are illegal in filenames across OS
var illegalCharsRegex = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)

// multipleSpacesRegex matches multiple consecutive spaces
var multipleSpacesRegex = regexp.MustCompile(`\s+`)

// pathTraversalPatterns contains patterns that indicate path traversal attempts
var pathTraversalPatterns = []string{
	"..",
	"./",
	".\\",
	"~",
}

// SanitizeFilename cleans a filename by removing illegal characters
func (s *Sanitizer) SanitizeFilename(filename string) (string, error) {
	if filename == "" {
		return "", fmt.Errorf("filename cannot be empty")
	}

	// Check for path traversal
	if err := s.checkPathTraversal(filename); err != nil {
		return "", err
	}

	// Get just the filename if a path was provided
	filename = filepath.Base(filename)

	// Remove illegal characters
	sanitized := illegalCharsRegex.ReplaceAllString(filename, "")

	// Replace multiple spaces with single space
	sanitized = multipleSpacesRegex.ReplaceAllString(sanitized, " ")

	// Trim spaces from ends
	sanitized = strings.TrimSpace(sanitized)

	// Limit length
	if utf8.RuneCountInString(sanitized) > s.maxFilenameLength {
		runes := []rune(sanitized)
		sanitized = string(runes[:s.maxFilenameLength])
	}

	// Ensure we still have a valid filename
	if sanitized == "" || sanitized == "." {
		return "", fmt.Errorf("filename is empty after sanitization")
	}

	return sanitized, nil
}

// SanitizeTitle cleans an article title for use as a directory/file name
func (s *Sanitizer) SanitizeTitle(title string) (string, error) {
	if title == "" {
		return "", fmt.Errorf("title cannot be empty")
	}

	// Check for path traversal
	if err := s.checkPathTraversal(title); err != nil {
		return "", err
	}

	// Remove illegal characters
	sanitized := illegalCharsRegex.ReplaceAllString(title, "")

	// Replace multiple spaces with single space
	sanitized = multipleSpacesRegex.ReplaceAllString(sanitized, " ")

	// Trim spaces from ends
	sanitized = strings.TrimSpace(sanitized)

	// Limit length
	if utf8.RuneCountInString(sanitized) > s.maxTitleLength {
		runes := []rune(sanitized)
		sanitized = string(runes[:s.maxTitleLength])
		// Trim trailing space if we cut in the middle
		sanitized = strings.TrimSpace(sanitized)
	}

	// Ensure we still have a valid title
	if sanitized == "" {
		return "", fmt.Errorf("title is empty after sanitization")
	}

	return sanitized, nil
}

// ValidateAssetFilename validates an asset filename for security
func (s *Sanitizer) ValidateAssetFilename(filename string) error {
	if filename == "" {
		return fmt.Errorf("asset filename cannot be empty")
	}

	// Check for path traversal
	if err := s.checkPathTraversal(filename); err != nil {
		return fmt.Errorf("invalid filename: %w", err)
	}

	// Filename should not contain directory separators
	if strings.ContainsAny(filename, "/\\") {
		return fmt.Errorf("invalid filename: path traversal detected in '%s'", filename)
	}

	// Filename should have reasonable length
	if utf8.RuneCountInString(filename) > s.maxFilenameLength {
		return fmt.Errorf("filename too long: %d characters (max %d)", utf8.RuneCountInString(filename), s.maxFilenameLength)
	}

	return nil
}

// checkPathTraversal checks if a string contains path traversal patterns
func (s *Sanitizer) checkPathTraversal(input string) error {
	for _, pattern := range pathTraversalPatterns {
		if strings.Contains(input, pattern) {
			return fmt.Errorf("path traversal detected: '%s'", pattern)
		}
	}
	return nil
}

// BuildSafePath creates a safe file path within the vault directory
// It ensures the resulting path is within the allowed base directory
func (s *Sanitizer) BuildSafePath(basePath string, components ...string) (string, error) {
	// Clean the base path
	basePath = filepath.Clean(basePath)

	// Build the full path
	fullPath := basePath
	for _, component := range components {
		// Check each component for safety
		if err := s.checkPathTraversal(component); err != nil {
			return "", err
		}
		fullPath = filepath.Join(fullPath, component)
	}

	// Clean the final path
	fullPath = filepath.Clean(fullPath)

	// Verify the path is still within the base directory
	relPath, err := filepath.Rel(basePath, fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to compute relative path: %w", err)
	}

	// If the relative path starts with "..", we've escaped the base directory
	if strings.HasPrefix(relPath, "..") {
		return "", fmt.Errorf("path traversal detected: result would be outside base directory")
	}

	return fullPath, nil
}
