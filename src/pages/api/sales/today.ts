import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { createSalesService } from '../../../lib/sales/service';
import { createMenuService } from '../../../lib/menu/service';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = env.DB;
  const salesService = createSalesService(db);
  const menuService = createMenuService(db);

  const today = new Date().toISOString().split('T')[0];

  const sales = await salesService.getSalesWithProfit(menuService, today, today);

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalCost = sales.reduce((sum, s) => sum + s.totalCost, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.totalProfit, 0);
  const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const recentActivity = sales.slice(0, 5).map((s) => ({
    name: s.menuItemName,
    quantity: s.quantity,
    revenue: s.totalRevenue,
    time: 'Today',
  }));

  return Response.json({
    totalRevenue,
    totalCost,
    totalProfit,
    marginPercent,
    recentActivity,
    date: today,
  });
};
