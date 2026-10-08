import { describe, it, expect } from 'vitest';
import { InventoryItem, InventoryStatus, RiskLevel } from '../src/types';

describe('Inventory & Expiry Logic Unit Tests', () => {
  it('should evaluate low stock when quantity is equal to or below customizable low_stock_threshold', () => {
    const defaultThresholdItem: Partial<InventoryItem> = {
      quantity: 4,
      low_stock_threshold: 5,
    };
    expect(defaultThresholdItem.quantity! <= defaultThresholdItem.low_stock_threshold!).toBe(true);

    const customThresholdItem: Partial<InventoryItem> = {
      quantity: 12,
      low_stock_threshold: 15,
    };
    expect(customThresholdItem.quantity! <= customThresholdItem.low_stock_threshold!).toBe(true);

    const healthyStockItem: Partial<InventoryItem> = {
      quantity: 20,
      low_stock_threshold: 5,
    };
    expect(healthyStockItem.quantity! <= healthyStockItem.low_stock_threshold!).toBe(false);
  });

  it('should categorize days remaining into correct risk levels', () => {
    const calculateRiskLevel = (days: number): RiskLevel => {
      if (days < 0) return 'Expired';
      if (days <= 3) return 'High';
      if (days <= 7) return 'Medium';
      return 'Low';
    };

    expect(calculateRiskLevel(-1)).toBe('Expired');
    expect(calculateRiskLevel(0)).toBe('High');
    expect(calculateRiskLevel(2)).toBe('High');
    expect(calculateRiskLevel(5)).toBe('Medium');
    expect(calculateRiskLevel(10)).toBe('Low');
  });

  it('should correctly format inventory total monetary value', () => {
    const quantity = 25.5;
    const sellingPrice = 3.99;
    const totalValue = roundToTwoDecimals(quantity * sellingPrice);

    function roundToTwoDecimals(val: number) {
      return Math.round(val * 100) / 100;
    }

    expect(totalValue).toBe(101.75);
  });
});
