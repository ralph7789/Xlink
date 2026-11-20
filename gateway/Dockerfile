# Stage 1: Build Next.js Frontend Static Export
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN mkdir -p public
RUN npm run build

# Stage 2: Build Go Gateway with CGO and Go 1.25/1.26 toolchain switching
FROM golang:bookworm AS gateway-builder
ENV CGO_ENABLED=1
ENV GOTOOLCHAIN=auto
WORKDIR /app/gateway

COPY gateway/go.mod gateway/go.sum* ./
RUN go mod download

COPY gateway/ ./
RUN go build -o /app/gateway .

# Stage 3: Minimal Production Debian Runner
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled gateway binary from Stage 2
COPY --from=gateway-builder /app/gateway ./gateway

# Copy exported Next.js static site from Stage 1 to ./static
COPY --from=frontend-builder /app/frontend/out ./static

EXPOSE 8080
ENV PORT=8080

CMD ["./gateway"]
