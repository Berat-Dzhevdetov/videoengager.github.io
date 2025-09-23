// @ts-check
/**
 * Comprehensive mock environment for KioskApplication testing
 * Handles all external dependencies and provides error injection capabilities
 */

export class KioskMockEnvironment {
  constructor() {
    this.originalAPIs = {};
    this.errorScenarios = new Map();
    this.mockBehaviors = {
      configManager: 'normal',
      videoEngagerClient: 'normal',
      scriptLoading: 'normal',
      networkState: 'online',
      customElements: 'normal',
      fetch: 'normal',
      timeouts: 'normal'
    };
    this.mockInstances = {};
    this.eventCallbacks = new Map();
  }

  /**
   * Sets up all mocks for KioskApplication testing
   */
  setup() {
    this.backupOriginalAPIs();
    this.mockBrowserAPIs();
    this.mockConfigManager();
    this.mockVideoEngagerClient();
    this.mockCustomElements();
    this.mockScriptLoading();
    this.mockTimeouts();
    this.setupDOMElements();
  }

  /**
   * Restores all original APIs
   */
  restore() {
    global.fetch = this.originalAPIs.fetch;
    document.createElement = this.originalAPIs.createElement;
    document.head.appendChild = this.originalAPIs.appendChild;
    
    // Only restore navigator.onLine if we have it backed up
    if (this.originalAPIs.navigatorOnLine !== undefined) {
      try {
        delete Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
        Object.defineProperty(window.navigator, 'onLine', {
          value: this.originalAPIs.navigatorOnLine,
          writable: true,
          configurable: true
        });
      } catch (e) {
        // Ignore if can't restore
      }
    }
    
    global.setTimeout = this.originalAPIs.setTimeout;
    global.setInterval = this.originalAPIs.setInterval;
    global.clearTimeout = this.originalAPIs.clearTimeout;
    global.clearInterval = this.originalAPIs.clearInterval;
    
    // Clear all timers
    jest.clearAllTimers();
    
    // Reset mock behaviors
    this.mockBehaviors = {
      configManager: 'normal',
      videoEngagerClient: 'normal', 
      scriptLoading: 'normal',
      networkState: 'online',
      customElements: 'normal',
      fetch: 'normal',
      timeouts: 'normal'
    };
  }

  backupOriginalAPIs() {
    this.originalAPIs = {
      fetch: global.fetch,
      createElement: document.createElement,
      appendChild: document.head.appendChild,
      navigatorOnLine: window.navigator.onLine,
      setTimeout: global.setTimeout,
      setInterval: global.setInterval,
      clearTimeout: global.clearTimeout,
      clearInterval: global.clearInterval
    };
  }

