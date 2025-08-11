# Use Node.js 18 with system dependencies for PDF processing
FROM node:18-bullseye

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    imagemagick \
    ghostscript \
    poppler-utils \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy for PDF processing
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Payload types and build
RUN npm run generate:types || true
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]