# PowerShell build script for RateMyDorm website Docker container

Write-Host "🚀 Building RoastMyDorm Docker container..." -ForegroundColor Green

# Set variables
$IMAGE_NAME = "ratemydorm"
$IMAGE_TAG = "latest"
$CONTAINER_NAME = "ratemydorm-website"

# Stop and remove existing container if it exists
Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
docker stop $CONTAINER_NAME 2>$null
docker rm $CONTAINER_NAME 2>$null

# Build the Docker image
Write-Host "🔨 Building Docker image..." -ForegroundColor Blue
docker build -t "$IMAGE_NAME`:$IMAGE_TAG" .

# Check if build was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
    Write-Host "📦 Image: $IMAGE_NAME`:$IMAGE_TAG" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 To run the container:" -ForegroundColor Yellow
    Write-Host "   docker run -d -p 8080:80 --name $CONTAINER_NAME $IMAGE_NAME`:$IMAGE_TAG" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Website will be available at: http://localhost:8080" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "📊 To check container status:" -ForegroundColor Yellow
    Write-Host "   docker ps" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 To view logs:" -ForegroundColor Yellow
    Write-Host "   docker logs $CONTAINER_NAME" -ForegroundColor White
} else {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}
