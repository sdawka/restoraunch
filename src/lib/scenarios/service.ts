export interface NewMenuItemInput {
  price: number;
  recipe: { inventoryItemId: number; quantityPerServing: number; costPerUnit: number }[];
  estimatedDailySales: number;
}

export interface NewMenuItemResult {
  ingredientCost: number;
  marginPerItem: number;
  marginPercent: number;
  dailyRevenue: number;
  dailyCost: number;
  dailyProfit: number;
  monthlyProfit: number;
}

export interface PriceChangeInput {
  currentPrice: number;
  newPrice: number;
  ingredientCost: number;
  averageDailySales: number;
}

export interface PriceChangeResult {
  currentMargin: number;
  newMargin: number;
  currentMarginPercent: number;
  newMarginPercent: number;
  dailyProfitChange: number;
  monthlyProfitChange: number;
}

export interface SupplierSwitchInput {
  inventoryItemId: number;
  currentCostPerUnit: number;
  newCostPerUnit: number;
  affectedMenuItems: {
    menuItemId: number;
    quantityUsed: number;
    dailySales: number;
    price: number;
  }[];
}

export interface SupplierSwitchResult {
  costDifference: number;
  dailySavings: number;
  monthlySavings: number;
  affectedItems: {
    menuItemId: number;
    oldIngredientCost: number;
    newIngredientCost: number;
    dailyProfitChange: number;
  }[];
}

export interface VolumeChangeInput {
  menuItemId: number;
  currentDailySales: number;
  newDailySales: number;
  price: number;
  ingredientCost: number;
}

export interface VolumeChangeResult {
  revenueChange: number;
  profitChange: number;
  inventoryImpact: number;
}

export interface ScenarioService {
  modelNewMenuItem(input: NewMenuItemInput): NewMenuItemResult;
  modelPriceChange(input: PriceChangeInput): PriceChangeResult;
  modelSupplierSwitch(input: SupplierSwitchInput): SupplierSwitchResult;
  modelVolumeChange(input: VolumeChangeInput): VolumeChangeResult;
}

export function createScenarioService(): ScenarioService {
  return {
    modelNewMenuItem(input): NewMenuItemResult {
      const ingredientCost = input.recipe.reduce(
        (sum, r) => sum + r.quantityPerServing * r.costPerUnit,
        0
      );
      const marginPerItem = input.price - ingredientCost;
      const marginPercent = input.price <= 0 ? 0 : (marginPerItem / input.price) * 100;
      const dailyRevenue = input.price * input.estimatedDailySales;
      const dailyCost = ingredientCost * input.estimatedDailySales;
      const dailyProfit = marginPerItem * input.estimatedDailySales;

      return {
        ingredientCost,
        marginPerItem,
        marginPercent,
        dailyRevenue,
        dailyCost,
        dailyProfit,
        monthlyProfit: dailyProfit * 30,
      };
    },

    modelPriceChange(input): PriceChangeResult {
      const currentMargin = input.currentPrice - input.ingredientCost;
      const newMargin = input.newPrice - input.ingredientCost;
      const dailyProfitChange = (newMargin - currentMargin) * input.averageDailySales;

      return {
        currentMargin,
        newMargin,
        currentMarginPercent: input.currentPrice <= 0 ? 0 : (currentMargin / input.currentPrice) * 100,
        newMarginPercent: input.newPrice <= 0 ? 0 : (newMargin / input.newPrice) * 100,
        dailyProfitChange,
        monthlyProfitChange: dailyProfitChange * 30,
      };
    },

    modelSupplierSwitch(input): SupplierSwitchResult {
      const costDifference = input.newCostPerUnit - input.currentCostPerUnit;
      let dailySavings = 0;
      const affectedItems = input.affectedMenuItems.map(item => {
        const oldIngredientCost = item.quantityUsed * input.currentCostPerUnit;
        const newIngredientCost = item.quantityUsed * input.newCostPerUnit;
        const dailyProfitChange = Math.round((oldIngredientCost - newIngredientCost) * item.dailySales * 1e10) / 1e10;
        dailySavings += dailyProfitChange;
        return {
          menuItemId: item.menuItemId,
          oldIngredientCost,
          newIngredientCost,
          dailyProfitChange,
        };
      });

      const roundedDailySavings = Math.round(dailySavings * 1e10) / 1e10;
      return {
        costDifference,
        dailySavings: roundedDailySavings,
        monthlySavings: Math.round(roundedDailySavings * 30 * 1e10) / 1e10,
        affectedItems,
      };
    },

    modelVolumeChange(input): VolumeChangeResult {
      const margin = input.price - input.ingredientCost;
      const volumeDelta = input.newDailySales - input.currentDailySales;
      return {
        revenueChange: input.price * volumeDelta,
        profitChange: margin * volumeDelta,
        inventoryImpact: volumeDelta,
      };
    },
  };
}