  /**
   * Mock browser APIs with controllable behaviors
   */
  mockBrowserAPIs() {
    // Mock fetch with various failure scenarios
    global.fetch = jest.fn((url, options) => {
      const behavior = this.mockBehaviors.fetch;
      
      switch (behavior) {
        case 'network_error':
          return Promise.reject(new Error('Network request failed'));
        
        case 'timeout':
          return new Promise(() => {}); // Never resolves
        
        case 'invalid_json':
          return Promise.resolve({
            ok: true,
            json: () => Promise.reject(new Error('Unexpected token < in JSON at position 0'))
          });
        
        case 'server_error':
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: () => Promise.resolve({ error: 'Server error' })
          });
        
        case 'config_missing_fields':
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              // Missing required fields
              incomplete: 'config'
            })
          });
        
        case 'config_invalid_format':
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              videoEngager: { tenantId: 'test' }, // Missing veEnv
              genesys: { deploymentId: 'test' } // Missing domain
            })
          });
        
        default:
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              videoEngager: {
                tenantId: 'test-tenant',
                veEnv: 'dev',
                deploymentId: 'test-deployment'
              },
              genesys: {
                deploymentId: 'genesys-deployment',
                domain: 'mypurecloud.com'
              }
            })
          });
      }
    });

    // Mock navigator.onLine only if not already defined
    if (!Object.getOwnPropertyDescriptor(window.navigator, 'onLine') || 
        Object.getOwnPropertyDescriptor(window.navigator, 'onLine').configurable) {
      Object.defineProperty(window.navigator, 'onLine', {
        get: () => this.mockBehaviors.networkState === 'online',
        configurable: true
      });
    }
  }

  /**
   * Mock ConfigManager with various failure scenarios
   */
  mockConfigManager() {
    const originalConfigManager = require('../../js/config-manager.js').ConfigManager;
    
    jest.doMock('../../js/config-manager.js', () => {
      return {
        ConfigManager: jest.fn().mockImplementation((defaultConfig) => {
          const behavior = this.mockBehaviors.configManager;
          
          const mockInstance = {
            defaultConfig,
            config: {},
            
            async load() {
              switch (behavior) {
                case 'fetch_fails':
                  throw new Error('Failed to fetch external config');
                
                case 'validation_fails':
                  throw new Error('Missing videoEngager.tenantId');
                
                case 'url_config_invalid':
                  throw new Error('Invalid URL configuration format');
                
                case 'timeout':
                  return new Promise(() => {}); // Never resolves
                
                default:
                  return {
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
              }
            },

            validateCustomerConfig(cfg) {
              if (behavior === 'validation_fails') {
                throw new Error('Missing required field: videoEngager.tenantId');
              }
              return originalConfigManager.prototype.validateCustomerConfig.call(this, cfg);
            }
          };
          
          this.mockInstances.configManager = mockInstance;
          return mockInstance;
        })
      };
    });
  }

  /**
   * Mock VideoEngagerClient with comprehensive error scenarios
   */
  mockVideoEngagerClient() {
    jest.doMock('../../js/client.js', () => {
      return {
        VideoEngagerClient: jest.fn().mockImplementation((config) => {
          const behavior = this.mockBehaviors.videoEngagerClient;
          
          const mockInstance = {
            config,
            errorHandler: { handleError: jest.fn() },
            eventEmitter: new EventTarget(),
            connectionState: 'disconnected',
            
            async init() {
              switch (behavior) {
                case 'config_proxy_fails':
                  throw new Error('Failed to setup configuration proxy');
                
                case 'load_dependencies_fails':
                  throw new Error('Script load timeout');
                
                case 'wait_for_ready_fails':
                  throw new Error('VideoEngager ready timeout');
                
                case 'library_not_initialized':
                  throw new Error('VideoEngager library not properly initialized');
                
                case 'script_error':
                  throw new Error('Failed to load VideoEngager script');
                
                case 'method_not_available':
                  throw new Error('VideoEngager onReady method not available');
                
                case 'timeout':
                  return new Promise(() => {}); // Never resolves
                
                default:
                  this.connectionState = 'connected';
                  return true;
              }
            },

            isReady() {
              return this.connectionState === 'connected';
            },

            async startVideo() {
              if (behavior === 'start_video_fails') {
                throw new Error('Failed to start video session');
              }
              return { success: true };
            },

            async startChat() {
              if (behavior === 'start_chat_fails') {
                throw new Error('Failed to start chat session');
              }
              return { success: true };
            },

            async endVideo() {
              if (behavior === 'end_video_fails') {
                throw new Error('Failed to end video session');
              }
              return { success: true };
            },

            on(eventName, callback) {
              this.eventCallbacks.set(eventName, callback);
              return () => this.eventCallbacks.delete(eventName);
            },

            emit(eventName, data) {
              const callback = this.eventCallbacks.get(eventName);
              if (callback) callback(data);
            }
          };
          
          this.mockInstances.videoEngagerClient = mockInstance;
          return mockInstance;
        })
      };
    });
  }

  /**
   * Mock custom elements registration
   */
  mockCustomElements() {
    const behavior = this.mockBehaviors.customElements;
    
    window.customElements = {
      define: jest.fn((name, constructor) => {
        if (behavior === 'define_fails') {
          throw new Error(`Failed to define custom element: ${name}`);
        }
      }),
      
      get: jest.fn((name) => {
        if (behavior === 'get_fails') {
          return undefined;
        }
        return function MockElement() {};
      }),
      
      whenDefined: jest.fn((name) => {
        if (behavior === 'when_defined_fails') {
          return Promise.reject(new Error(`Custom element ${name} failed to define`));
        }
        return Promise.resolve();
      })
    };
  }

  /**
   * Mock script loading with various failure scenarios
   */
  mockScriptLoading() {
    const originalCreateElement = this.originalAPIs.createElement;
    const originalAppendChild = this.originalAPIs.appendChild;
    
    document.createElement = jest.fn((tagName) => {
      if (tagName === 'script') {
        return this.createMockScript();
      }
      return originalCreateElement.call(document, tagName);
    });

    document.head.appendChild = jest.fn((element) => {
      if (element.tagName === 'script') {
        this.handleScriptLoad(element);
        return element;
      }
      return originalAppendChild.call(document.head, element);
    });
  }

  createMockScript() {
    const behavior = this.mockBehaviors.scriptLoading;
    
    const mockScript = {
      src: '',
      async: true,
      onload: null,
      onerror: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      tagName: 'script'
    };

    // Handle src assignment
    Object.defineProperty(mockScript, 'src', {
      set: (value) => {
        mockScript._src = value;
        // Trigger load behavior when src is set
        setTimeout(() => this.triggerScriptBehavior(mockScript, behavior), 100);
      },
      get: () => mockScript._src
    });

    return mockScript;
  }

  handleScriptLoad(scriptElement) {
    const behavior = this.mockBehaviors.scriptLoading;
    setTimeout(() => this.triggerScriptBehavior(scriptElement, behavior), 100);
  }

  triggerScriptBehavior(scriptElement, behavior) {
    switch (behavior) {
      case 'timeout':
        // Never call onload or onerror - simulates timeout
        break;
      
      case 'load_error':
        if (scriptElement.onerror) {
          scriptElement.onerror(new Error('Script failed to load'));
        }
        break;
      
      case 'loads_but_no_videoenager':
        if (scriptElement.onload) {
          // Script loads but doesn't set up VideoEngager properly
          scriptElement.onload();
        }
        break;
      
      case 'videoenager_malformed':
        window.VideoEngager = {}; // Malformed VideoEngager object
        if (scriptElement.onload) {
          scriptElement.onload();
        }
        break;
      
      default: // 'normal'
        // Set up proper VideoEngager mock
        this.setupVideoEngagerGlobal();
        if (scriptElement.onload) {
          scriptElement.onload();
        }
        break;
    }
  }

  setupVideoEngagerGlobal() {
    const behavior = this.mockBehaviors.videoEngagerClient;
    
    window.__VideoEngagerQueue = [];
    
    window.VideoEngager = new Proxy({}, {
      get: (_, method) => (...args) => {
        return new Promise((resolve, reject) => {
          if (behavior === 'method_timeout') {
            // Never resolve - simulates method timeout
            return;
          }
          
          if (method === 'onReady') {
            if (behavior === 'ready_never_calls') {
              // Store callback but never call it
              return;
            } else if (behavior === 'ready_fails') {
              setTimeout(() => reject(new Error('VideoEngager ready failed')), 100);
              return;
            } else {
              // Normal ready behavior
              setTimeout(() => {
                if (args[0]) args[0](); // Call the ready callback
                resolve();
              }, 100);
              return;
            }
          }
          
          // Other methods
          if (behavior === 'method_fails') {
            reject(new Error(`VideoEngager.${String(method)} failed`));
          } else {
            resolve(`Mock result for ${String(method)}`);
          }
        });
      }
    });
  }

  /**
   * Mock timeout functions for testing timeout scenarios
   */
  mockTimeouts() {
    if (this.mockBehaviors.timeouts === 'never_fire') {
      global.setTimeout = jest.fn(() => 999); // Return fake timer ID but never fire
      global.setInterval = jest.fn(() => 999);
    } else {
      // Use Jest's fake timers for normal timeout testing
      jest.useFakeTimers();
    }
  }

  /**
   * Set up DOM elements that KioskApplication expects
   */
  setupDOMElements() {
    // Additional elements that might be needed for specific tests
    const genesysMessengerContainer = document.createElement('div');
    genesysMessengerContainer.id = 'genesys-messenger';
    genesysMessengerContainer.style.display = 'none';
    document.body.appendChild(genesysMessengerContainer);

    // Skip creating the carousel element in setup since it causes issues
    // Tests can create it as needed without triggering the constructor
  }

  createMockCarouselElement() {
    const element = document.createElement('ve-carousel-waitroom');
    element.setAttribute('config-src', '/config/waitroom-config.json');
    
    // Mock the init method
    element.init = jest.fn(async () => {
      const behavior = this.mockBehaviors.customElements;
      if (behavior === 'init_fails') {
        throw new Error('Waitroom component initialization failed');
      }
      if (behavior === 'config_load_fails') {
        throw new Error('Failed to load waitroom configuration');
      }
      
      // Emit ready event after successful init
      setTimeout(() => {
        element.dispatchEvent(new CustomEvent('waitroom:ready', {
          detail: { component: element }
        }));
      }, 50);
    });

    return element;
  }

  /**
   * Set specific behavior for different components
   */
  setBehavior(component, behavior) {
    this.mockBehaviors[component] = behavior;
    
    // Re-setup relevant mocks when behavior changes
    if (component === 'scriptLoading') {
      this.mockScriptLoading();
    } else if (component === 'fetch') {
      this.mockBrowserAPIs();
    }
  }

  /**
   * Simulate network state changes
   */
  setNetworkState(state) {
    this.mockBehaviors.networkState = state;
    
    // Trigger online/offline events
    if (state === 'offline') {
      window.dispatchEvent(new Event('offline'));
    } else {
      window.dispatchEvent(new Event('online'));
    }
  }

  /**
   * Get mock instance for testing
   */
  getMockInstance(component) {
    return this.mockInstances[component];
  }

  /**
   * Trigger specific events for testing
   */
  triggerEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail });
    
    if (eventName.startsWith('waitroom:')) {
      const carouselElement = document.querySelector('ve-carousel-waitroom');
      if (carouselElement) {
        carouselElement.dispatchEvent(event);
      }
    } else {
      document.dispatchEvent(event);
    }
  }

  /**
   * Fast-forward timers for testing timeout scenarios
   */
  fastForwardTime(milliseconds) {
    jest.advanceTimersByTime(milliseconds);
  }

  /**
   * Simulate user interactions
   */
  simulateUserClick(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.click();
    }
  }

  /**
   * Capture current error state from DOM
   */
  captureErrorState() {
    const errorModal = document.getElementById('errorModal');
    const toasts = Array.from(document.querySelectorAll('.toast'));
    
    return {
      modalVisible: errorModal && errorModal.style.display !== 'none',
      modalTitle: errorModal?.querySelector('#modalTitle')?.textContent,
      modalMessage: errorModal?.querySelector('.modal-body')?.textContent,
      hasRetryButton: errorModal?.querySelector('.error-button')?.style?.display !== 'none',
      toastMessages: toasts.map(toast => toast.textContent),
      activeToasts: toasts.filter(toast => toast.style.opacity !== '0').length
    };
  }
}

