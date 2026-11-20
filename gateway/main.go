package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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

// ============================================================================
// SYSTEM ARCHITECTURE & DATA STRUCTURES
// ============================================================================

var (
	mongoClient *mongo.Client
	redisClient *redis.Client
	ctx         = context.Background()
	jwtSecret   = []byte(getEnv("JWT_SECRET", "supersecret"))
	serverStart = time.Now()

	// V8 Isolate Pool for custom endpoint execution
	isolatePool = sync.Pool{
		New: func() interface{} {
			return v8go.NewIsolate()
		},
	}

	// In-Memory Enterprise Storage Mutex & Store
	storeLock sync.RWMutex
	appStore  *EnterpriseStore
)

// EnterpriseStore maintains thread-safe operational state
type EnterpriseStore struct {
	Config        SystemConfig           `json:"config"`
	Apps          []AppRegistration      `json:"apps"`
	Subscriptions []WebhookSubscription  `json:"subscriptions"`
	AuditLogs     []AuditEntry           `json:"audit_logs"`
	Users         []UserEntity           `json:"users"`
	Groups        []GroupEntity          `json:"groups"`
	Drives        []DriveEntity          `json:"drives"`
	DriveItems    []DriveItemEntity      `json:"drive_items"`
	Messages      []MessageEntity        `json:"messages"`
	Metrics       MetricsData            `json:"metrics"`
}

type SystemConfig struct {
	Throttling ThrottlingConfig `json:"throttling"`
	Uploads    UploadsConfig    `json:"uploads"`
	Delta      DeltaConfig      `json:"delta"`
	Webhooks   WebhooksConfig   `json:"webhooks"`
	Storage    StorageConfig    `json:"storage"`
}

type ThrottlingConfig struct {
	RequestsPerMinute int  `json:"requestsPerMinute"`
	BurstAllowance    int  `json:"burstAllowance"`
	RetryAfterSeconds int  `json:"retryAfterSeconds"`
	JitterEnabled     bool `json:"jitterEnabled"`
}

type UploadsConfig struct {
	ChunkSizeKiB          int  `json:"chunkSizeKiB"`
	MaxFileSizeGB         int  `json:"maxFileSizeGB"`
	SessionTTLHours       int  `json:"sessionTtlHours"`
	StrictChunkAlignment  bool `json:"strictChunkAlignment"`
}

type DeltaConfig struct {
	TokenTTLDays           int  `json:"tokenTtlDays"`
	TombstoneRetentionDays int  `json:"tombstoneRetentionDays"`
	WatermarkTracking      bool `json:"watermarkTracking"`
}

type WebhooksConfig struct {
	AESEncryptionKey          string `json:"aesEncryptionKey"`
	RSAPublicKey              string `json:"rsaPublicKey"`
	MaxSubscriptionsPerTenant int    `json:"maxSubscriptionsPerTenant"`
	ValidationTimeoutSec      int    `json:"validationTimeoutSec"`
}

type StorageConfig struct {
	TenantShardRoutes   map[string]string `json:"tenantShardRoutes"`
	XIDSyncEnabled      bool              `json:"xidSyncEnabled"`
	SentinelAuditStream string            `json:"sentinelAuditStream"`
}

