'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { motion } from 'framer-motion';
import { Building2, Users, UserCog, Tractor, Wallet, Activity, CreditCard, LayoutTemplate } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MasterDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setIsLoading(true);
      const data = await adminService.getPlatformStats();
      setStats(data);
      setIsLoading(false);
    }
    loadStats();
  }, []);

  const statCards = [
    { title: 'Total Centers', value: stats?.totalCenters || 0, icon: Building2, color: '#3B82F6', bg: '#EFF6FF' },
    { title: 'Total Owners', value: stats?.totalOwners || 0, icon: UserCog, color: '#F59E0B', bg: '#FEF3C7' },
    { title: 'Total Staff', value: stats?.totalStaff || 0, icon: Users, color: '#10B981', bg: '#D1FAE5' },
    { title: 'Total Farmers', value: stats?.totalFarmers || 0, icon: Tractor, color: '#6366F1', bg: '#E0E7FF' },
    { title: "Today's Revenue", value: `₹${stats?.revenueToday || 0}`, icon: Wallet, color: '#EC4899', bg: '#FCE7F3' },
    { title: 'Monthly Revenue', value: `₹${stats?.revenueMonthly || 0}`, icon: CreditCard, color: '#8B5CF6', bg: '#EDE9FE' },
    { title: 'Active Subscriptions', value: stats?.totalCenters || 0, icon: Activity, color: '#14B8A6', bg: '#CCFBF1' },
    { title: 'Expired Subscriptions', value: 0, icon: LayoutTemplate, color: '#EF4444', bg: '#FEE2E2' },
  ];

  // Dummy chart data for Master Dashboard
  const chartData = [
    { name: 'Mon', revenue: 4000, centers: 24 },
    { name: 'Tue', revenue: 3000, centers: 25 },
    { name: 'Wed', revenue: 2000, centers: 25 },
    { name: 'Thu', revenue: 2780, centers: 26 },
    { name: 'Fri', revenue: 1890, centers: 28 },
    { name: 'Sat', revenue: 2390, centers: 30 },
    { name: 'Sun', revenue: 3490, centers: 32 },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-[#ECECEC] animate-pulse h-[116px]">
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-6 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="h-10 w-10 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-6 rounded-2xl border border-[#ECECEC] hover:shadow-sm transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[12px] font-semibold text-[#888888] uppercase tracking-wider">{stat.title}</p>
                <h3 className="text-[24px] font-bold text-[#111111] mt-1">{stat.value}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-2xl border border-[#ECECEC]"
        >
          <div className="mb-6">
            <h3 className="text-[16px] font-bold text-[#111111]">Platform Revenue</h3>
            <p className="text-[12px] text-[#777777]">Revenue generated from center subscriptions</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FF6B00" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-[#ECECEC]"
        >
          <div className="mb-6">
            <h3 className="text-[16px] font-bold text-[#111111]">Center Growth</h3>
            <p className="text-[12px] text-[#777777]">Total active centers on the platform</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="centers" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCen)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
