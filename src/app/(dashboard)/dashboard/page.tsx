'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { collectionService } from '@/services/collectionService';
import { farmerService } from '@/services/farmerService';
import { paymentService } from '@/services/paymentService';
import { ledgerService } from '@/services/ledgerService';
import { Collection, LedgerEntry, Farmer } from '@/types';
import { calculateFarmerBalance } from '@/lib/balance';
import { motion } from 'framer-motion';
import { Droplets, TrendingUp, Users, Wallet, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { format, subDays, isSameDay, startOfDay, endOfDay, differenceInDays, eachDayOfInterval } from 'date-fns';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  const [isLoading, setIsLoading] = useState(true);

  // Stats
  // const [isLoading, setIsLoading] = useState(true);

  // Raw Data States
  const [rawCollections, setRawCollections] = useState<Collection[]>([]);
  const [rawFarmers, setRawFarmers] = useState<Farmer[]>([]);
  const [rawLedgers, setRawLedgers] = useState<LedgerEntry[]>([]);

  // Filter States
  const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'fy' | 'all' | 'custom'>('week');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Stats
  const [todayLiters, setTodayLiters] = useState(0);
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);

  // Charts
  const [weeklyData, setWeeklyData] = useState<{ name: string, liters: number, amount: number }[]>([]);
  const [animalData, setAnimalData] = useState<{ name: string, cow: number, buffalo: number }[]>([]);

  // Recent
  const [recentCols, setRecentCols] = useState<Collection[]>([]);

  // Fetch once on mount
  useEffect(() => {
    if (!centerId) return;

    const loadRawData = async () => {
      try {
        setIsLoading(true);
        const [collections, farmers, ledgers] = await Promise.all([
          collectionService.getAll(centerId),
          farmerService.getAll(centerId),
          ledgerService.getAll(centerId)
        ]);
        setRawCollections(collections);
        setRawFarmers(farmers);
        setRawLedgers(ledgers);
      } catch (err) {
        console.error("Failed to load dashboard raw data", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRawData();
  }, [centerId]);

  // Dynamic filter processing
  useEffect(() => {
    if (rawCollections.length === 0 && rawFarmers.length === 0 && rawLedgers.length === 0) {
      return;
    }

    const now = new Date();
    let startDate = subDays(now, 6);
    let endDate = now;

    if (filterType === 'today') {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (filterType === 'yesterday') {
      const yesterday = subDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
    } else if (filterType === 'week') {
      startDate = startOfDay(subDays(now, 6));
      endDate = endOfDay(now);
    } else if (filterType === 'month') {
      startDate = startOfDay(subDays(now, 29));
      endDate = endOfDay(now);
    } else if (filterType === 'fy') {
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      endDate = endOfDay(now);
    } else if (filterType === 'all') {
      startDate = new Date(0);
      endDate = endOfDay(now);
    } else if (filterType === 'custom') {
      startDate = startOfDay(new Date(customStart));
      endDate = endOfDay(new Date(customEnd));
    }

    const getMillis = (val: any) => {
      if (!val) return 0;
      if (val.toMillis) return val.toMillis();
      return new Date(val).getTime();
    };

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // 1. Filter Collections
    const filteredCols = rawCollections.filter(c => {
      const t = getMillis(c.createdAt);
      return t >= startMs && t <= endMs;
    });

    // 2. Filter Ledgers
    const filteredLedgers = rawLedgers.filter(l => {
      const t = getMillis(l.createdAt);
      return t >= startMs && t <= endMs;
    });

    // 3. Compute Metrics
    setTodayLiters(filteredCols.reduce((sum, c) => sum + c.liters, 0));
    setTodayRevenue(filteredCols.reduce((sum, c) => sum + c.totalAmount, 0));
    setTotalFarmers(rawFarmers.length);

    // Group Ledger by Farmer
    const ledgerMap = new Map<string, LedgerEntry[]>();
    filteredLedgers.forEach(l => {
      if (!ledgerMap.has(l.farmerId)) {
        ledgerMap.set(l.farmerId, []);
      }
      ledgerMap.get(l.farmerId)!.push(l);
    });

    let outstandingSum = 0;
    let payablesSum = 0;
    let receivablesSum = 0;

    rawFarmers.forEach(f => {
      const transactions = ledgerMap.get(f.id) || [];
      const { balance } = calculateFarmerBalance(transactions);
      outstandingSum += balance;
      if (balance > 0) {
        payablesSum += balance;
      } else if (balance < 0) {
        receivablesSum += Math.abs(balance);
      }
    });

    setTotalOutstanding(outstandingSum);
    setTotalPayables(payablesSum);
    setTotalReceivables(receivablesSum);

    // Recent Collections (Top 5)
    setRecentCols(filteredCols.slice(0, 5));

    // 4. Generate Chart points based on range size
    const diffDays = differenceInDays(endDate, startDate);

    if (diffDays <= 31) {
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const wData = days.map(d => {
        const colsForDay = filteredCols.filter(c => isSameDay(new Date(getMillis(c.createdAt)), d));
        return {
          name: format(d, 'dd MMM'),
          liters: colsForDay.reduce((s, c) => s + c.liters, 0),
          amount: colsForDay.reduce((s, c) => s + c.totalAmount, 0),
        };
      });
      setWeeklyData(wData);

      const aData = days.map(d => {
        const colsForDay = filteredCols.filter(c => isSameDay(new Date(getMillis(c.createdAt)), d));
        return {
          name: format(d, 'dd MMM'),
          cow: colsForDay.filter(c => c.animalType === 'cow').reduce((s, c) => s + c.liters, 0),
          buffalo: colsForDay.filter(c => c.animalType === 'buffalo').reduce((s, c) => s + c.liters, 0),
        };
      });
      setAnimalData(aData);
    } else {
      const monthsMap = new Map<string, Date>();
      let curr = new Date(startDate);
      while (curr <= endDate) {
        const key = format(curr, 'yyyy-MM');
        if (!monthsMap.has(key)) {
          monthsMap.set(key, new Date(curr));
        }
        curr.setDate(curr.getDate() + 5);
      }
      const sortedMonths = Array.from(monthsMap.values()).sort((a, b) => a.getTime() - b.getTime());

      const wData = sortedMonths.map(m => {
        const colsForMonth = filteredCols.filter(c => {
          const d = new Date(getMillis(c.createdAt));
          return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
        });
        return {
          name: format(m, 'MMM yy'),
          liters: colsForMonth.reduce((s, c) => s + c.liters, 0),
          amount: colsForMonth.reduce((s, c) => s + c.totalAmount, 0),
        };
      });
      setWeeklyData(wData);

      const aData = sortedMonths.map(m => {
        const colsForMonth = filteredCols.filter(c => {
          const d = new Date(getMillis(c.createdAt));
          return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
        });
        return {
          name: format(m, 'MMM yy'),
          cow: colsForMonth.filter(c => c.animalType === 'cow').reduce((s, c) => s + c.liters, 0),
          buffalo: colsForMonth.filter(c => c.animalType === 'buffalo').reduce((s, c) => s + c.liters, 0),
        };
      });
      setAnimalData(aData);
    }
  }, [rawCollections, rawFarmers, rawLedgers, filterType, customStart, customEnd]);

  const summaryCards = [
    { title: "Today's Collection", value: `${todayLiters.toFixed(1)} L`, sub: 'Liters collected today', icon: Droplets, color: '#FF6B00', bg: '#FFF3E8' },
    { title: 'Total Farmers', value: totalFarmers.toString(), sub: 'Registered active farmers', icon: Users, color: '#22C55E', bg: '#DCFCE7' },
    { title: 'Revenue Today', value: `₹${todayRevenue.toFixed(0)}`, sub: 'Total payout today', icon: TrendingUp, color: '#3B82F6', bg: '#DBEAFE' },
    { title: 'Total Outstanding', value: `₹${totalOutstanding.toFixed(0)}`, sub: 'Net outstanding balance', icon: Wallet, color: '#FF6B00', bg: '#FFF3E8' },
    { title: 'Payable to Farmers', value: `₹${totalPayables.toFixed(0)}`, sub: 'Total we owe farmers', icon: ArrowUpRight, color: '#22C55E', bg: '#DCFCE7' },
    { title: 'Receivable from Farmers', value: `₹${totalReceivables.toFixed(0)}`, sub: 'Total farmers owe us', icon: ArrowDownRight, color: '#EF4444', bg: '#FEE2E2' },
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

      {/* Global Date Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#ECECEC] rounded-2xl shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'Last 30 Days' },
            { id: 'fy', label: 'Financial Year' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id as any)}
              className="px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer border"
              style={{
                background: filterType === opt.id ? '#FF6B00' : 'transparent',
                color: filterType === opt.id ? '#FFFFFF' : '#666666',
                borderColor: filterType === opt.id ? '#FF6B00' : '#ECECEC',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filterType === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#444]"
            />
            <span className="text-[12px] text-[#777]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#444]"
            />
          </div>
        )}
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
