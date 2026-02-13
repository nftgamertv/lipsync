/**
 * App - Main entry point for the Live Avatar Lip Sync application.
 * Orchestrates all modules: AudioProcessor, TextProcessor, SyncEngine, AssetManager, Renderer.
 */
class App {
  constructor() {
    this.audioProcessor = null;
    this.textProcessor = null;
    this.syncEngine = null;
    this.assetManager = null;
    this.renderer = null;

    this.isRunning = false;
    this._textInputInterval = null;
  }

  /**
   * Initialize all modules and connect them.
   * @param {HTMLCanvasElement} canvas
   */
  init(canvas) {
    this.audioProcessor = new AudioProcessor();
    this.textProcessor = new TextProcessor();
    this.syncEngine = new SyncEngine();
    this.assetManager = new AssetManager();
    this.renderer = new Renderer(canvas);

    // Connect modules
    this.renderer.setAssetManager(this.assetManager);
    this.renderer.setSyncEngine(this.syncEngine);

    // Wire audio data to sync engine
    this.audioProcessor.onAudioData((data) => {
      this.syncEngine.updateAudio(data);
    });

    this._setupUI();
  }

  /**
   * Set up UI event handlers.
   */
  _setupUI() {
    // Start/Stop button
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.toggle());
    }

    // Text input
    const textInput = document.getElementById('text-input');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        this._processTextInput(e.target.value);
      });
    }

    // Mode selector
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.syncEngine.setMode(e.target.value);
      });
    }

    // Base image upload
    const baseUpload = document.getElementById('base-upload');
    if (baseUpload) {
      baseUpload.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.assetManager.loadBaseImage(e.target.files[0]);
          this._updatePreview();
        }
      });
    }

    // Viseme images upload
    const visemeUpload = document.getElementById('viseme-upload');
    if (visemeUpload) {
      visemeUpload.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.assetManager.loadVisemeFiles(e.target.files);
          this._updatePreview();
          this._updateVisemeStatus();
        }
      });
    }

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.renderer.setOpacity(parseFloat(e.target.value));
      });
    }

    // Scale slider
    const scaleSlider = document.getElementById('scale-slider');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', (e) => {
        this.renderer.setScale(parseFloat(e.target.value));
      });
    }

    // Mouth position X/Y sliders
    const mouthXSlider = document.getElementById('mouth-x-slider');
    if (mouthXSlider) {
      mouthXSlider.addEventListener('input', (e) => {
        const y = this.assetManager.mouthPosition.y;
        this.assetManager.setMouthPosition(parseFloat(e.target.value), y);
      });
    }

    const mouthYSlider = document.getElementById('mouth-y-slider');
    if (mouthYSlider) {
      mouthYSlider.addEventListener('input', (e) => {
        const x = this.assetManager.mouthPosition.x;
        this.assetManager.setMouthPosition(x, parseFloat(e.target.value));
      });
    }

    // Mouth scale slider
    const mouthScaleSlider = document.getElementById('mouth-scale-slider');
    if (mouthScaleSlider) {
      mouthScaleSlider.addEventListener('input', (e) => {
        this.assetManager.setMouthScale(parseFloat(e.target.value));
      });
    }

    // Canvas click for mouth positioning
    const canvas = this.renderer.canvas;
    if (canvas) {
      canvas.addEventListener('click', (e) => {
        if (!this.isRunning) {
          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          this.assetManager.setMouthPosition(x, y);
          this._updatePreview();
          // Update sliders
          if (mouthXSlider) mouthXSlider.value = x;
          if (mouthYSlider) mouthYSlider.value = y;
        }
      });
    }

    // Drag and drop on canvas
    if (canvas) {
      this.assetManager.setupDragAndDrop(canvas, () => {
        this._updatePreview();
        this._updateVisemeStatus();
      });
    }

    // Viseme tester buttons
    for (let i = 0; i <= 11; i++) {
      const btn = document.getElementById(`viseme-test-${i}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.renderer.renderPreviewFrame(i);
        });
      }
    }
  }

  /**
   * Process text input and feed to sync engine.
   */
  _processTextInput(text) {
    const visemes = this.textProcessor.processText(text);
    this.syncEngine.feedVisemes(visemes);
  }

  /**
   * Update the canvas preview.
   */
  _updatePreview() {
    this.renderer.renderPreviewFrame(0);
  }

  /**
   * Update viseme status display.
   */
  _updateVisemeStatus() {
    const statusEl = document.getElementById('viseme-status');
    if (statusEl) {
      const count = this.assetManager.getLoadedVisemeCount();
      statusEl.textContent = `${count}/12 visemes loaded`;
    }
  }

  /**
   * Start audio capture and rendering.
   */
  async start() {
    if (this.isRunning) return;

    try {
      await this.audioProcessor.start();
      this.renderer.start();
      this.isRunning = true;
      this._updateUIState();
    } catch (error) {
      const statusEl = document.getElementById('status-text');
      if (statusEl) {
        statusEl.textContent = `Error: ${error.message}`;
      }
    }
  }

  /**
   * Stop audio capture and rendering.
   */
  stop() {
    this.audioProcessor.stop();
    this.renderer.stop();
    this.syncEngine.reset();
    this.isRunning = false;
    this._updateUIState();
  }

  /**
   * Toggle start/stop.
   */
  async toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      await this.start();
    }
  }

  /**
   * Update UI to reflect running state.
   */
  _updateUIState() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.textContent = this.isRunning ? 'Stop' : 'Start';
      startBtn.classList.toggle('active', this.isRunning);
    }

    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = this.isRunning ? 'Running' : 'Stopped';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
