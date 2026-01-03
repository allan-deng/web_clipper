// Package services provides business logic services for the Web Clipper server.
package services

import (
	"fmt"
	"log"
	"os"
	"time"
)

// LogLevel represents the severity level of a log message
type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

// Logger provides structured logging functionality
type Logger struct {
	level  LogLevel
	prefix string
	logger *log.Logger
}

// NewLogger creates a new Logger instance
func NewLogger(levelStr string, prefix string) *Logger {
	level := parseLogLevel(levelStr)
	return &Logger{
		level:  level,
		prefix: prefix,
		logger: log.New(os.Stdout, "", 0),
	}
}

// parseLogLevel converts a string log level to LogLevel
func parseLogLevel(level string) LogLevel {
	switch level {
	case "debug":
		return DEBUG
	case "info":
		return INFO
	case "warn":
		return WARN
	case "error":
		return ERROR
	default:
		return INFO
	}
}

// formatMessage formats a log message with timestamp and level
func (l *Logger) formatMessage(level LogLevel, msg string) string {
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	levelStr := ""
	switch level {
	case DEBUG:
		levelStr = "DEBUG"
	case INFO:
		levelStr = "INFO"
	case WARN:
		levelStr = "WARN"
	case ERROR:
		levelStr = "ERROR"
	}

	if l.prefix != "" {
		return fmt.Sprintf("[%s] [%s] [%s] %s", timestamp, levelStr, l.prefix, msg)
	}
	return fmt.Sprintf("[%s] [%s] %s", timestamp, levelStr, msg)
}

// Debug logs a debug message
func (l *Logger) Debug(format string, v ...interface{}) {
	if l.level <= DEBUG {
		msg := fmt.Sprintf(format, v...)
		l.logger.Println(l.formatMessage(DEBUG, msg))
	}
}

// Info logs an info message
func (l *Logger) Info(format string, v ...interface{}) {
	if l.level <= INFO {
		msg := fmt.Sprintf(format, v...)
		l.logger.Println(l.formatMessage(INFO, msg))
	}
}

// Warn logs a warning message
func (l *Logger) Warn(format string, v ...interface{}) {
	if l.level <= WARN {
		msg := fmt.Sprintf(format, v...)
		l.logger.Println(l.formatMessage(WARN, msg))
	}
}

// Error logs an error message
func (l *Logger) Error(format string, v ...interface{}) {
	if l.level <= ERROR {
		msg := fmt.Sprintf(format, v...)
		l.logger.Println(l.formatMessage(ERROR, msg))
	}
}

// RequestLog logs an HTTP request
func (l *Logger) RequestLog(method, path string, statusCode int, duration time.Duration, clientIP string) {
	l.Info("%s %s %d %v %s", method, path, statusCode, duration, clientIP)
}

// ErrorLog logs an error with context
func (l *Logger) ErrorLog(context string, err error) {
	l.Error("[%s] %v", context, err)
}

// Global logger instance
var globalLogger *Logger

// InitGlobalLogger initializes the global logger
func InitGlobalLogger(level string) {
	globalLogger = NewLogger(level, "")
}

// GetLogger returns the global logger
func GetLogger() *Logger {
	if globalLogger == nil {
		globalLogger = NewLogger("info", "")
	}
	return globalLogger
}
