// @ts-check
/**
 * Basic setup test to verify Jest configuration works correctly
 * This test imports your modules and checks basic functionality
 */

// Import your modules - adjust paths as needed
import { VideoEngagerClient } from '../../js/client.js';
import { ErrorHandler, ErrorTypes } from '../../js/error-handler.js';
import { Utils } from '../../js/utils.js';
import { ConfigManager } from '../../js/config-manager.js';
import { TimeoutManager } from '../../js/timeout-manager.js';

describe('Jest Setup Verification', () => {
  describe('Environment Setup', () => {
    test('should have DOM elements available', () => {
      expect(document.getElementById('initial-screen')).toBeTruthy();
      expect(document.getElementById('oncall-screen')).toBeTruthy();
      expect(document.getElementById('errorModal')).toBeTruthy();
      expect(document.getElementById('StartVideoCall')).toBeTruthy();
    });

    test('should have browser APIs mocked', () => {
      expect(window.localStorage).toBeDefined();
      expect(window.location).toBeDefined();
      expect(window.navigator).toBeDefined();
      expect(global.fetch).toBeDefined();
    });

    test('should have customElements available', () => {
      expect(window.customElements).toBeDefined();
      expect(typeof window.customElements.define).toBe('function');
    });
  });

  describe('Module Imports', () => {
    test('should import VideoEngagerClient successfully', () => {
      expect(VideoEngagerClient).toBeDefined();
      expect(typeof VideoEngagerClient).toBe('function');
    });

    test('should import ErrorHandler and ErrorTypes successfully', () => {
      expect(ErrorHandler).toBeDefined();
      expect(ErrorTypes).toBeDefined();
      expect(typeof ErrorHandler).toBe('function');
      expect(typeof ErrorTypes).toBe('object');
    });

    test('should import Utils successfully', () => {
      expect(Utils).toBeDefined();
      expect(typeof Utils.sanitizeText).toBe('function');
      expect(typeof Utils.validateURL).toBe('function');
    });

    test('should import ConfigManager successfully', () => {
      expect(ConfigManager).toBeDefined();
      expect(typeof ConfigManager).toBe('function');
    });

    test('should import TimeoutManager successfully', () => {
      expect(TimeoutManager).toBeDefined();
      expect(typeof TimeoutManager).toBe('function');
    });
  });

  describe('Basic Error Types', () => {
    test('should have all expected error types defined', () => {
      const expectedErrorTypes = [
        'NETWORK_ERROR',
        'CONFIG_MISSING', 
        'CONFIG_INVALID',
        'LIBRARY_LOAD_FAILED',
        'FORBIDDEN',
        'INTERNAL_ERROR',
        'CALL_TIMEOUT',
        'WAITROOM_ERROR',
        'WAITROOM_COMPONENT_NOT_FOUND'
      ];

      expectedErrorTypes.forEach(errorType => {
        expect(ErrorTypes[errorType]).toBeDefined();
        expect(ErrorTypes[errorType].code).toBe(errorType);
        expect(ErrorTypes[errorType].userMessage).toBeTruthy();
        expect(typeof ErrorTypes[errorType].shouldRetry).toBe('boolean');
      });
    });

    test('should create ErrorHandler instance', () => {
      const errorHandler = new ErrorHandler();
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
      expect(typeof errorHandler.handleError).toBe('function');
      expect(typeof errorHandler.showError).toBe('function');
    });
  });

  describe('Basic VideoEngagerClient', () => {
    test('should throw error for missing configuration', () => {
      expect(() => {
        new VideoEngagerClient();
      }).toThrow('Configuration is required');
    });

    test('should throw error for invalid configuration', () => {
      expect(() => {
        new VideoEngagerClient({});
      }).toThrow('Missing required configuration sections');
    });

    test('should create instance with valid config', () => {
      const validConfig = {
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

      const client = new VideoEngagerClient(validConfig);
      expect(client).toBeInstanceOf(VideoEngagerClient);
      expect(client.config).toBeDefined();
      expect(client.errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('Utility Functions', () => {
    test('Utils.sanitizeText should work correctly', () => {
      expect(Utils.sanitizeText('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
      expect(Utils.sanitizeText('Normal text')).toBe('Normal text');
    });

    test('Utils.validateURL should work correctly', () => {
      expect(Utils.validateURL('https://example.com')).toBe(true);
      expect(Utils.validateURL('invalid-url')).toBe(false);
    });

    test('Utils.generateId should create unique IDs', () => {
      const id1 = Utils.generateId();
      const id2 = Utils.generateId();
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
    });
  });

  describe('ConfigManager Basic Functionality', () => {
    test('should create ConfigManager with default config', () => {
      const defaultConfig = { test: 'value' };
      const configManager = new ConfigManager(defaultConfig);
      expect(configManager).toBeInstanceOf(ConfigManager);
      expect(configManager.defaultConfig).toEqual(defaultConfig);
    });

    test('should validate customer config correctly', () => {
      const configManager = new ConfigManager({});
      
      const validConfig = {
        videoEngager: { tenantId: 'test', veEnv: 'dev' },
        genesys: { deploymentId: 'test', domain: 'test.com' }
      };
      
      expect(() => {
        configManager.validateCustomerConfig(validConfig);
      }).not.toThrow();

      expect(() => {
        configManager.validateCustomerConfig({});
      }).toThrow();
    });
  });
});

describe('Mock Verification', () => {
  test('should be able to mock fetch responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ test: 'data' })
    });

    const response = await fetch('/test');
    const data = await response.json();
    
    expect(data).toEqual({ test: 'data' });
    expect(fetch).toHaveBeenCalledWith('/test');
  });

  test('should be able to mock DOM interactions', () => {
    const button = document.getElementById('StartVideoCall');
    const clickHandler = jest.fn();
    
    button.addEventListener('click', clickHandler);
    button.click();
    
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  test('should be able to mock localStorage', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');
  });
});