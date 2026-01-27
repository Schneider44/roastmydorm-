#!/bin/bash

# Test script for RateMyDorm Docker deployment

echo "🧪 Testing RoastMyDorm Docker deployment..."

BASE_URL="http://localhost:8080"
CONTAINER_NAME="ratemydorm-website"

# Function to test URL
test_url() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo "✅ OK"
        return 0
    else
        echo "❌ FAILED"
        return 1
    fi
}

# Check if container is running
echo "📊 Checking container status..."
if docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}" | grep -q "$CONTAINER_NAME"; then
    echo "✅ Container is running"
else
    echo "❌ Container is not running. Please start it first with ./run.sh"
    exit 1
fi

echo ""
echo "🌐 Testing website endpoints..."

# Test main endpoints
test_url "$BASE_URL" "Main website"
test_url "$BASE_URL/frontend/" "Frontend page"
test_url "$BASE_URL/how-it-works.html" "How It Works page"
test_url "$BASE_URL/health" "Health check endpoint"

# Test city pages
test_url "$BASE_URL/frontend/casablanca-dorms.html" "Casablanca dorms"
test_url "$BASE_URL/frontend/rabat-dorms.html" "Rabat dorms"
test_url "$BASE_URL/frontend/marrakech-dorms.html" "Marrakech dorms"

echo ""
echo "📊 Container resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINER_NAME

echo ""
echo "📝 Recent container logs:"
docker logs --tail 10 $CONTAINER_NAME

echo ""
echo "🎉 Testing completed!"
echo "🌐 Your website is available at: $BASE_URL"
