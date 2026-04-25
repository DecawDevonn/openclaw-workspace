/**
 * webAgent.js
 * Web Agent — HTTP requests, API calls, web scraping
 */

export class WebAgent {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      rateLimit: config.rateLimit || 100,
      ...config
    };
    this.metrics = { runs: 0, successes: 0, failures: 0 };
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  async execute(payload) {
    this.metrics.runs++;
    await this.rateLimitCheck();
    
    const { 
      url, 
      method = 'GET', 
      headers = {}, 
      body,
      extractMode = 'json'
    } = payload;
    
    if (!url) {
      throw new Error('No URL specified');
    }
    
    console.log(`[WebAgent] ${method} ${url}`);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'MyClaw-Agent/2.0',
          'Accept': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      this.requestCount++;
      this.lastRequestTime = Date.now();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      let result;
      if (extractMode === 'json') {
        result = await response.json();
      } else if (extractMode === 'text') {
        result = await response.text();
      } else {
        result = { status: response.status, headers: response.headers };
      }
      
      this.metrics.successes++;
      
      return {
        data: result,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        executionTime: Date.now()
      };
      
    } catch (error) {
      this.metrics.failures++;
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async rateLimitCheck() {
    const now = Date.now();
    const windowStart = now - 60000;
    
    if (this.lastRequestTime < windowStart) {
      this.requestCount = 0;
    }
    
    if (this.requestCount >= this.config.rateLimit) {
      const waitTime = 60000 - (now - this.lastRequestTime);
      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime));
        this.requestCount = 0;
      }
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export function createAgent(config) {
  return new WebAgent(config);
}

export default WebAgent;
