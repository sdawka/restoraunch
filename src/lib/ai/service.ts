import { RECEIPT_PARSE_PROMPT, POS_PARSE_PROMPT, ITEM_MATCH_PROMPT, MULTI_PHOTO_RECEIPT_PROMPT } from "./prompts";

// Interfaces
export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedReceipt {
  vendor: string;
  date: string;
  total: number;
  items: ParsedReceiptItem[];
}

export interface MultiPhotoReceipt extends ParsedReceipt {
  isPartial: boolean;
  photoCount: number;
}

export interface ParsedSalesItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ParsedSales {
  date: string;
  items: ParsedSalesItem[];
  totalRevenue: number;
}

export interface ItemMatch {
  matchedId: number | null;
  confidence: number;
  reasoning: string;
}

export interface InventoryItemForMatch {
  id: number;
  name: string;
  unit: string;
}

export interface AIService {
  parseReceipt(imageDataUrl: string): Promise<ParsedReceipt>;
  parseMultiPhotoReceipt(imageUrls: string[]): Promise<MultiPhotoReceipt>;
  parsePOSScreen(imageDataUrl: string): Promise<ParsedSales>;
  matchInventoryItem(
    receiptItem: { name: string; unit: string },
    inventoryItems: InventoryItemForMatch[]
  ): Promise<ItemMatch>;
}

interface AIServiceConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";

// JSON Schemas for structured outputs (OpenRouter enforces these)
const RECEIPT_SCHEMA = {
  name: "parsed_receipt",
  strict: true,
  schema: {
    type: "object",
    properties: {
      vendor: { type: "string", description: "Supplier/vendor name" },
      date: { type: "string", description: "Receipt date in YYYY-MM-DD format" },
      total: { type: "number", description: "Total amount" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unitPrice: { type: "number" },
            totalPrice: { type: "number" },
          },
          required: ["name", "quantity", "unit", "unitPrice", "totalPrice"],
          additionalProperties: false,
        },
      },
    },
    required: ["vendor", "date", "total", "items"],
    additionalProperties: false,
  },
};

const SALES_SCHEMA = {
  name: "parsed_sales",
  strict: true,
  schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Sales date in YYYY-MM-DD format" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            revenue: { type: "number" },
          },
          required: ["name", "quantity", "revenue"],
          additionalProperties: false,
        },
      },
      totalRevenue: { type: "number" },
    },
    required: ["date", "items", "totalRevenue"],
    additionalProperties: false,
  },
};

const ITEM_MATCH_SCHEMA = {
  name: "item_match",
  strict: true,
  schema: {
    type: "object",
    properties: {
      matchedId: {
        type: ["integer", "null"],
        description: "Matched inventory item ID or null",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Match confidence 0-1",
      },
      reasoning: { type: "string", description: "Match explanation" },
    },
    required: ["matchedId", "confidence", "reasoning"],
    additionalProperties: false,
  },
};

const MULTI_PHOTO_RECEIPT_SCHEMA = {
  name: "multi_photo_parsed_receipt",
  strict: true,
  schema: {
    type: "object",
    properties: {
      vendor: { type: "string", description: "Supplier/vendor name" },
      date: { type: ["string", "null"], description: "Receipt date in YYYY-MM-DD format" },
      total: { type: ["number", "null"], description: "Total amount, null if not visible" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            unitPrice: { type: "number" },
            totalPrice: { type: "number" },
          },
          required: ["name", "quantity", "unit", "unitPrice", "totalPrice"],
          additionalProperties: false,
        },
      },
      isPartial: { type: "boolean", description: "True if receipt appears incomplete (no total)" },
    },
    required: ["vendor", "date", "total", "items", "isPartial"],
    additionalProperties: false,
  },
};

// Sanitize user-provided text to prevent prompt injection
function sanitizeForPrompt(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return json
    .replace(/<\/?[a-z_]+>/gi, '')
    .replace(/\b(ignore|disregard|forget|instead|override|system|instruction|prompt)\b/gi, '[$1]')
    .slice(0, 2000);
}

// Fallback validators for robustness (structured outputs should already be valid)
function validateReceipt(data: unknown): ParsedReceipt {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response: not an object');
  }
  const obj = data as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  return {
    vendor: typeof obj.vendor === 'string' ? obj.vendor : 'Unknown',
    date: typeof obj.date === 'string' ? obj.date : new Date().toISOString().slice(0, 10),
    total: typeof obj.total === 'number' ? obj.total : 0,
    items: items.map((item: unknown) => {
      const i = item as Record<string, unknown>;
      return {
        name: typeof i.name === 'string' ? i.name : 'Unknown item',
        quantity: typeof i.quantity === 'number' ? i.quantity : 1,
        unit: typeof i.unit === 'string' ? i.unit : 'each',
        unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : 0,
        totalPrice: typeof i.totalPrice === 'number' ? i.totalPrice : 0,
      };
    }),
  };
}

