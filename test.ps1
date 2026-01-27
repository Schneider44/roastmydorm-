# PowerShell test script for RateMyDorm Docker deployment

Write-Host "🧪 Testing RoastMyDorm Docker deployment..." -ForegroundColor Green

$BASE_URL = "http://localhost:8080"
$CONTAINER_NAME = "roastmydorm-website"

# Function to test URL
function Test-Url {
    param(
        [string]$url,
        [string]$description
    )
    
    Write-Host "Testing $description... " -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ OK" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ FAILED (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ FAILED (Error: $($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

# Check if container is running
Write-Host "📊 Checking container status..." -ForegroundColor Blue
$containerStatus = docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}} {{.Status}}"
if ($containerStatus -match $CONTAINER_NAME) {
    Write-Host "✅ Container is running" -ForegroundColor Green
} else {
    Write-Host "❌ Container is not running. Please start it first with .\run.ps1" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🌐 Testing website endpoints..." -ForegroundColor Blue

# Test main endpoints
Test-Url $BASE_URL "Main website"
Test-Url "$BASE_URL/frontend/" "Frontend page"
Test-Url "$BASE_URL/how-it-works.html" "How It Works page"
Test-Url "$BASE_URL/health" "Health check endpoint"

# Test city pages
Test-Url "$BASE_URL/frontend/casablanca-dorms.html" "Casablanca dorms"
Test-Url "$BASE_URL/frontend/rabat-dorms.html" "Rabat dorms"
Test-Url "$BASE_URL/frontend/marrakech-dorms.html" "Marrakech dorms"

Write-Host ""
Write-Host "📊 Container resource usage:" -ForegroundColor Blue
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $CONTAINER_NAME

Write-Host ""
Write-Host "📝 Recent container logs:" -ForegroundColor Blue
docker logs --tail 10 $CONTAINER_NAME

Write-Host ""
Write-Host "🎉 Testing completed!" -ForegroundColor Green
Write-Host "🌐 Your website is available at: $BASE_URL" -ForegroundColor Magenta
