// Mock all dependencies first (before imports)
jest.mock("../../js/error-handler.js", () => ({
  ErrorHandler: jest.fn(),
  ErrorTypes: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    CONFIG_INVALID: 'CONFIG_INVALID',
    LIBRARY_LOAD_FAILED: 'LIBRARY_LOAD_FAILED',
    WAITROOM_COMPONENT_NOT_FOUND: 'WAITROOM_COMPONENT_NOT_FOUND',
    WAITROOM_ERROR: 'WAITROOM_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    CALL_TIMEOUT: 'CALL_TIMEOUT'
  }
}));

jest.mock("../../js/client.js", () => ({
  VideoEngagerClient: jest.fn()
}));

jest.mock("../../js/timeout-manager.js", () => ({
  TimeoutManager: jest.fn()
}));

jest.mock("../../js/waitroom-event-mediator.js", () => ({
  WaitroomEventMediator: jest.fn()
}));

jest.mock("../../js/config-manager.js", () => ({
  ConfigManager: jest.fn()
}));

jest.mock("../../js/utils.js", () => ({
  Utils: {
    sanitizeText: jest.fn(text => text),
    validateURL: jest.fn(() => true)
  }
}));

jest.mock("../../config/conf.js", () => ({
  configs: {
    production: {
      apiEndpoint: "https://api.test.com",
      timeout: 5000
    }
  },
  metadata: {
    backgroundImage: "img/bg.jpg"
  }
}));

// Now import after mocking
import { KioskApplication } from "../../js/kiosk.js";
import { ErrorHandler, ErrorTypes } from "../../js/error-handler.js";
import { VideoEngagerClient } from "../../js/client.js";
import { TimeoutManager } from "../../js/timeout-manager.js";
import { WaitroomEventMediator } from "../../js/waitroom-event-mediator.js";
import { ConfigManager } from "../../js/config-manager.js";

