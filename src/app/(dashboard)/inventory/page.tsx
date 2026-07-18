'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { purchaseService } from '@/services/purchaseService';
import { salesService } from '@/services/salesService';
import { InventoryItem, PurchaseEntry, SalesEntry } from '@/types';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Package, DollarSign, AlertTriangle, XCircle, 
  TrendingUp, ShoppingBag, ArrowRight, Sliders
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import Link from 'next/link';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function InventoryDashboard() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    todayPurchases: 0,
    todaySales: 0,
  });

  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [itemsData, purchasesData, salesData] = await Promise.all([
        inventoryService.getAll(centerId),
        purchaseService.getAll(centerId),
        salesService.getAll(centerId)
      ]);

      setItems(itemsData);
      setPurchases(purchasesData);
      setSales(salesData);

      // 1. Calculate items stock and values from variants
      let stockValue = 0;
      let lowCount = 0;
      let outCount = 0;
      const lowItems: any[] = [];
      const catMap: Record<string, number> = {};

      for (const item of itemsData) {
        const variants = await inventoryService.getVariants(centerId, item.id);
        
        let itemStock = 0;
        variants.forEach(v => {
          itemStock += v.currentStock || 0;
          stockValue += (v.currentStock || 0) * (v.purchasePrice || 0);
        });

        // Track Category distribution
        catMap[item.category] = (catMap[item.category] || 0) + itemStock;

        if (itemStock === 0) {
          outCount++;
        }
        if (itemStock > 0 && itemStock <= (item.minimumStock || 10)) {
          lowCount++;
          lowItems.push({
            id: item.id,
            name: item.name,
            sku: item.sku,
            currentStock: itemStock,
            minStock: item.minimumStock,
            unit: item.unit
          });
        }
      }

      // 2. Compute today's purchases/sales totals
      const todayStr = new Date().toDateString();

      const todayP = purchasesData
        .filter(p => {
          const d = (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any);
          return d.toDateString() === todayStr;
        })
        .reduce((sum, p) => sum + (p.grandTotal || 0), 0);

      const todayS = salesData
        .filter(s => {
          const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
          return d.toDateString() === todayStr;
        })
        .reduce((sum, s) => sum + (s.grandTotal || 0), 0);

      setStats({
        totalItems: itemsData.length,
        totalStockValue: stockValue,
        lowStockCount: lowCount,
        outOfStockCount: outCount,
        todayPurchases: todayP,
        todaySales: todayS,
      });

      setLowStockList(lowItems.slice(0, 5)); // top 5 low stock

      // 3. Category Pie Chart
      const categories = Object.keys(catMap).map(key => ({
        name: key,
        value: catMap[key]
      })).filter(c => c.value > 0);
      setCategoryData(categories);

      // 4. Weekly comparison chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d;
      }).reverse();

      const comparisonChart = last7Days.map(date => {
        const dateStr = date.toDateString();
        const label = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

        const pSum = purchasesData
          .filter(p => {
            const d = (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any);
            return d.toDateString() === dateStr;
          })
          .reduce((sum, p) => sum + (p.grandTotal || 0), 0);

        const sSum = salesData
          .filter(s => {
            const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
            return d.toDateString() === dateStr;
          })
          .reduce((sum, s) => sum + (s.grandTotal || 0), 0);

        return {
          name: label,
          Purchases: pSum,
          Sales: sSum
        };
      });

      setChartData(comparisonChart);

    } catch (err) {
      toast.error('Failed to load dashboard metrics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const cards = [
    { name: 'Total Items', value: stats.totalItems, icon: Package, color: '#FF6B00', bg: '#FFF0E6' },
    { name: 'Total Stock Value', value: `₹${stats.totalStockValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, icon: DollarSign, color: '#16A34A', bg: '#DCFCE7' },
    { name: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: '#D97706', bg: '#FEF3C7', border: stats.lowStockCount > 0 ? '1px solid #F59E0B' : undefined },
    { name: 'Out of Stock Items', value: stats.outOfStockCount, icon: XCircle, color: '#DC2626', bg: '#FEE2E2', border: stats.outOfStockCount > 0 ? '1px solid #EF4444' : undefined },
    { name: "Today's Purchases", value: `₹${stats.todayPurchases.toFixed(2)}`, icon: ShoppingBag, color: '#2563EB', bg: '#DBEAFE' },
    { name: "Today's Sales", value: `₹${stats.todaySales.toFixed(2)}`, icon: TrendingUp, color: '#8B5CF6', bg: '#EDE9FE' },
  ];

  const PIE_COLORS = ['#FF6B00', '#16A34A', '#2563EB', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#ECECEC] animate-pulse p-5">
              <div className="h-4 bg-[#F0F0F0] rounded w-2/3 mb-4" />
              <div className="h-8 bg-[#F0F0F0] rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-2xl bg-white border border-[#ECECEC] animate-pulse" />
          <div className="h-80 rounded-2xl bg-white border border-[#ECECEC] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              whileHover={{ y: -2 }}
              key={card.name}
              style={{ ...cardStyle, border: card.border || cardStyle.border }}
              className="p-5 flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span className="text-[12px] font-bold text-[#777777] leading-none">{card.name}</span>
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: card.bg, color: card.color }}
                >
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-[20px] sm:text-[22px] font-extrabold text-[#111111] mt-4 leading-none">{card.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* 2. Charts & Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Purchases vs Sales Chart */}
        <div style={cardStyle} className="p-6 lg:col-span-2 flex flex-col justify-between min-h-[360px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-bold text-[#111111]">Purchases vs Sales</h3>
              <p className="text-[11px] text-[#777777]">Activity trend over the last 7 days</p>
            </div>
            <div className="flex gap-4 text-[11px] font-bold">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-orange-500 block"></span> Sales</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500 block"></span> Purchases</div>
            </div>
          </div>
          <div className="flex-1 w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -15, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#CCCCCC" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#CCCCCC" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #ECECEC', borderRadius: '12px', fontSize: 12 }} 
                />
                <Area type="monotone" dataKey="Sales" stroke="#FF6B00" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                <Area type="monotone" dataKey="Purchases" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#purchasesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Category Distribution */}
        <div style={cardStyle} className="p-6 flex flex-col justify-between min-h-[360px]">
          <div>
            <h3 className="text-[15px] font-bold text-[#111111]">Stock Distribution</h3>
            <p className="text-[11px] text-[#777777]">Stock quantity by Category</p>
          </div>
          <div className="flex-1 flex items-center justify-center h-[200px]">
            {categoryData.length === 0 ? (
              <div className="text-center text-[12px] text-[#AAAAAA]">No stock data to display</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} units`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold justify-center">
            {categoryData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full block" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                <span className="text-[#555] truncate max-w-[80px]">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 3. Low Stock Alert List & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Low Stock Alerts */}
        <div style={cardStyle} className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-[#111111]">Low Stock Alert</h3>
              <p className="text-[11px] text-orange-600 font-semibold">Items below minimum stock threshold</p>
            </div>
            <Link href="/inventory/reports?tab=low-stock" className="text-[12px] text-[#FF6B00] font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                  <th className="pb-2">Item Name</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Available</th>
                  <th className="pb-2 text-right">Min Stock</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#AAAAAA] text-[12px]">
                      🎉 All items are healthy. No low stock alerts!
                    </td>
                  </tr>
                ) : (
                  lowStockList.map(item => (
                    <tr key={item.id} className="border-b border-[#F7F7F7] last:border-none">
                      <td className="py-2.5 font-bold text-[#111111]">{item.name}</td>
                      <td className="py-2.5 text-[#777777] font-mono text-[11px]">{item.sku}</td>
                      <td className="py-2.5 text-right font-extrabold text-red-500">{item.currentStock} {item.unit}</td>
                      <td className="py-2.5 text-right text-[#555]">{item.minStock} {item.unit}</td>
                      <td className="py-2.5 text-center">
                        <span className="text-[9px] font-extrabold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-lg uppercase">
                          Low Stock
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Widget */}
        <div style={cardStyle} className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-[#111111]">Quick Transactions</h3>
            <p className="text-[11px] text-[#777777]">Direct operations shortcuts</p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 mt-4">
            <Link href="/inventory/purchases" className="w-full py-3 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-xl text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2">
              <ShoppingBag size={15} /> Record New Purchase
            </Link>
            <Link href="/inventory/sales" className="w-full py-3 bg-[#111111] hover:bg-black text-white rounded-xl text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2">
              <TrendingUp size={15} /> Record New Sale
            </Link>
            <Link href="/inventory/adjustments" className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2">
              <Sliders size={15} /> Stock Correction
            </Link>
          </div>
          <div className="mt-4 border-t border-[#ECECEC] pt-4 text-center text-[10px] text-[#999999] leading-tight">
            Inventory is configured to run fully offline. Offline entries will queue and sync on network restoration automatically.
          </div>
        </div>

      </div>

    </div>
  );
}
