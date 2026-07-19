# API Builder SaaS App Architecture Document

## Overview

This document outlines the High-Level Design (HLD) and Low-Level Design (LLD) for the new API Builder Software-as-a-Service (SaaS) application. This platform enables developers to configure, manage, and deploy custom API endpoints (REST and WebSockets) dynamically. It acts as both a Backend-as-a-Service (BaaS) and a high-performance enterprise API Gateway.

## Core Requirements & Tech Stack

*   **Frontend:** Next.js (React) unified application with Role-Based Access Control (RBAC) separating Admin and Developer portals. Premium Dark Theme.
*   **Backend/Gateway Core:** Go (Golang) for the high-performance core gateway.
*   **Execution Environment:** Secure Sandboxed Execution Engine using V8 Isolates (via `v8go` or similar) or WebAssembly (Wasm) modules.
*   **Databases:** MongoDB (Persistent Storage) running in Docker.
*   **Caching & Real-time:** Redis (Rate limiting, caching, and Pub/Sub for WebSockets).
*   **Protocols Supported:** REST, WebSockets.
*   **Scale:** Designed to handle 100,000+ concurrent requests.
*   **Infrastructure:** Docker, Docker Swarm / Kubernetes (open-source orchestration).
*   **Integrations:** Plugin/Marketplace system for easily connecting external services like OpenAI, Stripe, and databases.

---

## High-Level Design (HLD)

The HLD defines the primary components of the system and how they interact to achieve extreme performance, security, and scalability for 100,000 concurrent connections.

### 1. System Architecture Diagram (Conceptual)

```
[ Clients / Users ]  -->  [ L4/L7 Load Balancer (HAProxy / Nginx) ]
                                      |
                                      v
[ Frontend Node (Next.js) ]    <-- (API calls) -->   [ Go API Gateway (Multiple Instances) ]
  (Admin & Developer UI)                                 |            |               |
                                                         |            |               |
                                      +------------------+            |               +------------------+
                                      |                               |                                  |
                                      v                               v                                  v
                        [ Secure Execution Sandbox ]       [ Redis Cluster ]                  [ MongoDB Cluster ]
                        (V8 Isolates / WebAssembly)        (Caching, Limits, Pub/Sub)         (Configs, Logs, Users)
                                      |
                                      v
                          [ 3rd Party Integrations ]
                            (OpenAI, Stripe, etc.)
```

### 2. Core Components Overview

#### A. Next.js Frontend Application
*   **Unified App:** A single Next.js application serves both the Developer Portal (for creating APIs, viewing analytics) and the Admin Portal (system management, global metrics, user management).
*   **RBAC:** Role-Based Access Control enforces strict boundaries. A JWT token determines if the user is a `DEVELOPER`, `ADMIN`, or `SUPER_ADMIN`.
*   **Dark Theme:** Utilizes a UI framework (e.g., Tailwind CSS, shadcn/ui) designed primarily for a premium dark mode experience.

#### B. Go (Golang) API Gateway
*   **The Brain:** Built in Go for maximum concurrency via Goroutines. It acts as the ingress for all dynamic endpoint traffic.
*   **Routing:** Dynamically routes incoming requests based on the URL path to the specific user's logic stored in the database.
*   **Scale:** Stateless design allows aggressive horizontal scaling across many Docker containers to handle 100k concurrents.

#### C. Secure Sandboxed Execution Engine
*   **V8 Isolates:** Similar to Cloudflare Workers, when a user's API endpoint is hit, the Gateway fetches the user's custom script and runs it in a highly constrained, ephemeral V8 isolate (using libraries like `rogchap/v8go`).
*   **Security:** This ensures one user's code cannot crash the Gateway, access the host OS, or read memory from another user's execution context. It enforces memory limits and timeout limits (e.g., max 50ms execution time).

