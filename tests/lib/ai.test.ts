import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAIService } from "../../src/lib/ai/service";
import type { ParsedReceipt, ParsedSales } from "../../src/lib/ai/service";

describe("AI Service", () => {
  const mockApiKey = "test-api-key";

  describe("parseReceipt", () => {
    it("returns structured receipt data from image", async () => {
      const mockReceiptResponse: ParsedReceipt = {
        vendor: "Sysco",
        date: "2024-03-15",
        total: 234.56,
        items: [
          { name: "Chicken Breast", quantity: 10, unit: "lb", unitPrice: 4.99, totalPrice: 49.90 },
          { name: "Olive Oil", quantity: 2, unit: "gal", unitPrice: 28.50, totalPrice: 57.00 },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockReceiptResponse),
              },
            },
          ],
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseReceipt("data:image/png;base64,fakeImageData");

      expect(result).toEqual(mockReceiptResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(options.headers["Authorization"]).toBe("Bearer test-api-key");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("google/gemini-3.1-flash-lite");
      expect(body.messages[0].content).toContainEqual(
        expect.objectContaining({ type: "image_url" })
      );
    });

    it("throws error when API returns non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(ai.parseReceipt("data:image/png;base64,fakeImageData"))
        .rejects.toThrow("API request failed");
    });
  });

  describe("parsePOSScreen", () => {
    it("returns structured sales data from POS screenshot", async () => {
      const mockSalesResponse: ParsedSales = {
        date: "2024-03-15",
        items: [
          { name: "Margherita Pizza", quantity: 12, revenue: 180.00 },
          { name: "Caesar Salad", quantity: 8, revenue: 96.00 },
        ],
        totalRevenue: 276.00,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockSalesResponse),
              },
            },
          ],
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parsePOSScreen("data:image/png;base64,fakePOSScreenshot");

      expect(result).toEqual(mockSalesResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContainEqual(
        expect.objectContaining({ type: "image_url" })
      );
    });
  });

  describe("parseReceipt edge cases", () => {
    it("handles malformed JSON in parseReceipt", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not valid json {" } }],
        }),
      });

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      await expect(service.parseReceipt("http://example.com/receipt.jpg"))
        .rejects.toThrow(/JSON/i);
    });

    it("throws on rate limit error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      await expect(service.parseReceipt("http://example.com/receipt.jpg"))
        .rejects.toThrow(/429|rate/i);
    });

    it("handles null fields in parsed receipt", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                vendor: null,
                items: [],
                total: 0,
                date: null,
              }),
            },
          }],
        }),
      });

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      const result = await service.parseReceipt("http://example.com/receipt.jpg");
      expect(result.items).toEqual([]);
    });

    it("handles network errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      await expect(service.parseReceipt("http://example.com/receipt.jpg"))
        .rejects.toThrow("Network error");
    });
  });

  describe("matchInventoryItem", () => {
    it("matches receipt item to inventory items", async () => {
      const mockMatchResponse = {
        matchedId: 42,
        confidence: 0.95,
        reasoning: "Exact name match with similar unit",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockMatchResponse),
              },
            },
          ],
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      const result = await ai.matchInventoryItem(
        { name: "Chicken Breast", unit: "lb" },
        [
          { id: 42, name: "Chicken Breast", unit: "lb" },
          { id: 43, name: "Chicken Thigh", unit: "lb" },
        ]
      );

      expect(result).toEqual(mockMatchResponse);
    });

    it("returns null matchedId when no good match found", async () => {
      const mockMatchResponse = {
        matchedId: null,
        confidence: 0.2,
        reasoning: "No matching items found in inventory",
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockMatchResponse),
              },
            },
          ],
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      const result = await ai.matchInventoryItem(
        { name: "Mystery Item", unit: "each" },
        [
          { id: 42, name: "Chicken Breast", unit: "lb" },
        ]
      );

      expect(result.matchedId).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("returns low confidence for dissimilar items", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                matchedId: null,
                confidence: 0.1,
                reasoning: "No similar items found",
              }),
            },
          }],
        }),
      });

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      const result = await service.matchInventoryItem(
        { name: "XYZ Unknown Product", unit: "each" },
        [{ id: 1, name: "Chicken", unit: "lb" }]
      );
      expect(result.matchedId).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("handles empty inventory list", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                matchedId: null,
                confidence: 0,
                reasoning: "No inventory items to match against",
              }),
            },
          }],
        }),
      });

      const service = createAIService({ apiKey: "test", fetchFn: mockFetch });
      const result = await service.matchInventoryItem(
        { name: "Eggs", unit: "dozen" },
        []
      );
      expect(result.matchedId).toBeNull();
    });
  });
});
