export type RestaurantType = 'fast_casual' | 'fine_dining' | 'bar_brewery' | 'cafe' | 'food_truck'

export interface SampleInventoryItem {
  id: number
  name: string
  unit: string
  quantity: number
  low_stock_threshold: number
  isLowStock: boolean
}

export interface SampleSalesData {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  marginPercent: number
  recentActivity: { name: string; quantity: number; revenue: number; time: string }[]
  date: string
}

export interface SampleVarianceData {
  unresolvedCount: number
}

export interface SampleDataSet {
  inventory: SampleInventoryItem[]
  sales: SampleSalesData
  variance: SampleVarianceData
}

const fastCasual: SampleDataSet = {
  inventory: [
    { id: 1, name: 'Ground Beef', unit: 'lb', quantity: 45, low_stock_threshold: 50, isLowStock: true },
    { id: 2, name: 'Burger Buns', unit: 'pcs', quantity: 120, low_stock_threshold: 100, isLowStock: false },
    { id: 3, name: 'French Fries', unit: 'lb', quantity: 80, low_stock_threshold: 40, isLowStock: false },
    { id: 4, name: 'Lettuce', unit: 'head', quantity: 8, low_stock_threshold: 15, isLowStock: true },
    { id: 5, name: 'Tomatoes', unit: 'lb', quantity: 25, low_stock_threshold: 20, isLowStock: false },
  ],
  sales: {
    totalRevenue: 2847,
    totalCost: 854,
    totalProfit: 1993,
    marginPercent: 70,
    recentActivity: [
      { name: 'Classic Burger', quantity: 12, revenue: 156, time: '2:30 PM' },
      { name: 'Chicken Sandwich', quantity: 8, revenue: 96, time: '2:15 PM' },
      { name: 'Loaded Fries', quantity: 6, revenue: 54, time: '1:45 PM' },
      { name: 'Double Burger', quantity: 4, revenue: 68, time: '1:20 PM' },
    ],
    date: new Date().toISOString().split('T')[0],
  },
  variance: { unresolvedCount: 2 },
}

const fineDining: SampleDataSet = {
  inventory: [
    { id: 1, name: 'Wagyu Ribeye', unit: 'lb', quantity: 12, low_stock_threshold: 15, isLowStock: true },
    { id: 2, name: 'Black Truffle', unit: 'oz', quantity: 6, low_stock_threshold: 4, isLowStock: false },
    { id: 3, name: 'Lobster Tail', unit: 'pcs', quantity: 18, low_stock_threshold: 20, isLowStock: true },
    { id: 4, name: 'Dom Pérignon', unit: 'btl', quantity: 8, low_stock_threshold: 6, isLowStock: false },
    { id: 5, name: 'Foie Gras', unit: 'lb', quantity: 4, low_stock_threshold: 3, isLowStock: false },
  ],
  sales: {
    totalRevenue: 8420,
    totalCost: 2948,
    totalProfit: 5472,
    marginPercent: 65,
    recentActivity: [
      { name: 'Wagyu Tasting', quantity: 2, revenue: 340, time: '8:45 PM' },
      { name: 'Lobster Risotto', quantity: 3, revenue: 195, time: '8:30 PM' },
      { name: 'Wine Pairing', quantity: 4, revenue: 280, time: '8:15 PM' },
      { name: 'Truffle Pasta', quantity: 2, revenue: 130, time: '7:50 PM' },
    ],
    date: new Date().toISOString().split('T')[0],
  },
  variance: { unresolvedCount: 1 },
}

