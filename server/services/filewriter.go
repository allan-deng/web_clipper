package services

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"obsidian-clipper-server/config"
	"obsidian-clipper-server/models"
)

// Custom error types for specific failure modes
type DirCreateError struct{ Msg string }
type MarkdownWriteError struct{ Msg string }
type AssetWriteError struct{ Msg string }
type PermissionError struct{ Msg string }
type SecurityError struct{ Msg string }

func (e *DirCreateError) Error() string      { return e.Msg }
func (e *MarkdownWriteError) Error() string  { return e.Msg }
func (e *AssetWriteError) Error() string     { return e.Msg }
func (e *PermissionError) Error() string     { return e.Msg }
func (e *SecurityError) Error() string       { return e.Msg }

// SaveResult contains the result of a save operation
type SaveResult struct {
	SavedPath   string
	ArticleDir  string
	AssetsCount int
}

// FileWriter handles writing files to the Obsidian vault
type FileWriter struct {
	cfg       *config.Config
	sanitizer *Sanitizer
}

// NewFileWriter creates a new FileWriter
func NewFileWriter(cfg *config.Config, sanitizer *Sanitizer) *FileWriter {
	return &FileWriter{
		cfg:       cfg,
		sanitizer: sanitizer,
	}
}

// Save writes the article and assets to the vault
func (w *FileWriter) Save(req *models.SaveRequest) (*SaveResult, error) {
	// Sanitize title for directory name
	sanitizedTitle, err := w.sanitizer.SanitizeTitle(req.Metadata.Title)
	if err != nil {
		return nil, &SecurityError{Msg: fmt.Sprintf("invalid title: %s", err.Error())}
	}

	// Get date from savedAt or use current date
	dateStr := w.extractDate(req.Metadata.SavedAt)

	// Build base path: vault/subdir/date/title
	basePath := filepath.Join(w.cfg.Vault.Path, w.cfg.Vault.Subdir)
	articleDir := sanitizedTitle

	// Check for existing directory and add version suffix if needed
	targetDir, err := w.getVersionedDir(basePath, dateStr, sanitizedTitle)
	if err != nil {
		return nil, err
	}

	// Create temporary directory for atomic write
	tempDir := targetDir + ".tmp"
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return nil, &DirCreateError{Msg: fmt.Sprintf("failed to create directory: %s: %s", tempDir, err.Error())}
	}

	// Cleanup function for rollback on failure
	success := false
	defer func() {
		if !success {
			os.RemoveAll(tempDir)
		}
	}()

	// Write assets first
	assetsCount := 0
	if len(req.Assets) > 0 {
		assetsDir := filepath.Join(tempDir, "assets")
		if err := os.MkdirAll(assetsDir, 0755); err != nil {
			return nil, &DirCreateError{Msg: fmt.Sprintf("failed to create assets directory: %s", err.Error())}
		}

		for _, asset := range req.Assets {
			if err := w.writeAsset(assetsDir, &asset); err != nil {
				return nil, err
			}
			assetsCount++
		}
	}

	// Generate and write markdown file
	markdown := w.generateMarkdown(req)
	mdFilename := sanitizedTitle + ".md"
	mdPath := filepath.Join(tempDir, mdFilename)

	if err := os.WriteFile(mdPath, []byte(markdown), 0644); err != nil {
		return nil, &MarkdownWriteError{Msg: fmt.Sprintf("failed to write markdown file: %s", err.Error())}
	}

	// Atomic rename: move temp directory to final location
	if err := os.Rename(tempDir, targetDir); err != nil {
		return nil, &DirCreateError{Msg: fmt.Sprintf("failed to finalize save: %s", err.Error())}
	}

	success = true
	savedPath := filepath.Join(targetDir, mdFilename)

	return &SaveResult{
		SavedPath:   savedPath,
		ArticleDir:  articleDir,
		AssetsCount: assetsCount,
	}, nil
}

