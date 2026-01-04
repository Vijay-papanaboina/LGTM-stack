# Sample App Dockerfile (Node.js)
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose the port
EXPOSE 8000

# Run the app
CMD ["node", "app.js"]