const barBrewery: SampleDataSet = {
  inventory: [
    { id: 1, name: 'House IPA', unit: 'keg', quantity: 3, low_stock_threshold: 4, isLowStock: true },
    { id: 2, name: 'Vodka', unit: 'btl', quantity: 8, low_stock_threshold: 6, isLowStock: false },
    { id: 3, name: 'Whiskey Barrel Aged', unit: 'keg', quantity: 2, low_stock_threshold: 2, isLowStock: false },
    { id: 4, name: 'Lime Juice', unit: 'gal', quantity: 1.5, low_stock_threshold: 2, isLowStock: true },
    { id: 5, name: 'Simple Syrup', unit: 'gal', quantity: 3, low_stock_threshold: 2, isLowStock: false },
  ],
  sales: {
    totalRevenue: 4215,
    totalCost: 1054,
    totalProfit: 3161,
    marginPercent: 75,
    recentActivity: [
      { name: 'IPA Flight', quantity: 8, revenue: 96, time: '10:15 PM' },
      { name: 'Old Fashioned', quantity: 6, revenue: 90, time: '9:45 PM' },
      { name: 'Margarita Pitcher', quantity: 3, revenue: 75, time: '9:30 PM' },
      { name: 'House Lager', quantity: 15, revenue: 105, time: '9:00 PM' },
    ],
    date: new Date().toISOString().split('T')[0],
  },
  variance: { unresolvedCount: 3 },
}

const cafe: SampleDataSet = {
  inventory: [
    { id: 1, name: 'Espresso Beans', unit: 'lb', quantity: 8, low_stock_threshold: 10, isLowStock: true },
    { id: 2, name: 'Oat Milk', unit: 'gal', quantity: 6, low_stock_threshold: 4, isLowStock: false },
    { id: 3, name: 'Croissants', unit: 'pcs', quantity: 24, low_stock_threshold: 20, isLowStock: false },
    { id: 4, name: 'Vanilla Syrup', unit: 'btl', quantity: 3, low_stock_threshold: 4, isLowStock: true },
    { id: 5, name: 'Almond Milk', unit: 'gal', quantity: 4, low_stock_threshold: 3, isLowStock: false },
  ],
  sales: {
    totalRevenue: 1856,
    totalCost: 464,
    totalProfit: 1392,
    marginPercent: 75,
    recentActivity: [
      { name: 'Oat Latte', quantity: 18, revenue: 108, time: '11:30 AM' },
      { name: 'Almond Croissant', quantity: 12, revenue: 60, time: '11:15 AM' },
      { name: 'Cold Brew', quantity: 15, revenue: 82, time: '10:45 AM' },
      { name: 'Avocado Toast', quantity: 8, revenue: 104, time: '10:20 AM' },
    ],
    date: new Date().toISOString().split('T')[0],
  },
  variance: { unresolvedCount: 0 },
}

const foodTruck: SampleDataSet = {
  inventory: [
    { id: 1, name: 'Flour Tortillas', unit: 'pcs', quantity: 80, low_stock_threshold: 100, isLowStock: true },
    { id: 2, name: 'Carnitas', unit: 'lb', quantity: 15, low_stock_threshold: 10, isLowStock: false },
    { id: 3, name: 'Salsa Verde', unit: 'qt', quantity: 4, low_stock_threshold: 3, isLowStock: false },
    { id: 4, name: 'Cotija Cheese', unit: 'lb', quantity: 3, low_stock_threshold: 5, isLowStock: true },
    { id: 5, name: 'Cilantro', unit: 'bunch', quantity: 6, low_stock_threshold: 4, isLowStock: false },
  ],
  sales: {
    totalRevenue: 1420,
    totalCost: 355,
    totalProfit: 1065,
    marginPercent: 75,
    recentActivity: [
      { name: 'Street Tacos (3)', quantity: 22, revenue: 242, time: '1:30 PM' },
      { name: 'Burrito Bowl', quantity: 8, revenue: 104, time: '1:15 PM' },
      { name: 'Elote', quantity: 10, revenue: 60, time: '12:45 PM' },
      { name: 'Quesadilla', quantity: 6, revenue: 66, time: '12:20 PM' },
    ],
    date: new Date().toISOString().split('T')[0],
  },
  variance: { unresolvedCount: 1 },
}

export const sampleDataSets: Record<RestaurantType, SampleDataSet> = {
  fast_casual: fastCasual,
  fine_dining: fineDining,
  bar_brewery: barBrewery,
  cafe: cafe,
  food_truck: foodTruck,
}

export function getSampleData(type: RestaurantType): SampleDataSet {
  return sampleDataSets[type] || fastCasual
}
