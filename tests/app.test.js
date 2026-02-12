/**
 * Tests for App module.
 */

// Mock dependencies before requiring App
const AudioProcessor = require('../js/audio-processor');
const TextProcessor = require('../js/text-processor');
const SyncEngine = require('../js/sync-engine');
const AssetManager = require('../js/asset-manager');
const Renderer = require('../js/renderer');

// Make them globally accessible (App expects them on global scope)
global.AudioProcessor = AudioProcessor;
global.TextProcessor = TextProcessor;
global.SyncEngine = SyncEngine;
global.AssetManager = AssetManager;
global.Renderer = Renderer;

const App = require('../js/app');

// Helper to create a mock DOM
function setupDOM() {
  document.body.innerHTML = `
    <div id="app">
      <button id="start-btn">Start</button>
      <select id="mode-select">
        <option value="hybrid">Hybrid</option>
        <option value="audio-only">Audio Only</option>
        <option value="text-only">Text Only</option>
      </select>
      <input type="file" id="base-upload" />
      <input type="file" id="viseme-upload" multiple />
      <input type="range" id="opacity-slider" min="0" max="1" step="0.05" value="1.0" />
      <input type="range" id="scale-slider" min="0.1" max="3.0" step="0.05" value="1.0" />
      <input type="range" id="mouth-x-slider" min="0" max="1" step="0.01" value="0.5" />
      <input type="range" id="mouth-y-slider" min="0" max="1" step="0.01" value="0.7" />
      <input type="range" id="mouth-scale-slider" min="0.1" max="3.0" step="0.05" value="1.0" />
      <textarea id="text-input"></textarea>
      <span id="status-text">Stopped</span>
      <span id="viseme-status">0/12 visemes loaded</span>
      <canvas id="avatar-canvas"></canvas>
      <span id="fps-display">FPS: --</span>
      <button id="viseme-test-0">Neutral</button>
      <button id="viseme-test-1">Aa</button>
      <button id="viseme-test-2">D</button>
      <button id="viseme-test-3">Ee</button>
      <button id="viseme-test-4">F</button>
      <button id="viseme-test-5">L</button>
      <button id="viseme-test-6">M</button>
      <button id="viseme-test-7">Oh</button>
      <button id="viseme-test-8">R</button>
      <button id="viseme-test-9">S</button>
      <button id="viseme-test-10">Uh</button>
      <button id="viseme-test-11">W-Oo</button>
    </div>
  `;
}

