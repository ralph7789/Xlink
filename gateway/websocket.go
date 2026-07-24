package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for this example, but restrict in production
		return true
	},
}

func handleWebSocket(c *gin.Context) {
	slug := c.Param("slug")
	path := c.Param("path")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v\n", err)
		return
	}
	defer conn.Close()

	fmt.Printf("New WebSocket connection for %s%s\n", slug, path)

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v\n", err)
			break
		}
		
		fmt.Printf("Received message: %s\n", p)

		// Echo back for now
		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Printf("Write error: %v\n", err)
			break
		}
	}
}
