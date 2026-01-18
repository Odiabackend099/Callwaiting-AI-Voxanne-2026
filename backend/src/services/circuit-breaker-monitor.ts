import { getCircuitBreakerStatus } from './safe-call';
import { log } from './logger';
import { supabase } from './supabase-client';

export class CircuitBreakerMonitor {
  private static instance: CircuitBreakerMonitor;
  private lastStatus: Record<string, boolean> = {};
  private alertCooldowns: Record<string, number> = {};
  
  private constructor() {
    // Start monitoring
    setInterval(() => this.checkStatus(), 30000); // Check every 30 seconds
  }

  public static getInstance(): CircuitBreakerMonitor {
    if (!CircuitBreakerMonitor.instance) {
      CircuitBreakerMonitor.instance = new CircuitBreakerMonitor();
    }
    return CircuitBreakerMonitor.instance;
  }

  private async checkStatus() {
    try {
      const status = getCircuitBreakerStatus();
      const now = Date.now();
      
      // Check for state changes
      for (const [service, state] of Object.entries(status)) {
        const isOpen = state.isOpen;
        const lastState = this.lastStatus[service];
        
        // State changed
        if (lastState !== undefined && lastState !== isOpen) {
          const message = isOpen 
            ? `Circuit breaker OPEN for ${service}` 
            : `Circuit breaker CLOSED for ${service}`;
          
          log.warn('CircuitBreaker', message, { service, state });
          
          // Store in database for analytics
          await supabase.from('circuit_breaker_events').insert({
            service,
            state: isOpen ? 'open' : 'closed',
            timestamp: new Date().toISOString()
          });
          
          // Send alert if breaker opened (with cooldown)
          if (isOpen && (!this.alertCooldowns[service] || now - this.alertCooldowns[service] > 3600000)) {
            await this.sendAlert(service);
            this.alertCooldowns[service] = now;
          }
        }
        
        this.lastStatus[service] = isOpen;
      }
    } catch (error) {
      log.error('CircuitBreaker', 'Monitoring failed', { error });
    }
  }
  
  private async sendAlert(service: string) {
    try {
      // Insert alert into database
      const { error } = await supabase.from('alerts').insert({
        type: 'circuit_breaker',
        severity: 'high',
        title: `Service Degradation: ${service}`,
        message: `Circuit breaker opened for ${service}. Service may be degraded.`,
        status: 'open'
      });
      
      if (error) {
        log.error('CircuitBreaker', 'Failed to save alert', { error });
      }
    } catch (error) {
      log.error('CircuitBreaker', 'Failed to send alert', { error });
    }
  }
}

// Initialize singleton instance
CircuitBreakerMonitor.getInstance();
