// Package models defines data structures for the Obsidian Web Clipper API.
package models

// SaveRequest represents the request body for POST /api/v1/save
type SaveRequest struct {
	Metadata Metadata `json:"metadata" binding:"required"`
	Content  Content  `json:"content" binding:"required"`
	Assets   []Asset  `json:"assets"`
}

// Metadata contains article metadata
type Metadata struct {
	Title   string   `json:"title" binding:"required"`
	URL     string   `json:"url" binding:"required"`
	Domain  string   `json:"domain" binding:"required"`
	SavedAt string   `json:"savedAt" binding:"required"`
	Tags    []string `json:"tags"`
}

// Content contains the article content
// Note: The markdown field now contains the complete, pre-rendered Markdown document
// including frontmatter, AI summary, highlights, and main content.
// The browser extension is responsible for generating the full Markdown using templates.
type Content struct {
	Markdown string `json:"markdown" binding:"required"`
}

// Asset represents an image or resource to be saved
type Asset struct {
	Filename string `json:"filename" binding:"required"`
	Base64   string `json:"base64" binding:"required"`
	MimeType string `json:"mimeType" binding:"required"`
}

// SaveResponse represents the response for POST /api/v1/save
type SaveResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data *SaveResult `json:"data"`
}

// SaveResult contains the save operation result details
type SaveResult struct {
	SavedPath   string `json:"savedPath"`
	ArticleDir  string `json:"articleDir"`
	AssetsCount int    `json:"assetsCount"`
}

// Error codes
const (
	CodeSuccess           = 0
	CodeAuthFailed        = 1001
	CodeBadRequest        = 1002
	CodeDirCreateFailed   = 2001
	CodeMarkdownWriteFail = 2002
	CodeAssetWriteFail    = 2003
	CodePermissionDenied  = 2004
	CodeSecurityViolation = 3001
	CodeInternalError     = 9999
)

// NewSuccessResponse creates a success response
func NewSuccessResponse(savedPath, articleDir string, assetsCount int) *SaveResponse {
	return &SaveResponse{
		Code: CodeSuccess,
		Msg:  "success",
		Data: &SaveResult{
			SavedPath:   savedPath,
			ArticleDir:  articleDir,
			AssetsCount: assetsCount,
		},
	}
}

// NewErrorResponse creates an error response
func NewErrorResponse(code int, msg string) *SaveResponse {
	return &SaveResponse{
		Code: code,
		Msg:  msg,
		Data: nil,
	}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
}
