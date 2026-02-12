/**
 * AssetManager - Handles character asset loading, upload, and management.
 *
 * Supports:
 * - Base face image (PNG/JPG with alpha)
 * - Viseme mouth images (viseme0.png ... viseme8.png)
 * - Drag-and-drop upload
 * - Click-to-position mouth overlay calibration
 */
class AssetManager {
  constructor() {
    this.baseImage = null;
    this.visemeImages = new Array(9).fill(null); // 9 viseme slots (0-8)
    this.mouthPosition = { x: 0.5, y: 0.7 }; // Normalized position (center default)
    this.mouthScale = 1.0;
    this.loaded = false;
    this._onUpdate = null;
  }

  /**
   * Register callback for asset updates.
   * @param {Function} callback
   */
  onUpdate(callback) {
    this._onUpdate = callback;
  }

  /**
   * Load a base face image from a File or URL.
   * @param {File|string} source - File object or URL string
   * @returns {Promise<HTMLImageElement>}
   */
  async loadBaseImage(source) {
    this.baseImage = await this._loadImage(source);
    this._notifyUpdate();
    return this.baseImage;
  }

  /**
   * Load a viseme image for a specific slot.
   * @param {number} index - Viseme index (0-8)
   * @param {File|string} source - File object or URL string
   * @returns {Promise<HTMLImageElement>}
   */
  async loadVisemeImage(index, source) {
    if (index < 0 || index > 8) {
      throw new Error(`Invalid viseme index: ${index}. Must be 0-8.`);
    }
    this.visemeImages[index] = await this._loadImage(source);
    this._notifyUpdate();
    return this.visemeImages[index];
  }

  /**
   * Load multiple viseme images from an array of files.
   * Files should be named viseme0.png through viseme8.png.
   * @param {FileList|File[]} files
   */
  async loadVisemeFiles(files) {
    const promises = [];
    for (const file of files) {
      const match = file.name.match(/viseme(\d)\.(?:png|jpg|jpeg|webp)/i);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index >= 0 && index <= 8) {
          promises.push(this.loadVisemeImage(index, file));
        }
      }
    }
    await Promise.all(promises);
    return this.getLoadedVisemeCount();
  }

  /**
   * Set the mouth overlay position (normalized 0-1 coordinates).
   * @param {number} x - Horizontal position (0 = left, 1 = right)
   * @param {number} y - Vertical position (0 = top, 1 = bottom)
   */
  setMouthPosition(x, y) {
    this.mouthPosition = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
    this._notifyUpdate();
  }

  /**
   * Set mouth overlay scale.
   * @param {number} scale
   */
  setMouthScale(scale) {
    this.mouthScale = Math.max(0.1, Math.min(3.0, scale));
    this._notifyUpdate();
  }

  /**
   * Get the base image.
   * @returns {HTMLImageElement|null}
   */
  getBaseImage() {
    return this.baseImage;
  }

  /**
   * Get a viseme image by index.
   * @param {number} index
   * @returns {HTMLImageElement|null}
   */
  getVisemeImage(index) {
    if (index < 0 || index > 8) return null;
    return this.visemeImages[index];
  }

  /**
   * Get the mouth overlay position in canvas coordinates.
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   * @returns {{x: number, y: number}}
   */
  getMouthCanvasPosition(canvasWidth, canvasHeight) {
    return {
      x: this.mouthPosition.x * canvasWidth,
      y: this.mouthPosition.y * canvasHeight
    };
  }

  /**
   * Check if minimum assets are loaded (base + at least viseme 0).
   * @returns {boolean}
   */
  isReady() {
    return this.baseImage !== null && this.visemeImages[0] !== null;
  }

  /**
   * Get count of loaded viseme images.
   * @returns {number}
   */
  getLoadedVisemeCount() {
    return this.visemeImages.filter(v => v !== null).length;
  }

  /**
   * Reset all assets.
   */
  reset() {
    this.baseImage = null;
    this.visemeImages = new Array(9).fill(null);
    this.mouthPosition = { x: 0.5, y: 0.7 };
    this.mouthScale = 1.0;
    this.loaded = false;
    this._notifyUpdate();
  }

  /**
   * Set up drag-and-drop handlers on an element.
   * @param {HTMLElement} element - Drop target
   * @param {Function} [onDrop] - Callback after files are processed
   */
  setupDragAndDrop(element, onDrop) {
    if (!element) return;

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove('drag-over');
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      element.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files);
      await this._processDroppedFiles(files);
      if (onDrop) onDrop(this);
    });
  }

  /**
   * Process dropped files: detect base vs viseme images.
   * @param {File[]} files
   */
  async _processDroppedFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    for (const file of imageFiles) {
      const match = file.name.match(/viseme(\d)\.(?:png|jpg|jpeg|webp)/i);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index >= 0 && index <= 8) {
          await this.loadVisemeImage(index, file);
        }
      } else if (file.name.match(/base|face|character/i) || !this.baseImage) {
        await this.loadBaseImage(file);
      }
    }
  }

  /**
   * Load an image from a File or URL.
   * @param {File|string} source
   * @returns {Promise<HTMLImageElement>}
   */
  async _loadImage(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${source}`));

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof Blob || (typeof File !== 'undefined' && source instanceof File)) {
        const url = URL.createObjectURL(source);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.src = url;
      } else {
        reject(new Error('Invalid image source'));
      }
    });
  }

  _notifyUpdate() {
    if (this._onUpdate) {
      this._onUpdate(this);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetManager;
}
