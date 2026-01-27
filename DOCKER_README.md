# RoastMyDorm - Docker Deployment Guide

This guide will help you containerize and deploy your RoastMyDorm website using Docker.

## 🐳 Docker Setup

### Prerequisites
- Docker installed on your system
- Docker Compose (optional, for easier management)

### Quick Start

#### Option 1: Using Scripts (Recommended)

**For Linux/Mac:**
```bash
# Make scripts executable
chmod +x build.sh run.sh

# Build the Docker image
./build.sh

# Run the container
./run.sh
```

**For Windows (PowerShell):**
```powershell
# Build the Docker image
.\build.ps1

# Run the container
.\run.ps1
```

#### Option 2: Manual Docker Commands

```bash
# Build the Docker image
docker build -t ratemydorm:latest .

# Run the container
docker run -d -p 8080:80 --name ratemydorm-website ratemydorm:latest
```

#### Option 3: Using Docker Compose

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the services
docker-compose down
```

## 🌐 Access Your Website

Once the container is running, your website will be available at:

- **Main Website**: http://localhost:8080
- **Frontend**: http://localhost:8080/frontend/
- **How It Works**: http://localhost:8080/how-it-works.html
- **Health Check**: http://localhost:8080/health

## 📊 Container Management

### Check Container Status
```bash
docker ps
```

### View Container Logs
```bash
docker logs -f ratemydorm-website
```

### Stop the Container
```bash
docker stop ratemydorm-website
```

### Remove the Container
```bash
docker rm ratemydorm-website
```

### Remove the Image
```bash
docker rmi ratemydorm:latest
```

## 🚀 Deployment Options

### 1. Railway
1. Connect your GitHub repository to Railway
2. Railway will automatically detect the Dockerfile
3. Deploy with one click

### 2. Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `docker build -t roastmydorm .`
4. Set start command: `docker run -p $PORT:80 roastmydorm`

### 3. Hostinger VPS
1. Upload your project files to the VPS
2. Install Docker on the VPS
3. Run the build and run commands
4. Configure reverse proxy if needed

### 4. DigitalOcean App Platform
1. Connect your GitHub repository
2. Select "Docker" as the source type
3. DigitalOcean will auto-detect your Dockerfile
4. Deploy with automatic scaling

## 🔧 Configuration

### Environment Variables
You can customize the deployment using environment variables:

```bash
docker run -d \
  -p 8080:80 \
  -e NGINX_HOST=your-domain.com \
  -e NGINX_PORT=80 \
  --name ratemydorm-website \
  ratemydorm:latest
```

### Custom Domain
To use a custom domain, update the nginx.conf file and rebuild:

1. Edit `nginx.conf`
2. Change `server_name localhost;` to your domain
3. Rebuild the Docker image
4. Deploy with your domain configuration

## 🔒 Security Features

The Docker setup includes several security features:

- **Non-root user**: Container runs as nginx user
- **Security headers**: XSS protection, content type options, etc.
- **Health checks**: Automatic container health monitoring
- **Resource limits**: Configurable CPU and memory limits

## 📈 Performance Optimizations

- **Gzip compression**: Automatic compression for text files
- **Static file caching**: Long-term caching for assets
- **Efficient nginx configuration**: Optimized for static sites
- **Alpine Linux**: Minimal base image for faster deployments

## 🛠️ Troubleshooting

### Container won't start
```bash
# Check logs
docker logs ratemydorm-website

# Check if port is already in use
netstat -tulpn | grep :8080
```

### Website not loading
```bash
# Check container status
docker ps

# Test connectivity
curl http://localhost:8080/health
```

### Build failures
```bash
# Check Dockerfile syntax
docker build --no-cache -t ratemydorm:latest .

# Check for file permissions
ls -la
```

## 📝 File Structure

```
ratemydorm/
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
├── nginx.conf             # Nginx configuration
├── .dockerignore          # Files to exclude from Docker build
├── build.sh               # Linux/Mac build script
├── run.sh                 # Linux/Mac run script
├── build.ps1              # Windows build script
├── run.ps1                # Windows run script
├── DOCKER_README.md       # This file
└── [your website files]
```

## 🎯 Production Deployment Checklist

- [ ] Test locally with Docker
- [ ] Configure custom domain (if needed)
- [ ] Set up SSL certificates (for HTTPS)
- [ ] Configure monitoring and logging
- [ ] Set up automatic backups
- [ ] Configure CI/CD pipeline
- [ ] Test load balancing (if needed)
- [ ] Set up health monitoring

## 📞 Support

If you encounter any issues with the Docker deployment:

1. Check the container logs: `docker logs ratemydorm-website`
2. Verify the build process: `docker build --no-cache -t ratemydorm .`
3. Test the health endpoint: `curl http://localhost:8080/health`
4. Check file permissions and ownership

Happy deploying! 🚀