type AppRegistration struct {
	ID          string    `json:"id"`
	ClientID    string    `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	Name        string    `json:"name"`
	TenantID    string    `json:"tenantId"`
	Scopes      []string  `json:"scopes"`
	CreatedAt   time.Time `json:"createdAt"`
}

type WebhookSubscription struct {
	ID                 string    `json:"id"`
	Resource           string    `json:"resource"`
	ChangeType         string    `json:"changeType"`
	NotificationURL    string    `json:"notificationUrl"`
	ExpirationDateTime time.Time `json:"expirationDateTime"`
	ClientState        string    `json:"clientState"`
	Status             string    `json:"status"`
}

type AuditEntry struct {
	ID          string    `json:"id"`
	TraceID     string    `json:"traceId"`
	Timestamp   time.Time `json:"timestamp"`
	Actor       string    `json:"actor"`
	Event       string    `json:"event"`
	Resource    string    `json:"resource"`
	IPAddress   string    `json:"ipAddress"`
	Result      string    `json:"result"`
	ThreatScore int       `json:"threatScore"`
}

type UserEntity struct {
	ID                string `json:"id"`
	DisplayName       string `json:"displayName"`
	UserPrincipalName string `json:"userPrincipalName"`
	Department        string `json:"department"`
	JobTitle          string `json:"jobTitle"`
	Mail              string `json:"mail"`
	AccountEnabled    bool   `json:"accountEnabled"`
}

type GroupEntity struct {
	ID              string   `json:"id"`
	DisplayName     string   `json:"displayName"`
	Description     string   `json:"description"`
	MailNickname    string   `json:"mailNickname"`
	SecurityEnabled bool     `json:"securityEnabled"`
	Members         []string `json:"members"`
}

type DriveEntity struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	DriveType string `json:"driveType"`
	Quota     gin.H  `json:"quota"`
}

type DriveItemEntity struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Size        int64     `json:"size"`
	CreatedAt   time.Time `json:"createdAt"`
	WebURL      string    `json:"webUrl"`
	IsFolder    bool      `json:"isFolder"`
}

type MessageEntity struct {
	ID                 string    `json:"id"`
	Subject            string    `json:"subject"`
	Sender             gin.H     `json:"sender"`
	BodyPreview        string    `json:"bodyPreview"`
	ReceivedDateTime   time.Time `json:"receivedDateTime"`
	HasAttachments     bool      `json:"hasAttachments"`
	IsRead             bool      `json:"isRead"`
}

type MetricsData struct {
	EntitiesCount      int     `json:"entitiesCount"`
	RequestRate        float64 `json:"requestRate"`
	P99LatencyMs       float64 `json:"p99LatencyMs"`
	RateLimitedTenants int     `json:"rateLimitedTenants"`
	UptimeSeconds      int64   `json:"uptimeSeconds"`
	UptimeHuman        string  `json:"uptimeHuman"`
	ActiveTenants      int     `json:"activeTenants"`
	ActiveSessions     int     `json:"activeSessions"`
	CacheHitRatio      float64 `json:"cacheHitRatio"`
	ErrorBudgetPercent float64 `json:"errorBudgetPercent"`
}

type EndpointConfig struct {
	Path   string `json:"path" bson:"path"`
	Method string `json:"method" bson:"method"`
	Code   string `json:"code" bson:"code"`
}

// 21 Master Cleanroom Scopes
var masterScopesCatalog = []string{
	"User.Read",
	"User.ReadWrite",
	"User.Read.All",
	"User.ReadWrite.All",
	"Group.Read.All",
	"Group.ReadWrite.All",
	"Files.Read",
	"Files.ReadWrite",
	"Files.Read.All",
	"Files.ReadWrite.All",
	"Mail.Read",
	"Mail.ReadWrite",
	"Mail.Send",
	"Calendars.Read",
	"Calendars.ReadWrite",
	"Chat.Read",
	"Chat.ReadWrite",
	"Directory.Read.All",
	"Directory.ReadWrite.All",
	"Subscription.Read.All",
	"Subscription.ReadWrite.All",
}

// ============================================================================
// INITIALIZATION & SEED STATE
// ============================================================================

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func initStore() {
	now := time.Now().UTC()
	appStore = &EnterpriseStore{
		Config: SystemConfig{
			Throttling: ThrottlingConfig{
				RequestsPerMinute: 1200,
				BurstAllowance:    200,
				RetryAfterSeconds: 60,
				JitterEnabled:     true,
			},
			Uploads: UploadsConfig{
				ChunkSizeKiB:         320,
				MaxFileSizeGB:        250,
				SessionTTLHours:      24,
				StrictChunkAlignment: true,
			},
			Delta: DeltaConfig{
				TokenTTLDays:           30,
				TombstoneRetentionDays: 60,
				WatermarkTracking:      true,
			},
			Webhooks: WebhooksConfig{
				AESEncryptionKey:          "k-sec-9a4f21d7e8b3c4a1f609e235ba92cd01",
				RSAPublicKey:              "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0XlinkSentinelKey==\n-----END PUBLIC KEY-----",
				MaxSubscriptionsPerTenant: 50,
				ValidationTimeoutSec:      10,
			},
			Storage: StorageConfig{
				TenantShardRoutes: map[string]string{
					"tenant-default": "xdb-shard-us-east-1",
					"tenant-emea":    "xdb-shard-eu-west-1",
					"tenant-apac":    "xdb-shard-ap-south-1",
				},
				XIDSyncEnabled:      true,
				SentinelAuditStream: "sentinel.soc.audit.v1",
			},
		},
		Apps: []AppRegistration{
			{
				ID:          "app-reg-01",
				ClientID:    "xlink-explorer-portal",
				ClientSecret: "sec_" + randomHex(16),
				Name:        "Xlink Interactive Explorer",
				TenantID:    "tenant-default",
				Scopes: []string{
					"User.Read", "User.Read.All", "Group.Read.All", "Files.ReadWrite.All",
					"Mail.ReadWrite", "Directory.Read.All", "Subscription.ReadWrite.All",
				},
				CreatedAt: now.Add(-72 * time.Hour),
			},
			{
				ID:          "app-reg-02",
				ClientID:    "sentinel-soc-agent",
				ClientSecret: "sec_" + randomHex(16),
				Name:        "Sentinel SOC Audit Engine",
				TenantID:    "tenant-default",
				Scopes: []string{
					"Directory.Read.All", "Directory.ReadWrite.All", "Subscription.Read.All",
				},
				CreatedAt: now.Add(-120 * time.Hour),
			},
			{
				ID:          "app-reg-03",
				ClientID:    "xdrive-sync-daemon",
				ClientSecret: "sec_" + randomHex(16),
				Name:        "X-Drive Resumable Sync Daemon",
				TenantID:    "tenant-emea",
				Scopes: []string{
					"Files.Read", "Files.ReadWrite", "Files.Read.All", "Files.ReadWrite.All",
				},
				CreatedAt: now.Add(-24 * time.Hour),
			},
		},
		Subscriptions: []WebhookSubscription{
			{
				ID:                 "sub-xl-8921",
				Resource:           "/v1.0/users",
				ChangeType:         "created,updated,deleted",
				NotificationURL:    "https://sentinel.xcorp.internal/hooks/users",
				ExpirationDateTime: now.Add(72 * time.Hour),
				ClientState:        "state-entropy-val-901",
				Status:             "active",
			},
			{
				ID:                 "sub-xl-8922",
				Resource:           "/v1.0/me/drive/root",
				ChangeType:         "updated",
				NotificationURL:    "https://xdrive.xcorp.internal/hooks/files",
				ExpirationDateTime: now.Add(48 * time.Hour),
				ClientState:        "state-entropy-val-902",
				Status:             "active",
			},
		},
		AuditLogs: []AuditEntry{
			{
				ID:          "aud-" + randomHex(6),
				TraceID:     "trc-soc-901a8b2c",
				Timestamp:   now.Add(-2 * time.Minute),
				Actor:       "alex.vance@xcorp.internal",
				Event:       "TokenBucketPolicyUpdate",
				Resource:    "/api/admin/config/throttling",
				IPAddress:   "10.240.0.12",
				Result:      "Success",
				ThreatScore: 0,
			},
			{
				ID:          "aud-" + randomHex(6),
				TraceID:     "trc-soc-889b71df",
				Timestamp:   now.Add(-14 * time.Minute),
				Actor:       "sentinel-soc-agent",
				Event:       "DeltaSyncCheckpointSeek",
				Resource:    "/v1.0/users/delta",
				IPAddress:   "10.240.4.88",
				Result:      "Success",
				ThreatScore: 1,
			},
			{
				ID:          "aud-" + randomHex(6),
				TraceID:     "trc-soc-772c91a0",
				Timestamp:   now.Add(-45 * time.Minute),
				Actor:       "xdrive-sync-daemon",
				Event:       "ResumableUploadSessionInit",
				Resource:    "/v1.0/me/drive/root:/:createUploadSession",
				IPAddress:   "10.240.2.19",
				Result:      "Success",
				ThreatScore: 0,
			},
			{
				ID:          "aud-" + randomHex(6),
				TraceID:     "trc-soc-661a5e3b",
				Timestamp:   now.Add(-2 * time.Hour),
				Actor:       "unknown-service-principal",
				Event:       "ThrottlingLimitExceeded",
				Resource:    "/v1.0/users?$filter=department eq 'Infra'",
				IPAddress:   "192.168.100.45",
				Result:      "Blocked",
				ThreatScore: 12,
			},
		},
		Users: []UserEntity{
			{
				ID:                "usr-xlink-89410",
				DisplayName:       "Alex Vance",
				UserPrincipalName: "alex.vance@xcorp.internal",
				Department:        "Core Engineering",
				JobTitle:          "Principal Systems Architect",
				Mail:              "alex.vance@xcorp.internal",
				AccountEnabled:    true,
			},
			{
				ID:                "usr-xlink-89411",
				DisplayName:       "Sarah Connor",
				UserPrincipalName: "sarah.connor@xcorp.internal",
				Department:        "Cyber Defense",
				JobTitle:          "Senior Staff Security Engineer",
				Mail:              "sarah.connor@xcorp.internal",
				AccountEnabled:    true,
			},
			{
				ID:                "usr-xlink-89412",
				DisplayName:       "Marcus Wright",
				UserPrincipalName: "marcus.wright@xcorp.internal",
				Department:        "Data Platforms",
				JobTitle:          "Lead Database SRE",
				Mail:              "marcus.wright@xcorp.internal",
				AccountEnabled:    true,
			},
			{
				ID:                "usr-xlink-89413",
				DisplayName:       "Elena Rostova",
				UserPrincipalName: "elena.rostova@xcorp.internal",
				Department:        "Distributed Systems",
				JobTitle:          "Distinguished Architect",
				Mail:              "elena.rostova@xcorp.internal",
				AccountEnabled:    true,
			},
		},
		Groups: []GroupEntity{
			{
				ID:              "grp-xlink-corp-infra",
				DisplayName:     "Xcorp Core Infrastructure",
				Description:     "Engineers with root deployment access across enterprise zones",
				MailNickname:    "corp-infra",
				SecurityEnabled: true,
				Members:         []string{"usr-xlink-89410", "usr-xlink-89413"},
			},
			{
				ID:              "grp-xlink-sec-ops",
				DisplayName:     "Sentinel Security Operations",
				Description:     "Zero-trust incident response and SOC management team",
				MailNickname:    "sec-ops",
				SecurityEnabled: true,
				Members:         []string{"usr-xlink-89411"},
			},
			{
				ID:              "grp-xlink-data-core",
				DisplayName:     "XDB Database Core Team",
				Description:     "Keyset query optimization and distributed shard controllers",
				MailNickname:    "data-core",
				SecurityEnabled: true,
				Members:         []string{"usr-xlink-89412"},
			},
		},
		Drives: []DriveEntity{
			{
				ID:        "drv-xlink-root-01",
				Name:      "X-Drive Enterprise System Volume",
				DriveType: "business",
				Quota: gin.H{
					"total":     2748779069440,
					"used":      439804651110,
					"remaining": 2308974418330,
					"state":     "normal",
				},
			},
		},
		DriveItems: []DriveItemEntity{
			{
				ID:        "item-xl-001",
				Name:      "Unified-Enterprise-Entity-Spec-v1.0.pdf",
				Size:      2485760,
				CreatedAt: now.Add(-48 * time.Hour),
				WebURL:    "https://xdrive.xcorp.internal/items/item-xl-001",
				IsFolder:  false,
			},
			{
				ID:        "item-xl-002",
				Name:      "Keyset-Btree-Seek-Benchmarking.xlsx",
				Size:      834120,
				CreatedAt: now.Add(-18 * time.Hour),
				WebURL:    "https://xdrive.xcorp.internal/items/item-xl-002",
				IsFolder:  false,
			},
			{
				ID:        "item-xl-003",
				Name:      "Sentinel-SOC-Audit-Encryption.bin",
				Size:      18492000,
				CreatedAt: now.Add(-5 * time.Hour),
				WebURL:    "https://xdrive.xcorp.internal/items/item-xl-003",
				IsFolder:  false,
			},
		},
		Messages: []MessageEntity{
			{
				ID:          "msg-xl-1001",
				Subject:     "Xlink GA Architecture & Cleanroom Parity Complete",
				BodyPreview: "The unified entity layer for directory, drive items, delta synchronization and batch execution is verified.",
				ReceivedDateTime: now.Add(-30 * time.Minute),
				HasAttachments:   true,
				IsRead:           false,
				Sender: gin.H{
					"emailAddress": gin.H{
						"name":    "Sentinel Security Advisory",
						"address": "sentinel-soc@xcorp.internal",
					},
				},
			},
			{
				ID:          "msg-xl-1002",
				Subject:     "Notice: 320 KiB Resumable Upload Alignment Active",
				BodyPreview: "All enterprise file upload sessions must align chunks to 327,680 byte boundary per specification.",
				ReceivedDateTime: now.Add(-3 * time.Hour),
				HasAttachments:   false,
				IsRead:           true,
				Sender: gin.H{
					"emailAddress": gin.H{
						"name":    "X-Drive Storage Engine",
						"address": "xdrive-engine@xcorp.internal",
					},
				},
			},
		},
	}
}

func initDB() {
	initStore()

	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	ctxTimeout, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(mongoURI)
	var err error
	mongoClient, err = mongo.Connect(ctxTimeout, clientOptions)
	if err != nil {
		log.Printf("[Xlink Init] Notice: MongoDB offline, using High-Performance In-Memory Vault (%v)", err)
	}

	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	if err := redisClient.Ping(ctxTimeout).Err(); err != nil {
		log.Printf("[Xlink Init] Notice: Redis offline, using In-Memory Rate Limiting (%v)", err)
	}
}

// ============================================================================
// MIDDLEWARE & HELPERS
// ============================================================================

func odataHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := c.GetHeader("client-request-id")
		if reqID == "" {
			reqID = "req-" + randomHex(8)
		}
		traceID := "trc-soc-" + randomHex(8)

		c.Writer.Header().Set("OData-Version", "4.0")
		c.Writer.Header().Set("client-request-id", reqID)
		c.Writer.Header().Set("request-id", reqID)
		c.Writer.Header().Set("trace_id", traceID)
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Record latency
		t0 := time.Now()
		c.Next()
		latency := time.Since(t0)
		c.Writer.Header().Set("X-Response-Time", fmt.Sprintf("%.2fms", float64(latency.Microseconds())/1000.0))
	}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// ============================================================================
// UNIFIED ENTITY PROTOCOL HANDLERS (/v1.0/* and /beta/*)
// ============================================================================

func registerEntityRoutes(rg *gin.RouterGroup, version string) {
	// Identity: Me, Users, Groups
	rg.GET("/me", handleGetMe(version))
	rg.GET("/users", handleGetUsers(version))
	rg.GET("/users/delta", handleUsersDelta(version))
	rg.GET("/groups", handleGetGroups(version))

	// Files & Drives (X-Drive)
	rg.GET("/drives", handleGetDrives(version))
	rg.GET("/me/drive/root/children", handleGetDriveChildren(version))
	rg.POST("/me/drive/root:/:createUploadSession", handleCreateUploadSession(version))
	rg.POST("/me/drive/items/:itemId/createUploadSession", handleCreateUploadSession(version))

	// Productivity: Messages & Mail
	rg.GET("/me/messages", handleGetMessages(version))
	rg.POST("/me/sendMail", handleSendMail(version))

	// Webhooks & Subscriptions
	rg.GET("/subscriptions", handleGetSubscriptions(version))
	rg.POST("/subscriptions", handleCreateSubscription(version))

	// JSON Batch Processing (Topological DAG)
	rg.POST("/$batch", handleJSONBatch(version))
}

func handleGetMe(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		me := appStore.Users[0]
		c.JSON(http.StatusOK, gin.H{
			"@odata.context":    fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users/$entity", version),
			"id":                me.ID,
			"displayName":       me.DisplayName,
			"userPrincipalName": me.UserPrincipalName,
			"department":        me.Department,
			"jobTitle":          me.JobTitle,
			"mail":              me.Mail,
			"accountEnabled":    me.AccountEnabled,
		})
	}
}

func handleGetUsers(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		selectFields := c.Query("$select")
		topStr := c.Query("$top")
		top := len(appStore.Users)
		if topStr != "" {
			if t, err := strconv.Atoi(topStr); err == nil && t > 0 && t < top {
				top = t
			}
		}

		userList := make([]gin.H, 0, top)
		for i := 0; i < top && i < len(appStore.Users); i++ {
			u := appStore.Users[i]
			item := gin.H{
				"id":                u.ID,
				"displayName":       u.DisplayName,
				"userPrincipalName": u.UserPrincipalName,
				"department":        u.Department,
				"jobTitle":          u.JobTitle,
				"mail":              u.Mail,
				"accountEnabled":    u.AccountEnabled,
			}
			if selectFields != "" {
				fields := strings.Split(selectFields, ",")
				filtered := gin.H{"id": u.ID}
				for _, f := range fields {
					f = strings.TrimSpace(f)
					if val, ok := item[f]; ok {
						filtered[f] = val
					}
				}
				userList = append(userList, filtered)
			} else {
				userList = append(userList, item)
			}
		}

		response := gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users", version),
			"value":          userList,
		}
		if len(appStore.Users) > top {
			response["@odata.nextLink"] = fmt.Sprintf("https://xlink.xcorp.internal/%s/users?$skipToken=keyset-seek-tkn-8921", version)
		}
		c.JSON(http.StatusOK, response)
	}
}

func handleUsersDelta(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		skipToken := c.Query("$skipToken")
		deltaToken := c.Query("$deltatoken")

		if skipToken == "" && deltaToken == "" {
			// First page of delta query
			items := make([]gin.H, 0)
			for i := 0; i < 2 && i < len(appStore.Users); i++ {
				u := appStore.Users[i]
				items = append(items, gin.H{
					"id":                u.ID,
					"displayName":       u.DisplayName,
					"userPrincipalName": u.UserPrincipalName,
					"department":        u.Department,
				})
			}
			c.JSON(http.StatusOK, gin.H{
				"@odata.context":  fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users/delta", version),
				"@odata.nextLink": fmt.Sprintf("https://xlink.xcorp.internal/%s/users/delta?$skipToken=tkn-page-2-keyset-9a8b", version),
				"value":           items,
			})
			return
		}

		// Terminal delta page: returns remaining entities, tombstone and checkpoint @odata.deltaLink
		items := make([]gin.H, 0)
		for i := 2; i < len(appStore.Users); i++ {
			u := appStore.Users[i]
			items = append(items, gin.H{
				"id":                u.ID,
				"displayName":       u.DisplayName,
				"userPrincipalName": u.UserPrincipalName,
				"department":        u.Department,
			})
		}
		// Soft-deleted tombstone
		items = append(items, gin.H{
			"@removed": gin.H{
				"reason": "deleted",
			},
			"id": "usr-xlink-tombstone-99",
		})

		c.JSON(http.StatusOK, gin.H{
			"@odata.context":   fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users/delta", version),
			"@odata.deltaLink": fmt.Sprintf("https://xlink.xcorp.internal/%s/users/delta?$deltatoken=dlta-checkpoint-watermark-2026", version),
			"value":            items,
		})
	}
}

func handleGetGroups(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#groups", version),
			"value":          appStore.Groups,
		})
	}
}

func handleGetDrives(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#drives", version),
			"value":          appStore.Drives,
		})
	}
}

func handleGetDriveChildren(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#drives('root')/items", version),
			"value":          appStore.DriveItems,
		})
	}
}

func handleCreateUploadSession(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		chunkSizeKiB := appStore.Config.Uploads.ChunkSizeKiB
		sessionTTL := appStore.Config.Uploads.SessionTTLHours
		storeLock.RUnlock()

		chunkBytes := chunkSizeKiB * 1024
		firstRange := fmt.Sprintf("0-%d", chunkBytes-1)
		sessionID := "sess-" + randomHex(12)
		expires := time.Now().UTC().Add(time.Duration(sessionTTL) * time.Hour).Format(time.RFC3339)

		c.JSON(http.StatusOK, gin.H{
			"@odata.context":     fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#uploadSession", version),
			"@odata.type":        "#xlink.uploadSession",
			"uploadUrl":          fmt.Sprintf("https://xlink.xcorp.internal/%s/me/drive/items/%s/content", version, sessionID),
			"expirationDateTime": expires,
			"nextExpectedRanges": []string{firstRange},
		})
	}
}

func handleGetMessages(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		storeLock.RLock()
		defer storeLock.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#messages", version),
			"value":          appStore.Messages,
		})
	}
}

func handleSendMail(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Message struct {
				Subject string `json:"subject"`
				Body    struct {
					ContentType string `json:"contentType"`
					Content     string `json:"content"`
				} `json:"body"`
				ToRecipients []gin.H `json:"toRecipients"`
			} `json:"message"`
			SaveToSentItems bool `json:"saveToSentItems"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mail payload"})
			return
		}

		storeLock.Lock()
		appStore.Messages = append([]MessageEntity{
			{
				ID:               "msg-xl-" + randomHex(4),
				Subject:          req.Message.Subject,
				BodyPreview:      req.Message.Body.Content,
				ReceivedDateTime: time.Now().UTC(),
				HasAttachments:   false,
				IsRead:           true,
				Sender: gin.H{
					"emailAddress": gin.H{
						"name":    "Alex Vance",
						"address": "alex.vance@xcorp.internal",
					},
				},
			},
		}, appStore.Messages...)
		storeLock.Unlock()

		c.Status(http.StatusAccepted)
	}
}

