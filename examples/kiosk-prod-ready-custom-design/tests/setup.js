// tests/setup.js - Jest setup file

// Mock global objects that don't exist in Node.js environment
global.URLSearchParams = class URLSearchParams {
  constructor(search = '') {
    this.params = new Map();
    if (search.startsWith('?')) {
      search = search.slice(1);
    }
    if (search) {
      search.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
      });
    }
  }
  
  get(key) {
    return this.params.get(key) || null;
  }
  
  set(key, value) {
    this.params.set(key, value);
  }
};

// Mock console methods for testing
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock intersection observer
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock resize observer  
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Add custom matchers if needed
expect.extend({
  toHaveBeenCalledWithError(received, errorType) {
    const pass = received.mock.calls.some(call => 
      call[0] === errorType || (call[0] && call[0].type === errorType)
    );
    
    if (pass) {
      return {
        message: () => `expected ${received} not to have been called with error ${errorType}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have been called with error ${errorType}`,
        pass: false,
      };
    }
  },
});
