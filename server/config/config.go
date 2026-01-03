// Package config provides configuration loading for the Web Clipper server.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// Config represents the application configuration
type Config struct {
	Server  ServerConfig  `yaml:"server"`
	Auth    AuthConfig    `yaml:"auth"`
	Vault   VaultConfig   `yaml:"vault"`
	Logging LoggingConfig `yaml:"logging"`
}

// ServerConfig contains HTTP server settings
type ServerConfig struct {
	Port        int    `yaml:"port"`
	MaxBodySize string `yaml:"maxBodySize"`
}

// AuthConfig contains authentication settings
type AuthConfig struct {
	Token string `yaml:"token"`
}

// VaultConfig contains local vault settings
type VaultConfig struct {
	Path   string `yaml:"path"`
	Subdir string `yaml:"subdir"`
}

// LoggingConfig contains logging settings
type LoggingConfig struct {
	Level string `yaml:"level"`
}

// DefaultConfig returns a config with default values
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:        18080,
			MaxBodySize: "100MB",
		},
		Auth: AuthConfig{
			Token: "",
		},
		Vault: VaultConfig{
			Path:   "",
			Subdir: "Inbox/WebClips",
		},
		Logging: LoggingConfig{
			Level: "info",
		},
	}
}

// Load reads configuration from a YAML file and applies environment variable overrides
func Load(path string) (*Config, error) {
	cfg := DefaultConfig()

	// Read config file
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// If config file doesn't exist, use defaults with env overrides
			cfg.applyEnvOverrides()
			return cfg, nil
		}
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse YAML
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Apply environment variable overrides
	cfg.applyEnvOverrides()

	// Validate configuration
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}

// applyEnvOverrides applies environment variable overrides to the config
func (c *Config) applyEnvOverrides() {
	// Server settings
	if port := os.Getenv("CLIPPER_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			c.Server.Port = p
		}
	}
	if maxBody := os.Getenv("CLIPPER_MAX_BODY_SIZE"); maxBody != "" {
		c.Server.MaxBodySize = maxBody
	}

	// Auth settings
	if token := os.Getenv("CLIPPER_AUTH_TOKEN"); token != "" {
		c.Auth.Token = token
	}

	// Vault settings
	if vaultPath := os.Getenv("CLIPPER_VAULT_PATH"); vaultPath != "" {
		c.Vault.Path = vaultPath
	}
	if subdir := os.Getenv("CLIPPER_VAULT_SUBDIR"); subdir != "" {
		c.Vault.Subdir = subdir
	}

	// Logging settings
	if level := os.Getenv("CLIPPER_LOG_LEVEL"); level != "" {
		c.Logging.Level = level
	}
}

// validate checks if the configuration is valid
func (c *Config) validate() error {
	if c.Auth.Token == "" {
		return fmt.Errorf("auth.token is required")
	}
	if c.Vault.Path == "" {
		return fmt.Errorf("vault.path is required")
	}
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("server.port must be between 1 and 65535")
	}
	return nil
}

// GetMaxBodySizeBytes parses the maxBodySize string and returns bytes
func (c *Config) GetMaxBodySizeBytes() int64 {
	size := strings.ToUpper(strings.TrimSpace(c.Server.MaxBodySize))

	var multiplier int64 = 1
	var numStr string

	if strings.HasSuffix(size, "GB") {
		multiplier = 1024 * 1024 * 1024
		numStr = strings.TrimSuffix(size, "GB")
	} else if strings.HasSuffix(size, "MB") {
		multiplier = 1024 * 1024
		numStr = strings.TrimSuffix(size, "MB")
	} else if strings.HasSuffix(size, "KB") {
		multiplier = 1024
		numStr = strings.TrimSuffix(size, "KB")
	} else if strings.HasSuffix(size, "B") {
		numStr = strings.TrimSuffix(size, "B")
	} else {
		numStr = size
	}

	num, err := strconv.ParseInt(strings.TrimSpace(numStr), 10, 64)
	if err != nil {
		// Default to 100MB if parsing fails
		return 100 * 1024 * 1024
	}

	return num * multiplier
}
