#!/bin/bash

# Build script for RateMyDorm website Docker container

echo "🚀 Building RoastMyDorm Docker container..."

# Set variables
IMAGE_NAME="roastmydorm"
IMAGE_TAG="latest"
CONTAINER_NAME="roastmydorm-website"

# Stop and remove existing container if it exists
echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME:$IMAGE_TAG .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo "📦 Image: $IMAGE_NAME:$IMAGE_TAG"
    echo ""
    echo "🚀 To run the container:"
    echo "   docker run -d -p 8080:80 --name $CONTAINER_NAME $IMAGE_NAME:$IMAGE_TAG"
    echo ""
    echo "🌐 Website will be available at: http://localhost:8080"
    echo ""
    echo "📊 To check container status:"
    echo "   docker ps"
    echo ""
    echo "📝 To view logs:"
    echo "   docker logs $CONTAINER_NAME"
else
    echo "❌ Docker build failed!"
    exit 1
fi
