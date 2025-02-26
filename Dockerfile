# Dockerfile
FROM node:21

# Set working directory inside container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Make shell script executable
RUN chmod +x your_program.sh

# Set default command
CMD ["node", "app/main.js"]