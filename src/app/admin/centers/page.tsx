'use client';

import { useEffect, useState } from 'react';
import { adminService, AdminCenter } from '@/services/adminService';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, MoreVertical, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterCentersPage() {
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadCenters = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAllCenters();
      setCenters(data);
    } catch (error) {
      toast.error('Failed to load centers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCenters();
  }, []);

  const handleToggleStatus = async (center: AdminCenter) => {
    const newStatus = center.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this center?`)) return;
    
    try {
      await adminService.updateCenterStatus(center.id, newStatus);
      toast.success(`Center is now ${newStatus}`);
      loadCenters();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search centers by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#ECECEC] rounded-xl text-[14px] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>
      </div>

      {/* Centers Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Center Name</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                        <Building2 size={32} className="text-blue-500" />
                      </div>
                      <div className="text-[16px] font-bold text-[#111]">No centers found</div>
                      <div className="text-[14px] text-[#888]">No milk collection centers match your search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredCenters.map((center, i) => (
                    <motion.tr
                      key={center.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111]">{center.name}</div>
                        <div className="text-[12px] text-[#888]">ID: {center.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] text-[#444]">{center.city || '-'}</div>
                        <div className="text-[12px] text-[#888]">{center.state || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[12px] font-semibold">
                          {center.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${center.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                          {center.status === 'ACTIVE' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                          {center.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(center)}
                          className="text-[13px] font-semibold text-[#FF6B00] hover:underline"
                        >
                          {center.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
