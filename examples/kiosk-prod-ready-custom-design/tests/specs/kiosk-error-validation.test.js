// @ts-check
/**
 * Comprehensive error validation test suite for KioskApplication
 * Tests all possible error scenarios and tracks message transformations
 */

import { KioskApplication } from '../../js/kiosk.js';
import { ErrorTypes } from '../../js/error-handler.js';
import { KioskMockEnvironment, KioskErrorTracker } from '../mocks/kiosk-environment.js';

describe('KioskApplication Error Message Validation', () => {
  let mockEnv;
  let errorTracker;
  let app;

  beforeEach(() => {
    mockEnv = new KioskMockEnvironment();
    errorTracker = new KioskErrorTracker();
    
    mockEnv.setup();
    errorTracker.startTracking();
    
    // Clear any existing global state
    delete window.kioskApp;
  });

  afterEach(() => {
    if (app) {
      app.destroy?.();
    }
    
    errorTracker.stopTracking();
    mockEnv.restore();
    
    // Clear all timers
    jest.clearAllTimers();
  });

  describe('Configuration Errors', () => {
    describe.each([
      {
        scenario: 'ConfigManager fetch fails',
        setup: () => mockEnv.setBehavior('configManager', 'fetch_fails'),
        expectedErrorType: 'CONFIG_INVALID',
        expectedUserMessage: 'Service configuration is invalid. Please contact support.',
        retryable: false,
        recoverable: false,
        originalErrorPattern: /Failed to fetch external config/
      },
      {
        scenario: 'ConfigManager validation fails',
        setup: () => mockEnv.setBehavior('configManager', 'validation_fails'),
        expectedErrorType: 'CONFIG_INVALID', 
        expectedUserMessage: 'Service configuration is invalid. Please contact support.',
        retryable: false,
        recoverable: false,
        originalErrorPattern: /Missing required field/
      },
      {
        scenario: 'External config network error',
        setup: () => {
          // Simulate URL param with config URL
          Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?config=https://example.com/config.json' },
            writable: true
          });
          mockEnv.setBehavior('fetch', 'network_error');
        },
        expectedErrorType: 'CONFIG_INVALID',
        expectedUserMessage: 'Service configuration is invalid. Please contact support.',
        retryable: false,
        recoverable: false,
        originalErrorPattern: /Network request failed/
      },
      {
        scenario: 'External config invalid JSON',
        setup: () => {
          Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?config=https://example.com/config.json' },
            writable: true
          });
          mockEnv.setBehavior('fetch', 'invalid_json');
        },
        expectedErrorType: 'CONFIG_INVALID',
        expectedUserMessage: 'Service configuration is invalid. Please contact support.',
        retryable: false,
        recoverable: false,
        originalErrorPattern: /Unexpected token/
      },
      {
        scenario: 'External config missing required fields',
        setup: () => {
          Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?config=https://example.com/config.json' },
            writable: true
          });
          mockEnv.setBehavior('fetch', 'config_missing_fields');
        },
        expectedErrorType: 'CONFIG_INVALID',
        expectedUserMessage: 'Service configuration is invalid. Please contact support.',
        retryable: false,
        recoverable: false,
        originalErrorPattern: /Missing.*tenantId|Missing.*veEnv|Missing.*deploymentId|Missing.*domain/
      }
    ])('$scenario', ({ scenario, setup, expectedErrorType, expectedUserMessage, retryable, recoverable, originalErrorPattern }) => {
      test(`should handle "${scenario}" correctly`, async () => {
        // Arrange
        setup();
        app = new KioskApplication();
        
        // Act
        await app.init();
        
        // Assert - Check error tracking
        const errorChain = errorTracker.getErrorChain();
        const lastError = errorTracker.getLastError();
        const userMessage = errorTracker.getLastUserMessage();
        
        expect(lastError).toBeDefined();
        expect(lastError.errorTypeCode).toBe(expectedErrorType);
        expect(userMessage?.displayedMessage).toBe(expectedUserMessage);
        expect(userMessage?.retryable).toBe(retryable);
        
        // Verify original error is preserved in chain
        if (originalErrorPattern) {
          const hasOriginalError = errorChain.some(error => 
            originalErrorPattern.test(error.originalErrorMessage || '')
          );
          expect(hasOriginalError).toBe(true);
        }
        
        // Check DOM state
        const errorState = mockEnv.captureErrorState();
        expect(errorState.modalVisible).toBe(true);
        expect(errorState.modalMessage).toBe(expectedUserMessage);
        expect(errorState.hasRetryButton).toBe(retryable);
      });
    });
  });

  describe('Network and Offline Errors', () => {
    test.only('should handle offline state during initialization', async () => {
        debugger;
      // Arrange
      mockEnv.setNetworkState('offline');
      app = new KioskApplication();
      
      // Act
      await app.init();
      
      // Assert
      const lastError = errorTracker.getLastError();
      expect(lastError.errorTypeCode).toBe('NETWORK_ERROR');
      expect(lastError.userMessage).toBe('Please check your internet connection and try again.');
      
      const errorState = mockEnv.captureErrorState();
      expect(errorState.modalVisible).toBe(true);
      expect(errorState.hasRetryButton).toBe(false);
    });

    test('should handle network restoration', async () => {
      // Arrange
      mockEnv.setNetworkState('offline');
      app = new KioskApplication();
      await app.init();
      
      // Act - Simulate network coming back online
      mockEnv.setNetworkState('online');
      
      // Assert
      const errorState = mockEnv.captureErrorState();
      expect(errorState.activeToasts).toBeGreaterThan(0);
      // Should show "Connection restored" toast
    });
  });

  describe('VideoEngager Client Errors', () => {
    describe.each([
      {
        scenario: 'VideoEngager script load timeout',
        setup: () => mockEnv.setBehavior('scriptLoading', 'timeout'),
        expectedErrorType: 'LIBRARY_LOAD_FAILED',
        expectedUserMessage: 'Unable to load required services. Please refresh the page.',
        retryable: true,
        recoverable: true,
        originalError: 'Script load timeout'
      },
      {
        scenario: 'VideoEngager script load error',
        setup: () => mockEnv.setBehavior('scriptLoading', 'load_error'),
        expectedErrorType: 'LIBRARY_LOAD_FAILED',
        expectedUserMessage: 'Unable to load required services. Please refresh the page.',
        retryable: true,
        recoverable: true,
        originalError: 'Failed to load VideoEngager script'
      },
      {
        scenario: 'VideoEngager library not properly initialized',
        setup: () => mockEnv.setBehavior('scriptLoading', 'loads_but_no_videoenager'),
        expectedErrorType: 'LIBRARY_LOAD_FAILED',
        expectedUserMessage: 'Unable to load required services. Please refresh the page.',
        retryable: true,
        recoverable: true,
        originalError: 'VideoEngager library not properly initialized'
      },
      {
        scenario: 'VideoEngager ready timeout',
        setup: () => mockEnv.setBehavior('videoEngagerClient', 'ready_never_calls'),
        expectedErrorType: 'NETWORK_ERROR',
        expectedUserMessage: 'Please check your internet connection and try again.',
        retryable: false,
        recoverable: true,
        originalError: 'VideoEngager ready timeout'
      },
      {
        scenario: 'VideoEngager onReady method not available',
        setup: () => mockEnv.setBehavior('videoEngagerClient', 'method_not_available'),
        expectedErrorType: 'LIBRARY_LOAD_FAILED',
        expectedUserMessage: 'Unable to load required services. Please refresh the page.',
        retryable: true,
        recoverable: true,
        originalError: 'VideoEngager onReady method not available'
      },
      {
        scenario: 'VideoEngager configuration proxy setup fails',
        setup: () => mockEnv.setBehavior('videoEngagerClient', 'config_proxy_fails'),
        expectedErrorType: 'INTERNAL_ERROR',
        expectedUserMessage: 'A service error occurred. The page will automatically refresh.',
        retryable: true,
        recoverable: true,
        originalError: 'Failed to setup configuration proxy'
      }
    ])('$scenario', ({ scenario, setup, expectedErrorType, expectedUserMessage, retryable, recoverable, originalError }) => {
      test(`should handle "${scenario}" correctly`, async () => {
        // Arrange
        setup();
        app = new KioskApplication();
        
        // Act
        await app.init();
        
        // Assert
        const lastError = errorTracker.getLastError();
        const userMessage = errorTracker.getLastUserMessage();
        
        expect(lastError.errorTypeCode).toBe(expectedErrorType);
        expect(userMessage?.displayedMessage).toBe(expectedUserMessage);
        expect(userMessage?.retryable).toBe(retryable);
        
        // Verify error propagation
        const errorChain = errorTracker.getErrorChain();
        const hasOriginalError = errorChain.some(error => 
          error.originalErrorMessage?.includes(originalError)
        );
        expect(hasOriginalError).toBe(true);
        
        // Check DOM state
        const errorState = mockEnv.captureErrorState();
        expect(errorState.modalVisible).toBe(true);
        expect(errorState.modalMessage).toBe(expectedUserMessage);
        expect(errorState.hasRetryButton).toBe(retryable);
      });
    });
  });

  describe('Waitroom Component Errors', () => {
    describe.each([
      {
        scenario: 'Waitroom component not found',
        setup: () => {
          // Element won't exist since we don't create it in setup anymore
        },
        expectedErrorType: 'WAITROOM_COMPONENT_NOT_FOUND',
        expectedUserMessage: 'The waitroom component is not available. Please check your configuration.',
        retryable: false,
        recoverable: false
      },
      {
        scenario: 'Waitroom initialization fails',
        setup: () => mockEnv.setBehavior('customElements', 'init_fails'),
        expectedErrorType: 'WAITROOM_ERROR',
        expectedUserMessage: 'An error occurred while loading the waitroom. Please try again.',
        retryable: false,
        recoverable: true
      },
      {
        scenario: 'Waitroom config loading fails',
        setup: () => mockEnv.setBehavior('customElements', 'config_load_fails'),
        expectedErrorType: 'WAITROOM_ERROR',
        expectedUserMessage: 'An error occurred while loading the waitroom. Please try again.',
        retryable: false,
        recoverable: true
      }
    ])('$scenario', ({ scenario, setup, expectedErrorType, expectedUserMessage, retryable, recoverable }) => {
      test(`should handle "${scenario}" correctly`, async () => {
        // Arrange
        setup();
        app = new KioskApplication();
        
        // Act
        await app.init();
        
        // Assert
        const lastError = errorTracker.getLastError();
        const userMessage = errorTracker.getLastUserMessage();
        
        expect(lastError.errorTypeCode).toBe(expectedErrorType);
        expect(userMessage?.displayedMessage).toBe(expectedUserMessage);
        expect(userMessage?.retryable).toBe(retryable);
        
        const errorState = mockEnv.captureErrorState();
        expect(errorState.modalVisible).toBe(true);
        expect(errorState.modalMessage).toBe(expectedUserMessage);
        expect(errorState.hasRetryButton).toBe(retryable);
      });
    });
  });

  describe('Runtime Operation Errors', () => {
    beforeEach(async () => {
      // Set up successful initialization first
      app = new KioskApplication();
      await app.init();
      errorTracker.clear(); // Clear initialization tracking
    });

    describe('Video Call Errors', () => {
      test('should handle start video call failure', async () => {
        // Arrange
        mockEnv.setBehavior('videoEngagerClient', 'start_video_fails');
        
        // Act
        mockEnv.simulateUserClick('StartVideoCall');
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operation
        
        // Assert
        const lastError = errorTracker.getLastError();
        expect(lastError.errorTypeCode).toBe('INTERNAL_ERROR');
        expect(lastError.userMessage).toBe('A service error occurred. The page will automatically refresh.');
        
        // Should return to initial screen
        const initialScreen = document.getElementById('initial-screen');
        expect(initialScreen.style.display).toBe('flex');
      });

      test('should handle video call timeout', async () => {
        // Arrange - Start a video call
        mockEnv.simulateUserClick('StartVideoCall');
        
        // Act - Fast forward past call timeout
        mockEnv.fastForwardTime(1000 * 60 * 3 + 1000); // 3 minutes + 1 second
        
        // Assert
        const lastError = errorTracker.getLastError();
        expect(lastError.errorTypeCode).toBe('CALL_TIMEOUT');
        expect(lastError.userMessage).toBe('Unable to connect to an agent. Please try again.');
        
        const errorState = mockEnv.captureErrorState();
        expect(errorState.modalVisible).toBe(true);
        expect(errorState.hasRetryButton).toBe(true);
      });

      test('should handle video call end failure', async () => {
        // Arrange - Start successful video call
        const videoClient = mockEnv.getMockInstance('videoEngagerClient');
        videoClient.connectionState = 'connected';
        
        // Setup end failure
        mockEnv.setBehavior('videoEngagerClient', 'end_video_fails');
        
        // Act - Try to end call
        await app.handleCancelCall({ preventDefault: () => {} });
        
        // Assert - Should still handle gracefully and return to initial screen
        const initialScreen = document.getElementById('initial-screen');
        expect(initialScreen.style.display).toBe('flex');
      });
    });

    describe('Chat Operation Errors', () => {
      test('should handle start chat failure', async () => {
        // Arrange
        mockEnv.setBehavior('videoEngagerClient', 'start_chat_fails');
        
        // Act
        try {
          await app.videoEngagerClient.startChat();
        } catch (error) {
          // Expected to throw
        }
        
        // Assert
        const errorChain = errorTracker.getErrorChain();
        const hasInternalError = errorChain.some(error => 
          error.errorTypeCode === 'INTERNAL_ERROR'
        );
        expect(hasInternalError).toBe(true);
      });
    });
  });

  describe('Event Handling Errors', () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
      errorTracker.clear();
    });

    test('should handle waitroom user cancellation', async () => {
      // Arrange - Simulate loading screen
      app.showScreen('loading');
      
      // Act - Trigger user cancellation from waitroom
      mockEnv.triggerEvent('waitroom:userCancelled', { timestamp: Date.now() });
      
      // Wait for event handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert - Should return to initial screen
      const initialScreen = document.getElementById('initial-screen');
      expect(initialScreen.style.display).toBe('flex');
    });

    test('should handle waitroom error events', async () => {
      // Act
      mockEnv.triggerEvent('waitroom:error', { 
        message: 'Waitroom component error' 
      });
      
      // Wait for event handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      const lastError = errorTracker.getLastError();
      expect(lastError.errorTypeCode).toBe('WAITROOM_ERROR');
    });

    test('should handle system message processing errors', async () => {
      // Arrange - Mock malformed system message
      const malformedMessage = {
        message: {
          direction: 'Inbound',
          content: null // This should cause an error
        }
      };
      
      // Act
      try {
        app.handleSystemMessage(malformedMessage);
      } catch (error) {
        // Expected - system should handle gracefully
      }
      
      // Assert - Should not crash the application
      expect(app.currentScreen).toBeDefined();
    });
  });

  describe('Inactivity and Timeout Scenarios', () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
    });

    test('should handle inactivity timeout', async () => {
      // Arrange
      app.showScreen('initial');
      
      // Act - Fast forward past inactivity timeout
      mockEnv.fastForwardTime(1000 * 60 * 60 + 1000); // 1 hour + 1 second
      
      // Assert - Should trigger page reload
      expect(window.location.reload).toHaveBeenCalled();
    });

    test('should reset inactivity timer on user activity', async () => {
      // Arrange
      app.showScreen('initial');
      
      // Act - Simulate user activity
      document.dispatchEvent(new Event('click'));
      mockEnv.fastForwardTime(1000 * 60 * 30); // 30 minutes
      
      // Simulate another activity
      document.dispatchEvent(new Event('mousemove'));
      mockEnv.fastForwardTime(1000 * 60 * 30); // Another 30 minutes
      
      // Assert - Should not have triggered reload yet
      expect(window.location.reload).not.toHaveBeenCalled();
      
      // Fast forward past the reset timer
      mockEnv.fastForwardTime(1000 * 60 * 60 + 1000);
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    test('should handle retry attempts correctly', async () => {
      // Arrange - Set up localStorage with retry count
      localStorage.setItem('LIBRARY_LOAD_FAILED', '2');
      mockEnv.setBehavior('scriptLoading', 'timeout');
      
      app = new KioskApplication();
      
      // Act
      await app.init();
      
      // Assert
      const lastError = errorTracker.getLastError();
      expect(lastError.errorTypeCode).toBe('LIBRARY_LOAD_FAILED');
      
      // Should increment retry count
      expect(localStorage.getItem('LIBRARY_LOAD_FAILED')).toBe('3');
    });

    test('should stop retrying after max attempts', async () => {
      // Arrange - Set retry count to max
      localStorage.setItem('LIBRARY_LOAD_FAILED', '3');
      mockEnv.setBehavior('scriptLoading', 'timeout');
      
      app = new KioskApplication();
      
      // Act
      await app.init();
      
      // Assert
      const errorState = mockEnv.captureErrorState();
      expect(errorState.toastMessages.some(msg => 
        msg.includes('Maximum retry attempts reached')
      )).toBe(true);
      
      // Should clear retry count
      expect(localStorage.getItem('LIBRARY_LOAD_FAILED')).toBeNull();
    });
  });

  describe('Unhandled Error Scenarios', () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
      errorTracker.clear();
    });

    test('should handle unhandled promise rejections', async () => {
      // Act - Trigger unhandled promise rejection
      window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Unhandled async error')),
        reason: new Error('Unhandled async error')
      }));
      
      // Assert
      const lastError = errorTracker.getLastError();
      expect(lastError.errorTypeCode).toBe('INTERNAL_ERROR');
      expect(lastError.originalErrorMessage).toBe('Unhandled async error');
    });

    test('should handle event handler errors gracefully', async () => {
      // Arrange - Add a failing event handler
      const failingHandler = jest.fn(() => {
        throw new Error('Event handler failed');
      });
      
      // Act
      try {
        app.on('test:event', failingHandler);
        app.emit('test:event', {});
      } catch (error) {
        // Should be caught and logged
      }
      
      // Assert - Application should continue functioning
      expect(app.currentScreen).toBeDefined();
      expect(failingHandler).toHaveBeenCalled();
    });
  });
});

