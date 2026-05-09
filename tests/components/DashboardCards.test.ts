import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DashboardCards from '../../src/components/DashboardCards.vue';

// Mock fetch globally
const mockFetch = vi.fn();

describe('DashboardCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockResponses(overrides: {
    inventory?: object[];
    variance?: object;
    sales?: object;
  } = {}) {
    const inventory = overrides.inventory ?? [
      { id: 1, name: 'Tomatoes', unit: 'lb', quantity: 5, low_stock_threshold: 10, isLowStock: true },
      { id: 2, name: 'Onions', unit: 'lb', quantity: 50, low_stock_threshold: 10, isLowStock: false },
    ];
    const variance = overrides.variance ?? { unresolvedCount: 3 };
    const sales = overrides.sales ?? {
      totalRevenue: 1500,
      totalCost: 600,
      totalProfit: 900,
      marginPercent: 60,
      recentActivity: [
        { name: 'Margherita Pizza', quantity: 5, revenue: 75, time: '10:30 AM' },
        { name: 'Caesar Salad', quantity: 3, revenue: 36, time: '10:15 AM' },
      ],
      date: '2024-03-15',
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/inventory')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(inventory) });
      }
      if (url.includes('/api/variance/calculate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(variance) });
      }
      if (url.includes('/api/sales/today')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(sales) });
      }
      return Promise.resolve({ ok: false });
    });
  }

  describe('loading state', () => {
    it('shows loading state initially', () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      expect(wrapper.find('.loading-grid').exists()).toBe(true);
      expect(wrapper.findAll('.loading-card').length).toBe(4);
    });

    it('shows loading shimmer animation', () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      expect(wrapper.find('.loading-shimmer').exists()).toBe(true);
    });
  });

  describe('renders metric cards', () => {
    it('renders all four metric cards after loading', async () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const metricCards = wrapper.findAll('.metric-card');
      expect(metricCards.length).toBe(4);
    });

    it('renders Today\'s Haul card', async () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const labels = wrapper.findAll('.metric-label');
      expect(labels.some((label) => label.text() === "Today's Haul")).toBe(true);
    });

    it('renders Total Cost card', async () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const labels = wrapper.findAll('.metric-label');
      expect(labels.some((label) => label.text() === 'Total Cost')).toBe(true);
    });

    it('renders What You\'re Making card', async () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const labels = wrapper.findAll('.metric-label');
      expect(labels.some((label) => label.text() === "What You're Making")).toBe(true);
    });

    it('renders Margin card', async () => {
      createMockResponses();
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const labels = wrapper.findAll('.metric-label');
      expect(labels.some((label) => label.text() === 'Margin')).toBe(true);
    });
  });

  describe('displays correct metric values', () => {
    it('displays formatted sales value', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const metricValues = wrapper.findAll('.metric-value');
      expect(metricValues.some((v) => v.text().includes('$1,500'))).toBe(true);
    });

    it('displays formatted cost value', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const metricValues = wrapper.findAll('.metric-value');
      expect(metricValues.some((v) => v.text().includes('$600'))).toBe(true);
    });

    it('displays formatted profit value', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const metricValues = wrapper.findAll('.metric-value');
      expect(metricValues.some((v) => v.text().includes('$900'))).toBe(true);
    });

    it('displays margin percentage', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      // Margin is shown in .gauge-value element, not .metric-value
      expect(wrapper.find('.gauge-value').text()).toBe('60.0%');
    });

    it('applies success color for high margin', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 65,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const marginValue = wrapper.find('.gauge-value');
      expect(marginValue.classes()).toContain('text-accent-success');
    });

    it('applies warning color for low margin', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1000,
          totalCost: 700,
          totalProfit: 300,
          marginPercent: 30,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const marginValue = wrapper.find('.gauge-value');
      expect(marginValue.classes()).toContain('text-accent-warning');
    });
  });

  describe('handles empty data gracefully', () => {
    it('handles empty inventory response', async () => {
      createMockResponses({ inventory: [] });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.find('.alerts-empty').exists()).toBe(true);
    });

    it('handles zero sales data', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          marginPercent: 0,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const metricValues = wrapper.findAll('.metric-value');
      expect(metricValues.some((v) => v.text().includes('$0'))).toBe(true);
    });

    it('handles empty recent activity', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.find('.activity-empty').exists()).toBe(true);
      expect(wrapper.text()).toContain('No recent sales activity');
    });

    it('shows pantry loaded message when no low stock items', async () => {
      createMockResponses({
        inventory: [
          { id: 1, name: 'Tomatoes', unit: 'lb', quantity: 50, low_stock_threshold: 10, isLowStock: false },
        ],
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain("Pantry's loaded");
    });

    it('shows smooth sailing message when no anomalies', async () => {
      createMockResponses({ variance: { unresolvedCount: 0 } });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain('Smooth sailing');
    });
  });

  describe('error handling', () => {
    it('shows error state when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.find('.error-card').exists()).toBe(true);
      expect(wrapper.text()).toContain('Failed to load dashboard data');
    });

    it('shows retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const retryButton = wrapper.find('.error-card button');
      expect(retryButton.exists()).toBe(true);
      expect(retryButton.text()).toContain('Try Again');
    });

    it('retries fetch when retry button is clicked', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const wrapper = mount(DashboardCards);

      await flushPromises();

      // Setup successful response for retry
      createMockResponses();

      const retryButton = wrapper.find('.error-card button');
      await retryButton.trigger('click');

      await flushPromises();

      // Should have called fetch again (3 initial + 3 retry = 6)
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('handles partial API failures gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/inventory')) {
          return Promise.resolve({ ok: false });
        }
        if (url.includes('/api/variance/calculate')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ unresolvedCount: 0 }) });
        }
        if (url.includes('/api/sales/today')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                totalRevenue: 100,
                totalCost: 50,
                totalProfit: 50,
                marginPercent: 50,
                recentActivity: [],
                date: '2024-03-15',
              }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const wrapper = mount(DashboardCards);

      await flushPromises();

      // Should still render dashboard with available data
      expect(wrapper.find('.dashboard-content').exists()).toBe(true);
      expect(wrapper.findAll('.metric-card').length).toBe(4);
    });
  });

  describe('alerts section', () => {
    it('displays low stock items', async () => {
      createMockResponses({
        inventory: [
          { id: 1, name: 'Tomatoes', unit: 'lb', quantity: 5, low_stock_threshold: 10, isLowStock: true },
          { id: 2, name: 'Onions', unit: 'lb', quantity: 3, low_stock_threshold: 10, isLowStock: true },
        ],
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain('Tomatoes');
      expect(wrapper.text()).toContain('5 lb');
    });

    it('shows correct low stock count', async () => {
      createMockResponses({
        inventory: [
          { id: 1, name: 'Tomatoes', unit: 'lb', quantity: 5, low_stock_threshold: 10, isLowStock: true },
          { id: 2, name: 'Onions', unit: 'lb', quantity: 3, low_stock_threshold: 10, isLowStock: true },
        ],
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const warningCount = wrapper.find('.warning-count');
      expect(warningCount.text()).toBe('2');
    });

    it('shows "+X more" link when more than 3 low stock items', async () => {
      createMockResponses({
        inventory: [
          { id: 1, name: 'Tomatoes', unit: 'lb', quantity: 5, low_stock_threshold: 10, isLowStock: true },
          { id: 2, name: 'Onions', unit: 'lb', quantity: 3, low_stock_threshold: 10, isLowStock: true },
          { id: 3, name: 'Peppers', unit: 'lb', quantity: 2, low_stock_threshold: 10, isLowStock: true },
          { id: 4, name: 'Lettuce', unit: 'head', quantity: 1, low_stock_threshold: 5, isLowStock: true },
        ],
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain('+1 more');
    });

    it('shows anomaly count', async () => {
      createMockResponses({ variance: { unresolvedCount: 5 } });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      const errorCount = wrapper.find('.error-count');
      expect(errorCount.text()).toBe('5');
    });

    it('shows review issues button when anomalies exist', async () => {
      createMockResponses({ variance: { unresolvedCount: 3 } });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.find('.alerts-action').exists()).toBe(true);
      expect(wrapper.text()).toContain('Review Issues');
    });
  });

  describe('recent activity section', () => {
    it('displays recent activity items', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 1500,
          totalCost: 600,
          totalProfit: 900,
          marginPercent: 60,
          recentActivity: [
            { name: 'Margherita Pizza', quantity: 5, revenue: 75, time: '10:30 AM' },
            { name: 'Caesar Salad', quantity: 3, revenue: 36, time: '10:15 AM' },
          ],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain('Margherita Pizza');
      expect(wrapper.text()).toContain('x5');
      expect(wrapper.text()).toContain('10:30 AM');
    });

    it('shows Import Sales button when no activity', async () => {
      createMockResponses({
        sales: {
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          marginPercent: 0,
          recentActivity: [],
          date: '2024-03-15',
        },
      });
      const wrapper = mount(DashboardCards);

      await flushPromises();

      expect(wrapper.text()).toContain('Import Sales');
    });
  });
});
