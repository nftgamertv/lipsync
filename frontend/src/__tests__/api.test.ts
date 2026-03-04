import { getWebSocketUrl } from "@/lib/api";

// Mock fetch for API tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Save original env
const originalEnv = process.env;

beforeEach(() => {
  mockFetch.mockReset();
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("API client", () => {
  test("getWebSocketUrl converts http to ws", () => {
    const url = getWebSocketUrl();
    // Should convert https → wss (or http → ws) and append /ws/audio
    expect(url).toMatch(/^wss?:\/\/.+\/ws\/audio$/);
  });

  test("healthCheck calls /api/health", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", viseme_count: 12 }),
    });

    const { healthCheck } = await import("@/lib/api");
    const result = await healthCheck();
    expect(result.status).toBe("ok");
    expect(result.viseme_count).toBe(12);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/health")
    );
  });

  test("fetchVisemes calls /api/visemes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        visemes: Array.from({ length: 12 }, (_, i) => ({
          index: i,
          label: `V${i}`,
          description: `desc${i}`,
        })),
      }),
    });

    const { fetchVisemes } = await import("@/lib/api");
    const result = await fetchVisemes();
    expect(result.visemes).toHaveLength(12);
  });

  test("processText sends POST with text and speed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], count: 0, total_duration_ms: 0 }),
    });

    const { processText } = await import("@/lib/api");
    await processText("hello", 1.5);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/process-text"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello", speed: 1.5 }),
      })
    );
  });

  test("processAudioFile sends FormData", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ timeline: [], duration_ms: 0, total_events: 0 }),
    });

    const { processAudioFile } = await import("@/lib/api");
    const blob = new Blob(["fake audio"], { type: "audio/wav" });
    await processAudioFile(blob, "audio_only");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/process-audio"),
      expect.objectContaining({ method: "POST" })
    );
    // Verify FormData was sent
    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  test("healthCheck rejects on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { healthCheck } = await import("@/lib/api");
    await expect(healthCheck()).rejects.toThrow("Backend not available");
  });

  test("processText rejects on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const { processText } = await import("@/lib/api");
    await expect(processText("test")).rejects.toThrow();
  });
});
