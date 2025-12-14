// Package handlers provides HTTP handlers for the Obsidian Web Clipper server.
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"obsidian-clipper-server/models"
)

// HealthHandler handles the GET /health endpoint
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, models.HealthResponse{
		Status: "ok",
	})
}
