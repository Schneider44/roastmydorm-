#!/bin/bash

# Run script for RateMyDorm website Docker container

echo "🚀 Starting RoastMyDorm website..."

# Set variables
IMAGE_NAME="ratemydorm"
IMAGE_TAG="latest"
CONTAINER_NAME="ratemydorm-website"
PORT="8080"

# Check if image exists
if ! docker image inspect $IMAGE_NAME:$IMAGE_TAG >/dev/null 2>&1; then
    echo "❌ Docker image not found. Building first..."
    ./build.sh
fi

# Stop and remove existing container if it exists
echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Run the container
echo "🚀 Starting container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:80 \
    --restart unless-stopped \
    $IMAGE_NAME:$IMAGE_TAG

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo ""
    echo "🌐 Website is available at: http://localhost:$PORT"
    echo "🔍 Frontend is available at: http://localhost:$PORT/frontend/"
    echo "❓ How It Works page: http://localhost:$PORT/how-it-works.html"
    echo ""
    echo "📊 Container status:"
    docker ps --filter "name=$CONTAINER_NAME"
    echo ""
    echo "📝 To view logs:"
    echo "   docker logs -f $CONTAINER_NAME"
    echo ""
    echo "🛑 To stop the container:"
    echo "   docker stop $CONTAINER_NAME"
    echo ""
    echo "🗑️ To remove the container:"
    echo "   docker rm $CONTAINER_NAME"
else
    echo "❌ Failed to start container!"
    exit 1
fi
