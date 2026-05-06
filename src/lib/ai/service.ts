import { RECEIPT_PARSE_PROMPT, POS_PARSE_PROMPT, ITEM_MATCH_PROMPT } from "./prompts";

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
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-20250514";

export function createAIService(config: AIServiceConfig): AIService {
  const { apiKey, fetchFn = fetch, model = DEFAULT_MODEL } = config;

  async function callAPI(messages: unknown[]): Promise<string> {
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
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  function parseJSONResponse<T>(content: string): T {
    // Handle potential markdown code blocks
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    return JSON.parse(jsonStr.trim());
  }

  return {
    async parseReceipt(imageDataUrl: string): Promise<ParsedReceipt> {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PARSE_PROMPT },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ];

      const response = await callAPI(messages);
      return parseJSONResponse<ParsedReceipt>(response);
    },

    async parsePOSScreen(imageDataUrl: string): Promise<ParsedSales> {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: POS_PARSE_PROMPT },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ];

      const response = await callAPI(messages);
      return parseJSONResponse<ParsedSales>(response);
    },

    async matchInventoryItem(
      receiptItem: { name: string; unit: string },
      inventoryItems: InventoryItemForMatch[]
    ): Promise<ItemMatch> {
      const prompt = ITEM_MATCH_PROMPT
        .replace("{receiptItem}", JSON.stringify(receiptItem, null, 2))
        .replace("{inventoryItems}", JSON.stringify(inventoryItems, null, 2));

      const messages = [
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await callAPI(messages);
      return parseJSONResponse<ItemMatch>(response);
    },
  };
}
