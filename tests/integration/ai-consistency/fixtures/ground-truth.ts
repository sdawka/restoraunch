export interface ReceiptGroundTruth {
  imageFile: string;
  description: string;
  expected: {
    vendor: string;
    vendorAliases?: string[];
    date: string;
    total: number;
    itemCount: number;
  };
  tolerances?: {
    total?: number;
    itemCount?: number;
  };
  difficulty: "easy" | "medium" | "hard";
}

export const RECEIPT_FIXTURES: ReceiptGroundTruth[] = [
  {
    imageFile: "pink_peacock_cafe.jpg",
    description: "Modern café receipt, clear text, handwritten items",
    expected: {
      vendor: "Pink Peacock",
      vendorAliases: ["pink peacock", "Pink Peacock Cafe", "Pink Peacock Café"],
      date: "2021-11-01",
      total: 5.0,
      itemCount: 2,
    },
    tolerances: {
      total: 0.5,
      itemCount: 0,
    },
    difficulty: "easy",
  },
  {
    imageFile: "restaurant_bill_2013.jpg",
    description: "US restaurant receipt, phone photo, visible items and totals",
    expected: {
      vendor: "Pizza Chicago",
      vendorAliases: ["pizza chicago", "PIZZA CHICAGO"],
      date: "2013-07-08", // Note: AI may read as 2015 - the handwriting is ambiguous
      total: 151.91,
      itemCount: 12,
    },
    tolerances: {
      total: 20.0,
      itemCount: 3,
    },
    difficulty: "medium",
  },
  {
    imageFile: "mcdonalds_paris.jpg",
    description: "French McDonald's receipt, angled photo, partial occlusion",
    expected: {
      vendor: "McDonald's",
      vendorAliases: [
        "mcdonalds",
        "McDonalds",
        "McDonald's Carrousel du Louvre",
        "MCDONALDS",
      ],
      date: "2019-09-25",
      total: 9.4,
      itemCount: 4,
    },
    tolerances: {
      total: 1.0,
      itemCount: 2,
    },
    difficulty: "medium",
  },
  {
    imageFile: "manischewitz_1912.jpg",
    description: "Historical B2B invoice from 1912, aged paper, mixed typography",
    expected: {
      vendor: "B. Manischewitz",
      vendorAliases: [
        "Manischewitz",
        "B Manischewitz",
        "B. MANISCHEWITZ",
        "B. Manischewitz Fine Matzos Baker",
      ],
      date: "1912-03-08",
      total: 192.48,
      itemCount: 10,
    },
    tolerances: {
      total: 30.0,
      itemCount: 4,
    },
    difficulty: "hard",
  },
];
