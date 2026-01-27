# PowerShell run script for RoastMyDorm website Docker container

Write-Host "🚀 Starting RoastMyDorm website..." -ForegroundColor Green

# Set variables
$IMAGE_NAME = "roastmydorm"
$IMAGE_TAG = "latest"
$CONTAINER_NAME = "roastmydorm-website"
$PORT = "8080"

# Check if image exists
$imageExists = docker image inspect "$IMAGE_NAME`:$IMAGE_TAG" 2>$null
if (-not $imageExists) {
    Write-Host "❌ Docker image not found. Building first..." -ForegroundColor Red
    .\build.ps1
}

# Stop and remove existing container if it exists
Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
docker stop $CONTAINER_NAME 2>$null
docker rm $CONTAINER_NAME 2>$null

# Run the container
Write-Host "🚀 Starting container..." -ForegroundColor Blue
docker run -d --name $CONTAINER_NAME -p "$PORT`:80" --restart unless-stopped "$IMAGE_NAME`:$IMAGE_TAG"

# Check if container started successfully
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Website is available at: http://localhost:$PORT" -ForegroundColor Magenta
    Write-Host "🔍 Frontend is available at: http://localhost:$PORT/frontend/" -ForegroundColor Magenta
    Write-Host "❓ How It Works page: http://localhost:$PORT/how-it-works.html" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "📊 Container status:" -ForegroundColor Yellow
    docker ps --filter "name=$CONTAINER_NAME"
    Write-Host ""
    Write-Host "📝 To view logs:" -ForegroundColor Yellow
    Write-Host "   docker logs -f $CONTAINER_NAME" -ForegroundColor White
    Write-Host ""
    Write-Host "🛑 To stop the container:" -ForegroundColor Yellow
    Write-Host "   docker stop $CONTAINER_NAME" -ForegroundColor White
    Write-Host ""
    Write-Host "🗑️ To remove the container:" -ForegroundColor Yellow
    Write-Host "   docker rm $CONTAINER_NAME" -ForegroundColor White
} else {
    Write-Host "❌ Failed to start container!" -ForegroundColor Red
    exit 1
}
