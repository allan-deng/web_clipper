// Package handlers provides HTTP handlers for the Web Clipper server.
package handlers

import (
	"net/http"

	"web-clipper-server/models"

	"github.com/gin-gonic/gin"
)

// HealthHandler handles the GET /health endpoint
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, models.HealthResponse{
		Status: "ok",
	})
}
