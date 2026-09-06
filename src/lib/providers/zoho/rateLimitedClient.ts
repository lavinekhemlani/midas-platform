// src/lib/providers/zoho/rateLimitedClient.ts
import { ProviderApiClient } from '../apiClient';

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
}

export class ZohoRateLimitedClient {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 650; // ~92 requests per minute (leaving buffer)
  
  constructor(private apiClient: ProviderApiClient) {}
  
  /**
   * Execute a request with rate limiting
   * Priority: 0 = highest, higher numbers = lower priority
   */
  async executeWithRateLimit<T>(
    request: () => Promise<T>,
    priority: number = 5
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: request,
        resolve,
        reject,
        priority
      });
      
      // Sort queue by priority
      this.queue.sort((a, b) => a.priority - b.priority);
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      // Wait if necessary to respect rate limit
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const request = this.queue.shift();
      if (!request) continue;
      
      this.lastRequestTime = Date.now();
      
      try {
        const result = await request.execute();
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Execute multiple requests in sequence with delays
   */
  async executeSequential<T>(
    requests: Array<() => Promise<T>>,
    delayMs: number = this.MIN_REQUEST_INTERVAL
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      try {
        const result = await requests[i]();
        results.push(result);
      } catch (error) {
        console.error(`Request ${i} failed:`, error);
        throw error;
      }
    }
    
    return results;
  }
  
  /**
   * Execute requests in batches with delays between batches
   */
  async executeBatched<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 3,
    batchDelayMs: number = 2000
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
      
      const batchResults = await Promise.all(batch.map(req => req()));
      results.push(...batchResults);
    }
    
    return results;
  }
}