// extractDate extracts the date portion from an ISO 8601 timestamp
func (w *FileWriter) extractDate(savedAt string) string {
	// Try to parse the timestamp
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, savedAt); err == nil {
			return t.Format("2006-01-02")
		}
	}

	// If parsing fails, use current date
	return time.Now().Format("2006-01-02")
}

// getVersionedDir finds an available directory name, adding version suffix if needed
func (w *FileWriter) getVersionedDir(basePath, dateStr, title string) (string, error) {
	datePath := filepath.Join(basePath, dateStr)
	
	// Ensure date directory exists
	if err := os.MkdirAll(datePath, 0755); err != nil {
		return "", &DirCreateError{Msg: fmt.Sprintf("failed to create date directory: %s: %s", datePath, err.Error())}
	}

	// Try original name first
	targetDir := filepath.Join(datePath, title)
	if _, err := os.Stat(targetDir); os.IsNotExist(err) {
		return targetDir, nil
	}

	// Directory exists, try versioned names
	for version := 2; version <= 100; version++ {
		versionedTitle := fmt.Sprintf("%s_v%d", title, version)
		targetDir = filepath.Join(datePath, versionedTitle)
		if _, err := os.Stat(targetDir); os.IsNotExist(err) {
			return targetDir, nil
		}
	}

	return "", &DirCreateError{Msg: "too many versions exist for this article (max 100)"}
}

// writeAsset decodes and writes a single asset file
func (w *FileWriter) writeAsset(assetsDir string, asset *models.Asset) error {
	// Decode base64 data
	data, err := base64.StdEncoding.DecodeString(asset.Base64)
	if err != nil {
		return &AssetWriteError{Msg: fmt.Sprintf("failed to decode asset '%s': invalid base64 encoding", asset.Filename)}
	}

	// Write file
	assetPath := filepath.Join(assetsDir, asset.Filename)
	if err := os.WriteFile(assetPath, data, 0644); err != nil {
		return &AssetWriteError{Msg: fmt.Sprintf("failed to write asset '%s': %s", asset.Filename, err.Error())}
	}

	return nil
}

// generateMarkdown creates the final markdown content with frontmatter
func (w *FileWriter) generateMarkdown(req *models.SaveRequest) string {
	var sb strings.Builder

	// YAML frontmatter
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("title: \"%s\"\n", escapeYAMLString(req.Metadata.Title)))
	sb.WriteString(fmt.Sprintf("url: \"%s\"\n", escapeYAMLString(req.Metadata.URL)))
	sb.WriteString(fmt.Sprintf("date: %s\n", w.extractDate(req.Metadata.SavedAt)))
	
	// Tags
	if len(req.Metadata.Tags) > 0 {
		sb.WriteString("tags:\n")
		for _, tag := range req.Metadata.Tags {
			sb.WriteString(fmt.Sprintf("  - %s\n", tag))
		}
	}
	sb.WriteString("---\n\n")

	// AI Summary section (if available)
	if req.Content.AISummary != nil && req.Content.AISummary.Status == "SUCCESS" {
		sb.WriteString("## 摘要\n\n")

		// If we have raw text (from direct AI response), use it directly
		if req.Content.AISummary.RawText != "" {
			sb.WriteString(req.Content.AISummary.RawText)
			sb.WriteString("\n\n")
		} 

		sb.WriteString("---\n\n")
	}

	// Highlights section (if any)
	if len(req.Content.Highlights) > 0 {
		sb.WriteString("## 我的笔记\n\n")
		for _, highlight := range req.Content.Highlights {
			sb.WriteString(fmt.Sprintf("> **高亮**: %s\n", highlight.Text))
			if highlight.Note != "" {
				sb.WriteString(fmt.Sprintf("> \n> 💬 批注: %s\n", highlight.Note))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("---\n\n")
	}

	// Main content
	sb.WriteString("## 正文\n\n")
	sb.WriteString(req.Content.Markdown)

	return sb.String()
}

// escapeYAMLString escapes special characters in YAML string values
func escapeYAMLString(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}
