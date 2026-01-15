/**
 * HTTP Mocking Utilities
 * Provides fetch/axios mocking for testing frontend → backend communication
 */

import { jest } from '@jest/globals';

interface MockFetchOptions {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
}

/**
 * Create a mock fetch response
 */
function createMockResponse(options: MockFetchOptions = {}) {
  const {
    status = 200,
    statusText = 'OK',
    headers = { 'content-type': 'application/json' },
    body = {},
    delay = 0,
  } = options;

  return new Promise<Response>((resolve) => {
    setTimeout(() => {
      const response = new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: new Headers(headers),
      });
      // @ts-ignore - Mock properties
      response.json = async () => body;
      // @ts-ignore - Mock properties
      response.text = async () => JSON.stringify(body);
      // @ts-ignore - Mock properties
      response.ok = status >= 200 && status < 300;
      resolve(response);
    }, delay);
  });
}

/**
 * Create a mock fetch implementation
 */
export function createMockFetch(scenarios: Record<string, MockFetchOptions> = {}) {
  return jest.fn((url: string, options?: any) => {
    // Match exact URL or pattern
    for (const [pattern, scenario] of Object.entries(scenarios)) {
      if (url.includes(pattern)) {
        return createMockResponse(scenario);
      }
    }

    // Default successful response
    return createMockResponse({
      status: 200,
      body: { success: true },
    });
  });
}

/**
 * Mock HTTP client for making backend requests in tests
 */
export class MockHttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl = 'http://localhost:3001', defaultHeaders = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  async get<T = any>(path: string, options = {}): Promise<T> {
    const response = await this.request<T>('GET', path, undefined, options);
    return response;
  }

  async post<T = any>(path: string, body?: any, options = {}): Promise<T> {
    const response = await this.request<T>('POST', path, body, options);
    return response;
  }

  async patch<T = any>(path: string, body?: any, options = {}): Promise<T> {
    const response = await this.request<T>('PATCH', path, body, options);
    return response;
  }

  async put<T = any>(path: string, body?: any, options = {}): Promise<T> {
    const response = await this.request<T>('PUT', path, body, options);
    return response;
  }

  async delete<T = any>(path: string, options = {}): Promise<T> {
    const response = await this.request<T>('DELETE', path, undefined, options);
    return response;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    options: any = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers,
      ...options,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}\n${errorBody}`
      );
    }

    try {
      return await response.json();
    } catch {
      return response as any;
    }
  }
}

/**
 * Create mock HTTP interceptor for capturing requests
 */
export class HttpInterceptor {
  private requests: Array<{
    method: string;
    url: string;
    body?: any;
    timestamp: number;
  }> = [];

  constructor() {
    this.setupInterceptor();
  }

  private setupInterceptor(): void {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url: string, options?: any) => {
      this.requests.push({
        method: options?.method || 'GET',
        url: url.toString(),
        body: options?.body ? JSON.parse(options.body) : undefined,
        timestamp: Date.now(),
      });

      return originalFetch(url, options);
    });
  }

  getRequests() {
    return this.requests;
  }

  getLastRequest() {
    return this.requests[this.requests.length - 1];
  }

  getRequestsByPath(path: string) {
    return this.requests.filter((r) => r.url.includes(path));
  }

  clear() {
    this.requests = [];
  }
}

/**
 * Measure HTTP request/response timing
 */
export class TimingMeasurement {
  private timings: Record<string, number[]> = {};

  recordTiming(label: string, duration: number): void {
    if (!this.timings[label]) {
      this.timings[label] = [];
    }
    this.timings[label].push(duration);
  }

  getStats(label: string) {
    const times = this.timings[label] || [];
    if (times.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0 };
    }

    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    return { count: times.length, min, max, avg };
  }

  getAllStats() {
    return Object.entries(this.timings).reduce(
      (acc, [label, times]) => {
        acc[label] = this.getStats(label);
        return acc;
      },
      {} as Record<string, any>
    );
  }
}
