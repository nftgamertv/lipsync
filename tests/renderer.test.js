/**
 * Tests for Renderer module.
 */
const Renderer = require('../js/renderer');

// Mock canvas and context
function createMockCanvas() {
  const ctx = {
    clearRect: jest.fn(),
    drawImage: jest.fn(),
    globalAlpha: 1.0,
  };
  const canvas = {
    width: 1920,
    height: 1080,
    style: { background: '' },
    getContext: jest.fn(() => ctx),
    getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 1920, height: 1080 }))
  };
  return { canvas, ctx };
}

describe('Renderer', () => {
  let renderer;
  let mockCanvas;
  let mockCtx;

  beforeEach(() => {
    const mock = createMockCanvas();
    mockCanvas = mock.canvas;
    mockCtx = mock.ctx;
    renderer = new Renderer(mockCanvas);

    // Mock requestAnimationFrame and cancelAnimationFrame
    global.requestAnimationFrame = jest.fn(cb => {
      return setTimeout(() => cb(performance.now()), 0);
    });
    global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));
  });

  afterEach(() => {
    renderer.stop();
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  describe('constructor', () => {
    test('initializes with default dimensions', () => {
      expect(renderer.width).toBe(1920);
      expect(renderer.height).toBe(1080);
    });

    test('sets canvas dimensions', () => {
      expect(mockCanvas.width).toBe(1920);
      expect(mockCanvas.height).toBe(1080);
    });

    test('sets transparent background', () => {
      expect(mockCanvas.style.background).toBe('transparent');
    });

    test('initializes rendering state', () => {
      expect(renderer.running).toBe(false);
      expect(renderer.opacity).toBe(1.0);
      expect(renderer.scale).toBe(1.0);
      expect(renderer.targetFPS).toBe(60);
      expect(renderer.currentFPS).toBe(0);
    });

    test('handles null canvas', () => {
      const r = new Renderer(null);
      expect(r.canvas).toBeNull();
      expect(r.ctx).toBeNull();
    });
  });

  describe('setAssetManager', () => {
    test('sets asset manager reference', () => {
      const mockAM = { getBaseImage: jest.fn() };
      renderer.setAssetManager(mockAM);
      expect(renderer.assetManager).toBe(mockAM);
    });
  });

  describe('setSyncEngine', () => {
    test('sets sync engine reference', () => {
      const mockSE = { update: jest.fn() };
      renderer.setSyncEngine(mockSE);
      expect(renderer.syncEngine).toBe(mockSE);
    });
  });

  describe('setSize', () => {
    test('updates width and height', () => {
      renderer.setSize(800, 600);
      expect(renderer.width).toBe(800);
      expect(renderer.height).toBe(600);
      expect(mockCanvas.width).toBe(800);
      expect(mockCanvas.height).toBe(600);
    });
  });

  describe('setOpacity', () => {
    test('sets opacity within range', () => {
      renderer.setOpacity(0.5);
      expect(renderer.opacity).toBe(0.5);
    });

    test('clamps to 0', () => {
      renderer.setOpacity(-0.5);
      expect(renderer.opacity).toBe(0);
    });

    test('clamps to 1', () => {
      renderer.setOpacity(1.5);
      expect(renderer.opacity).toBe(1);
    });
  });

  describe('setScale', () => {
    test('sets scale within range', () => {
      renderer.setScale(2.0);
      expect(renderer.scale).toBe(2.0);
    });

    test('clamps to minimum 0.1', () => {
      renderer.setScale(0.01);
      expect(renderer.scale).toBe(0.1);
    });

    test('clamps to maximum 3.0', () => {
      renderer.setScale(5.0);
      expect(renderer.scale).toBe(3.0);
    });
  });

  describe('setTargetFPS', () => {
    test('sets target FPS and updates interval', () => {
      renderer.setTargetFPS(30);
      expect(renderer.targetFPS).toBe(30);
      expect(renderer._frameInterval).toBeCloseTo(1000 / 30, 5);
    });

    test('sets 60 FPS', () => {
      renderer.setTargetFPS(60);
      expect(renderer._frameInterval).toBeCloseTo(1000 / 60, 5);
    });
  });

  describe('start / stop', () => {
    test('start sets running to true', () => {
      renderer.start();
      expect(renderer.running).toBe(true);
    });

    test('stop sets running to false', () => {
      renderer.start();
      renderer.stop();
      expect(renderer.running).toBe(false);
    });

    test('start does nothing if already running', () => {
      renderer.start();
      const id = renderer._animationId;
      renderer.start();
      // Should not have changed
      expect(renderer._animationId).toBe(id);
    });

    test('stop cancels animation frame', () => {
      renderer.start();
      renderer.stop();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
      expect(renderer._animationId).toBeNull();
    });
  });

  describe('onRender', () => {
    test('registers custom render callback', () => {
      const callback = jest.fn();
      renderer.onRender(callback);
      expect(renderer._renderCallback).toBe(callback);
    });
  });

  describe('_render', () => {
    test('clears canvas each frame', () => {
      renderer._render(1000);
      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    test('uses sync engine state if available', () => {
      const mockSE = {
        update: jest.fn(() => ({ viseme: 1, nextViseme: 2, blendFactor: 0.5, energy: 0.5 }))
      };
      renderer.setSyncEngine(mockSE);
      renderer._render(1000);
      expect(mockSE.update).toHaveBeenCalledWith(1000);
    });

    test('calls custom render callback', () => {
      const callback = jest.fn();
      renderer.onRender(callback);
      renderer._render(1000);
      expect(callback).toHaveBeenCalledWith(mockCtx, expect.any(Object));
    });

    test('handles null ctx gracefully', () => {
      const r = new Renderer(null);
      expect(() => r._render(1000)).not.toThrow();
    });

    test('draws base image when asset manager has one', () => {
      const mockImg = { width: 500, height: 500 };
      const mockAM = {
        getBaseImage: jest.fn(() => mockImg),
        getVisemeImage: jest.fn(() => null),
        getMouthCanvasPosition: jest.fn(() => ({ x: 960, y: 756 })),
        mouthScale: 1.0
      };
      renderer.setAssetManager(mockAM);
      renderer._render(1000);
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });
  });

  describe('_computeScaledDimensions', () => {
    test('fits wide image to canvas', () => {
      const result = renderer._computeScaledDimensions(3840, 1080);
      expect(result.drawW).toBeLessThanOrEqual(1920);
      expect(result.drawH).toBeLessThanOrEqual(1080);
    });

    test('fits tall image to canvas', () => {
      const result = renderer._computeScaledDimensions(500, 2000);
      expect(result.drawW).toBeLessThanOrEqual(1920);
      expect(result.drawH).toBeLessThanOrEqual(1080);
    });

    test('centers the image', () => {
      const result = renderer._computeScaledDimensions(1920, 1080);
      expect(result.drawX).toBeCloseTo(0, 0);
      expect(result.drawY).toBeCloseTo(0, 0);
    });

    test('respects scale factor', () => {
      renderer.setScale(2.0);
      const result = renderer._computeScaledDimensions(960, 540);
      expect(result.drawW).toBe(1920 * 2);
    });
  });

  describe('renderPreviewFrame', () => {
    test('clears canvas and draws base', () => {
      renderer.renderPreviewFrame(0);
      expect(mockCtx.clearRect).toHaveBeenCalled();
    });

    test('draws viseme image if available', () => {
      const mockImg = { width: 50, height: 50 };
      const mockAM = {
        getBaseImage: jest.fn(() => null),
        getVisemeImage: jest.fn((i) => i === 3 ? mockImg : null),
        getMouthCanvasPosition: jest.fn(() => ({ x: 960, y: 756 })),
        mouthScale: 1.0
      };
      renderer.setAssetManager(mockAM);
      renderer.renderPreviewFrame(3);
      expect(mockAM.getVisemeImage).toHaveBeenCalledWith(3);
      expect(mockCtx.drawImage).toHaveBeenCalled();
    });
  });

  describe('_drawMouth', () => {
    test('handles missing viseme images gracefully', () => {
      const mockAM = {
        getBaseImage: jest.fn(() => null),
        getVisemeImage: jest.fn(() => null),
        getMouthCanvasPosition: jest.fn(() => ({ x: 960, y: 756 })),
        mouthScale: 1.0
      };
      renderer.setAssetManager(mockAM);
      expect(() => renderer._drawMouth({ viseme: 0, nextViseme: 0, blendFactor: 1, energy: 0 })).not.toThrow();
    });

    test('blends between current and next viseme', () => {
      const mockImg1 = { width: 50, height: 50 };
      const mockImg2 = { width: 50, height: 50 };
      const mockAM = {
        getVisemeImage: jest.fn((i) => i === 0 ? mockImg1 : i === 1 ? mockImg2 : null),
        getMouthCanvasPosition: jest.fn(() => ({ x: 960, y: 756 })),
        mouthScale: 1.0
      };
      renderer.setAssetManager(mockAM);

      renderer._drawMouth({ viseme: 0, nextViseme: 1, blendFactor: 0.5, energy: 0.5 });
      // Both images should be drawn
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
    });
  });
});
