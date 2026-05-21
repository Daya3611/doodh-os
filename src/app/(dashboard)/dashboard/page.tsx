'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { collectionService } from '@/services/collectionService';
import { farmerService } from '@/services/farmerService';
import { paymentService } from '@/services/paymentService';
import { Collection } from '@/types';
import { motion } from 'framer-motion';
import { Droplets, TrendingUp, Users, Wallet, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  const [isLoading, setIsLoading] = useState(true);
  
  // Stats
  const [todayLiters, setTodayLiters] = useState(0);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingDues, setPendingDues] = useState(0);
  
  // Charts
  const [weeklyData, setWeeklyData] = useState<{name: string, liters: number, amount: number}[]>([]);
  const [animalData, setAnimalData] = useState<{name: string, cow: number, buffalo: number}[]>([]);
  
  // Recent
  const [recentCols, setRecentCols] = useState<Collection[]>([]);

  useEffect(() => {
    if (!centerId) return;

    const loadData = async () => {
      try {
        const [collections, farmers, payments] = await Promise.all([
          collectionService.getAll(centerId),
          farmerService.getAll(centerId),
          paymentService.getAll(centerId)
        ]);

        const today = new Date();

        // Total farmers
        setTotalFarmers(farmers.length);

        // Today's collections
        const todaysCols = collections.filter(c => {
          if (!c.createdAt) return false;
          const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
          return isSameDay(d, today);
        });

        setTodayLiters(todaysCols.reduce((sum, c) => sum + c.liters, 0));
        setTodayRevenue(todaysCols.reduce((sum, c) => sum + c.totalAmount, 0));

        // Pending Dues (Total Earned - Total Paid)
        const totalEarned = collections.reduce((sum, c) => sum + c.totalAmount, 0);
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        setPendingDues(totalEarned - totalPaid);

        // Recent Collections (Top 5)
        setRecentCols(collections.slice(0, 5));

        // Prepare Weekly Data (last 7 days)
        const days = Array.from({length: 7}).map((_, i) => subDays(today, 6 - i));
        
        const wData = days.map(d => {
          const colsForDay = collections.filter(c => {
            if (!c.createdAt) return false;
            const cd = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
            return isSameDay(cd, d);
          });
          return {
            name: format(d, 'EEE'),
            liters: colsForDay.reduce((s, c) => s + c.liters, 0),
            amount: colsForDay.reduce((s, c) => s + c.totalAmount, 0),
          };
        });
        setWeeklyData(wData);

        const aData = days.map(d => {
          const colsForDay = collections.filter(c => {
            if (!c.createdAt) return false;
            const cd = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
            return isSameDay(cd, d);
          });
          return {
            name: format(d, 'EEE'),
            cow: colsForDay.filter(c => c.animalType === 'cow').reduce((s, c) => s + c.liters, 0),
            buffalo: colsForDay.filter(c => c.animalType === 'buffalo').reduce((s, c) => s + c.liters, 0),
          };
        });
        setAnimalData(aData);

      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [centerId]);

  const summaryCards = [
    { title: "Today's Collection", value: `${todayLiters.toFixed(1)} L`, sub: 'Liters collected today', icon: Droplets, color: '#FF6B00', bg: '#FFF3E8' },
    { title: 'Total Farmers', value: totalFarmers.toString(), sub: 'Registered active farmers', icon: Users, color: '#22C55E', bg: '#DCFCE7' },
    { title: 'Revenue Today', value: `₹${todayRevenue.toFixed(0)}`, sub: 'Total payout today', icon: TrendingUp, color: '#3B82F6', bg: '#DBEAFE' },
    { title: 'Pending Dues', value: `₹${pendingDues.toFixed(0)}`, sub: 'Total pending balance', icon: Wallet, color: '#EF4444', bg: '#FEE2E2' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#777]">
        <Activity className="animate-pulse" size={32} style={{ color: '#FF6B00' }} />
        <span className="text-[14px] font-medium">Loading Dashboard Data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-2">
        <h2 className="text-[28px] font-bold text-[#111111]">Hello, {firstName} 👋</h2>
        <p className="text-[14px] text-[#777777] mt-1">Control your milk collections, income and farmer records.</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.3 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="!p-6" style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <div className="text-[28px] font-bold text-[#111111] leading-none mb-1">{card.value}</div>
              <div className="text-[12px] text-[#777777] mt-2">{card.title}</div>
              <div className="text-[11px] text-[#AAAAAA] mt-0.5">{card.sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-7 gap-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.3 }}
          className="xl:col-span-4" style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[16px] font-semibold text-[#111111]">Collection Overview</div>
              <div className="text-[12px] text-[#777777] mt-0.5">Weekly liters collected</div>
            </div>
            <div className="text-[12px] font-medium px-3 py-1.5 rounded-lg" style={{ background: '#F5F5F5', color: '#555' }}>Past 7 Days</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#AAAAAA', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#AAAAAA', fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #ECECEC', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '13px' }} labelStyle={{ color: '#111111', fontWeight: 600 }} />
              <Area type="monotone" dataKey="liters" name="Liters" stroke="#FF6B00" strokeWidth={2.5} fill="url(#orangeGrad)" dot={false} activeDot={{ r: 5, fill: '#FF6B00', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.3 }}
          className="xl:col-span-3" style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="text-[16px] font-semibold text-[#111111]">Recent Collections</div>
            <a href="/collections" className="text-[12px] font-medium" style={{ color: '#FF6B00' }}>See all</a>
          </div>
          <div className="space-y-1">
            {recentCols.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AAAAAA]">No entries yet</div>
            ) : (
              recentCols.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#FAFAFA] transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: item.animalType === 'cow' ? '#DBEAFE' : '#EDE9FE', color: item.animalType === 'cow' ? '#2563EB' : '#7C3AED' }}>
                    {item.farmerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#111111] truncate">{item.farmerName}</div>
                    <div className="text-[11px] text-[#999999] capitalize">{item.animalType} • {item.farmerId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-[#111111]">₹{item.totalAmount.toFixed(0)}</div>
                    <div className="text-[11px] text-[#AAAAAA]">{item.liters.toFixed(1)} L</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.3 }}
        style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[16px] font-semibold text-[#111111]">Animal Distribution</div>
            <div className="text-[12px] text-[#777777] mt-0.5">Cow vs Buffalo weekly split</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF6B00' }} /><span className="text-[12px] text-[#777777]">Cow</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFBF86' }} /><span className="text-[12px] text-[#777777]">Buffalo</span></div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={animalData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#AAAAAA', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#AAAAAA', fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #ECECEC', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '13px' }} />
            <Bar dataKey="cow" name="Cow (L)" fill="#FF6B00" radius={[6, 6, 0, 0]} />
            <Bar dataKey="buffalo" name="Buffalo (L)" fill="#FFBF86" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
