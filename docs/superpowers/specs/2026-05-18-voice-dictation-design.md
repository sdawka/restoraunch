# Voice Dictation for Receipt Entry

## Context

Users currently add receipt items by taking photos and running OCR. This works well for printed receipts but can be tedious for handwritten receipts, damaged receipts, or when the user just wants to quickly log a few items. Adding a voice dictation mode gives users a faster alternative — speak items one by one in natural language.

## Overview

Add "Speak Items" as an alternative to "Scan Receipt" on the ReceiptScanner landing screen. Users dictate items one at a time using natural language (e.g., "12 pounds of tomatoes for $24"), confirm each parsed result with touch-friendly combo lock inputs, then update inventory when done.

## User Flow

### Entry Point
- Card selection landing: two large cards — "📷 Scan Receipt" and "🎤 Speak Items"
- User commits to a mode before starting
- Each mode has its dedicated UI flow

### Voice Dictation Flow
1. **Ready** — Big mic button with example phrase ("Speak naturally: 12 pounds of tomatoes for $24")
2. **Listening** — Red pulsing mic, live transcript preview, tap to stop
3. **Confirming** — Parsed result card with:
   - Item name (with edit button and inventory match indicator)
   - Quantity with combo lock digit rollers + unit dropdown
   - Price with combo lock digits including cents ($24.00)
   - Re-speak button and Add Item button
4. **List building** — Items accumulate with running total, smaller mic for "add another"
5. **Done** — Tap "Done — Update Inventory" to confirm all items

### Corrections
- **Re-speak**: Tap mic icon on confirm screen to dictate again
- **Inline edit**: Tap edit button on item name, or drag combo lock digits for quantity/price
- **Both available**: User picks whatever's faster for the situation

## Architecture

### Hybrid STT Approach
```
User speaks → Web Speech API (browser-native, free)
           → Raw transcript text
           → Gemini 3.1 Flash Lite (via OpenRouter)
           → Parsed {name, quantity, unit, price}
           → matchInventoryItem() (existing)
           → Confirm screen
```

**Why hybrid:**
- Web Speech API is free, fast, no API cost, works on mobile
- Gemini 3.1 Flash Lite is already integrated for OCR — reuse same model
- Parsing natural language ("twelve pounds" → 12 lb) is where AI adds value

### Components

| Component | Purpose |
|-----------|---------|
| `VoiceDictation.vue` | New. Voice input mode UI — mic button, listening state, confirm screen |
| `ComboLockInput.vue` | New. Reusable digit roller with drag/swipe. Used for quantity and price |
| `ReceiptScanner.vue` | Modified. Add mode selection landing, integrate voice mode, share item list |
| `/api/voice/parse.ts` | New. Takes raw transcript, returns parsed item via Gemini + inventory match |

### State Machine

```
ready ──tap mic──► listening ──stop──► parsing
  ▲                    │                  │
  │                    │ cancel           ▼
  │                    ▼              confirming
  │                  ready                │
  │                                       ├── re-speak → listening
  │                                       │
  └────────── done ◄── add item ◄─────────┘
               │
               ▼
         reviewing (shared with photo mode)
               │
               ▼
           confirmed
```

### API Endpoint

**POST `/api/voice/parse`**

Request:
```json
{
  "transcript": "twelve pounds of tomatoes for twenty four dollars"
}
```

Response:
```json
{
  "name": "Tomatoes",
  "quantity": 12,
  "unit": "lb",
  "price": 24.00,
  "matchedInventoryItemId": 42,
  "matchConfidence": 0.92,
  "matchReason": "Exact match: Roma Tomatoes"
}
```

Uses existing `matchInventoryItem()` function from OCR flow.

## ComboLockInput Component

Touch-friendly digit roller for precise number input without keyboard.

**Props:**
- `value: number` — current value
- `digits: number` — number of digit positions (e.g., 2 for quantity, 4 for price with cents)
- `min/max: number` — value bounds
- `step: number` — increment per drag unit (default 1)

**Behavior:**
- Drag up/down on individual digits to increment/decrement
- Visual: digits in rounded boxes, subtle shadow on active digit
- Haptic feedback on value change (if available)
- For price: separate dollars and cents sections with decimal point between

## Error Handling

| Scenario | Handling |
|----------|----------|
| Web Speech not supported | Show message: "Voice not supported in this browser. Try Chrome or Safari." Photo mode remains available. |
| Mic permission denied | Friendly prompt with link to browser settings |
| No speech detected (5s silence) | Auto-stop, show "Didn't catch that — tap to try again" |
| Gemini parsing fails | Show raw transcript with manual entry fields |
| Inventory match fails | Show item with "No match found" — user can proceed or edit |
| Network error | Toast notification, preserve transcript, offer retry |

**Resilience principle:** Never lose user input. If parsing fails, fall back to showing what we heard.

## Testing

| Layer | Approach |
|-------|----------|
| Component | ComboLockInput drag behavior, VoiceDictation state transitions |
| API | `/api/voice/parse.ts` — mock Gemini responses, edge cases |
| Integration | Mock Web Speech API, verify transcript → item flow |
| Manual QA | Real devices (iOS Safari, Android Chrome) for mic permissions |

## Verification Checklist

1. Land on mode selection, tap "Speak Items"
2. Tap mic, speak "12 pounds of tomatoes for $24"
3. See parsed result: Tomatoes, 12 lb, $24.00
4. Drag cents to .50, tap Add
5. See item in list with $24.50
6. Tap mic, add another item
7. Tap "Done — Update Inventory"
8. Verify inventory updated correctly

## Files to Modify/Create

**New files:**
- `src/components/VoiceDictation.vue`
- `src/components/ComboLockInput.vue`
- `src/pages/api/voice/parse.ts`
- `src/lib/ai/prompts.ts` (add voice parsing prompt)

**Modified files:**
- `src/components/ReceiptScanner.vue` — add mode selection, integrate voice flow
