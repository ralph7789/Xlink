# Build Go Gateway with CGO
FROM golang:bookworm AS builder
ENV CGO_ENABLED=1
ENV GOTOOLCHAIN=auto
WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN go build -o /app/gateway_bin .

# Minimal Production Debian Runner
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libstdc++6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled gateway binary from builder
COPY --from=builder /app/gateway_bin ./gateway
RUN chmod +x ./gateway

EXPOSE 8080
ENV PORT=8080

CMD ["./gateway"]
