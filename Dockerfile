FROM golang:1.23-bookworm AS builder

# v8go requires CGO
ENV CGO_ENABLED=1
ENV GOTOOLCHAIN=auto

WORKDIR /app

# Copy Go module manifests from gateway
COPY gateway/go.mod gateway/go.sum* ./
RUN go mod download

# Copy gateway source tree
COPY gateway/ .

# Compile gateway binary
RUN go build -o /app/gateway main.go

# Production runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/gateway .

EXPOSE 8080

ENV PORT=8080

CMD ["./gateway"]