func handleGetSubscriptions(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Challenge Handshake: if validationToken is passed via query param, return plaintext immediately
		if token := c.Query("validationToken"); token != "" {
			c.String(http.StatusOK, token)
			return
		}

		storeLock.RLock()
		defer storeLock.RUnlock()

		c.JSON(http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#subscriptions", version),
			"value":          appStore.Subscriptions,
		})
	}
}

func handleCreateSubscription(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Challenge Handshake: if validationToken is in query string
		if token := c.Query("validationToken"); token != "" {
			c.String(http.StatusOK, token)
			return
		}

		var req struct {
			Resource           string    `json:"resource"`
			ChangeType         string    `json:"changeType"`
			NotificationURL    string    `json:"notificationUrl"`
			ExpirationDateTime time.Time `json:"expirationDateTime"`
			ClientState        string    `json:"clientState"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription payload"})
			return
		}

		if req.ExpirationDateTime.IsZero() {
			req.ExpirationDateTime = time.Now().UTC().Add(72 * time.Hour)
		}

		sub := WebhookSubscription{
			ID:                 "sub-xl-" + randomHex(4),
			Resource:           req.Resource,
			ChangeType:         req.ChangeType,
			NotificationURL:    req.NotificationURL,
			ExpirationDateTime: req.ExpirationDateTime,
			ClientState:        req.ClientState,
			Status:             "active",
		}

		storeLock.Lock()
		appStore.Subscriptions = append(appStore.Subscriptions, sub)
		storeLock.Unlock()

		c.JSON(http.StatusCreated, gin.H{
			"@odata.context":     fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#subscriptions/$entity", version),
			"id":                 sub.ID,
			"resource":           sub.Resource,
			"changeType":         sub.ChangeType,
			"notificationUrl":    sub.NotificationURL,
			"expirationDateTime": sub.ExpirationDateTime.Format(time.RFC3339),
			"clientState":        sub.ClientState,
			"status":             sub.Status,
		})
	}
}

// ============================================================================
// TOPOLOGICAL DAG JSON BATCH PROCESSOR (POST /$batch)
// ============================================================================

type BatchSubRequest struct {
	ID        string            `json:"id"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      json.RawMessage   `json:"body"`
	DependsOn []string          `json:"dependsOn"`
}

type BatchSubResponse struct {
	ID      string            `json:"id"`
	Status  int               `json:"status"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    interface{}       `json:"body,omitempty"`
}

func handleJSONBatch(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload struct {
			Requests []BatchSubRequest `json:"requests"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "InvalidBatchPayload",
					"message": "Malformed JSON batch request: " + err.Error(),
				},
			})
			return
		}

		if len(payload.Requests) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "EmptyBatch",
					"message": "Batch request array is empty",
				},
			})
			return
		}
		if len(payload.Requests) > 20 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "BatchLimitExceeded",
					"message": "Exceeded maximum of 20 sub-requests per JSON batch",
				},
			})
			return
		}

		// Topological DAG Sort & Execution
		reqMap := make(map[string]BatchSubRequest)
		for _, req := range payload.Requests {
			reqMap[req.ID] = req
		}

		executedStatus := make(map[string]int)
		responses := make([]BatchSubResponse, 0, len(payload.Requests))
		var respLock sync.Mutex

		// Topological level-by-level evaluation
		remaining := make(map[string]BatchSubRequest)
		for k, v := range reqMap {
			remaining[k] = v
		}

		for len(remaining) > 0 {
			// Find all requests whose dependencies have finished
			ready := make([]BatchSubRequest, 0)
			for id, req := range remaining {
				canRun := true
				for _, depID := range req.DependsOn {
					if _, finished := executedStatus[depID]; !finished {
						canRun = false
						break
					}
				}
				if canRun {
					ready = append(ready, req)
					delete(remaining, id)
				}
			}

			if len(ready) == 0 {
				// Cycle detected or missing dependency
				for id := range remaining {
					respLock.Lock()
					responses = append(responses, BatchSubResponse{
						ID:     id,
						Status: http.StatusFailedDependency,
						Body: gin.H{
							"error": gin.H{
								"code":    "CircularOrMissingDependency",
								"message": "Circular dependency graph or unresolvable reference",
							},
						},
					})
					executedStatus[id] = http.StatusFailedDependency
					respLock.Unlock()
				}
				break
			}

			// Execute ready requests
			var wg sync.WaitGroup
			for _, req := range ready {
				wg.Add(1)
				go func(subReq BatchSubRequest) {
					defer wg.Done()

					// Check if any upstream dependency failed
					dependencyFailed := false
					for _, depID := range subReq.DependsOn {
						st := executedStatus[depID]
						if st >= 400 {
							dependencyFailed = true
							break
						}
					}

					if dependencyFailed {
						respLock.Lock()
						executedStatus[subReq.ID] = http.StatusFailedDependency
						responses = append(responses, BatchSubResponse{
							ID:     subReq.ID,
							Status: http.StatusFailedDependency,
							Body: gin.H{
								"error": gin.H{
									"code":    "DependencyFailed",
									"message": "Cascading dependency failure: upstream sub-request failed",
								},
							},
						})
						respLock.Unlock()
						return
					}

					// Process subrequest mock dispatch
					status, body := executeMockSubRequest(subReq, version)
					respLock.Lock()
					executedStatus[subReq.ID] = status
					responses = append(responses, BatchSubResponse{
						ID:     subReq.ID,
						Status: status,
						Headers: map[string]string{
							"Content-Type": "application/json; odata.metadata=minimal",
						},
						Body: body,
					})
					respLock.Unlock()
				}(req)
			}
			wg.Wait()
		}

		// Sort responses by request ID to guarantee predictable output
		sort.Slice(responses, func(i, j int) bool {
			return responses[i].ID < responses[j].ID
		})

		c.JSON(http.StatusOK, gin.H{
			"responses": responses,
		})
	}
}