/**
 * Error Message Report Generation Tests
 */
describe('Error Message Report Generation', () => {
  let mockEnv;
  let errorTracker;
  let reportData = [];

  beforeEach(() => {
    mockEnv = new KioskMockEnvironment();
    errorTracker = new KioskErrorTracker();
    mockEnv.setup();
    errorTracker.startTracking();
  });

  afterEach(() => {
    errorTracker.stopTracking();
    mockEnv.restore();
  });

  // Collect data from all error scenarios for report generation
  const errorScenarios = [
    {
      name: 'Config Fetch Failure',
      setup: () => mockEnv.setBehavior('configManager', 'fetch_fails'),
      category: 'Configuration'
    },
    {
      name: 'Script Load Timeout',
      setup: () => mockEnv.setBehavior('scriptLoading', 'timeout'),
      category: 'Library Loading'
    },
    {
      name: 'VideoEngager Ready Timeout',
      setup: () => mockEnv.setBehavior('videoEngagerClient', 'ready_never_calls'),
      category: 'Library Loading'
    },
    {
      name: 'Network Offline',
      setup: () => mockEnv.setNetworkState('offline'),
      category: 'Network'
    },
    {
      name: 'Waitroom Component Missing',
      setup: () => document.querySelector('ve-carousel-waitroom')?.remove(),
      category: 'Component'
    }
  ];

  test.each(errorScenarios)('should collect error data for $name', async ({ name, setup, category }) => {
    // Arrange
    setup();
    const app = new KioskApplication();
    
    // Act
    await app.init();
    
    // Collect data for report
    const lastError = errorTracker.getLastError();
    const userMessage = errorTracker.getLastUserMessage();
    const errorState = mockEnv.captureErrorState();
    
    const reportEntry = {
      errorType: name,
      category: category,
      originalError: lastError?.originalErrorMessage || 'N/A',
      userMessage: userMessage?.displayedMessage || errorState.modalMessage || 'N/A',
      retryable: userMessage?.retryable || errorState.hasRetryButton || false,
      recoverable: determineRecoverability(lastError?.errorTypeCode),
      errorCode: lastError?.errorTypeCode || 'UNKNOWN',
      source: `${category} Module`
    };
    
    reportData.push(reportEntry);
    
    // Basic assertions
    expect(reportEntry.errorType).toBeDefined();
    expect(reportEntry.userMessage).not.toBe('N/A');
    
    if (app) {
      app.destroy?.();
    }
  });

  test('should generate comprehensive error report', () => {
    // This test runs after all the data collection tests
    const markdownReport = generateErrorReport(reportData);
    
    expect(markdownReport).toContain('| Error Type | Original Message | User Sees | Retryable | Recoverable | Source |');
    expect(markdownReport.split('\n').length).toBeGreaterThan(10);
    
    // Log the report for manual inspection
    console.log('\n=== ERROR VALIDATION REPORT ===\n');
    console.log(markdownReport);
    console.log('\n=== END REPORT ===\n');
  });
});

/**
 * Helper functions for report generation
 */
function determineRecoverability(errorCode) {
  const recoverableErrors = [
    'LIBRARY_LOAD_FAILED',
    'NETWORK_ERROR', 
    'CALL_TIMEOUT',
    'WAITROOM_ERROR'
  ];
  return recoverableErrors.includes(errorCode);
}

function generateErrorReport(data) {
  const header = `
# Error Message Validation Report

This report shows how errors propagate through the nested try-catch blocks and what messages are ultimately shown to users.

| Error Type | Original Message | User Sees | Retryable | Recoverable | Source |
|------------|------------------|-----------|-----------|-------------|---------|`;

  const rows = data.map(entry => 
    `| ${entry.errorType} | ${entry.originalError} | ${entry.userMessage} | ${entry.retryable ? 'Yes' : 'No'} | ${entry.recoverable ? 'Yes' : 'No'} | ${entry.source} |`
  ).join('\n');

  return header + '\n' + rows;
}
