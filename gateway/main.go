package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoClient *mongo.Client
	redisClient *redis.Client
	ctx         = context.Background()
)

type EndpointConfig struct {
	Path   string `json:"path" bson:"path"`
	Method string `json:"method" bson:"method"`
	Code   string `json:"code" bson:"code"`
}

func initDB() {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	clientOptions := options.Client().ApplyURI(mongoURI)
	var err error
	mongoClient, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v", err)
	}
}

func main() {
	initDB()
	r := gin.Default()

	// Enable CORS for frontend
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Management API
	r.POST("/api/endpoints", createEndpoint)
	r.GET("/api/endpoints", listEndpoints)

	// Gateway execution route - catch all
	r.Any("/run/*path", executeEndpoint)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Gateway running on port %s", port)
	r.Run(":" + port)
}

func createEndpoint(c *gin.Context) {
	var cfg EndpointConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := mongoClient.Database("apibuilder").Collection("endpoints")
	_, err := collection.InsertOne(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save endpoint"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Endpoint created", "endpoint": cfg})
}

func listEndpoints(c *gin.Context) {
	collection := mongoClient.Database("apibuilder").Collection("endpoints")
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch endpoints"})
		return
	}
	defer cursor.Close(ctx)

	var endpoints []EndpointConfig
	if err = cursor.All(ctx, &endpoints); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode endpoints"})
		return
	}

	if endpoints == nil {
		endpoints = []EndpointConfig{}
	}

	c.JSON(http.StatusOK, endpoints)
}

func executeEndpoint(c *gin.Context) {
	path := c.Param("path")
	method := c.Request.Method

	// Rate limiting check
	ip := c.ClientIP()
	rateLimitKey := fmt.Sprintf("rate_limit:%s", ip)

	// Basic rate limit: 100 requests per minute
	requests, err := redisClient.Incr(ctx, rateLimitKey).Result()
	if err == nil {
		if requests == 1 {
			redisClient.Expire(ctx, rateLimitKey, time.Minute)
		}
		if requests > 100 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
			return
		}
	}

	// Fetch endpoint config
	collection := mongoClient.Database("apibuilder").Collection("endpoints")
	var cfg EndpointConfig
	err = collection.FindOne(ctx, bson.M{"path": path, "method": method}).Decode(&cfg)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Endpoint not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Read body for forwarding
	bodyBytes, _ := io.ReadAll(c.Request.Body)
	bodyStr := string(bodyBytes)

	headerMap := make(map[string]string)
	for k, v := range c.Request.Header {
		if len(v) > 0 {
			headerMap[k] = v[0]
		}
	}

	// Forward to sandbox
	sandboxURL := os.Getenv("SANDBOX_URL")
	if sandboxURL == "" {
		sandboxURL = "http://localhost:3001"
	}

	payload := map[string]interface{}{
		"code":    cfg.Code,
		"method":  method,
		"url":     path,
		"headers": headerMap,
		"body":    bodyStr,
	}

	payloadBytes, _ := json.Marshal(payload)
	resp, err := http.Post(sandboxURL+"/execute", "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to execute in sandbox"})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", respBody)
}
