# CallWaiting AI - Voice Orchestration Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying the CallWaiting AI voice orchestration system in production environments.

## Architecture

### System Components
1. **Voice Orchestration Layer** - Core 5-task concurrent event loop
2. **VAD & Echo Cancellation** - Advanced speech detection
3. **Monitoring & Metrics** - Performance tracking and alerting
4. **Load Balancing** - High availability and scaling
5. **Data Persistence** - Call logs and analytics

### Technology Stack
- **FastAPI** - Web framework
- **WebSockets** - Real-time communication
- **Deepgram** - STT and TTS services
- **Groq** - LLM inference
- **Redis** - Session management
- **PostgreSQL** - Data persistence
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.11+
- API keys for Deepgram and Groq
- Domain name with SSL certificate

### 1. Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd callwaiting-ai

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 2. Configuration
Update the following in your `.env` file:
```bash
# Required API Keys
DEEPGRAM_API_KEY=your_deepgram_api_key
GROQ_API_KEY=your_groq_api_key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/voxanne
REDIS_URL=redis://localhost:6379

# Application Settings
ENVIRONMENT=production
LOG_LEVEL=INFO
MAX_CONCURRENT_CALLS=50
```

### 3. Deploy with Docker
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f voxanne-voice-orchestrator
```

### 4. Verify Deployment
```bash
# Health check
curl http://localhost:8000/health

# Check metrics
curl http://localhost:8000/metrics

# Access monitoring
open http://localhost:3000  # Grafana
open http://localhost:9090  # Prometheus
```

## Production Deployment

### Infrastructure Requirements

#### Minimum Requirements
- **CPU**: 4 cores (8 cores recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD
- **Network**: 1Gbps bandwidth
- **OS**: Ubuntu 20.04+ or similar

#### Recommended Cloud Setup
```yaml
# AWS EC2 Example
Instance Type: c5.2xlarge (8 vCPU, 16GB RAM)
Storage: 100GB GP3 SSD (3000 IOPS)
Network: Enhanced networking enabled
Regions: Multi-region for HA
```

### Security Configuration

#### 1. SSL/TLS Setup
```bash
# Generate SSL certificates
sudo apt-get install certbot
sudo certbot certonly --standalone -d your-domain.com

# Update nginx configuration
sudo nano /etc/nginx/sites-available/voxanne
```

#### 2. Firewall Configuration
```bash
# Allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8000/tcp  # Application
sudo ufw enable
```

#### 3. API Key Security
```bash
# Secure API keys
chmod 600 .env
chown root:root .env

# Use environment variables in production
export DEEPGRAM_API_KEY="your_key"
export GROQ_API_KEY="your_key"
```

### Performance Optimization

#### 1. System Tuning
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize network settings
echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_rmem = 4096 87380 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_wmem = 4096 65536 134217728" >> /etc/sysctl.conf
sysctl -p
```

#### 2. Docker Optimization
```yaml
# docker-compose.yml optimizations
services:
  voxanne-voice-orchestrator:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - UVICORN_WORKERS=4
      - UVICORN_LOOP=uvloop
```

#### 3. Application Tuning
```python
# FastAPI optimizations
app = FastAPI(
    title="CallWaiting AI",
    version="2.0.0",
    docs_url=None,  # Disable docs in production
    redoc_url=None,
    openapi_url=None
)

# WebSocket optimizations
websocket_config = {
    "max_size": 10 * 1024 * 1024,  # 10MB
    "max_queue": 100,
    "read_limit": 64 * 1024,
    "write_limit": 64 * 1024,
    "ping_interval": 20,
    "ping_timeout": 10,
}
```

### Monitoring and Alerting

#### 1. Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'voxanne-voice'
    static_configs:
      - targets: ['localhost:8000']
    scrape_interval: 5s
    metrics_path: /metrics
```

#### 2. Alert Rules
```yaml
# alert_rules.yml
groups:
  - name: voice_orchestration
    rules:
      - alert: HighLatency
        expr: voice_rtt_latency_p95 > 600
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High voice latency detected"
          
      - alert: HighErrorRate
        expr: voice_error_rate > 0.05
        for: 1m
        labels:
          severity: critical
          
      - alert: SystemOverloaded
        expr: voice_active_calls > 40
        for: 5m
        labels:
          severity: warning