#### D. Plugin / Marketplace Integrations
*   **Native Bindings:** Users don't write complex HTTP clients for Stripe or OpenAI. Instead, the Gateway injects secure, pre-configured functions (placeholders) into the V8 environment.
*   **Example:** A user script calls `Plugins.OpenAI.generateText(prompt)`. The Gateway intercepts this, securely handles the API key and actual HTTP request, and returns the result to the isolate.

#### E. Storage & State Management
*   **MongoDB:** The primary datastore. Holds user accounts, API endpoint configurations (code strings, routes), plugin configurations, and historical analytic logs.
*   **Redis:** Crucial for extreme scale.
    *   **Caching:** Caches endpoint routing configurations to avoid hitting MongoDB on every request.
    *   **Rate Limiting:** Implements sliding window or token bucket algorithms to ensure fair use and prevent DDoS.
    *   **Pub/Sub:** Handles state synchronization for WebSockets across multiple Gateway nodes.

### 3. Traffic Flows

#### REST API Flow
1.  Request arrives at Load Balancer -> routed to a Go Gateway instance.
2.  Gateway parses the URL to identify the requested Endpoint ID.
3.  Gateway checks Redis for rate limits and cached endpoint configuration.
4.  Gateway spawns a V8 isolate and injects the user's custom JavaScript code alongside requested Plugin bindings.
5.  Code executes, potentially calling external APIs via Plugins.
6.  Gateway captures the return value, formats the HTTP response, and returns it to the client.
7.  Gateway asynchronously logs the transaction (latency, status) to a message queue/MongoDB.

#### WebSocket Real-time Flow
1.  Client initiates WebSocket upgrade request to Load Balancer -> Gateway node (e.g., Node A).
2.  Node A accepts the connection and registers the connection ID in memory.
3.  If a message is sent from the client, the Gateway triggers the user's `onMessage` sandboxed script.
4.  If the script needs to broadcast a message to *all* connected users on this endpoint, Node A publishes the message to a specific Redis Pub/Sub channel.
5.  All other Gateway nodes (Node B, Node C) subscribed to that channel receive the message and forward it to their locally connected WebSocket clients.

---

## Low-Level Design (LLD)

The LLD delves into the database schemas, Go internal routing mechanisms, Plugin Architecture, and Real-time WebSocket connection state management.

### 1. MongoDB Schema Design

The following collections define the core data models for the platform.

#### `users`
*   `_id`: ObjectId
*   `email`: String (Unique)
*   `passwordHash`: String
*   `role`: Enum (`DEVELOPER`, `ADMIN`, `SUPER_ADMIN`)
*   `createdAt`: Timestamp
*   `status`: Enum (`ACTIVE`, `SUSPENDED`)

#### `projects`
*   `_id`: ObjectId
*   `userId`: ObjectId (Ref `users`)
*   `name`: String
*   `slug`: String (Unique) - Forms the base URL, e.g., `https://api.app.com/p/{slug}`
*   `createdAt`: Timestamp

#### `endpoints`
*   `_id`: ObjectId
*   `projectId`: ObjectId (Ref `projects`)
*   `path`: String (e.g., `/v1/users`, `/ws/chat`)
*   `method`: Enum (`GET`, `POST`, `PUT`, `DELETE`, `WS`)
*   `code`: String (The custom JavaScript executed in the sandbox)
*   `plugins`: Array of Plugin Configurations (e.g., `[{plugin: "OpenAI", secretId: "sec_123"}]`)
*   `status`: Enum (`DRAFT`, `PUBLISHED`)

#### `secrets` (Encrypted)
*   `_id`: ObjectId
*   `projectId`: ObjectId
*   `key`: String (e.g., `OPENAI_API_KEY`)
*   `value`: String (Encrypted symmetric key)

### 2. Go API Gateway Routing & Execution

#### Gateway Initializer
On startup, the Go Gateway establishes connection pools for MongoDB and Redis. It also pre-initializes a pool of V8 Isolates to eliminate start-up latency during high traffic.

