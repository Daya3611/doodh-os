'use client';

import { useSyncStore } from '@/store/useSyncStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SyncStatusIndicator() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const {
    isOnline,
    pendingCount,
    syncStatus,
    setOnline,
    updatePendingCount,
    syncNow
  } = useSyncStore();

  // Listen to browser network changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setOnline(true);
      if (centerId) {
        syncNow(centerId);
      }
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setOnline(navigator.onLine);

    if (centerId) {
      updatePendingCount(centerId);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [centerId, setOnline, updatePendingCount]);

  // Periodic check for pending count
  useEffect(() => {
    if (!centerId) return;
    const interval = setInterval(() => {
      updatePendingCount(centerId);
    }, 5000);
    return () => clearInterval(interval);
  }, [centerId, updatePendingCount]);

  const handleSyncClick = () => {
    if (isOnline && centerId && pendingCount > 0) {
      syncNow(centerId);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isOnline ? `online-${pendingCount}-${syncStatus}` : 'offline'}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border shadow-sm cursor-pointer select-none"
        onClick={handleSyncClick}
        style={{
          background: !isOnline 
            ? '#FEF2F2' 
            : pendingCount > 0 
              ? '#EFF6FF' 
              : '#F0FDF4',
          borderColor: !isOnline 
            ? '#FCA5A5' 
            : pendingCount > 0 
              ? '#93C5FD' 
              : '#BBF7D0',
          color: !isOnline 
            ? '#DC2626' 
            : pendingCount > 0 
              ? '#2563EB' 
              : '#16A34A',
        }}
        whileHover={isOnline && pendingCount > 0 ? { scale: 1.03 } : {}}
        whileTap={isOnline && pendingCount > 0 ? { scale: 0.98 } : {}}
      >
        {/* Status Icon */}
        {!isOnline ? (
          <WifiOff size={14} className="animate-pulse" />
        ) : syncStatus === 'syncing' ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : pendingCount > 0 ? (
          <RefreshCw size={14} className="animate-bounce" />
        ) : (
          <CheckCircle2 size={14} />
        )}

        {/* Status Text */}
        <span>
          {!isOnline
            ? '🔴 Offline'
            : syncStatus === 'syncing'
              ? 'Syncing...'
              : pendingCount > 0
                ? `🔵 Pending Sync (${pendingCount})`
                : '🟢 Synced'}
        </span>

        {/* Sync Hint */}
        {isOnline && pendingCount > 0 && syncStatus !== 'syncing' && (
          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-md ml-1 font-bold">
            Sync Now
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
