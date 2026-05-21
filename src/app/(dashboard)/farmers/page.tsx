'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { collectionService } from '@/services/collectionService';
import { Farmer, Collection } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MoreHorizontal, User as UserIcon, Wallet, Droplets, Book, Ban, Trash2, Edit } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format } from 'date-fns';

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

  // Sheet State
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [farmerCollections, setFarmerCollections] = useState<Collection[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

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

  useEffect(() => {
    if (selectedFarmer && centerId) {
      setIsLoadingSheet(true);
      collectionService.getByFarmer(centerId, selectedFarmer.id)
        .then(cols => setFarmerCollections(cols))
        .catch(() => toast.error("Failed to load collections"))
        .finally(() => setIsLoadingSheet(false));
    }
  }, [selectedFarmer, centerId]);

  const handleDelete = async (id: string) => {
    if (!centerId) return;
    if (confirm('Delete this farmer? This cannot be undone.')) {
      try {
        await farmerService.delete(centerId, id);
        toast.success('Farmer deleted');
        setIsSheetOpen(false);
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

  const handleOpenSheet = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setIsSheetOpen(true);
  };

  const totalCollectionAmount = farmerCollections.reduce((sum, c) => sum + c.totalAmount, 0);

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
                        <UserIcon size={26} style={{ color: '#FF6B00' }} />
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
                        <button
                          onClick={() => handleOpenSheet(farmer)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#E5E5E5] outline-none ml-auto"
                          style={{ background: '#F0F0F0' }}
                        >
                          <MoreHorizontal size={15} style={{ color: '#555' }} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {filteredFarmers.length > 0 && (
          <div className="px-6 py-3 border-t border-[#F0F0F0]">
            <span className="text-[12px] text-[#AAAAAA]">
              Showing {filteredFarmers.length} of {farmers.length} farmers
            </span>
          </div>
        )}
      </motion.div>

      {/* Farmer Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-[#FAFAFA] border-l-[#ECECEC] p-0" style={{ zIndex: 100000 }}>
          {selectedFarmer && (
            <div className="h-full flex flex-col">
              {/* Header Profile */}
              <div className="p-6 bg-white border-b border-[#ECECEC]">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-left text-[16px] font-bold">Farmer Profile</SheetTitle>
                </SheetHeader>
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold flex-shrink-0"
                    style={{
                      background: selectedFarmer.animalType === 'cow' ? '#DBEAFE' : '#EDE9FE',
                      color: selectedFarmer.animalType === 'cow' ? '#2563EB' : '#7C3AED',
                    }}
                  >
                    {getInitials(selectedFarmer.name)}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-[#111]">{selectedFarmer.name}</h2>
                    <div className="text-[13px] text-[#777] font-mono mt-0.5">{selectedFarmer.id}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${selectedFarmer.active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                        {selectedFarmer.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${selectedFarmer.animalType === 'cow' ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#EDE9FE] text-[#7C3AED]'}`}>
                        {selectedFarmer.animalType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button onClick={() => router.push(`/accounts/${selectedFarmer.id}`)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#FF6B00] shadow-sm hover:opacity-90">
                     View Account
                  </button>
                  <button onClick={() => router.push(`/farmers/edit/${selectedFarmer.id}`)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#111] bg-white border border-[#ECECEC] shadow-sm hover:bg-[#F9F9F9]">
                    <Edit size={14} /> Edit Profile
                  </button>
                  <button onClick={() => router.push('/collections')} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#111] bg-white border border-[#ECECEC] shadow-sm hover:bg-[#F9F9F9]">
                    <Droplets size={14} /> Collections
                  </button>
                  <button onClick={() => router.push('/payments')} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#111] bg-white border border-[#ECECEC] shadow-sm hover:bg-[#F9F9F9]">
                    <Wallet size={14} /> Payments
                  </button>
                  <button
                    onClick={async () => {
                      if (!centerId) return;
                      await farmerService.update(centerId, selectedFarmer.id, { active: !selectedFarmer.active });
                      toast.success(selectedFarmer.active ? 'Farmer disabled' : 'Farmer activated');
                      setSelectedFarmer({ ...selectedFarmer, active: !selectedFarmer.active });
                      loadFarmers();
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#111] bg-white border border-[#ECECEC] shadow-sm hover:bg-[#F9F9F9]"
                  >
                    <Ban size={14} /> {selectedFarmer.active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(selectedFarmer.id)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-[#DC2626] bg-[#FEE2E2] hover:opacity-90 border border-[#FCA5A5]">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>

                {/* Account Summary */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#777] uppercase tracking-wider mb-3">Account Summary</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-[#ECECEC] rounded-xl p-4">
                      <div className="text-[11px] text-[#777] mb-1 font-semibold uppercase tracking-wider">Current Balance</div>
                      <div className="text-[18px] font-bold" style={{ color: selectedFarmer.balance >= 0 ? '#16A34A' : '#DC2626' }}>
                        {selectedFarmer.balance >= 0 ? '+' : '-'}₹{Math.abs(selectedFarmer.balance || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white border border-[#ECECEC] rounded-xl p-4">
                      <div className="text-[11px] text-[#777] mb-1 font-semibold uppercase tracking-wider">Total Collection</div>
                      {isLoadingSheet ? (
                        <div className="h-6 w-16 bg-[#F0F0F0] rounded animate-pulse" />
                      ) : (
                        <div className="text-[18px] font-bold text-[#FF6B00]">₹{totalCollectionAmount.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Farmer Details */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#777] uppercase tracking-wider mb-3">Farmer Details</h3>
                  <div className="bg-white border border-[#ECECEC] rounded-xl overflow-hidden text-[13px]">
                    {[
                      { label: 'Mobile', value: selectedFarmer.mobile },
                      { label: 'Village', value: selectedFarmer.village },
                      { label: 'Animal Type', value: <span className="capitalize">{selectedFarmer.animalType}</span> },
                      { label: 'Bank Name', value: selectedFarmer.bankName || '—' },
                      { label: 'Account No.', value: selectedFarmer.accountNumber || '—' },
                      { label: 'IFSC Code', value: selectedFarmer.ifscCode || '—' },
                      { label: 'Aadhaar', value: selectedFarmer.aadhaarNumber || '—' },
                      { label: 'Joining Date', value: selectedFarmer.createdAt ? format((selectedFarmer.createdAt as any).toDate ? (selectedFarmer.createdAt as any).toDate() : new Date(selectedFarmer.createdAt as any), 'dd MMM yyyy') : '—' },
                    ].map((item, idx) => (
                      <div key={item.label} className={`flex items-center justify-between p-3 ${idx !== 0 ? 'border-t border-[#F7F7F7]' : ''}`}>
                        <span className="text-[#777] font-medium">{item.label}</span>
                        <span className="text-[#111] font-semibold text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Collections */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#777] uppercase tracking-wider mb-3">Recent Collections</h3>
                  <div className="bg-white border border-[#ECECEC] rounded-xl overflow-hidden">
                    {isLoadingSheet ? (
                      <div className="p-4 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : farmerCollections.length === 0 ? (
                      <div className="p-6 text-center text-[13px] text-[#777]">No collections found.</div>
                    ) : (
                      farmerCollections.slice(0, 3).map((col, idx) => (
                        <div key={col.id} className={`flex items-center justify-between p-3 ${idx !== 0 ? 'border-t border-[#F7F7F7]' : ''}`}>
                          <div>
                            <div className="text-[13px] font-semibold text-[#111]">
                              {format((col.createdAt as any).toDate ? (col.createdAt as any).toDate() : new Date(col.createdAt as any), 'dd/MM/yyyy')}
                            </div>
                            <div className="text-[11px] text-[#777] capitalize">{col.shift} Shift</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] font-bold text-[#FF6B00]">₹{col.totalAmount.toFixed(2)}</div>
                            <div className="text-[11px] text-[#777]">{col.liters} L @ ₹{col.rate}/L</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
