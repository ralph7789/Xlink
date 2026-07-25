FROM golang:1.22-bookworm AS builder

# v8go requires CGO
ENV CGO_ENABLED=1

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o /app/gateway main.go

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/gateway .

EXPOSE 8080

CMD ["./gateway"]