```

#### 3. Grafana Dashboards
Import the following dashboards:
- Voice Latency Dashboard
- System Performance Dashboard
- Error Rate Dashboard
- Business Metrics Dashboard

### Scaling Strategies

#### 1. Horizontal Scaling
```yaml
# docker-compose scale
version: '3.8'
services:
  voxanne-voice-orchestrator:
    image: callwaiting/voxanne:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

#### 2. Load Balancing
```nginx
# nginx.conf upstream configuration
upstream voxanne_backend {
    least_conn;
    server voxanne1:8000 weight=3 max_fails=3 fail_timeout=30s;
    server voxanne2:8000 weight=3 max_fails=3 fail_timeout=30s;
    server voxanne3:8000 weight=3 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    location /ws {
        proxy_pass http://voxanne_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

#### 3. Database Scaling
```sql
-- PostgreSQL optimization
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Create indexes for performance
CREATE INDEX idx_calls_started_at ON calls(started_at);
CREATE INDEX idx_calls_user_id ON calls(user_id);
CREATE INDEX idx_metrics_call_id ON call_metrics(call_id);
```

### Backup and Disaster Recovery

#### 1. Database Backup
```bash
# Automated daily backups
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres voxanne > /backup/voxanne_$DATE.sql
gzip /backup/voxanne_$DATE.sql

# Upload to S3
aws s3 cp /backup/voxanne_$DATE.sql.gz s3://your-backup-bucket/
```

#### 2. Configuration Backup
```bash
# Backup configuration files
tar -czf /backup/voxanne-config-$(date +%Y%m%d).tar.gz \
  /opt/callwaiting/config \
  /opt/callwaiting/ssl \
  /etc/nginx/sites-available/voxanne
```

#### 3. Recovery Procedures
```bash
# Database recovery
gunzip /backup/voxanne_latest.sql.gz
psql -h localhost -U postgres -d voxanne < /backup/voxanne_latest.sql

# Service recovery
docker-compose down
docker-compose up -d
```

### Maintenance Procedures

#### 1. Zero-Downtime Updates
```bash
# Rolling update process
docker-compose up -d --no-deps --scale voxanne-voice-orchestrator=4 voxanne-voice-orchestrator
docker-compose up -d --no-deps --scale voxanne-voice-orchestrator=3 voxanne-voice-orchestrator
```

#### 2. Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/voxanne

/var/log/voxanne/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
```

#### 3. Performance Monitoring
```bash
# Regular performance checks
#!/bin/bash
# Check system resources
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)

# Check application health
curl -f http://localhost:8000/health || echo "Health check failed"

# Log metrics
echo "$(date): CPU:${CPU_USAGE}% MEM:${MEMORY_USAGE}% DISK:${DISK_USAGE}%" >> /var/log/voxanne/performance.log
```

## Troubleshooting

### Common Issues

#### 1. High Latency
```bash
# Check system resources
top -p $(pgrep -f voxanne)
iostat -x 1

# Check network latency
ping -c 10 api.deepgram.com
ping -c 10 api.groq.com

# Check application logs
docker-compose logs --tail=100 voxanne-voice-orchestrator
```

#### 2. WebSocket Connection Issues
```bash
# Check WebSocket status
netstat -an | grep :8000
ss -tuln | grep :8000

# Test WebSocket connection
websocat ws://localhost:8000/ws
```

#### 3. Memory Leaks
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep voxanne | grep -v grep'

# Check for memory leaks
valgrind --tool=memcheck --leak-check=full python app.py
```

### Performance Debugging

#### 1. Latency Breakdown
```python
# Enable detailed latency logging
LOG_LEVEL=DEBUG python app.py

# Profile specific functions
import cProfile
import pstats

pr = cProfile.Profile()
pr.enable()
# ... your code ...
pr.disable()
stats = pstats.Stats(pr).sort_stats('cumulative')
stats.print_stats(20)
```

#### 2. Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check connection usage
SELECT count(*), state
FROM pg_stat_activity
GROUP BY state;
```

## Support and Maintenance

### Regular Maintenance Tasks
- [ ] Monitor system metrics daily
- [ ] Review error logs weekly
- [ ] Update dependencies monthly
- [ ] Performance testing quarterly
- [ ] Security audits bi-annually

### Contact Information
- **Technical Support**: support@callwaiting.ai
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.callwaiting.ai
- **Status Page**: https://status.callwaiting.ai

### Version Information
- **Current Version**: 2.0.0
- **Release Date**: December 2024
- **Next Update**: Q1 2025

---

**Note**: This deployment guide is for production environments. Always test in staging before deploying to production.