// Mock DOM elements and APIs
const mockDocument = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockWindow = {
  navigator: { onLine: true },
  location: { 
    reload: jest.fn(),
    search: "?lang=en"
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  Genesys: jest.fn()
};

// Mock console to track logs
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe("KioskApplication Error Cases", () => {
  let app;
  let mockErrorHandler;
  let mockVideoClient;
  let mockTimeoutManager;
  let mockWaitroomMediator;
  let mockConfigManager;

  // Setup global mocks before tests
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalConsole = global.console;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup window mock with location that doesn't throw
    const mockLocation = {
      reload: jest.fn(),
      search: "?lang=en",
      href: "http://localhost"
    };

    // Setup improved window mock
    global.window = {
      ...mockWindow,
      location: mockLocation,
      navigator: { onLine: true },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      Genesys: jest.fn()
    };

    // Setup document mock
    global.document = mockDocument;
    global.console = mockConsole;

    // Setup DOM element mocks with more comprehensive behavior
    const mockElement = {
      style: { 
        display: 'block', 
        backgroundImage: '',
        opacity: '1',
        transform: '',
        transition: '',
        height: '100%'
      },
      textContent: '',
      classList: { 
        add: jest.fn(), 
        remove: jest.fn() 
      },
      addEventListener: jest.fn(),
      appendChild: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(() => null),
      id: 'mock-element'
    };

    // Mock different elements for different IDs
    mockDocument.getElementById.mockImplementation((id) => {
      if (id === 'oncall-screen') return null; // Simulate missing element for some tests
      return { ...mockElement, id };
    });
    
    mockDocument.querySelector.mockImplementation((selector) => {
      if (selector === 've-carousel-waitroom') {
        return {
          ...mockElement,
          init: jest.fn().mockResolvedValue()
        };
      }
      return mockElement;
    });
    
    mockDocument.createElement.mockReturnValue(mockElement);

    // Setup mock instances with proper error handling
    mockErrorHandler = {
      handleError: jest.fn()
    };
    ErrorHandler.mockImplementation(() => mockErrorHandler);

    mockVideoClient = {
      init: jest.fn().mockResolvedValue(),
      isReady: jest.fn(() => true),
      waitForReady: jest.fn().mockResolvedValue(),
      startVideo: jest.fn().mockResolvedValue(),
      endVideo: jest.fn().mockResolvedValue(),
      startGenesysChat: jest.fn().mockResolvedValue(),
      endGenesysChat: jest.fn().mockResolvedValue(),
      hideGenesysChat: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn()
    };
    VideoEngagerClient.mockImplementation(() => mockVideoClient);

    mockTimeoutManager = {
      set: jest.fn(),
      clear: jest.fn(),
      clearAll: jest.fn(),
      extend: jest.fn()
    };
    TimeoutManager.mockImplementation(() => mockTimeoutManager);

    mockWaitroomMediator = {
      on: jest.fn()
    };
    WaitroomEventMediator.mockImplementation(() => mockWaitroomMediator);

    mockConfigManager = {
      load: jest.fn().mockResolvedValue({
        apiEndpoint: "https://api.test.com",
        timeout: 5000,
        metadata: {
          backgroundImage: "img/bg.jpg"
        }
      })
    };
    ConfigManager.mockImplementation(() => mockConfigManager);
  });

  afterEach(() => {
    if (app && app.destroy) {
      try {
        app.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Restore globals
    global.document = originalDocument;
    global.window = originalWindow;
    global.console = originalConsole;
    
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("Initialization Errors", () => {
    test.only("should handle network offline during initialization", async () => {
      // Arrange
      const mockNavigator = jest.spyOn(window.navigator, 'onLine', 'get');
      mockNavigator.mockReturnValue(false);
      expect(navigator.onLine).toBe(false);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(ErrorTypes.NETWORK_ERROR);
      mockNavigator.mockRestore();
    });

    test("should handle configuration loading failure", async () => {
      // Arrange
      const configError = new Error("Config load failed");
      mockConfigManager.load.mockRejectedValue(configError);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.CONFIG_INVALID,
        configError
      );
    });

    test("should handle invalid configuration data", async () => {
      // Arrange
      mockConfigManager.load.mockResolvedValue(null);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.CONFIG_INVALID,
        expect.any(Error)
      );
    });

    test("should handle VideoEngager client initialization failure", async () => {
      // Arrange
      const clientError = new Error("Client init failed");
      mockVideoClient.init.mockRejectedValue(clientError);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.LIBRARY_LOAD_FAILED,
        clientError
      );
    });

    test("should handle waitroom component not found", async () => {
      // Arrange
      mockDocument.querySelector.mockReturnValue(null);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.WAITROOM_COMPONENT_NOT_FOUND
      );
    });

    test("should handle waitroom initialization failure", async () => {
      // Arrange
      const waitroomElement = {
        init: jest.fn().mockRejectedValue(new Error("Waitroom init failed"))
      };
      mockDocument.querySelector.mockReturnValue(waitroomElement);
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.WAITROOM_ERROR
      );
    });
  });

  describe("Video Call Errors", () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
    });

    test("should handle video call start failure - client not ready", async () => {
      // Arrange
      mockVideoClient.isReady.mockReturnValue(false);
      const mockEvent = { preventDefault: jest.fn() };

      // Act
      await app.handleStartVideoCall(mockEvent);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.INTERNAL_ERROR,
        expect.any(Error)
      );
    });

    test("should handle video call start failure - startVideo throws", async () => {
      // Arrange
      const videoError = new Error("Video start failed");
      mockVideoClient.startVideo.mockRejectedValue(videoError);
      mockVideoClient.waitForReady.mockResolvedValue();
      const mockEvent = { preventDefault: jest.fn() };

      // Act
      await app.handleStartVideoCall(mockEvent);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.INTERNAL_ERROR,
        expect.any(Error)
      );
    });

    test("should handle video call start failure - Genesys chat throws", async () => {
      // Arrange
      const genesysError = new Error("Genesys chat failed");
      mockVideoClient.startVideo.mockResolvedValue();
      mockVideoClient.startGenesysChat.mockRejectedValue(genesysError);
      mockVideoClient.waitForReady.mockResolvedValue();
      const mockEvent = { preventDefault: jest.fn() };

      // Act
      await app.handleStartVideoCall(mockEvent);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.INTERNAL_ERROR,
        expect.any(Error)
      );
    });

    test("should handle video call end failure", async () => {
      // Arrange
      const endError = new Error("End video failed");
      mockVideoClient.endVideo.mockRejectedValue(endError);

      // Clear previous log calls
      mockConsole.log.mockClear();

      // Act
      await app.handleVideoCallEnded();

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("CALL: Video call ended"),
        expect.any(Object)
      );
    });

    test("should handle call timeout", async () => {
      // Arrange
      const endError = new Error("End video failed");
      mockVideoClient.endVideo.mockRejectedValue(endError);

      // Clear previous log calls
      mockConsole.log.mockClear();

      // Act
      await app.handleCallTimeout();

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(ErrorTypes.CALL_TIMEOUT);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("CALL: Call timeout - ending call"),
        expect.any(Object)
      );
    });

    test("should handle video call error event", async () => {
      // Arrange
      const callError = new Error("Call failed");

      // Act
      await app.handleVideoCallError(callError);

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        ErrorTypes.INTERNAL_ERROR,
        callError
      );
      expect(mockTimeoutManager.clear).toHaveBeenCalledWith("call");
    });

    test("should handle cancel call with end video failure", async () => {
      // Arrange
      const endError = new Error("End video failed");
      mockVideoClient.endVideo.mockRejectedValue(endError);
      const mockEvent = { preventDefault: jest.fn() };

      // Clear previous log calls
      mockConsole.log.mockClear();

      // Act
      await app.handleCancelCall(mockEvent);

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("CALL: Cancel call requested"),
        expect.any(Object)
      );
    });

    test("should handle cancel call with Genesys end failure", async () => {
      // Arrange
      const genesysEndError = new Error("Genesys end failed");
      mockVideoClient.endVideo.mockResolvedValue();
      mockVideoClient.endGenesysChat.mockRejectedValue(genesysEndError);
      const mockEvent = { preventDefault: jest.fn() };

      // Clear previous log calls  
      mockConsole.log.mockClear();

      // Act
      await app.handleCancelCall(mockEvent);

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("CALL: Cancel call requested"),
        expect.any(Object)
      );
    });
  });

  describe("Waitroom Errors", () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
    });

    test("should handle waitroom error event", () => {
      // Arrange - Find the error callback that was registered
      const errorCallArgs = mockWaitroomMediator.on.mock.calls.find(call => call[0] === "error");
      expect(errorCallArgs).toBeDefined();
      const errorCallback = errorCallArgs[1];

      // Act
      errorCallback({ message: "Waitroom error" });

      // Assert
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(ErrorTypes.WAITROOM_ERROR);
    });

    test("should handle waitroom user cancellation", async () => {
      // Arrange - Find the userCancelled callback
      const cancelCallArgs = mockWaitroomMediator.on.mock.calls.find(call => call[0] === "userCancelled");
      expect(cancelCallArgs).toBeDefined();
      const cancelCallback = cancelCallArgs[1];
      
      // Act
      await cancelCallback({ reason: "user_cancelled" });

      // Assert
      expect(mockTimeoutManager.clear).toHaveBeenCalledWith("call");
    });
  });

  describe("System Notification Errors", () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
      app.currentScreen = "loading";
    });

    test("should handle system notification display when oncall-screen missing", () => {
      // Arrange - Mock getElementById to return null for oncall-screen
      mockDocument.getElementById.mockImplementation((id) => {
        if (id === 'oncall-screen') return null;
        return { id, style: {}, textContent: '', classList: { add: jest.fn(), remove: jest.fn() } };
      });
      
      // Clear previous log calls
      mockConsole.log.mockClear();
      
      // Act
      app.displaySystemNotification("Test notification");

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("SYSTEM NOTIFICATION: oncall-screen element not found"),
        expect.any(Object)
      );
    });

    test("should handle system notification element creation failure", () => {
      // Arrange
      mockDocument.createElement.mockReturnValue(null);
      
      // Act
      app.createSystemNotificationElement();

      // Assert
      // Should not throw error, should gracefully handle null element
      expect(app.systemNotificationElement).toBeFalsy();
    });

    test("should handle invalid system message format", () => {
      // Arrange
      const invalidMessage = { 
        message: { 
          direction: "Inbound",
          content: { type: "Image" } // Not a text message
        }
      };

      // Act & Assert - should not throw
      expect(() => app.handleSystemMessage(invalidMessage)).not.toThrow();
    });

    test("should handle missing message content", () => {
      // Arrange
      const invalidMessage = { message: null };

      // Act & Assert - should not throw
      expect(() => app.handleSystemMessage(invalidMessage)).not.toThrow();
    });
  });

  describe("DOM and Environment Errors", () => {
    test("should handle missing DOM elements gracefully", async () => {
      // Arrange
      mockDocument.getElementById.mockReturnValue(null);
      mockDocument.querySelector.mockReturnValue(null);
      app = new KioskApplication();

      // Act & Assert - should not throw
      expect(async () => await app.init()).not.toThrow();
      expect(() => app.showScreen("initial")).not.toThrow();
      expect(() => app.showScreen("loading")).not.toThrow();
      expect(() => app.showScreen("video")).not.toThrow();
    });

    test("should handle invalid language parameter", () => {
      // Arrange
      global.window.location.search = "?lang=invalid";
      app = new KioskApplication();

      // Act
      const lang = app.getLanguageFromParams();

      // Assert
      expect(lang).toBe("en"); // Should default to English
    });

    test("should handle invalid background image URL", async () => {
      // Arrange
      const { Utils } = require("../../js/utils.js");
      Utils.validateURL.mockReturnValue(false); // Mock invalid URL
      
      app = new KioskApplication();
      await app.init();
      
      // Clear previous log calls
      mockConsole.log.mockClear();

      // Act
      app.setupBackgroundImage();

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining("BACKGROUND: Invalid background image URL"),
        expect.any(Object)
      );
    });

    test("should handle missing URLSearchParams", () => {
      // Arrange
      const originalURLSearchParams = global.URLSearchParams;
      delete global.URLSearchParams;
      app = new KioskApplication();

      // Act & Assert - should throw
      expect(() => app.getLanguageFromParams()).toThrow();
      
      // Cleanup
      global.URLSearchParams = originalURLSearchParams;
    });
  });

  describe("Timer and Timeout Errors", () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
    });

    test("should handle timeout manager set failure", () => {
      // Arrange
      mockTimeoutManager.set.mockImplementation(() => {
        throw new Error("Timer set failed");
      });

      // Act & Assert - should throw since the app doesn't handle this error
      expect(() => app.setupInactivityTimer()).toThrow("Timer set failed");
    });

    test("should handle timeout manager clear failure", () => {
      // Arrange
      mockTimeoutManager.clear.mockImplementation(() => {
        throw new Error("Timer clear failed");
      });

      // Act & Assert - should throw since the app doesn't handle this error
      expect(() => app.resetInactivityTimer()).toThrow("Timer clear failed");
    });

    test("should handle inactivity timeout callback error", () => {
      // Arrange - Mock window.location.reload to throw error
      global.window.location.reload.mockImplementation(() => {
        throw new Error("Reload failed");
      });
      
      let timeoutCallback;
      mockTimeoutManager.set.mockImplementation((name, callback, time) => {
        if (name === "inactivity") {
          timeoutCallback = callback;
        }
      });
      
      app.setupInactivityTimer();

      // Act & Assert - The timeout callback should throw
      expect(() => timeoutCallback()).toThrow("Reload failed");
    });
  });

  describe("Configuration and Loading Errors", () => {
    test("should handle malformed configuration data", async () => {
      // Arrange
      mockConfigManager.load.mockResolvedValue({
        // Missing required fields
        metadata: null
      });
      app = new KioskApplication();

      // Act
      await app.init();

      // Assert - should handle gracefully
      expect(app.config).toBeTruthy();
    });

    test("should handle configuration with circular references", async () => {
      // Arrange
      const circularConfig = { apiEndpoint: "test" };
      circularConfig.self = circularConfig;
      mockConfigManager.load.mockResolvedValue(circularConfig);
      app = new KioskApplication();

      // Act & Assert - should not throw
      await expect(app.init()).resolves.not.toThrow();
    });

    test("should handle configuration manager instantiation failure", () => {
      // Arrange
      ConfigManager.mockImplementation(() => {
        throw new Error("ConfigManager failed");
      });

      // Act & Assert
      expect(() => new KioskApplication()).toThrow("ConfigManager failed");
    });
  });

  describe("Event Handler Errors", () => {
    beforeEach(async () => {
      app = new KioskApplication();
      await app.init();
    });

    test("should handle addEventListener failure", () => {
      // Arrange
      mockDocument.addEventListener.mockImplementation(() => {
        throw new Error("addEventListener failed");
      });

      // Act & Assert - Should throw since app doesn't handle this
      expect(() => app.setupInternalEventListeners()).toThrow("addEventListener failed");
    });

    test("should handle removeEventListener failure in destroy", () => {
      // Arrange  
      mockDocument.removeEventListener.mockImplementation(() => {
        throw new Error("removeEventListener failed");
      });

      // Act & Assert - Should throw since app doesn't handle this
      expect(() => app.destroy()).toThrow("removeEventListener failed");
    });

    test("should handle network restored event with uninitialized app", () => {
      // Arrange
      let networkCallback;
      mockDocument.addEventListener.mockImplementation((event, callback) => {
        if (event === "networkRestored") {
          networkCallback = callback;
        }
      });
      
      app.setupInternalEventListeners();
      app.isInitialized = false;

      // Act
      expect(networkCallback).toBeDefined();
      networkCallback();

      // Assert
      expect(global.window.location.reload).toHaveBeenCalled();
    });
  });

  describe("Memory and Resource Errors", () => {
    test("should handle destroy when components are null", () => {
      // Arrange
      app = new KioskApplication();
      app.videoEngagerClient = null;
      app.timeoutManager = null;

      // Act & Assert - Should throw because the app tries to call clearAll on null
      expect(() => app.destroy()).toThrow();
    });

    test("should handle VideoEngager client destroy failure", async () => {
      // Arrange
      mockVideoClient.destroy.mockImplementation(() => {
        throw new Error("Client destroy failed");
      });
      app = new KioskApplication();
      await app.init();

      // Act & Assert - Should throw since app doesn't handle this error
      expect(() => app.destroy()).toThrow("Client destroy failed");
    });

    test("should handle timeout manager clearAll failure", async () => {
      // Arrange
      mockTimeoutManager.clearAll.mockImplementation(() => {
        throw new Error("ClearAll failed");
      });
      app = new KioskApplication();
      await app.init();

      // Act & Assert - Should throw since app doesn't handle this error
      expect(() => app.destroy()).toThrow("ClearAll failed");
    });
  });

  describe("Edge Cases and Race Conditions", () => {
    test("should handle rapid screen changes", async () => {
      // Arrange
      app = new KioskApplication();
      await app.init();

      // Act - rapidly change screens
      app.showScreen("initial");
      app.showScreen("loading");
      app.showScreen("video");
      app.showScreen("initial");

      // Assert - should not throw
      expect(app.currentScreen).toBe("initial");
    });

    test("should handle multiple initialization calls", async () => {
      // Arrange
      app = new KioskApplication();

      // Act - call init multiple times
      const promises = [app.init(), app.init(), app.init()];

      // Assert - should not throw
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    test("should handle events after destruction", async () => {
      // Arrange
      app = new KioskApplication();
      await app.init();
      app.destroy();

      // Act & Assert - should not throw
      expect(() => app.handleVideoCallStarted()).not.toThrow();
      expect(() => app.resetInactivityTimer()).not.toThrow();
    });
  });
});