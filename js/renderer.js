/**
 * Renderer - Canvas-based rendering for the lip sync avatar.
 *
 * Features:
 * - 60 FPS rendering via requestAnimationFrame
 * - Transparent background (alpha channel) for OBS overlay
 * - Smooth viseme blending with opacity interpolation
 * - Base face + mouth overlay compositing
 * - Configurable canvas size (default 1920x1080)
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.width = 1920;
    this.height = 1080;
    this.running = false;
    this._animationId = null;
    this._renderCallback = null;

    this.assetManager = null;
    this.syncEngine = null;

    this.opacity = 1.0;
    this.scale = 1.0;
    this.targetFPS = 60;
    this._lastFrameTime = 0;
    this._frameInterval = 1000 / 60;
    this._fpsCount = 0;
    this._fpsTime = 0;
    this.currentFPS = 0;

    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.background = 'transparent';
    }
  }

  /**
   * Set the asset manager to source images from.
   * @param {AssetManager} assetManager
   */
  setAssetManager(assetManager) {
    this.assetManager = assetManager;
  }

  /**
   * Set the sync engine to get viseme states from.
   * @param {SyncEngine} syncEngine
   */
  setSyncEngine(syncEngine) {
    this.syncEngine = syncEngine;
  }

  /**
   * Set canvas dimensions.
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Set global opacity.
   * @param {number} opacity - 0 to 1
   */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Set global scale.
   * @param {number} scale
   */
  setScale(scale) {
    this.scale = Math.max(0.1, Math.min(3.0, scale));
  }

  /**
   * Set the target FPS (30 or 60).
   * @param {number} fps
   */
  setTargetFPS(fps) {
    this.targetFPS = fps;
    this._frameInterval = 1000 / fps;
  }

  /**
   * Start the render loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._lastFrameTime = performance.now();
    this._fpsTime = this._lastFrameTime;
    this._fpsCount = 0;
    this._loop();
  }

  /**
   * Stop the render loop.
   */
  stop() {
    this.running = false;
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Register a custom render callback (called each frame after standard rendering).
   * @param {Function} callback - Called with (ctx, state)
   */
  onRender(callback) {
    this._renderCallback = callback;
  }

  /**
   * Main render loop.
   */
  _loop() {
    if (!this.running) return;

    this._animationId = requestAnimationFrame((timestamp) => {
      const elapsed = timestamp - this._lastFrameTime;

      if (elapsed >= this._frameInterval) {
        this._lastFrameTime = timestamp - (elapsed % this._frameInterval);
        this._render(timestamp);
        this._updateFPS(timestamp);
      }

      this._loop();
    });
  }

  /**
   * Single frame render.
   */
  _render(timestamp) {
    if (!this.ctx) return;

    // Clear with transparency
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = this.opacity;

    // Get sync state
    let state = { viseme: 0, nextViseme: 0, blendFactor: 1, energy: 0 };
    if (this.syncEngine) {
      state = this.syncEngine.update(timestamp);
    }

    // Draw base face
    this._drawBase();

    // Draw mouth viseme with blending
    this._drawMouth(state);

    // Custom render callback
    if (this._renderCallback) {
      this._renderCallback(this.ctx, state);
    }

    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Draw the base face image.
   */
  _drawBase() {
    if (!this.assetManager) return;
    const baseImg = this.assetManager.getBaseImage();
    if (!baseImg) return;

    const { drawX, drawY, drawW, drawH } = this._computeScaledDimensions(
      baseImg.width, baseImg.height
    );
    this.ctx.drawImage(baseImg, drawX, drawY, drawW, drawH);
  }

  /**
   * Draw the mouth viseme overlay with blending.
   * @param {{viseme: number, nextViseme: number, blendFactor: number, energy: number}} state
   */
  _drawMouth(state) {
    if (!this.assetManager) return;

    const currentImg = this.assetManager.getVisemeImage(state.viseme);
    const nextImg = this.assetManager.getVisemeImage(state.nextViseme);

    if (!currentImg && !nextImg) return;

    const mouthPos = this.assetManager.getMouthCanvasPosition(this.width, this.height);
    const mouthScale = this.assetManager.mouthScale * this.scale;

    // Draw current viseme
    if (currentImg) {
      const alpha = 1 - state.blendFactor;
      if (alpha > 0.01) {
        this.ctx.globalAlpha = this.opacity * alpha;
        this._drawImageCentered(currentImg, mouthPos.x, mouthPos.y, mouthScale);
      }
    }

    // Draw next viseme (blending in)
    if (nextImg) {
      this.ctx.globalAlpha = this.opacity * state.blendFactor;
      this._drawImageCentered(nextImg, mouthPos.x, mouthPos.y, mouthScale);
    }

    this.ctx.globalAlpha = this.opacity;
  }

  /**
   * Draw an image centered at a position with scale.
   */
  _drawImageCentered(img, cx, cy, scale) {
    const w = img.width * scale;
    const h = img.height * scale;
    this.ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }

  /**
   * Compute scaled dimensions to fit the canvas while maintaining aspect ratio.
   */
  _computeScaledDimensions(imgWidth, imgHeight) {
    const canvasAspect = this.width / this.height;
    const imgAspect = imgWidth / imgHeight;

    let drawW, drawH;
    if (imgAspect > canvasAspect) {
      drawW = this.width * this.scale;
      drawH = (this.width / imgAspect) * this.scale;
    } else {
      drawH = this.height * this.scale;
      drawW = (this.height * imgAspect) * this.scale;
    }

    const drawX = (this.width - drawW) / 2;
    const drawY = (this.height - drawH) / 2;

    return { drawX, drawY, drawW, drawH };
  }

  /**
   * Update FPS counter.
   */
  _updateFPS(timestamp) {
    this._fpsCount++;
    if (timestamp - this._fpsTime >= 1000) {
      this.currentFPS = this._fpsCount;
      this._fpsCount = 0;
      this._fpsTime = timestamp;
    }
  }

  /**
   * Render a single static frame with a specific viseme (for preview/testing).
   * @param {number} visemeIndex
   */
  renderPreviewFrame(visemeIndex) {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = this.opacity;

    this._drawBase();

    if (this.assetManager) {
      const img = this.assetManager.getVisemeImage(visemeIndex);
      if (img) {
        const mouthPos = this.assetManager.getMouthCanvasPosition(this.width, this.height);
        const mouthScale = this.assetManager.mouthScale * this.scale;
        this.ctx.globalAlpha = this.opacity;
        this._drawImageCentered(img, mouthPos.x, mouthPos.y, mouthScale);
      }
    }

    this.ctx.globalAlpha = 1.0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
}
