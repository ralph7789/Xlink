#!/bin/bash

# Ensure we're in the right directory
cd "$(dirname "$0")"

echo "Building and starting Docker containers..."
docker compose up --build -d

echo "Waiting for services to start..."
sleep 15 # Wait for mongodb and go-gateway to come up

echo "Checking running containers:"
docker compose ps

echo ""
echo "======================================"
echo "SaaS API Builder Stack is Running!"
echo "Frontend: http://localhost:3000"
echo "API Gateway: http://localhost:8080"
echo "======================================"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
