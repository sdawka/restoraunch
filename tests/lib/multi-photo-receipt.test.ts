import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAIService } from "../../src/lib/ai/service";
import type {
  TrackedMultiPhotoReceipt,
  ParsedReceiptItem,
} from "../../src/lib/ai/service";

describe("parseMultiPhotoReceiptTracked", () => {
  const mockApiKey = "test-api-key";

  // Helper to create mock API response
  function createMockResponse(data: unknown, usage?: { prompt_tokens: number; completion_tokens: number }) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(data) } }],
        usage: usage ?? { prompt_tokens: 1000, completion_tokens: 200 },
      }),
    };
  }

  // Helper to create mock single-image extraction result
  function createImageExtraction(options: {
    vendor?: string | null;
    date?: string | null;
    subtotal?: number | null;
    items?: ParsedReceiptItem[];
  }) {
    return {
      vendor: options.vendor ?? null,
      date: options.date ?? null,
      subtotal: options.subtotal ?? null,
      items: options.items ?? [],
    };
  }

  describe("single image parsing", () => {
    it("parses a single image and returns tracked result", async () => {
      const mockItems: ParsedReceiptItem[] = [
        { name: "Chicken Breast", quantity: 5, unit: "lb", unitPrice: 4.99, totalPrice: 24.95 },
        { name: "Olive Oil", quantity: 2, unit: "gal", unitPrice: 15.00, totalPrice: 30.00 },
      ];

      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            vendor: "Restaurant Depot",
            date: "2026-04-24",
            subtotal: 54.95,
            items: mockItems,
          }),
          { prompt_tokens: 1500, completion_tokens: 300 }
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,fakeImage1"]);

      expect(result.vendor).toBe("Restaurant Depot");
      expect(result.date).toBe("2026-04-24");
      expect(result.items).toHaveLength(2);
      expect(result.photoCount).toBe(1);
      expect(result.isPartial).toBe(false);
      expect(result.extractedTotal).toBe(54.95);
      expect(result.calculatedTotal).toBe(54.95);
      expect(result.discrepancy).toBe(0);

      // Verify all items have sourceImageIndex = 0
      result.items.forEach((item) => {
        expect(item.sourceImageIndex).toBe(0);
      });

      // Verify per-image results
      expect(result.perImageResults).toHaveLength(1);
      expect(result.perImageResults[0].imageIndex).toBe(0);
      expect(result.perImageResults[0].items).toHaveLength(2);
    });
  });

  describe("multiple images with deduplication", () => {
    it("deduplicates items that appear in overlapping photos", async () => {
      // Photo 1: Items A, B
      const photo1Items: ParsedReceiptItem[] = [
        { name: "Chicken Breast", quantity: 5, unit: "lb", unitPrice: 4.99, totalPrice: 24.95 },
        { name: "Olive Oil", quantity: 2, unit: "gal", unitPrice: 15.00, totalPrice: 30.00 },
      ];

      // Photo 2: Items B (duplicate), C
      const photo2Items: ParsedReceiptItem[] = [
        { name: "Olive Oil", quantity: 2, unit: "gal", unitPrice: 15.00, totalPrice: 30.00 }, // Duplicate
        { name: "Salt", quantity: 10, unit: "lb", unitPrice: 0.50, totalPrice: 5.00 },
      ];

      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({ vendor: "Restaurant Depot", date: "2026-04-24", items: photo1Items })
          )
        )
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({ vendor: null, date: null, subtotal: 59.95, items: photo2Items })
          )
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
      ]);

      // Should have 3 unique items (Olive Oil deduplicated)
      expect(result.items).toHaveLength(3);
      expect(result.items.map((i) => i.name)).toContain("Chicken Breast");
      expect(result.items.map((i) => i.name)).toContain("Olive Oil");
      expect(result.items.map((i) => i.name)).toContain("Salt");

      // Olive Oil should only appear once (from first image)
      const oliveOilItems = result.items.filter((i) => i.name === "Olive Oil");
      expect(oliveOilItems).toHaveLength(1);
      expect(oliveOilItems[0].sourceImageIndex).toBe(0);

      // Salt should be from second image
      const saltItem = result.items.find((i) => i.name === "Salt");
      expect(saltItem?.sourceImageIndex).toBe(1);
    });

    it("handles items with minor OCR variations in names", async () => {
      // Same item with slightly different casing/spacing
      const photo1Items: ParsedReceiptItem[] = [
        { name: "Chicken Breast", quantity: 5, unit: "lb", unitPrice: 4.99, totalPrice: 24.95 },
      ];
      const photo2Items: ParsedReceiptItem[] = [
        { name: "chicken breast", quantity: 5, unit: "lb", unitPrice: 4.99, totalPrice: 24.95 }, // lowercase
      ];

      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ vendor: "Sysco", items: photo1Items }))
        )
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ items: photo2Items }))
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
      ]);

      // Should deduplicate (normalized names match)
      expect(result.items).toHaveLength(1);
    });
  });

  describe("vendor/date extraction consistency", () => {
    it("uses vendor from first image that has it", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ vendor: null, date: null, items: [] }))
        )
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ vendor: "Restaurant Depot", date: "2026-04-24", items: [] }))
        )
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ vendor: "Different Vendor", date: null, items: [] }))
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
        "data:image/jpeg;base64,photo3",
      ]);

      // Should use "Restaurant Depot" from the first image that has a vendor
      expect(result.vendor).toBe("Restaurant Depot");
      expect(result.date).toBe("2026-04-24");
    });

    it("defaults to Unknown vendor when none found", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(createImageExtraction({ vendor: null, date: null, items: [] }))
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.vendor).toBe("Unknown");
    });
  });

  describe("per-image result tracking (sourceImageIndex)", () => {
    it("tracks which image each item came from", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({
              items: [{ name: "Item A", quantity: 1, unit: "each", unitPrice: 10.00, totalPrice: 10.00 }],
            })
          )
        )
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({
              items: [{ name: "Item B", quantity: 2, unit: "each", unitPrice: 5.00, totalPrice: 10.00 }],
            })
          )
        )
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({
              items: [{ name: "Item C", quantity: 3, unit: "each", unitPrice: 3.33, totalPrice: 10.00 }],
            })
          )
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
        "data:image/jpeg;base64,photo3",
      ]);

      expect(result.items).toHaveLength(3);

      const itemA = result.items.find((i) => i.name === "Item A");
      const itemB = result.items.find((i) => i.name === "Item B");
      const itemC = result.items.find((i) => i.name === "Item C");

      expect(itemA?.sourceImageIndex).toBe(0);
      expect(itemB?.sourceImageIndex).toBe(1);
      expect(itemC?.sourceImageIndex).toBe(2);
    });

    it("provides per-image breakdown in perImageResults", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({
              vendor: "Vendor A",
              date: "2026-01-01",
              subtotal: 100.00,
              items: [{ name: "Item 1", quantity: 1, unit: "each", unitPrice: 100.00, totalPrice: 100.00 }],
            }),
            { prompt_tokens: 1000, completion_tokens: 100 }
          )
        )
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({
              vendor: null,
              date: null,
              subtotal: 200.00,
              items: [{ name: "Item 2", quantity: 2, unit: "each", unitPrice: 50.00, totalPrice: 100.00 }],
            }),
            { prompt_tokens: 1200, completion_tokens: 150 }
          )
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
      ]);

      expect(result.perImageResults).toHaveLength(2);

      expect(result.perImageResults[0].imageIndex).toBe(0);
      expect(result.perImageResults[0].vendor).toBe("Vendor A");
      expect(result.perImageResults[0].date).toBe("2026-01-01");
      expect(result.perImageResults[0].subtotal).toBe(100.00);
      expect(result.perImageResults[0].items).toHaveLength(1);
      expect(result.perImageResults[0].tokensUsed).toBe(1100);

      expect(result.perImageResults[1].imageIndex).toBe(1);
      expect(result.perImageResults[1].vendor).toBeNull();
      expect(result.perImageResults[1].date).toBeNull();
      expect(result.perImageResults[1].subtotal).toBe(200.00);
      expect(result.perImageResults[1].items).toHaveLength(1);
      expect(result.perImageResults[1].tokensUsed).toBe(1350);
    });
  });

  describe("cost and token tracking", () => {
    it("aggregates tokens and cost across all images", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({ items: [] }),
            { prompt_tokens: 1000, completion_tokens: 200 }
          )
        )
        .mockResolvedValueOnce(
          createMockResponse(
            createImageExtraction({ items: [] }),
            { prompt_tokens: 1500, completion_tokens: 300 }
          )
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
      ]);

      // Total tokens: (1000 + 200) + (1500 + 300) = 3000
      expect(result.totalTokensUsed).toBe(3000);

      // Cost calculation: (input * 0.075 + output * 0.30) / 1_000_000
      // Image 1: (1000 * 0.075 + 200 * 0.30) / 1_000_000 = 0.000135
      // Image 2: (1500 * 0.075 + 300 * 0.30) / 1_000_000 = 0.0002025
      // Total: 0.0003375
      expect(result.totalCost).toBeCloseTo(0.0003375, 6);
    });

    it("tracks cost per image in perImageResults", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({ items: [] }),
          { prompt_tokens: 2000, completion_tokens: 400 }
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      // Cost: (2000 * 0.075 + 400 * 0.30) / 1_000_000 = 0.00027
      expect(result.perImageResults[0].cost).toBeCloseTo(0.00027, 6);
      expect(result.perImageResults[0].tokensUsed).toBe(2400);
    });
  });

  describe("isPartial detection", () => {
    it("sets isPartial=true when no total found", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            vendor: "Test Vendor",
            subtotal: null, // No total found
            items: [{ name: "Item", quantity: 1, unit: "each", unitPrice: 10.00, totalPrice: 10.00 }],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.isPartial).toBe(true);
      expect(result.extractedTotal).toBeNull();
    });

    it("sets isPartial=false when total is found", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            vendor: "Test Vendor",
            subtotal: 100.00,
            items: [{ name: "Item", quantity: 10, unit: "each", unitPrice: 10.00, totalPrice: 100.00 }],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.isPartial).toBe(false);
      expect(result.extractedTotal).toBe(100.00);
    });

    it("uses last image subtotal as extracted total", async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ subtotal: 50.00, items: [] }))
        )
        .mockResolvedValueOnce(
          createMockResponse(createImageExtraction({ subtotal: 150.00, items: [] })) // Last image has final total
        );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,photo1",
        "data:image/jpeg;base64,photo2",
      ]);

      expect(result.extractedTotal).toBe(150.00);
      expect(result.isPartial).toBe(false);
    });
  });

  describe("calculated total and discrepancy", () => {
    it("calculates total from items and computes discrepancy", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            subtotal: 100.00,
            items: [
              { name: "Item A", quantity: 2, unit: "each", unitPrice: 25.00, totalPrice: 50.00 },
              { name: "Item B", quantity: 1, unit: "each", unitPrice: 45.00, totalPrice: 45.00 },
            ],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.calculatedTotal).toBe(95.00);
      expect(result.extractedTotal).toBe(100.00);
      expect(result.discrepancy).toBe(5.00);
    });

    it("sets discrepancy to 0 when no extracted total", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            subtotal: null,
            items: [{ name: "Item", quantity: 1, unit: "each", unitPrice: 50.00, totalPrice: 50.00 }],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.calculatedTotal).toBe(50.00);
      expect(result.extractedTotal).toBeNull();
      expect(result.discrepancy).toBe(0);
    });
  });

  describe("item validation and math fixing", () => {
    it("filters out items with zero or negative prices", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            items: [
              { name: "Valid Item", quantity: 1, unit: "each", unitPrice: 10.00, totalPrice: 10.00 },
              { name: "Zero Price", quantity: 1, unit: "each", unitPrice: 0, totalPrice: 0 },
              { name: "Negative Price", quantity: 1, unit: "each", unitPrice: -5.00, totalPrice: -5.00 },
            ],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Valid Item");
    });

    it("fixes unit price when it does not match total price / quantity", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          createImageExtraction({
            items: [
              // unitPrice * quantity = 10 * 2 = 20, but totalPrice = 24.95
              { name: "Mismatched Item", quantity: 2, unit: "each", unitPrice: 10.00, totalPrice: 24.95 },
            ],
          })
        )
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });
      const result = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"]);

      expect(result.items).toHaveLength(1);
      // Unit price should be recalculated: 24.95 / 2 = 12.475
      expect(result.items[0].unitPrice).toBeCloseTo(12.475, 2);
      expect(result.items[0].totalPrice).toBe(24.95);
    });
  });

  describe("error handling", () => {
    it("throws error when no images provided", async () => {
      const mockFetch = vi.fn();
      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(ai.parseMultiPhotoReceiptTracked([])).rejects.toThrow("No images provided");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws error on API failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(
        ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"])
      ).rejects.toThrow("API request failed");
    });

    it("throws error on network failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(
        ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"])
      ).rejects.toThrow("Network error");
    });

    it("throws error on malformed JSON response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not valid json {{{" } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(
        ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"])
      ).rejects.toThrow();
    });

    it("throws error on rate limit (429)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(
        ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"])
      ).rejects.toThrow(/429/);
    });

    it("handles invalid API response structure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing choices array
          error: "Something went wrong",
        }),
      });

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      await expect(
        ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,photo1"])
      ).rejects.toThrow("Invalid API response structure");
    });
  });

  describe("photoCount", () => {
    it("correctly tracks the number of photos processed", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(createImageExtraction({ items: [] }))
      );

      const ai = createAIService({ apiKey: mockApiKey, fetchFn: mockFetch });

      const result1 = await ai.parseMultiPhotoReceiptTracked(["data:image/jpeg;base64,p1"]);
      expect(result1.photoCount).toBe(1);

      const result3 = await ai.parseMultiPhotoReceiptTracked([
        "data:image/jpeg;base64,p1",
        "data:image/jpeg;base64,p2",
        "data:image/jpeg;base64,p3",
      ]);
      expect(result3.photoCount).toBe(3);
    });
  });
});
