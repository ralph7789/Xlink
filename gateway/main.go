package main

import (
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
	"rogchap.com/v8go"
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

	// Execute in V8 Isolate
	payload := map[string]interface{}{
		"method":  method,
		"url":     path,
		"headers": headerMap,
		"body":    bodyStr,
	}

	payloadBytes, _ := json.Marshal(payload)

	iso := v8go.NewIsolate()
	defer iso.Dispose()

	global := v8go.NewObjectTemplate(iso)
	logFn := v8go.NewFunctionTemplate(iso, func(info *v8go.FunctionCallbackInfo) *v8go.Value {
		fmt.Printf("LOG:")
		for _, arg := range info.Args() {
			fmt.Printf(" %s", arg.String())
		}
		fmt.Println()
		return nil
	})

	console := v8go.NewObjectTemplate(iso)
	console.Set("log", logFn)
	global.Set("console", console)

	v8Ctx := v8go.NewContext(iso, global)
	defer v8Ctx.Close()

	script := fmt.Sprintf(`
		(async () => {
			const request = %s;
			%s
		})()
	`, string(payloadBytes), cfg.Code)

	val, err := v8Ctx.RunScript(script, "main.js")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var result string
	if val.IsPromise() {
		promise, err := val.AsPromise()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// In v8go, without an event loop, promises only resolve immediately if they are purely synchronous microtasks.
		// If it's pending, it means it's an unsupported async operation or it will never resolve.
		// For the sake of this basic embedded V8, we can wait a bit or run microtasks, but since we don't have an event loop,
		// we should timeout or just assume it won't resolve if it hasn't. We'll wait a tiny bit with a timeout just in case
		// microtasks are running, but avoid infinite loops.

		timeout := time.After(100 * time.Millisecond)
		for promise.State() == v8go.Pending {
			select {
			case <-timeout:
				c.JSON(http.StatusRequestTimeout, gin.H{"error": "Promise execution timed out or unsupported async operation"})
				return
			default:
				time.Sleep(1 * time.Millisecond)
			}
		}

		if promise.State() == v8go.Rejected {
			c.JSON(http.StatusInternalServerError, gin.H{"error": promise.Result().String()})
			return
		}
		result = promise.Result().String()
	} else {
		result = val.String()
	}

	c.JSON(http.StatusOK, gin.H{"result": result})
}
