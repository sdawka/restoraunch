export const RECEIPT_PARSE_PROMPT = `You are analyzing a receipt image from a restaurant supplier or vendor.
Extract the following information and return it as valid JSON:

{
  "vendor": "string - the supplier/vendor name",
  "date": "string - the receipt date in YYYY-MM-DD format",
  "total": "number - the total amount",
  "items": [
    {
      "name": "string - item name",
      "quantity": "number - quantity purchased",
      "unit": "string - unit of measure (lb, oz, gal, each, case, etc.)",
      "unitPrice": "number - price per unit",
      "totalPrice": "number - total price for this line item"
    }
  ]
}

Important:
- Return ONLY the JSON object, no markdown formatting or explanation
- Convert all currency to numbers without $ symbols
- Standardize units (e.g., "pounds" -> "lb", "gallons" -> "gal")
- If a field cannot be determined, use null
- Parse handwritten receipts as best you can`;

export const POS_PARSE_PROMPT = `You are analyzing a screenshot from a restaurant POS (Point of Sale) system.
Extract the sales data and return it as valid JSON:

{
  "date": "string - the sales date in YYYY-MM-DD format",
  "items": [
    {
      "name": "string - menu item name",
      "quantity": "number - number of items sold",
      "revenue": "number - total revenue for this item"
    }
  ],
  "totalRevenue": "number - total revenue for the period"
}

Important:
- Return ONLY the JSON object, no markdown formatting or explanation
- Convert all currency to numbers without $ symbols
- Match menu item names exactly as displayed
- If the screenshot shows multiple days, use the most recent date
- Aggregate items if they appear multiple times`;

export const ITEM_MATCH_PROMPT = `You are matching a receipt line item to existing inventory items.
Given a receipt item and a list of inventory items, determine the best match.

Receipt item to match:
{receiptItem}

Available inventory items:
{inventoryItems}

Return your answer as valid JSON:
{
  "matchedId": "number or null - the id of the best matching inventory item, or null if no good match",
  "confidence": "number between 0 and 1 - how confident you are in the match",
  "reasoning": "string - brief explanation of why this match was chosen or why no match was found"
}

Matching guidelines:
- Consider similar names (e.g., "Chicken Breast" matches "chicken breast boneless")
- Consider compatible units (e.g., lb and oz are both weights)
- If confidence is below 0.6, set matchedId to null
- Return ONLY the JSON object, no markdown formatting`;
