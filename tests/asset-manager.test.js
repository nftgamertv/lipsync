/**
 * Tests for AssetManager module.
 */
const AssetManager = require('../js/asset-manager');

describe('AssetManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AssetManager();
  });

  describe('constructor', () => {
    test('initializes with default values', () => {
      expect(manager.baseImage).toBeNull();
      expect(manager.visemeImages).toHaveLength(9);
      expect(manager.visemeImages.every(v => v === null)).toBe(true);
      expect(manager.mouthPosition).toEqual({ x: 0.5, y: 0.7 });
      expect(manager.mouthScale).toBe(1.0);
      expect(manager.loaded).toBe(false);
    });
  });

  describe('onUpdate', () => {
    test('registers callback', () => {
      const callback = jest.fn();
      manager.onUpdate(callback);
      expect(manager._onUpdate).toBe(callback);
    });
  });

  describe('setMouthPosition', () => {
    test('sets position within bounds', () => {
      manager.setMouthPosition(0.3, 0.6);
      expect(manager.mouthPosition).toEqual({ x: 0.3, y: 0.6 });
    });

    test('clamps x to 0-1 range', () => {
      manager.setMouthPosition(-0.5, 0.5);
      expect(manager.mouthPosition.x).toBe(0);

      manager.setMouthPosition(1.5, 0.5);
      expect(manager.mouthPosition.x).toBe(1);
    });

    test('clamps y to 0-1 range', () => {
      manager.setMouthPosition(0.5, -0.5);
      expect(manager.mouthPosition.y).toBe(0);

      manager.setMouthPosition(0.5, 1.5);
      expect(manager.mouthPosition.y).toBe(1);
    });

    test('triggers onUpdate callback', () => {
      const callback = jest.fn();
      manager.onUpdate(callback);
      manager.setMouthPosition(0.3, 0.6);
      expect(callback).toHaveBeenCalledWith(manager);
    });
  });

  describe('setMouthScale', () => {
    test('sets scale within bounds', () => {
      manager.setMouthScale(1.5);
      expect(manager.mouthScale).toBe(1.5);
    });

    test('clamps to minimum 0.1', () => {
      manager.setMouthScale(0.01);
      expect(manager.mouthScale).toBe(0.1);
    });

    test('clamps to maximum 3.0', () => {
      manager.setMouthScale(5.0);
      expect(manager.mouthScale).toBe(3.0);
    });

    test('triggers onUpdate callback', () => {
      const callback = jest.fn();
      manager.onUpdate(callback);
      manager.setMouthScale(2.0);
      expect(callback).toHaveBeenCalledWith(manager);
    });
  });

  describe('getBaseImage', () => {
    test('returns null when no base image loaded', () => {
      expect(manager.getBaseImage()).toBeNull();
    });

    test('returns base image when loaded', () => {
      const mockImg = { width: 100, height: 100 };
      manager.baseImage = mockImg;
      expect(manager.getBaseImage()).toBe(mockImg);
    });
  });

  describe('getVisemeImage', () => {
    test('returns null for unloaded viseme', () => {
      expect(manager.getVisemeImage(0)).toBeNull();
    });

    test('returns null for out-of-range index', () => {
      expect(manager.getVisemeImage(-1)).toBeNull();
      expect(manager.getVisemeImage(9)).toBeNull();
    });

    test('returns image when loaded', () => {
      const mockImg = { width: 50, height: 50 };
      manager.visemeImages[3] = mockImg;
      expect(manager.getVisemeImage(3)).toBe(mockImg);
    });
  });

  describe('getMouthCanvasPosition', () => {
    test('computes correct position for default (centered)', () => {
      const pos = manager.getMouthCanvasPosition(1920, 1080);
      expect(pos.x).toBe(960);  // 0.5 * 1920
      expect(pos.y).toBe(756);  // 0.7 * 1080
    });

    test('computes correct position for top-left', () => {
      manager.setMouthPosition(0, 0);
      const pos = manager.getMouthCanvasPosition(1920, 1080);
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
    });

    test('computes correct position for bottom-right', () => {
      manager.setMouthPosition(1, 1);
      const pos = manager.getMouthCanvasPosition(1920, 1080);
      expect(pos.x).toBe(1920);
      expect(pos.y).toBe(1080);
    });

    test('computes correct position for custom values', () => {
      manager.setMouthPosition(0.25, 0.75);
      const pos = manager.getMouthCanvasPosition(800, 600);
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(450);
    });
  });

  describe('isReady', () => {
    test('returns false when nothing loaded', () => {
      expect(manager.isReady()).toBe(false);
    });

    test('returns false when only base image loaded', () => {
      manager.baseImage = { width: 100 };
      expect(manager.isReady()).toBe(false);
    });

    test('returns false when only viseme 0 loaded', () => {
      manager.visemeImages[0] = { width: 50 };
      expect(manager.isReady()).toBe(false);
    });

    test('returns true when base and viseme 0 are loaded', () => {
      manager.baseImage = { width: 100 };
      manager.visemeImages[0] = { width: 50 };
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('getLoadedVisemeCount', () => {
    test('returns 0 initially', () => {
      expect(manager.getLoadedVisemeCount()).toBe(0);
    });

    test('counts loaded visemes correctly', () => {
      manager.visemeImages[0] = { width: 50 };
      manager.visemeImages[3] = { width: 50 };
      manager.visemeImages[7] = { width: 50 };
      expect(manager.getLoadedVisemeCount()).toBe(3);
    });

    test('returns 9 when all loaded', () => {
      for (let i = 0; i < 9; i++) {
        manager.visemeImages[i] = { width: 50 };
      }
      expect(manager.getLoadedVisemeCount()).toBe(9);
    });
  });

  describe('reset', () => {
    test('resets all values to defaults', () => {
      manager.baseImage = { width: 100 };
      manager.visemeImages[0] = { width: 50 };
      manager.mouthPosition = { x: 0.3, y: 0.4 };
      manager.mouthScale = 2.0;

      manager.reset();

      expect(manager.baseImage).toBeNull();
      expect(manager.visemeImages.every(v => v === null)).toBe(true);
      expect(manager.mouthPosition).toEqual({ x: 0.5, y: 0.7 });
      expect(manager.mouthScale).toBe(1.0);
      expect(manager.loaded).toBe(false);
    });

    test('triggers onUpdate callback', () => {
      const callback = jest.fn();
      manager.onUpdate(callback);
      manager.reset();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('loadVisemeImage', () => {
    test('rejects invalid index below 0', async () => {
      await expect(manager.loadVisemeImage(-1, 'test.png'))
        .rejects.toThrow('Invalid viseme index');
    });

    test('rejects invalid index above 8', async () => {
      await expect(manager.loadVisemeImage(9, 'test.png'))
        .rejects.toThrow('Invalid viseme index');
    });
  });

  describe('setupDragAndDrop', () => {
    test('handles null element', () => {
      expect(() => manager.setupDragAndDrop(null)).not.toThrow();
    });

    test('adds event listeners to element', () => {
      const element = {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      manager.setupDragAndDrop(element);
      expect(element.addEventListener).toHaveBeenCalledWith('dragover', expect.any(Function));
      expect(element.addEventListener).toHaveBeenCalledWith('dragleave', expect.any(Function));
      expect(element.addEventListener).toHaveBeenCalledWith('drop', expect.any(Function));
    });

    test('dragover handler adds class and prevents default', () => {
      const element = {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      manager.setupDragAndDrop(element);

      // Get the dragover handler
      const dragoverCall = element.addEventListener.mock.calls.find(c => c[0] === 'dragover');
      const handler = dragoverCall[1];

      const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(element.classList.add).toHaveBeenCalledWith('drag-over');
    });

    test('dragleave handler removes class', () => {
      const element = {
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() }
      };
      manager.setupDragAndDrop(element);

      const dragleaveCall = element.addEventListener.mock.calls.find(c => c[0] === 'dragleave');
      const handler = dragleaveCall[1];

      const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      handler(event);

      expect(element.classList.remove).toHaveBeenCalledWith('drag-over');
    });
  });

  describe('_loadImage', () => {
    test('rejects on invalid source type', async () => {
      await expect(manager._loadImage(12345)).rejects.toThrow('Invalid image source');
    });
  });
});
