// Package middleware provides HTTP middleware for the Web Clipper server.
package middleware

import (
	"net/http"
	"strings"

	"web-clipper-server/models"

	"github.com/gin-gonic/gin"
)

// TokenAuth creates a middleware that validates Bearer token authentication
func TokenAuth(expectedToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.NewErrorResponse(
				models.CodeAuthFailed,
				"missing authorization header",
			))
			return
		}

		// Check Bearer prefix
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.NewErrorResponse(
				models.CodeAuthFailed,
				"invalid authorization format, expected 'Bearer <token>'",
			))
			return
		}

		// Extract and validate token
		token := strings.TrimPrefix(authHeader, "Bearer ")
		token = strings.TrimSpace(token)

		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.NewErrorResponse(
				models.CodeAuthFailed,
				"empty token",
			))
			return
		}

		if token != expectedToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.NewErrorResponse(
				models.CodeAuthFailed,
				"invalid auth token",
			))
			return
		}

		// Token is valid, continue
		c.Next()
	}
}
