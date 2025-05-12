FROM node:18.20.8-bullseye

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy application files
COPY . .

# Expose the port
EXPOSE 3030

# Start the application
CMD ["pnpm", "dev"] 