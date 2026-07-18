'use client';

import { useEffect } from 'react';
import { useSyncStore } from '@/store/useSyncStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AlertTriangle, Cloud, HardDrive, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ConflictResolver() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const { conflicts, loadConflicts, resolveConflict } = useSyncStore();

  useEffect(() => {
    if (centerId) {
      loadConflicts();
    }
  }, [centerId, loadConflicts]);

  if (conflicts.length === 0) return null;

  const currentConflict = conflicts[0];
  const local = currentConflict.localData;
  const cloud = currentConflict.cloudData;

  const formatDateTime = (val: any) => {
    if (!val) return 'N/A';
    const date = new Date(val);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
  };

  const handleResolve = async (resolution: 'local' | 'cloud') => {
    if (centerId) {
      await resolveConflict(currentConflict.id, resolution, centerId);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-[#ECECEC]"
          style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
        >
          {/* Header */}
          <div className="bg-[#FEF3C7] border-b border-[#FDE68A] px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center text-white">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#92400E]">Sync Conflict Detected</h2>
              <p className="text-[12px] text-[#B45309] mt-0.5">
                The same collection record was modified both online and offline. Select which version to keep.
              </p>
            </div>
          </div>

          {/* Main Comparison Area */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Left Side: Local Data */}
              <div className="border border-[#ECECEC] rounded-2xl bg-[#FAFAFA] p-5 space-y-4">
                <div className="flex items-center gap-2 text-[#2563EB] font-bold text-[14px]">
                  <HardDrive size={16} />
                  <span>Keep Local Version</span>
                </div>

                <div className="space-y-2.5 text-[13px] text-[#444]">
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Farmer:</span>
                    <span className="font-semibold">{local.farmerName || 'Unknown'} ({local.farmerId})</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Shift:</span>
                    <span className="font-semibold capitalize">{local.shift}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Liters:</span>
                    <span className="font-semibold">{local.liters} L</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">FAT / SNF:</span>
                    <span className="font-semibold">{local.fat}% / {local.snf}%</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Rate:</span>
                    <span className="font-semibold">₹{local.rate?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] pt-1">
                    <span className="text-[#888] font-bold">Total:</span>
                    <span className="font-bold text-[#111]">₹{local.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleResolve('local')}
                  className="w-full mt-4 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  Use Local Data
                </button>
              </div>

              {/* Right Side: Cloud Data */}
              <div className="border border-[#ECECEC] rounded-2xl bg-[#FAFAFA] p-5 space-y-4">
                <div className="flex items-center gap-2 text-[#16A34A] font-bold text-[14px]">
                  <Cloud size={16} />
                  <span>Keep Cloud Version</span>
                </div>

                <div className="space-y-2.5 text-[13px] text-[#444]">
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Farmer:</span>
                    <span className="font-semibold">{cloud.farmerName || 'Unknown'} ({cloud.farmerId})</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Shift:</span>
                    <span className="font-semibold capitalize">{cloud.shift}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Liters:</span>
                    <span className="font-semibold">{cloud.liters} L</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">FAT / SNF:</span>
                    <span className="font-semibold">{cloud.fat}% / {cloud.snf}%</span>
                  </div>
                  <div className="flex justify-between border-b border-[#EEE] pb-1.5">
                    <span className="text-[#888]">Rate:</span>
                    <span className="font-semibold">₹{cloud.rate?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] pt-1">
                    <span className="text-[#888] font-bold">Total:</span>
                    <span className="font-bold text-[#111]">₹{cloud.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleResolve('cloud')}
                  className="w-full mt-4 py-2.5 bg-[#16A34A] hover:bg-green-700 text-white rounded-xl text-[13px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  Use Cloud Data
                </button>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="border-t border-[#ECECEC] px-6 py-4 bg-[#FAFAFA] flex justify-between items-center text-[12px] text-[#777]">
            <span>Conflict 1 of {conflicts.length} pending</span>
            <span>Record ID: {currentConflict.id}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
