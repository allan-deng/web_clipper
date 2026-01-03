// Package main is the entry point for the Web Clipper server.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"web-clipper-server/config"
	"web-clipper-server/handlers"
	"web-clipper-server/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "config.yaml", "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Set Gin mode based on log level
	if cfg.Logging.Level == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin router
	router := gin.New()

	// Add recovery middleware
	router.Use(gin.Recovery())

	// Add logging middleware
	router.Use(gin.Logger())

	// Configure CORS
	corsConfig := cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           86400, // 24 hours
	}
	router.Use(cors.New(corsConfig))

	// Set max multipart memory for large requests
	router.MaxMultipartMemory = cfg.GetMaxBodySizeBytes()

	// Health check endpoint (no auth required)
	router.GET("/health", handlers.HealthHandler)

	// API v1 routes (auth required)
	v1 := router.Group("/api/v1")
	v1.Use(middleware.TokenAuth(cfg.Auth.Token))
	{
		// Initialize save handler with config
		saveHandler := handlers.NewSaveHandler(cfg)
		v1.POST("/save", saveHandler.Handle)
	}

	// Validate vault path exists
	if _, err := os.Stat(cfg.Vault.Path); os.IsNotExist(err) {
		log.Printf("Warning: Vault path does not exist: %s", cfg.Vault.Path)
	}

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Starting Web Clipper server on %s", addr)
	log.Printf("Vault path: %s/%s", cfg.Vault.Path, cfg.Vault.Subdir)

	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
