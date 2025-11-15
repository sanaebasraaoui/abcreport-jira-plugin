# Use Node.js 20
FROM node:20-alpine

# Set working directory to backend
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy backend source code
COPY backend/ ./

# Build the TypeScript code
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start the server
CMD ["npm", "start"]

