FROM golang:1.21-alpine AS builder

# v8go requires CGO
ENV CGO_ENABLED=1
RUN apk add --no-cache gcc g++ musl-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o /app/gateway .

FROM alpine:latest
RUN apk add --no-cache libstdc++

WORKDIR /app

COPY --from=builder /app/gateway .

EXPOSE 8080

CMD ["./gateway"]