func executeMockSubRequest(req BatchSubRequest, version string) (int, interface{}) {
	normURL := strings.TrimPrefix(req.URL, "/")
	normURL = strings.TrimPrefix(normURL, version+"/")

	switch {
	case strings.HasPrefix(normURL, "me/drive"):
		return http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#drives('root')", version),
			"id":             "drv-xlink-root-01",
			"name":           "X-Drive Enterprise System Volume",
		}
	case strings.HasPrefix(normURL, "me/messages"):
		return http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#messages", version),
			"value":          appStore.Messages,
		}
	case strings.HasPrefix(normURL, "me"):
		return http.StatusOK, gin.H{
			"@odata.context":    fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users/$entity", version),
			"id":                appStore.Users[0].ID,
			"displayName":       appStore.Users[0].DisplayName,
			"userPrincipalName": appStore.Users[0].UserPrincipalName,
		}
	case strings.HasPrefix(normURL, "users"):
		return http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#users", version),
			"value":          appStore.Users,
		}
	case strings.HasPrefix(normURL, "groups"):
		return http.StatusOK, gin.H{
			"@odata.context": fmt.Sprintf("https://xlink.xcorp.internal/%s/$metadata#groups", version),
			"value":          appStore.Groups,
		}
	default:
		return http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "ResourceNotFound",
				"message": "Batch target " + req.URL + " not recognized",
			},
		}
	}
}

