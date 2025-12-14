package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"obsidian-clipper-server/config"
	"obsidian-clipper-server/models"
	"obsidian-clipper-server/services"
)

// SaveHandler handles the POST /api/v1/save endpoint
type SaveHandler struct {
	cfg        *config.Config
	sanitizer  *services.Sanitizer
	fileWriter *services.FileWriter
}

// NewSaveHandler creates a new SaveHandler
func NewSaveHandler(cfg *config.Config) *SaveHandler {
	sanitizer := services.NewSanitizer()
	fileWriter := services.NewFileWriter(cfg, sanitizer)
	return &SaveHandler{
		cfg:        cfg,
		sanitizer:  sanitizer,
		fileWriter: fileWriter,
	}
}

// Handle processes the save request
func (h *SaveHandler) Handle(c *gin.Context) {
	var req models.SaveRequest

	// Parse JSON request body
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(
			models.CodeBadRequest,
			"invalid JSON format: "+err.Error(),
		))
		return
	}

	// Validate asset filenames for security
	for _, asset := range req.Assets {
		if err := h.sanitizer.ValidateAssetFilename(asset.Filename); err != nil {
			c.JSON(http.StatusBadRequest, models.NewErrorResponse(
				models.CodeSecurityViolation,
				err.Error(),
			))
			return
		}
	}

	// Write files to vault
	result, err := h.fileWriter.Save(&req)
	if err != nil {
		// Determine appropriate error code based on error type
		code := models.CodeInternalError
		status := http.StatusInternalServerError

		switch err.(type) {
		case *services.DirCreateError:
			code = models.CodeDirCreateFailed
		case *services.MarkdownWriteError:
			code = models.CodeMarkdownWriteFail
		case *services.AssetWriteError:
			code = models.CodeAssetWriteFail
		case *services.PermissionError:
			code = models.CodePermissionDenied
			status = http.StatusForbidden
		case *services.SecurityError:
			code = models.CodeSecurityViolation
			status = http.StatusBadRequest
		}

		c.JSON(status, models.NewErrorResponse(code, err.Error()))
		return
	}

	// Return success response
	c.JSON(http.StatusOK, models.NewSuccessResponse(
		result.SavedPath,
		result.ArticleDir,
		result.AssetsCount,
	))
}
