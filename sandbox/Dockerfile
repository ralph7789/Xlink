FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Native dependencies for isolated-vm
RUN apk add --no-cache python3 make g++
RUN npm install
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
