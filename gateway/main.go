package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
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
	jwtSecret   = []byte(getEnv("JWT_SECRET", "supersecret"))

	// V8 Isolate Pool
	isolatePool = sync.Pool{
		New: func() interface{} {
			return v8go.NewIsolate()
		},
	}
)

type EndpointConfig struct {
	Path   string `json:"path" bson:"path"`
	Method string `json:"method" bson:"method"`
	Code   string `json:"code" bson:"code"`
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func initDB() {
	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	clientOptions := options.Client().ApplyURI(mongoURI)
	var err error
	mongoClient, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v", err)
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing authorization header"})
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			return
		}

		token, err := jwt.Parse(parts[1], func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Next()
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

	// Management API (Authenticated)
	api := r.Group("/api")
	api.Use(authMiddleware())
	api.POST("/endpoints", createEndpoint)
	api.GET("/endpoints", listEndpoints)

	// Gateway execution route - catch all
	r.Any("/run/*path", executeEndpoint)

	port := getEnv("PORT", "8080")
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

	// Efficient Payload Handling: limit to 1MB
	bodyBytes, _ := io.ReadAll(io.LimitReader(c.Request.Body, 1024*1024))
	bodyStr := string(bodyBytes)

	// Setup V8 Isolate from pool
	iso := isolatePool.Get().(*v8go.Isolate)
	defer isolatePool.Put(iso)

	// Create a new context for this execution
	v8ctx := v8go.NewContext(iso)
	defer v8ctx.Close()

	// Inject safe variables
	v8ctx.Global().Set("request_body", bodyStr)
	v8ctx.Global().Set("request_method", method)
	v8ctx.Global().Set("request_url", path)

	// Build the script string securely
	script := fmt.Sprintf(`
		(function() {
			try {
				const handler = function() { %s };
				return JSON.stringify(handler());
			} catch (e) {
				return JSON.stringify({ error: e.message });
			}
		})();
	`, cfg.Code)

	val, err := v8ctx.RunScript(script, "endpoint.js")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Execution error: " + err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", []byte(val.String()))
}