#### Request Routing Logic (Go Pseudo-code)
```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    // 1. Extract Project Slug and Path
    slug, path := extractRouteParams(r.URL)

    // 2. Fetch Endpoint Config (Try Redis Cache first, then Mongo)
    endpointConfig := getEndpointConfig(slug, path, r.Method)

    // 3. Rate Limiting Check (Redis)
    if !rateLimiter.Allow(r.RemoteAddr, endpointConfig.RateLimit) {
        http.Error(w, "Too Many Requests", 429)
        return
    }

    // 4. Sandbox Execution
    result, err := executeInSandbox(endpointConfig.Code, r.Body, endpointConfig.Plugins)

    // 5. Response formatting
    writeResponse(w, result, err)
}
```

#### V8 Isolate Sandboxing (`v8go`)
To securely run developer code, the system utilizes `v8go`.
*   **Global Context:** A fresh V8 Context is created from an Isolate.
*   **Injections:** The HTTP `request` object and `Plugins` object are injected as global variables into the context.
*   **Execution Limits:** A Goroutine monitors the execution time. If it exceeds 50ms, a context cancellation halts the V8 isolate to prevent infinite loops from locking the thread.

### 3. Plugin Architecture

The Plugin system prevents developers from writing boilerplate and keeps secrets secure (they are never exposed to the V8 context directly).

#### Implementation Mechanism
1.  **Go Definitions:** Each plugin is written in Go as an interface inside the Gateway.
2.  **V8 Bindings:** The Go Gateway binds these functions to the V8 global context via `v8go.FunctionTemplate`.
3.  **Execution:** When the JavaScript code calls `Plugins.OpenAI.chat(...)`, V8 suspends, calls the underlying Go function, Go makes the network request securely using the stored secrets, and returns the result to V8.

### 4. WebSocket State Management (Redis Pub/Sub)

WebSockets are stateful, but our Gateway nodes are stateless. Redis Pub/Sub bridges this gap.

#### Connecting & Subscribing
*   When a client connects to `ws://api.app.com/p/{slug}/chat` via Node A, Node A assigns a `ConnectionID`.
*   Node A subscribes to a Redis channel named `ws:{slug}:chat`.

#### Broadcasting Messages
*   Client 1 sends a message. Node A executes the Sandboxed code.
*   The Sandboxed code calls `WS.broadcast(message)`.
*   Node A publishes `message` to the Redis channel `ws:{slug}:chat`.
*   *All* Gateway nodes (including Node A) receive the Pub/Sub message.
*   Each node looks up its local memory map for connections matching the slug/path and sends the raw message to those local WebSocket clients.

---

## Infrastructure & Deployment Strategy

To handle the scale of 100,000 concurrent requests, the system is designed to be entirely containerized and orchestrated using free, open-source tools.

### 1. Dockerization
*   **Next.js UI:** Built as a standalone Docker image.
*   **Go API Gateway:** Compiled to a minimal Alpine Linux or Scratch Docker image for fast startup and low overhead.
*   **MongoDB & Redis:** Deployed using official lightweight Docker images.

### 2. Container Orchestration (Docker Swarm / Kubernetes)
*   **Stateless Scaling:** The Go Gateway instances are completely stateless (aside from local WebSocket memory, which is synchronized via Redis). This allows the orchestrator to dynamically spin up new Gateway replicas based on CPU/Memory load.
*   **Replica Sets:** MongoDB will run in a Replica Set configuration to ensure data durability and read scalability.
*   **Redis Cluster:** Redis will run in Cluster mode to distribute keys across multiple nodes, preventing a single point of failure and bottlenecking.

### 3. `docker-compose.yml` Blueprint (For Local Development)
```yaml
version: '3.8'

services:
  # Load Balancer / API Gateway Ingress
  gateway:
    build: ./backend
    ports:
      - "8080:8080"
    depends_on:
      - mongo
      - redis
    environment:
      - MONGO_URI=mongodb://mongo:27017/apibuilder
      - REDIS_ADDR=redis:6379

  # Next.js Frontend
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080

  # Persistent Storage
  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  # Caching and Pub/Sub
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

volumes:
  mongo_data:
```