describe('App', () => {
  let app;

  beforeEach(() => {
    setupDOM();

    // Mock canvas context
    const canvasEl = document.getElementById('avatar-canvas');
    canvasEl.getContext = jest.fn(() => ({
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      globalAlpha: 1.0,
    }));

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn(cb => setTimeout(() => cb(performance.now()), 0));
    global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

    app = new App();
  });

  afterEach(() => {
    if (app.isRunning) app.stop();
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  describe('constructor', () => {
    test('starts with null modules', () => {
      expect(app.audioProcessor).toBeNull();
      expect(app.textProcessor).toBeNull();
      expect(app.syncEngine).toBeNull();
      expect(app.assetManager).toBeNull();
      expect(app.renderer).toBeNull();
      expect(app.isRunning).toBe(false);
    });
  });

  describe('init', () => {
    test('initializes all modules', () => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);

      expect(app.audioProcessor).toBeInstanceOf(AudioProcessor);
      expect(app.textProcessor).toBeInstanceOf(TextProcessor);
      expect(app.syncEngine).toBeInstanceOf(SyncEngine);
      expect(app.assetManager).toBeInstanceOf(AssetManager);
      expect(app.renderer).toBeInstanceOf(Renderer);
    });

    test('connects renderer to asset manager and sync engine', () => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);

      expect(app.renderer.assetManager).toBe(app.assetManager);
      expect(app.renderer.syncEngine).toBe(app.syncEngine);
    });

    test('sets up audio data callback', () => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);

      expect(app.audioProcessor._onAudioData).toBeDefined();
    });
  });

  describe('UI interaction', () => {
    beforeEach(() => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);
    });

    test('opacity slider updates renderer opacity', () => {
      const slider = document.getElementById('opacity-slider');
      slider.value = '0.5';
      slider.dispatchEvent(new Event('input'));
      expect(app.renderer.opacity).toBe(0.5);
    });

    test('scale slider updates renderer scale', () => {
      const slider = document.getElementById('scale-slider');
      slider.value = '2.0';
      slider.dispatchEvent(new Event('input'));
      expect(app.renderer.scale).toBe(2.0);
    });

    test('mouth X slider updates asset manager position', () => {
      const slider = document.getElementById('mouth-x-slider');
      slider.value = '0.3';
      slider.dispatchEvent(new Event('input'));
      expect(app.assetManager.mouthPosition.x).toBeCloseTo(0.3);
    });

    test('mouth Y slider updates asset manager position', () => {
      const slider = document.getElementById('mouth-y-slider');
      slider.value = '0.4';
      slider.dispatchEvent(new Event('input'));
      expect(app.assetManager.mouthPosition.y).toBeCloseTo(0.4);
    });

    test('mouth scale slider updates asset manager', () => {
      const slider = document.getElementById('mouth-scale-slider');
      slider.value = '1.5';
      slider.dispatchEvent(new Event('input'));
      expect(app.assetManager.mouthScale).toBe(1.5);
    });

    test('mode selector changes sync engine mode', () => {
      const select = document.getElementById('mode-select');
      select.value = 'audio-only';
      select.dispatchEvent(new Event('change'));
      expect(app.syncEngine.mode).toBe('audio-only');
    });

    test('text input triggers text processing', () => {
      const textarea = document.getElementById('text-input');
      jest.spyOn(app.syncEngine, 'feedVisemes');

      textarea.value = 'hello';
      textarea.dispatchEvent(new Event('input'));

      expect(app.syncEngine.feedVisemes).toHaveBeenCalled();
    });

    test('viseme test buttons call renderPreviewFrame', () => {
      jest.spyOn(app.renderer, 'renderPreviewFrame');

      const btn = document.getElementById('viseme-test-3');
      btn.click();
      expect(app.renderer.renderPreviewFrame).toHaveBeenCalledWith(3);
    });

    test('high-index viseme test buttons work', () => {
      jest.spyOn(app.renderer, 'renderPreviewFrame');

      const btn11 = document.getElementById('viseme-test-11');
      btn11.click();
      expect(app.renderer.renderPreviewFrame).toHaveBeenCalledWith(11);
    });
  });

  describe('start/stop', () => {
    beforeEach(() => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);
    });

    test('stop resets state', () => {
      app.isRunning = true;
      app.stop();

      expect(app.isRunning).toBe(false);
      expect(app.renderer.running).toBe(false);
    });

    test('stop updates UI', () => {
      app.isRunning = true;
      app.stop();

      const btn = document.getElementById('start-btn');
      expect(btn.textContent).toBe('Start');

      const status = document.getElementById('status-text');
      expect(status.textContent).toBe('Stopped');
    });

    test('toggle calls start when stopped', async () => {
      jest.spyOn(app, 'start').mockResolvedValue();
      await app.toggle();
      expect(app.start).toHaveBeenCalled();
    });

    test('toggle calls stop when running', async () => {
      app.isRunning = true;
      jest.spyOn(app, 'stop');
      await app.toggle();
      expect(app.stop).toHaveBeenCalled();
    });
  });

  describe('_processTextInput', () => {
    beforeEach(() => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);
    });

    test('processes text and feeds visemes to sync engine', () => {
      jest.spyOn(app.syncEngine, 'feedVisemes');
      app._processTextInput('hello world');
      expect(app.syncEngine.feedVisemes).toHaveBeenCalled();

      const visemes = app.syncEngine.feedVisemes.mock.calls[0][0];
      expect(visemes.length).toBeGreaterThan(0);
    });

    test('handles empty text', () => {
      jest.spyOn(app.syncEngine, 'feedVisemes');
      app._processTextInput('');
      expect(app.syncEngine.feedVisemes).toHaveBeenCalledWith([]);
    });
  });

  describe('_updateVisemeStatus', () => {
    beforeEach(() => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);
    });

    test('updates viseme status text', () => {
      app.assetManager.visemeImages[0] = { width: 50 };
      app.assetManager.visemeImages[1] = { width: 50 };
      app._updateVisemeStatus();

      const status = document.getElementById('viseme-status');
      expect(status.textContent).toBe('2/12 visemes loaded');
    });
  });

  describe('audio data pipeline', () => {
    test('audio data flows through to sync engine', () => {
      const canvas = document.getElementById('avatar-canvas');
      app.init(canvas);

      jest.spyOn(app.syncEngine, 'updateAudio');

      // Simulate audio data callback
      app.audioProcessor._onAudioData({
        rms: 0.5,
        smoothedRMS: 0.3,
        peak: true
      });

      expect(app.syncEngine.updateAudio).toHaveBeenCalledWith({
        rms: 0.5,
        smoothedRMS: 0.3,
        peak: true
      });
    });
  });
});
