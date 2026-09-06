// src/lib/providers/monitoring.ts

interface RateLimitEvent {
  providerId: string;
  organizationId: string;
  endpoint: string;
  timestamp: number;
  waitTime?: number;
  recovered?: boolean;
}

interface ApiErrorEvent {
  providerId: string;
  organizationId: string;
  endpoint: string;
  status: number;
  error: string;
  timestamp: number;
}

class ApiMonitoring {
  private rateLimitEvents: RateLimitEvent[] = [];
  private apiErrors: ApiErrorEvent[] = [];
  private readonly MAX_EVENTS = 100;
  
  logRateLimitHit(event: Omit<RateLimitEvent, 'timestamp'>) {
    this.rateLimitEvents.push({
      ...event,
      timestamp: Date.now()
    });
    
    // Keep only recent events
    if (this.rateLimitEvents.length > this.MAX_EVENTS) {
      this.rateLimitEvents = this.rateLimitEvents.slice(-this.MAX_EVENTS);
    }
    
    console.warn(`[Rate Limit] Provider: ${event.providerId}, Org: ${event.organizationId}, Endpoint: ${event.endpoint}, Wait: ${event.waitTime}s`);
  }
  
  logApiError(event: Omit<ApiErrorEvent, 'timestamp'>) {
    this.apiErrors.push({
      ...event,
      timestamp: Date.now()
    });
    
    // Keep only recent events
    if (this.apiErrors.length > this.MAX_EVENTS) {
      this.apiErrors = this.apiErrors.slice(-this.MAX_EVENTS);
    }
    
    console.error(`[API Error] Provider: ${event.providerId}, Status: ${event.status}, Endpoint: ${event.endpoint}`);
  }
  
  getRateLimitStats(providerId?: string, timeWindowMs: number = 3600000) {
    const now = Date.now();
    const events = this.rateLimitEvents.filter(e => 
      now - e.timestamp < timeWindowMs &&
      (!providerId || e.providerId === providerId)
    );
    
    return {
      total: events.length,
      recovered: events.filter(e => e.recovered).length,
      averageWaitTime: events.reduce((sum, e) => sum + (e.waitTime || 0), 0) / (events.length || 1),
      endpoints: [...new Set(events.map(e => e.endpoint))]
    };
  }
  
  getErrorStats(providerId?: string, timeWindowMs: number = 3600000) {
    const now = Date.now();
    const events = this.apiErrors.filter(e => 
      now - e.timestamp < timeWindowMs &&
      (!providerId || e.providerId === providerId)
    );
    
    const byStatus = events.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return {
      total: events.length,
      byStatus,
      endpoints: [...new Set(events.map(e => e.endpoint))]
    };
  }
  
  clearOldEvents(olderThanMs: number = 86400000) { // Default 24 hours
    const cutoff = Date.now() - olderThanMs;
    this.rateLimitEvents = this.rateLimitEvents.filter(e => e.timestamp > cutoff);
    this.apiErrors = this.apiErrors.filter(e => e.timestamp > cutoff);
  }
}

export const apiMonitoring = new ApiMonitoring();