/**
 * Error tracker to monitor error message transformations
 */
export class KioskErrorTracker {
  constructor() {
    this.errorChain = [];
    this.spies = [];
    this.userMessages = [];
  }

  startTracking() {
    // Spy on ErrorHandler methods
    const ErrorHandler = require('../../js/error-handler.js').ErrorHandler;
    
    const handleErrorSpy = jest.spyOn(ErrorHandler.prototype, 'handleError')
      .mockImplementation(function(errorType, originalError) {
        this.errorChain.push({
          timestamp: Date.now(),
          source: 'ErrorHandler.handleError',
          errorTypeCode: errorType.code,
          errorTypeName: errorType.type,
          originalErrorMessage: originalError?.message,
          userMessage: errorType.userMessage,
          shouldRetry: errorType.shouldRetry,
          stackTrace: originalError?.stack
        });
        
        // Call original implementation
        return jest.requireActual('../../js/error-handler.js')
          .ErrorHandler.prototype.handleError.call(this, errorType, originalError);
      }.bind(this));

    const showErrorSpy = jest.spyOn(ErrorHandler.prototype, 'showError')
      .mockImplementation(function(errorType) {
        this.userMessages.push({
          timestamp: Date.now(),
          source: 'ErrorHandler.showError',
          displayedMessage: errorType.userMessage,
          errorType: errorType.code,
          retryable: errorType.shouldRetry
        });
        
        // Call original implementation
        return jest.requireActual('../../js/error-handler.js')
          .ErrorHandler.prototype.showError.call(this, errorType);
      }.bind(this));

    // Spy on console methods
    const consoleErrorSpy = jest.spyOn(console, 'error')
      .mockImplementation((...args) => {
        this.errorChain.push({
          timestamp: Date.now(),
          source: 'console.error',
          message: args[0],
          args: args
        });
      });

    this.spies = [handleErrorSpy, showErrorSpy, consoleErrorSpy];
  }

  stopTracking() {
    this.spies.forEach(spy => spy.mockRestore());
    this.spies = [];
  }

  getErrorChain() {
    return [...this.errorChain];
  }

  getUserMessages() {
    return [...this.userMessages];
  }

  getLastError() {
    return this.errorChain[this.errorChain.length - 1];
  }

  getLastUserMessage() {
    return this.userMessages[this.userMessages.length - 1];
  }

  clear() {
    this.errorChain = [];
    this.userMessages = [];
  }
}