'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { Farmer } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MoreHorizontal, Trash, Eye, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '20px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function FarmersPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadFarmers = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const data = await farmerService.getAll(centerId);
      setFarmers(data);
    } catch {
      toast.error('Failed to load farmers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadFarmers(); }, [centerId]);

  const handleDelete = async (id: string) => {
    if (!centerId) return;
    if (confirm('Delete this farmer? This cannot be undone.')) {
      try {
        await farmerService.delete(centerId, id);
        toast.success('Farmer deleted');
        loadFarmers();
      } catch {
        toast.error('Failed to delete farmer');
      }
    }
  };

  const filteredFarmers = farmers.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.mobile.includes(searchTerm)
  );

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div />
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/farmers/add')}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white"
          style={{
            background: '#FF6B00',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(255,107,0,0.3)',
          }}
        >
          <Plus size={17} />
          Add Farmer
        </motion.button>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={cardStyle}
        className="overflow-hidden"
      >
        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-[#F0F0F0]">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{
                background: '#F7F7F7',
                border: '1.5px solid #ECECEC',
                color: '#111111',
              }}
              placeholder="Search by name, ID or mobile..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Farmer', 'Mobile', 'Village', 'Animal Type', 'Status', ''].map(col => (
                  <th
                    key={col}
                    className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#AAAAAA' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div
                          className="h-4 rounded-full animate-pulse"
                          style={{ background: '#F0F0F0', width: j === 0 ? '140px' : '80px' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: '#FFF3E8' }}
                      >
                        <Users size={26} style={{ color: '#FF6B00' }} />
                      </div>
                      <div className="text-[15px] font-semibold text-[#111111]">No farmers yet</div>
                      <div className="text-[13px] text-[#777777]">Add your first farmer to get started</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredFarmers.map((farmer, i) => (
                    <motion.tr
                      key={farmer.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: '1px solid #F7F7F7' }}
                      className="group hover:bg-[#FAFAFA] transition-colors"
                    >
                      {/* Farmer name + avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                            style={{
                              background: farmer.animalType === 'cow' ? '#DBEAFE' : '#EDE9FE',
                              color: farmer.animalType === 'cow' ? '#2563EB' : '#7C3AED',
                            }}
                          >
                            {getInitials(farmer.name)}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-[#111111]">{farmer.name}</div>
                            <div className="text-[11px] text-[#AAAAAA] font-mono">{farmer.id} • <span className="font-sans">{farmer.village}</span></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#555555]">{farmer.mobile}</td>
                      <td className="px-6 py-4 text-[13px] text-[#555555]">{farmer.village}</td>
                      <td className="px-6 py-4">
                        <span
                          className="text-[12px] font-medium px-2.5 py-1 rounded-lg capitalize"
                          style={{
                            background: farmer.animalType === 'cow' ? '#DBEAFE' : '#EDE9FE',
                            color: farmer.animalType === 'cow' ? '#2563EB' : '#7C3AED',
                          }}
                        >
                          {farmer.animalType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-[12px] font-semibold px-3 py-1 rounded-full"
                          style={
                            farmer.active
                              ? { background: '#DCFCE7', color: '#16A34A' }
                              : { background: '#FEE2E2', color: '#DC2626' }
                          }
                        >
                          {farmer.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 outline-none"
                              style={{ background: '#F0F0F0' }}
                            >
                              <MoreHorizontal size={15} style={{ color: '#555' }} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl border-[#ECECEC] shadow-lg">
                            <DropdownMenuLabel className="text-[11px] text-[#AAAAAA] uppercase tracking-wider">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[13px] gap-2 cursor-pointer"
                              onClick={() => router.push(`/farmers/${farmer.id}`)}
                            >
                              <Eye size={14} /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-[13px] gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => handleDelete(farmer.id)}
                            >
                              <Trash size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredFarmers.length > 0 && (
          <div className="px-6 py-3 border-t border-[#F0F0F0]">
            <span className="text-[12px] text-[#AAAAAA]">
              Showing {filteredFarmers.length} of {farmers.length} farmers
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
