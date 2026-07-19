FROM golang:1.21

WORKDIR /app

# install g++ to compile v8go
RUN apt-get update && apt-get install -y g++

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN go build -o /api-gateway

EXPOSE 8080
CMD [ "/api-gateway" ]
