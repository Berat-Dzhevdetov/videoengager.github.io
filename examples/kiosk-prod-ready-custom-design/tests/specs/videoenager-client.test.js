// @ts-check
/**
 * Focused VideoEngagerClient error validation tests
 * Test error message propagation in isolation before testing KioskApplication
 */

import { VideoEngagerClient } from '../../js/client.js';
import { ErrorTypes } from '../../js/error-handler.js';

describe('VideoEngagerClient Error Validation', () => {
  let originalFetch;
  let originalCreateElement;
  let originalAppendChild;
  let errorTracker;

  beforeEach(() => {
    // Track errors
    errorTracker = {
      errors: [],
      userMessages: []
    };

    // Spy on ErrorHandler methods
    const ErrorHandler = require('../../js/error-handler.js').ErrorHandler;
    jest.spyOn(ErrorHandler.prototype, 'handleError').mockImplementation(function(errorType, originalError) {
      errorTracker.errors.push({
        errorType: errorType.code,
        originalMessage: originalError?.message,
        userMessage: errorType.userMessage,
        shouldRetry: errorType.shouldRetry
      });
      return `${errorType.code}_${Date.now()}`;
    });

    // Backup originals
    originalFetch = global.fetch;
    originalCreateElement = document.createElement;
    originalAppendChild = document.head.appendChild;

    // Mock basic browser APIs
    global.fetch = jest.fn();
    
    // Clear any global VideoEngager state
    delete window.VideoEngager;
    delete window.__VideoEngagerConfigs;
    delete window.__VideoEngagerQueue;

    // Don't use fake timers by default - only for specific timeout tests
  });

  afterEach(() => {
    // Restore originals
    global.fetch = originalFetch;
    document.createElement = originalCreateElement;
    document.head.appendChild = originalAppendChild;

    // Clear any timers that might be running
    jest.clearAllTimers();
    jest.useRealTimers();
    
    // Clear mocks
    jest.restoreAllMocks();
  });

  describe('Configuration Validation Errors', () => {
    test('should show correct error for missing configuration', () => {
      expect(() => {
        new VideoEngagerClient();
      }).toThrow('Configuration is required');
    });

    test('should show correct error for missing required sections', () => {
      expect(() => {
        new VideoEngagerClient({});
      }).toThrow('Missing required configuration sections: videoEngager, genesys');
    });

    test('should show correct error for missing required fields', () => {
      expect(() => {
        new VideoEngagerClient({
          videoEngager: { tenantId: 'test' }, // missing veEnv
          genesys: { domain: 'test.com' } // missing deploymentId
        });
      }).toThrow('Missing required field: videoEngager.veEnv');
    });

    test('should show correct error for invalid environment format', () => {
      expect(() => {
        new VideoEngagerClient({
          videoEngager: { 
            tenantId: 'test',
            veEnv: 'invalid-env-with-special-chars!'
          },
          genesys: { deploymentId: 'test', domain: 'test.com' }
        });
      }).toThrow('Invalid videoEngager environment format');
    });
  });

  describe('Script Loading Errors', () => {
    let validConfig;

    beforeEach(() => {
      validConfig = {
        videoEngager: {
          tenantId: 'test-tenant',
          veEnv: 'dev',
          deploymentId: 'test-deployment'
        },
        genesys: {
          deploymentId: 'genesys-deployment',
          domain: 'mypurecloud.com'
        }
      };
    });

    test('should handle script load timeout correctly', async () => {
      // Mock script creation that never loads
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            async: true,
            onload: null,
            onerror: null,
            addEventListener: jest.fn(),
            remove: jest.fn()
          };
          return mockScript;
        }
        return originalCreateElement.call(document, tagName);
      });

      document.head.appendChild = jest.fn((element) => {
        // Don't trigger onload - simulate timeout
        return element;
      });

      const client = new VideoEngagerClient(validConfig);
      
      // Start init and advance timers to trigger timeout
      const initPromise = client.init();
      jest.advanceTimersByTime(15000); // Script timeout is 15 seconds
      
      await expect(initPromise).rejects.toThrow();

      // Check error was properly categorized
      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('LIBRARY_LOAD_FAILED');
      expect(errorTracker.errors[0].userMessage).toBe('Unable to load required services. Please refresh the page.');
      expect(errorTracker.errors[0].shouldRetry).toBe(true);
    });

    test('should handle script load error correctly', async () => {
      // Mock script creation that fails to load
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            async: true,
            onload: null,
            onerror: null,
            addEventListener: jest.fn(),
            remove: jest.fn()
          };
          return mockScript;
        }
        return originalCreateElement.call(document, tagName);
      });

      document.head.appendChild = jest.fn((element) => {
        if (element.onerror) {
          setTimeout(() => element.onerror(new Error('Script failed to load')), 100);
        }
        return element;
      });

      const client = new VideoEngagerClient(validConfig);
      
      const initPromise = client.init();
      jest.advanceTimersByTime(200);
      
      await expect(initPromise).rejects.toThrow();

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('LIBRARY_LOAD_FAILED');
      expect(errorTracker.errors[0].originalMessage).toBe('Failed to load VideoEngager script');
      expect(errorTracker.errors[0].userMessage).toBe('Unable to load required services. Please refresh the page.');
    });

    test('should handle VideoEngager not properly initialized', async () => {
      // Mock script that loads but doesn't set up VideoEngager
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            async: true,
            onload: null,
            onerror: null,
            addEventListener: jest.fn(),
            remove: jest.fn()
          };
          return mockScript;
        }
        return originalCreateElement.call(document, tagName);
      });

      document.head.appendChild = jest.fn((element) => {
        if (element.onload) {
          setTimeout(() => {
            // Script loads but VideoEngager is not properly set up
            window.VideoEngager = undefined;
            element.onload();
          }, 100);
        }
        return element;
      });

      const client = new VideoEngagerClient(validConfig);
      
      const initPromise = client.init();
      jest.advanceTimersByTime(200);
      
      await expect(initPromise).rejects.toThrow();

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('LIBRARY_LOAD_FAILED');
      expect(errorTracker.errors[0].originalMessage).toBe('VideoEngager library not properly initialized');
    });
  });

  describe('VideoEngager Ready Timeout', () => {
    let validConfig;

    beforeEach(() => {
      validConfig = {
        videoEngager: {
          tenantId: 'test-tenant',
          veEnv: 'dev',
          deploymentId: 'test-deployment'
        },
        genesys: {
          deploymentId: 'genesys-deployment',
          domain: 'mypurecloud.com'
        }
      };

      // Mock successful script loading
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            async: true,
            onload: null,
            onerror: null,
            addEventListener: jest.fn(),
            remove: jest.fn()
          };
          return mockScript;
        }
        return originalCreateElement.call(document, tagName);
      });

      document.head.appendChild = jest.fn((element) => {
        if (element.onload) {
          setTimeout(() => {
            // Set up VideoEngager but make onReady never call
            window.VideoEngager = {
              onReady: jest.fn() // Function exists but never calls the callback
            };
            element.onload();
          }, 100);
        }
        return element;
      });
    });

    test('should handle VideoEngager ready timeout', async () => {
      const client = new VideoEngagerClient(validConfig);
      
      const initPromise = client.init();
      
      // Advance past script load time
      jest.advanceTimersByTime(200);
      
      // Advance past ready timeout (60 seconds)
      jest.advanceTimersByTime(60000);
      
      await expect(initPromise).rejects.toThrow();

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('NETWORK_ERROR');
      expect(errorTracker.errors[0].originalMessage).toBe('VideoEngager ready timeout');
      expect(errorTracker.errors[0].userMessage).toBe('Please check your internet connection and try again.');
      expect(errorTracker.errors[0].shouldRetry).toBe(false);
    });

    test('should handle missing onReady method', async () => {
      // Mock VideoEngager without onReady method
      document.head.appendChild = jest.fn((element) => {
        if (element.onload) {
          setTimeout(() => {
            window.VideoEngager = {}; // No onReady method
            element.onload();
          }, 100);
        }
        return element;
      });

      const client = new VideoEngagerClient(validConfig);
      
      const initPromise = client.init();
      jest.advanceTimersByTime(200);
      
      await expect(initPromise).rejects.toThrow();

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('LIBRARY_LOAD_FAILED');
      expect(errorTracker.errors[0].originalMessage).toBe('VideoEngager onReady method not available');
    });
  });

  describe('Runtime Method Errors', () => {
    let client;
    let validConfig;

    beforeEach(async () => {
      validConfig = {
        videoEngager: {
          tenantId: 'test-tenant',
          veEnv: 'dev',
          deploymentId: 'test-deployment'
        },
        genesys: {
          deploymentId: 'genesys-deployment',
          domain: 'mypurecloud.com'
        }
      };

      // Mock successful initialization
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            async: true,
            onload: null,
            onerror: null,
            addEventListener: jest.fn(),
            remove: jest.fn()
          };
          return mockScript;
        }
        return originalCreateElement.call(document, tagName);
      });

      document.head.appendChild = jest.fn((element) => {
        if (element.onload) {
          setTimeout(() => {
            // Mock successful VideoEngager setup
            window.VideoEngager = new Proxy({}, {
              get: (_, method) => (...args) => {
                return new Promise((resolve, reject) => {
                  if (method === 'onReady') {
                    setTimeout(() => args[0](), 100);
                    resolve();
                  } else {
                    resolve(`Mock result for ${String(method)}`);
                  }
                });
              }
            });
            element.onload();
          }, 100);
        }
        return element;
      });

      client = new VideoEngagerClient(validConfig);
      await client.init();
      errorTracker.errors = []; // Clear init errors
    });

    test('should handle startVideo method failure', async () => {
      // Make startVideoChatSession fail
      window.VideoEngager = new Proxy({}, {
        get: (_, method) => (...args) => {
          return new Promise((resolve, reject) => {
            if (method === 'startVideoChatSession') {
              reject(new Error('Failed to start video session'));
            } else {
              resolve();
            }
          });
        }
      });

      await expect(client.startVideo()).rejects.toThrow('Failed to start video session');

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('INTERNAL_ERROR');
      expect(errorTracker.errors[0].originalMessage).toBe('Failed to start video session');
      expect(errorTracker.errors[0].shouldRetry).toBe(true);
    });

    test('should handle startChat method failure', async () => {
      // Make startGenesysChat fail
      window.VideoEngager = new Proxy({}, {
        get: (_, method) => (...args) => {
          return new Promise((resolve, reject) => {
            if (method === 'startGenesysChat') {
              reject(new Error('Failed to start chat session'));
            } else {
              resolve();
            }
          });
        }
      });

      await expect(client.startChat()).rejects.toThrow('Failed to start chat session');

      expect(errorTracker.errors).toHaveLength(1);
      expect(errorTracker.errors[0].errorType).toBe('INTERNAL_ERROR');
      expect(errorTracker.errors[0].originalMessage).toBe('Failed to start chat session');
    });
  });

  describe('Error Message Consistency Report', () => {
    test('should generate error report data', () => {
      const reportData = [];

      // Test different error scenarios and collect data
      const scenarios = [
        {
          name: 'Missing Configuration',
          test: () => {
            try {
              new VideoEngagerClient();
            } catch (error) {
              return { originalError: error.message, userMessage: error.message };
            }
          }
        },
        {
          name: 'Invalid Configuration',
          test: () => {
            try {
              new VideoEngagerClient({});
            } catch (error) {
              return { originalError: error.message, userMessage: error.message };
            }
          }
        }
      ];

      scenarios.forEach(scenario => {
        const result = scenario.test();
        if (result) {
          reportData.push({
            errorType: scenario.name,
            originalMessage: result.originalError,
            userMessage: result.userMessage,
            retryable: false,
            recoverable: false,
            source: 'VideoEngagerClient'
          });
        }
      });

      expect(reportData).toHaveLength(2);
      expect(reportData[0].errorType).toBe('Missing Configuration');
      expect(reportData[1].errorType).toBe('Invalid Configuration');

      // Log report for manual inspection
      console.log('\n=== VIDEOENGAGER CLIENT ERROR REPORT ===');
      console.log('| Error Type | Original Message | User Message | Retryable | Recoverable |');
      console.log('|------------|------------------|--------------|-----------|-------------|');
      reportData.forEach(item => {
        console.log(`| ${item.errorType} | ${item.originalMessage} | ${item.userMessage} | ${item.retryable ? 'Yes' : 'No'} | ${item.recoverable ? 'Yes' : 'No'} |`);
      });
      console.log('=== END REPORT ===\n');
    });
  });
});