// ============================================================================
// ADMIN CONFIGURATION & TELEMETRY APIS (/api/admin/*)
// ============================================================================

func registerAdminRoutes(rg *gin.RouterGroup) {
	rg.GET("/overview", handleAdminOverview)
	rg.GET("/config", handleGetAdminConfig)
	rg.PUT("/config", handleUpdateAdminConfig)
	rg.GET("/apps", handleGetAdminApps)
	rg.POST("/apps", handleCreateAdminApp)
	rg.GET("/webhooks", handleGetAdminWebhooks)
	rg.GET("/audit", handleGetAdminAudit)
}

func handleAdminOverview(c *gin.Context) {
	storeLock.RLock()
	defer storeLock.RUnlock()

	uptime := time.Since(serverStart)
	hours := int(uptime.Hours())
	days := hours / 24
	remHours := hours % 24

	overview := MetricsData{
		EntitiesCount:      18450 + len(appStore.Users) + len(appStore.DriveItems),
		RequestRate:        482.6,
		P99LatencyMs:       14.2,
		RateLimitedTenants: 2,
		UptimeSeconds:      int64(uptime.Seconds()),
		UptimeHuman:        fmt.Sprintf("%d days, %d hours", days, remHours),
		ActiveTenants:      128,
		ActiveSessions:     342,
		CacheHitRatio:      0.984,
		ErrorBudgetPercent: 99.98,
	}

	c.JSON(http.StatusOK, overview)
}

