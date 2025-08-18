# Use official Node.js image
FROM node:20

# Install dependencies for Electron (X11, etc.)
RUN apt-get update && \
    apt-get install -y libgtk-3-0 libnss3 libxss1 libasound2 xvfb

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose display for Electron
ENV DISPLAY=:99

# Start Xvfb and run the app
CMD ["/bin/bash", "-c", "Xvfb :99 -screen 0 1024x768x16 & npm run dev"]
