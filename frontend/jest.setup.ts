import "@testing-library/jest-dom";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock URL.createObjectURL
URL.createObjectURL = jest.fn(() => "blob:mock-url");
URL.revokeObjectURL = jest.fn();

// Mock canvas context
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  globalAlpha: 1,
});