function validateSales(data: unknown): ParsedSales {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response: not an object');
  }
  const obj = data as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  return {
    date: typeof obj.date === 'string' ? obj.date : new Date().toISOString().slice(0, 10),
    totalRevenue: typeof obj.totalRevenue === 'number' ? obj.totalRevenue : 0,
    items: items.map((item: unknown) => {
      const i = item as Record<string, unknown>;
      return {
        name: typeof i.name === 'string' ? i.name : 'Unknown item',
        quantity: typeof i.quantity === 'number' ? i.quantity : 0,
        revenue: typeof i.revenue === 'number' ? i.revenue : 0,
      };
    }),
  };
}

function validateItemMatch(data: unknown): ItemMatch {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response: not an object');
  }
  const obj = data as Record<string, unknown>;
  return {
    matchedId: typeof obj.matchedId === 'number' ? obj.matchedId : null,
    confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
    reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : 'No reasoning provided',
  };
}

function validateMultiPhotoReceipt(data: unknown, photoCount: number): MultiPhotoReceipt {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid response: not an object');
  }
  const obj = data as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const total = typeof obj.total === 'number' ? obj.total : 0;
  return {
    vendor: typeof obj.vendor === 'string' ? obj.vendor : 'Unknown',
    date: typeof obj.date === 'string' ? obj.date : new Date().toISOString().slice(0, 10),
    total,
    items: items.map((item: unknown) => {
      const i = item as Record<string, unknown>;
      return {
        name: typeof i.name === 'string' ? i.name : 'Unknown item',
        quantity: typeof i.quantity === 'number' ? i.quantity : 1,
        unit: typeof i.unit === 'string' ? i.unit : 'each',
        unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : 0,
        totalPrice: typeof i.totalPrice === 'number' ? i.totalPrice : 0,
      };
    }),
    isPartial: typeof obj.isPartial === 'boolean' ? obj.isPartial : total === 0,
    photoCount,
  };
}

export function createAIService(config: AIServiceConfig): AIService {
  const { apiKey, fetchFn = fetch, model = DEFAULT_MODEL } = config;

  async function callAPI<T>(
    messages: unknown[],
    schema: { name: string; strict: boolean; schema: object }
  ): Promise<T> {
    const response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://restoraunch.app",
        "X-Title": "Restoraunch",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: schema,
        },
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // response.text() may not be available in all environments
      }
      throw new Error(`API request failed: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid API response structure");
    }

    // Structured outputs guarantee valid JSON matching schema
    return JSON.parse(data.choices[0].message.content);
  }

  return {
    async parseReceipt(imageDataUrl: string): Promise<ParsedReceipt> {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PARSE_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ];

      const result = await callAPI<unknown>(messages, RECEIPT_SCHEMA);
      return validateReceipt(result);
    },

    async parseMultiPhotoReceipt(imageUrls: string[]): Promise<MultiPhotoReceipt> {
      if (imageUrls.length === 0) {
        throw new Error('No images provided');
      }

      // For single image, use parseReceipt and convert to MultiPhotoReceipt
      if (imageUrls.length === 1) {
        const result = await this.parseReceipt(imageUrls[0]);
        return {
          ...result,
          isPartial: result.total === 0,
          photoCount: 1,
        };
      }

      // Build content array with prompt + all images
      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: MULTI_PHOTO_RECEIPT_PROMPT },
        ...imageUrls.map(url => ({
          type: "image_url",
          image_url: { url },
        })),
      ];

      const messages = [{ role: "user", content }];
      const result = await callAPI<unknown>(messages, MULTI_PHOTO_RECEIPT_SCHEMA);
      return validateMultiPhotoReceipt(result, imageUrls.length);
    },

    async parsePOSScreen(imageDataUrl: string): Promise<ParsedSales> {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: POS_PARSE_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ];

      const result = await callAPI<unknown>(messages, SALES_SCHEMA);
      return validateSales(result);
    },

    async matchInventoryItem(
      receiptItem: { name: string; unit: string },
      inventoryItems: InventoryItemForMatch[]
    ): Promise<ItemMatch> {
      const sanitizedReceiptItem = sanitizeForPrompt({
        name: String(receiptItem.name).slice(0, 200),
        unit: String(receiptItem.unit).slice(0, 20),
      });
      const sanitizedInventory = sanitizeForPrompt(
        inventoryItems.slice(0, 50).map(item => ({
          id: item.id,
          name: String(item.name).slice(0, 200),
          unit: String(item.unit).slice(0, 20),
        }))
      );

      const prompt = ITEM_MATCH_PROMPT
        .replace("{receiptItem}", sanitizedReceiptItem)
        .replace("{inventoryItems}", sanitizedInventory);

      const messages = [{ role: "user", content: prompt }];

      const result = await callAPI<unknown>(messages, ITEM_MATCH_SCHEMA);
      return validateItemMatch(result);
    },
  };
}
