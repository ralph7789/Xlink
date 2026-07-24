package main

import (
	"fmt"
	"log"
	"os"

	"gateway/internal/api"
	"gateway/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	storage.InitDBs()
	defer storage.DisconnectMongo()

	r := gin.Default()

	api.SetupRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Gateway starting on port %s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
