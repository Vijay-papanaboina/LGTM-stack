# Order Service Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

EXPOSE 8001

CMD ["node", "app.js"]
