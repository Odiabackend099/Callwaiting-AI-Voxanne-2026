"""
CallWaiting AI - Comprehensive Monitoring Dashboard
Real-time metrics and observability for voice orchestration system
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict, deque
import numpy as np
from aiohttp import web
import aiohttp
from aiohttp import WSMsgType
import websockets
import threading
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class RealtimeMetrics:
    """Real-time system metrics"""
    timestamp: datetime = field(default_factory=datetime.now)
    active_calls: int = 0
    total_calls: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    error_rate: float = 0.0
    interruption_rate: float = 0.0
    
    # Component-specific metrics
    stt_ttft_avg_ms: float = 0.0
    llm_ttft_avg_ms: float = 0.0
    tts_ttft_avg_ms: float = 0.0
    
    # Resource metrics
    cpu_usage: float = 0.0
    memory_usage_mb: float = 0.0
    network_io_mb_s: float = 0.0


@dataclass
class AlertConfig:
    """Alert configuration"""
    name: str
    threshold: float
    comparison: str  # '>', '<', '==', '>='
    duration_s: int = 60  # How long condition must persist
    severity: str = "warning"  # 'info', 'warning', 'critical'
    message: str = ""


class MetricsCollector:
    """Collects and aggregates system metrics"""
    
    def __init__(self, max_history_minutes: int = 60):
        self.max_history_minutes = max_history_minutes
        self.metrics_history: deque = deque(maxlen=max_history_minutes * 60)  # 1 per second
        self.call_metrics: Dict[str, Dict] = {}
        self.current_metrics = RealtimeMetrics()
        
        # Component metrics
        self.stt_latencies: deque = deque(maxlen=1000)
        self.llm_latencies: deque = deque()
        self.tts_latencies: deque = deque()
        self.total_latencies: deque = deque()
        
        # Error tracking
        self.errors: Dict[str, int] = defaultdict(int)
        self.interruptions: int = 0
        self.total_calls: int = 0
        self.successful_calls: int = 0
        
        # Resource monitoring
        self.cpu_readings: deque = deque(maxlen=60)
        self.memory_readings: deque = deque(maxlen=60)
        
        self._running = False
        self._update_thread: Optional[threading.Thread] = None
    
    def start(self):
        """Start metrics collection"""
        self._running = True
        self._update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self._update_thread.start()
        logger.info("📊 Metrics collector started")
    
    def stop(self):
        """Stop metrics collection"""
        self._running = False
        if self._update_thread:
            self._update_thread.join()
        logger.info("📊 Metrics collector stopped")
    
    def _update_loop(self):
        """Background thread for periodic updates"""
        while self._running:
            try:
                self._collect_system_metrics()
                self._update_realtime_metrics()
                time.sleep(1)  # Update every second
            except Exception as e:
                logger.error(f"Error in metrics update loop: {e}")
    
    def _collect_system_metrics(self):
        """Collect system resource metrics"""
        try:
            import psutil
            
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.cpu_readings.append(cpu_percent)
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.memory_readings.append(memory.used / 1024 / 1024)  # MB
            
            # Network I/O
            net_io = psutil.net_io_counters()
            # Calculate MB/s (simplified)
            if len(self.cpu_readings) > 1:
                self.current_metrics.network_io_mb_s = net_io.bytes_sent / 1024 / 1024
            
        except ImportError:
            # psutil not available, use mock data
            self.cpu_readings.append(np.random.normal(30, 10))
            self.memory_readings.append(np.random.normal(512, 100))
    
    def _update_realtime_metrics(self):
        """Update current metrics"""
        now = datetime.now()
        
        # Calculate percentiles
        if self.total_latencies:
            latencies = list(self.total_latencies)
            self.current_metrics.p50_latency_ms = np.percentile(latencies, 50)
            self.current_metrics.p95_latency_ms = np.percentile(latencies, 95)
            self.current_metrics.p99_latency_ms = np.percentile(latencies, 99)
            self.current_metrics.avg_latency_ms = np.mean(latencies)
        
        # Component metrics
        if self.stt_latencies:
            self.current_metrics.stt_ttft_avg_ms = np.mean(list(self.stt_latencies))
        if self.llm_latencies:
            self.current_metrics.llm_ttft_avg_ms = np.mean(list(self.llm_latencies))
        if self.tts_latencies:
            self.current_metrics.tts_ttft_avg_ms = np.mean(list(self.tts_latencies))
        
        # Success/error rates
        if self.total_calls > 0:
            self.current_metrics.success_rate = self.successful_calls / self.total_calls
            self.current_metrics.error_rate = sum(self.errors.values()) / self.total_calls
            self.current_metrics.interruption_rate = self.interruptions / self.total_calls
        
        # Resource metrics
        if self.cpu_readings:
            self.current_metrics.cpu_usage = np.mean(list(self.cpu_readings))
        if self.memory_readings:
            self.current_metrics.memory_usage_mb = np.mean(list(self.memory_readings))
        
        # Update counters
        self.current_metrics.total_calls = self.total_calls
        self.current_metrics.active_calls = self.get_active_call_count()
        self.current_metrics.timestamp = now
        
        # Add to history
        self.metrics_history.append(self.current_metrics)
    
    def record_call_start(self, call_id: str):
        """Record new call start"""
        self.call_metrics[call_id] = {
            "start_time": datetime.now(),
            "status": "active",
            "latencies": [],
            "errors": []
        }
        self.total_calls += 1
    
    def record_call_end(self, call_id: str, success: bool, total_latency_ms: float):
        """Record call completion"""
        if call_id in self.call_metrics:
            self.call_metrics[call_id]["end_time"] = datetime.now()
            self.call_metrics[call_id]["status"] = "success" if success else "failed"
            self.call_metrics[call_id]["total_latency_ms"] = total_latency_ms
            
            if success:
                self.successful_calls += 1
                self.total_latencies.append(total_latency_ms)
            else:
                self.errors["call_failure"] += 1
    
    def record_component_latency(self, component: str, latency_ms: float):
        """Record component latency"""
        if component == "stt":
            self.stt_latencies.append(latency_ms)
        elif component == "llm":
            self.llm_latencies.append(latency_ms)
        elif component == "tts":
            self.tts_latencies.append(latency_ms)
    
    def record_interruption(self):
        """Record barge-in interruption"""
        self.interruptions += 1
    
    def record_error(self, error_type: str):
        """Record system error"""
        self.errors[error_type] += 1
    
    def get_active_call_count(self) -> int:
        """Get current active call count"""
        return sum(1 for call in self.call_metrics.values() if call["status"] == "active")
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        return {
            "timestamp": self.current_metrics.timestamp.isoformat(),
            "active_calls": self.current_metrics.active_calls,
            "total_calls": self.current_metrics.total_calls,
            "success_rate": self.current_metrics.success_rate,
            "avg_latency_ms": self.current_metrics.avg_latency_ms,
            "p50_latency_ms": self.current_metrics.p50_latency_ms,
            "p95_latency_ms": self.current_metrics.p95_latency_ms,
            "p99_latency_ms": self.current_metrics.p99_latency_ms,
            "error_rate": self.current_metrics.error_rate,
            "interruption_rate": self.current_metrics.interruption_rate,
            "component_latencies_ms": {
                "stt_ttft": self.current_metrics.stt_ttft_avg_ms,
                "llm_ttft": self.current_metrics.llm_ttft_avg_ms,
                "tts_ttft": self.current_metrics.tts_ttft_avg_ms
            },
            "resource_usage": {
                "cpu_percent": self.current_metrics.cpu_usage,
                "memory_mb": self.current_metrics.memory_usage_mb,
                "network_io_mb_s": self.current_metrics.network_io_mb_s
            },
            "errors": dict(self.errors)
        }


class AlertManager:
    """Manages system alerts and notifications"""
    
    def __init__(self):
        self.alerts: List[Dict] = []
        self.alert_configs = [
            AlertConfig(
                name="high_error_rate",
                threshold=0.05,  # 5%
                comparison=">",
                duration_s=60,
                severity="critical",
                message="Error rate exceeds 5%"
            ),
            AlertConfig(
                name="high_latency_p95",
                threshold=600,  # 600ms
                comparison=">",
                duration_s=120,
                severity="warning",
                message="P95 latency exceeds 600ms"
            ),
            AlertConfig(
                name="high_cpu_usage",
                threshold=80,  # 80%
                comparison=">",
                duration_s=300,
                severity="warning",
                message="CPU usage exceeds 80%"
            ),
            AlertConfig(
                name="low_success_rate",
                threshold=0.95,  # 95%
                comparison="<",
                duration_s=60,
                severity="critical",
                message="Success rate below 95%"
            ),
            AlertConfig(
                name="high_interruption_rate",
                threshold=0.3,  # 30%
                comparison=">",
                duration_s=300,
                severity="info",
                message="High interruption rate detected"
            )
        ]
        
        self.condition_history: Dict[str, List[float]] = defaultdict(list)
    
    def check_alerts(self, metrics: RealtimeMetrics):
        """Check for alert conditions"""
        current_time = time.time()
        
        for config in self.alert_configs:
            # Get metric value
            value = self._get_metric_value(metrics, config.name)
            if value is None:
                continue
            
            # Check condition
            condition_met = self._evaluate_condition(value, config.threshold, config.comparison)
            
            # Add to history
            self.condition_history[config.name].append(current_time if condition_met else 0)
            
            # Clean old history
            cutoff_time = current_time - config.duration_s
            self.condition_history[config.name] = [
                t for t in self.condition_history[config.name] if t > cutoff_time
            ]
            
            # Check if condition persisted
            if len(self.condition_history[config.name]) > 0 and condition_met:
                # All timestamps in history are within duration and condition is currently met
                alert = {
                    "timestamp": datetime.now().isoformat(),
                    "alert_name": config.name,
                    "severity": config.severity,
                    "message": config.message,
                    "current_value": value,
                    "threshold": config.threshold,
                    "duration_s": config.duration_s
                }
                
                self.alerts.append(alert)
                logger.warning(f"🚨 ALERT: {config.message} (value: {value:.2f})")
    
    def _get_metric_value(self, metrics: RealtimeMetrics, alert_name: str) -> Optional[float]:
        """Get metric value for alert"""
        if alert_name == "high_error_rate":
            return metrics.error_rate
        elif alert_name == "high_latency_p95":
            return metrics.p95_latency_ms
        elif alert_name == "high_cpu_usage":
            return metrics.cpu_usage
        elif alert_name == "low_success_rate":
            return metrics.success_rate
        elif alert_name == "high_interruption_rate":
            return metrics.interruption_rate
        return None
    
    def _evaluate_condition(self, value: float, threshold: float, comparison: str) -> bool:
        """Evaluate alert condition"""
        if comparison == ">":
            return value > threshold
        elif comparison == "<":
            return value < threshold
        elif comparison == ">=":
            return value >= threshold
        elif comparison == "<=":
            return value <= threshold
        elif comparison == "==":
            return value == threshold
        return False
    
    def get_active_alerts(self) -> List[Dict]:
        """Get currently active alerts"""
        return self.alerts[-10:]  # Last 10 alerts


class MonitoringDashboard:
    """Web-based monitoring dashboard"""
    
    def __init__(self, host: str = "0.0.0.0", port: int = 8080):
        self.host = host
        self.port = port
        self.app = web.Application()
        self.collector = MetricsCollector()
        self.alert_manager = AlertManager()
        self.websockets: List[web.WebSocketResponse] = []
        
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup web routes"""
        self.app.router.add_get('/', self.index_handler)
        self.app.router.add_get('/api/metrics', self.metrics_handler)
        self.app.router.add_get('/api/metrics/history', self.metrics_history_handler)
        self.app.router.add_get('/api/alerts', self.alerts_handler)
        self.app.router.add_get('/api/system/status', self.system_status_handler)
        self.app.router.add_get('/ws', self.websocket_handler)
        
        # Static files
        self.app.router.add_static('/static', 'static', name='static')
    
    async def index_handler(self, request):
        """Serve main dashboard page"""
        html_content = self._get_dashboard_html()
        return web.Response(text=html_content, content_type='text/html')
    
    async def metrics_handler(self, request):
        """Get current metrics"""
        metrics = self.collector.get_metrics_summary()
        return web.json_response(metrics)
    
    async def metrics_history_handler(self, request):
        """Get metrics history"""
        minutes = int(request.query.get('minutes', 5))
        history = list(self.collector.metrics_history)[-minutes*60:]  # Last N minutes
        
        return web.json_response([
            {
                "timestamp": m.timestamp.isoformat(),
                "active_calls": m.active_calls,
                "success_rate": m.success_rate,
                "avg_latency_ms": m.avg_latency_ms,
                "p95_latency_ms": m.p95_latency_ms,
                "error_rate": m.error_rate,
                "cpu_usage": m.cpu_usage,
                "memory_usage_mb": m.memory_usage_mb
            }
            for m in history
        ])
    
    async def alerts_handler(self, request):
        """Get active alerts"""
        alerts = self.alert_manager.get_active_alerts()
        return web.json_response(alerts)
    
    async def system_status_handler(self, request):
        """Get overall system status"""
        metrics = self.collector.current_metrics
        
        # Determine system health
        if metrics.error_rate > 0.1:  # >10% error rate
            health = "critical"
        elif metrics.error_rate > 0.05:  # >5% error rate
            health = "warning"
        elif metrics.p95_latency_ms > 800:  # >800ms P95 latency
            health = "degraded"
        else:
            health = "healthy"
        
        return web.json_response({
            "status": health,
            "active_calls": metrics.active_calls,
            "uptime_seconds": (datetime.now() - datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds(),
            "version": "2.0.0",
            "last_updated": metrics.timestamp.isoformat()
        })
    
    async def websocket_handler(self, request):
        """WebSocket for real-time updates"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.websockets.append(ws)
        
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    if msg.data == 'ping':
                        await ws.send_str('pong')
                elif msg.type == WSMsgType.ERROR:
                    logger.error(f'WebSocket error: {ws.exception()}')
        except Exception as e:
            logger.error(f'WebSocket handler error: {e}')
        finally:
            self.websockets.remove(ws)
        
        return ws
    
    async def broadcast_metrics(self):
        """Broadcast metrics to all connected WebSocket clients"""
        if not self.websockets:
            return
        
        metrics = self.collector.get_metrics_summary()
        message = json.dumps({
            "type": "metrics_update",
            "data": metrics
        })
        
        # Send to all connected clients
        disconnected = []
        for ws in self.websockets:
            try:
                await ws.send_str(message)
            except Exception:
                disconnected.append(ws)
        
        # Remove disconnected clients
        for ws in disconnected:
            self.websockets.remove(ws)
    
    def _get_dashboard_html(self) -> str:
        """Get dashboard HTML content"""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CallWaiting AI - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-healthy { background: #27ae60; }
        .status-warning { background: #f39c12; }
        .status-critical { background: #e74c3c; }
        
        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 1rem;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .card h3 {
            margin-bottom: 1rem;
            color: #2c3e50;
            font-size: 1.1rem;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #ecf0f1;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 500;
            color: #7f8c8d;
        }
        
        .metric-value {
            font-weight: 600;
            font-size: 1.1rem;
        }
        
        .metric-value.good { color: #27ae60; }
        .metric-value.warning { color: #f39c12; }
        .metric-value.critical { color: #e74c3c; }
        
        .chart-container {
            position: relative;
            height: 200px;
            margin-top: 1rem;
        }
        
        .alerts {
            grid-column: 1 / -1;
        }
        
        .alert {
            padding: 0.75rem;
            margin: 0.5rem 0;
            border-radius: 4px;
            border-left: 4px solid;
        }
        
        .alert-info {
            background: #e3f2fd;
            border-color: #2196f3;
            color: #1565c0;
        }
        
        .alert-warning {
            background: #fff3e0;
            border-color: #ff9800;
            color: #e65100;
        }
        
        .alert-critical {
            background: #ffebee;
            border-color: #f44336;
            color: #c62828;
        }
        
        .full-width {
            grid-column: 1 / -1;
        }
        
        @media (max-width: 1200px) {
            .dashboard {
                grid-template-columns: 1fr 1fr;
            }
        }
        
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1><span id="status-indicator" class="status-indicator"></span>CallWaiting AI - Voice Orchestration Monitor</h1>
    </div>
    
    <div class="dashboard">
        <div class="card">
            <h3>📞 Call Statistics</h3>
            <div class="metric">
                <span class="metric-label">Active Calls</span>
                <span class="metric-value" id="active-calls">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Total Calls</span>
                <span class="metric-value" id="total-calls">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Success Rate</span>
                <span class="metric-value" id="success-rate">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Error Rate</span>
                <span class="metric-value" id="error-rate">0%</span>
            </div>
        </div>
        
        <div class="card">
            <h3>⏱️ Latency Performance</h3>
            <div class="metric">
                <span class="metric-label">Average Latency</span>
                <span class="metric-value" id="avg-latency">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">P95 Latency</span>
                <span class="metric-value" id="p95-latency">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">P99 Latency</span>
                <span class="metric-value" id="p99-latency">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">Interruption Rate</span>
                <span class="metric-value" id="interruption-rate">0%</span>
            </div>
        </div>
        
        <div class="card">
            <h3>🧠 Component Performance</h3>
            <div class="metric">
                <span class="metric-label">STT TTFT</span>
                <span class="metric-value" id="stt-ttft">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">LLM TTFT</span>
                <span class="metric-value" id="llm-ttft">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">TTS TTFT</span>
                <span class="metric-value" id="tts-ttft">0ms</span>
            </div>
        </div>
        
        <div class="card">
            <h3>💻 System Resources</h3>
            <div class="metric">
                <span class="metric-label">CPU Usage</span>
                <span class="metric-value" id="cpu-usage">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Memory Usage</span>
                <span-value id="memory-usage">0MB</span>
            </div>
            <div class="metric">
                <span class="metric-label">Network I/O</span>
                <span class="metric-value" id="network-io">0MB/s</span>
            </div>
        </div>
        
        <div class="card full-width">
            <h3>📊 Latency Trends (Last 5 Minutes)</h3>
            <div class="chart-container">
                <canvas id="latency-chart"></canvas>
            </div>
        </div>
        
        <div class="card alerts">
            <h3>🚨 Active Alerts</h3>
            <div id="alerts-container">
                <p>No active alerts</p>
            </div>
        </div>
    </div>
    
    <script>
        let ws;
        let latencyChart;
        
        function connectWebSocket() {
            ws = new WebSocket(`ws://${window.location.host}/ws`);
            
            ws.onopen = function() {
                console.log('WebSocket connected');
                document.getElementById('status-indicator').className = 'status-indicator status-healthy';
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                if (data.type === 'metrics_update') {
                    updateDashboard(data.data);
                }
            };
            
            ws.onclose = function() {
                console.log('WebSocket disconnected');
                document.getElementById('status-indicator').className = 'status-indicator status-critical';
                setTimeout(connectWebSocket, 3000); // Reconnect after 3s
            };
            
            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        }
        
        function updateDashboard(metrics) {
            // Update call statistics
            document.getElementById('active-calls').textContent = metrics.active_calls;
            document.getElementById('total-calls').textContent = metrics.total_calls;
            document.getElementById('success-rate').textContent = (metrics.success_rate * 100).toFixed(1) + '%';
            document.getElementById('error-rate').textContent = (metrics.error_rate * 100).toFixed(1) + '%';
            
            // Update latency metrics
            document.getElementById('avg-latency').textContent = metrics.avg_latency_ms.toFixed(0) + 'ms';
            document.getElementById('p95-latency').textContent = metrics.p95_latency_ms.toFixed(0) + 'ms';
            document.getElementById('p99-latency').textContent = metrics.p99_latency_ms.toFixed(0) + 'ms';
            document.getElementById('interruption-rate').textContent = (metrics.interruption_rate * 100).toFixed(1) + '%';
            
            // Update component metrics
            document.getElementById('stt-ttft').textContent = metrics.component_latencies_ms.stt_ttft.toFixed(0) + 'ms';
            document.getElementById('llm-ttft').textContent = metrics.component_latencies_ms.llm_ttft.toFixed(0) + 'ms';
            document.getElementById('tts-ttft').textContent = metrics.component_latencies_ms.tts_ttft.toFixed(0) + 'ms';
            
            // Update resource metrics
            document.getElementById('cpu-usage').textContent = metrics.resource_usage.cpu_percent.toFixed(1) + '%';
            document.getElementById('memory-usage').textContent = metrics.resource_usage.memory_mb.toFixed(0) + 'MB';
            document.getElementById('network-io').textContent = metrics.resource_usage.network_io_mb_s.toFixed(1) + 'MB/s';
            
            // Update status indicator color based on health
            const statusIndicator = document.getElementById('status-indicator');
            if (metrics.error_rate > 0.1 || metrics.success_rate < 0.9) {
                statusIndicator.className = 'status-indicator status-critical';
            } else if (metrics.error_rate > 0.05 || metrics.p95_latency_ms > 600) {
                statusIndicator.className = 'status-indicator status-warning';
            } else {
                statusIndicator.className = 'status-indicator status-healthy';
            }
        }
        
        function initLatencyChart() {
            const ctx = document.getElementById('latency-chart').getContext('2d');
            latencyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Average Latency',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'P95 Latency',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Latency (ms)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        }
                    }
                }
            });
        }
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            connectWebSocket();
            initLatencyChart();
            
            // Fetch initial metrics
            fetch('/api/metrics')
                .then(response => response.json())
                .then(data => updateDashboard(data));
            
            // Fetch alerts
            fetch('/api/alerts')
                .then(response => response.json())
                .then(data => updateAlerts(data));
            
            // Update latency chart every 10 seconds
            setInterval(function() {
                fetch('/api/metrics/history?minutes=5')
                    .then(response => response.json())
                    .then(data => updateLatencyChart(data));
            }, 10000);
        });
        
        function updateLatencyChart(history) {
            if (!latencyChart || !history.length) return;
            
            const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());
            const avgData = history.map(h => h.avg_latency_ms);
            const p95Data = history.map(h => h.p95_latency_ms);
            
            latencyChart.data.labels = labels;
            latencyChart.data.datasets[0].data = avgData;
            latencyChart.data.datasets[1].data = p95Data;
            latencyChart.update();
        }
        
        function updateAlerts(alerts) {
            const container = document.getElementById('alerts-container');
            
            if (!alerts.length) {
                container.innerHTML = '<p>No active alerts</p>';
                return;
            }
            
            container.innerHTML = alerts.map(alert => `
                <div class="alert alert-${alert.severity}">
                    <strong>${alert.alert_name}:</strong> ${alert.message}
                    <br><small>${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
            `).join('');
        }
    </script>
</body>
</html>
        """


async def create_monitoring_app():
    """Create monitoring dashboard application"""
    dashboard = MonitoringDashboard()
    
    # Start metrics collection
    dashboard.collector.start()
    
    # Setup periodic tasks
    async def broadcast_metrics():
        while True:
            try:
                await dashboard.broadcast_metrics()
                dashboard.alert_manager.check_alerts(dashboard.collector.current_metrics)
                await asyncio.sleep(1)  # Broadcast every second
            except Exception as e:
                logger.error(f"Error in broadcast task: {e}")
                await asyncio.sleep(5)
    
    # Start broadcast task
    asyncio.create_task(broadcast_metrics())
    
    return dashboard.app


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--standalone":
        # Run standalone monitoring dashboard
        async def main():
            app = await create_monitoring_app()
            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, '0.0.0.0', 8080)
            await site.start()
            
            logger.info("🚀 Monitoring Dashboard started on http://0.0.0.0:8080")
            
            # Keep running
            while True:
                await asyncio.sleep(3600)
        
        asyncio.run(main())
    else:
        # Run as module
        print("CallWaiting AI - Monitoring Dashboard")
        print("Usage: python monitoring_dashboard.py --standalone")
        print("This will start the monitoring dashboard on port 8080")