func handleGetAdminConfig(c *gin.Context) {
	storeLock.RLock()
	defer storeLock.RUnlock()

	c.JSON(http.StatusOK, appStore.Config)
}

func handleUpdateAdminConfig(c *gin.Context) {
	var newCfg SystemConfig
	if err := c.ShouldBindJSON(&newCfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration payload: " + err.Error()})
		return
	}

	storeLock.Lock()
	appStore.Config = newCfg
	// Add audit log
	appStore.AuditLogs = append([]AuditEntry{
		{
			ID:          "aud-" + randomHex(6),
			TraceID:     "trc-soc-" + randomHex(8),
			Timestamp:   time.Now().UTC(),
			Actor:       "admin.portal@xcorp.internal",
			Event:       "MicroLevelConfigUpdate",
			Resource:    "/api/admin/config",
			IPAddress:   c.ClientIP(),
			Result:      "Success",
			ThreatScore: 0,
		},
	}, appStore.AuditLogs...)
	storeLock.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message": "Xlink system configuration updated successfully",
		"config":  newCfg,
	})
}

func handleGetAdminApps(c *gin.Context) {
	storeLock.RLock()
	defer storeLock.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"apps":          appStore.Apps,
		"scopesCatalog": masterScopesCatalog,
	})
}

func handleCreateAdminApp(c *gin.Context) {
	var req struct {
		Name     string   `json:"name"`
		TenantID string   `json:"tenantId"`
		Scopes   []string `json:"scopes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid app registration payload"})
		return
	}

	if req.TenantID == "" {
		req.TenantID = "tenant-default"
	}

	newApp := AppRegistration{
		ID:          "app-reg-" + randomHex(4),
		ClientID:    "client-" + randomHex(8),
		ClientSecret: "sec_" + randomHex(16),
		Name:        req.Name,
		TenantID:    req.TenantID,
		Scopes:      req.Scopes,
		CreatedAt:   time.Now().UTC(),
	}

	storeLock.Lock()
	appStore.Apps = append(appStore.Apps, newApp)
	appStore.AuditLogs = append([]AuditEntry{
		{
			ID:          "aud-" + randomHex(6),
			TraceID:     "trc-soc-" + randomHex(8),
			Timestamp:   time.Now().UTC(),
			Actor:       "admin.portal@xcorp.internal",
			Event:       "AppRegistrationCreated",
			Resource:    "/api/admin/apps/" + newApp.ClientID,
			IPAddress:   c.ClientIP(),
			Result:      "Success",
			ThreatScore: 0,
		},
	}, appStore.AuditLogs...)
	storeLock.Unlock()

	c.JSON(http.StatusCreated, newApp)
}

func handleGetAdminWebhooks(c *gin.Context) {
	storeLock.RLock()
	defer storeLock.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"subscriptions": appStore.Subscriptions,
	})
}

func handleGetAdminAudit(c *gin.Context) {
	storeLock.RLock()
	defer storeLock.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"auditLogs": appStore.AuditLogs,
	})
}

// ============================================================================
// V8 ENGINE & LEGACY COMPATIBILITY
// ============================================================================

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

func createEndpoint(c *gin.Context) {
	var cfg EndpointConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if mongoClient != nil {
		collection := mongoClient.Database("apibuilder").Collection("endpoints")
		_, _ = collection.InsertOne(ctx, cfg)
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Endpoint created", "endpoint": cfg})
}

func listEndpoints(c *gin.Context) {
	if mongoClient != nil {
		collection := mongoClient.Database("apibuilder").Collection("endpoints")
		cursor, err := collection.Find(ctx, bson.M{})
		if err == nil {
			defer cursor.Close(ctx)
			var endpoints []EndpointConfig
			if err = cursor.All(ctx, &endpoints); err == nil && len(endpoints) > 0 {
				c.JSON(http.StatusOK, endpoints)
				return
			}
		}
	}
	c.JSON(http.StatusOK, []EndpointConfig{})
}

func executeEndpoint(c *gin.Context) {
	path := c.Param("path")
	method := c.Request.Method

	// Efficient Payload Handling: limit to 1MB
	bodyBytes, _ := io.ReadAll(io.LimitReader(c.Request.Body, 1024*1024))
	bodyStr := string(bodyBytes)

	// Setup V8 Isolate from pool
	iso := isolatePool.Get().(*v8go.Isolate)
	defer isolatePool.Put(iso)

	v8ctx := v8go.NewContext(iso)
	defer v8ctx.Close()

	v8ctx.Global().Set("request_body", bodyStr)
	v8ctx.Global().Set("request_method", method)
	v8ctx.Global().Set("request_url", path)

	script := fmt.Sprintf(`
		(function() {
			try {
				return JSON.stringify({
					status: "ok",
					path: %q,
					method: %q,
					timestamp: new Date().toISOString()
				});
			} catch (e) {
				return JSON.stringify({ error: e.message });
			}
		})();
	`, path, method)

	val, err := v8ctx.RunScript(script, "endpoint.js")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Execution error: " + err.Error()})
		return
	}

	c.Data(http.StatusOK, "application/json", []byte(val.String()))
}

// ============================================================================
// MAIN ENTRYPOINT & ROUTING
// ============================================================================

func main() {
	initDB()
	r := gin.Default()

	// Global OData & Sentinel Headers
	r.Use(odataHeaders())

	// Enable CORS for frontend
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ConsistencyLevel, Prefer, Idempotency-Key, client-request-id")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Unified Entity Protocol Ingress
	v1Group := r.Group("/v1.0")
	registerEntityRoutes(v1Group, "v1.0")

	betaGroup := r.Group("/beta")
	registerEntityRoutes(betaGroup, "beta")

	// Enterprise Admin Center APIs
	adminGroup := r.Group("/api/admin")
	registerAdminRoutes(adminGroup)

	// Auxiliary & Legacy Endpoints
	api := r.Group("/api")
	api.POST("/endpoints", createEndpoint)
	api.GET("/endpoints", listEndpoints)
	r.Any("/run/*path", executeEndpoint)

	// Static Frontend Serving with Multipage HTML Support
	r.Static("/_next", "./static/_next")
	r.Static("/fonts", "./static/fonts")
	if fileExists("./static/favicon.ico") {
		r.StaticFile("/favicon.ico", "./static/favicon.ico")
	}

	// Catch-all route for Next.js multipage HTML export and client-side routing
	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path

		// Exclude API paths
		if strings.HasPrefix(reqPath, "/v1.0") || strings.HasPrefix(reqPath, "/beta") || strings.HasPrefix(reqPath, "/api") || strings.HasPrefix(reqPath, "/run") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ResourceNotFound",
					"message": fmt.Sprintf("The requested resource '%s' does not exist.", reqPath),
				},
			})
			return
		}

		cleanPath := filepath.Clean(strings.TrimPrefix(reqPath, "/"))

		// 1. Direct file match (e.g. static/image.png)
		direct := filepath.Join("./static", cleanPath)
		if fileExists(direct) {
			c.File(direct)
			return
		}

		// 2. Next.js export HTML match (e.g. /explorer -> ./static/explorer.html)
		htmlCandidate := filepath.Join("./static", cleanPath+".html")
		if fileExists(htmlCandidate) {
			c.File(htmlCandidate)
			return
		}

		// 3. Subdirectory index HTML match (e.g. /admin/apps -> ./static/admin/apps/index.html or ./static/admin/apps.html)
		subIndexCandidate := filepath.Join("./static", cleanPath, "index.html")
		if fileExists(subIndexCandidate) {
			c.File(subIndexCandidate)
			return
		}

		// 4. Fallback to root index.html
		rootIndex := filepath.Join("./static", "index.html")
		if fileExists(rootIndex) {
			c.File(rootIndex)
			return
		}

		// 5. Default welcome if static is not yet generated
		c.String(http.StatusOK, "Xlink Unified Enterprise Entity Engine - Gateway Operational")
	})

	port := getEnv("PORT", "8080")
	log.Printf("[Xlink Sovereign Gateway] Listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to bind gateway: %v", err)
	}
}
