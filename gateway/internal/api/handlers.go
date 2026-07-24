package api

import (
	"fmt"
	"net/http"
	
	"gateway/internal/sandbox"
	
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	r.Any("/p/:slug/*path", handleDynamicRoute)
	r.GET("/ws/:slug/*path", handleWebSocket)
}

func handleDynamicRoute(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Param("path")
	
	// This will be expanded in the sandbox implementation. Fetch code from DB/Redis.
	// For now, we execute a simple dummy script.
	code := fmt.Sprintf("'Dynamic route executed for project: %s, path: %s'", slug, path)

	result, err := sandbox.ExecuteCode(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": result,
	})
}
