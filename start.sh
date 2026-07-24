#!/bin/bash

echo "Starting the infrastructure stack..."
docker compose up --build -d
echo "Stack started successfully."
docker ps
