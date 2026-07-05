'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/AdminSidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': { title: 'Master Dashboard', subtitle: 'Platform-wide overview of DoodhOS' },
  '/admin/centers': { title: 'Centers', subtitle: 'Manage all milk collection centers on the platform' },
  '/admin/users': { title: 'Users', subtitle: 'Manage all registered owners, staff, and admins' },
  '/admin/subscriptions': { title: 'Subscriptions', subtitle: 'Manage SaaS billing and plans' },
  '/admin/payments': { title: 'Payments', subtitle: 'Platform revenue and payout history' },
  '/admin/analytics': { title: 'Analytics', subtitle: 'Platform growth and usage analytics' },
  '/admin/support': { title: 'Support', subtitle: 'Manage customer tickets and requests' },
  '/admin/notifications': { title: 'Notifications', subtitle: 'Broadcast messages to centers' },
  '/admin/logs': { title: 'Audit Logs', subtitle: 'System-wide activity monitoring' },
  '/admin/settings': { title: 'System Settings', subtitle: 'Configure platform preferences' },
};

function TopBar() {
  const pathname = usePathname();
  const { profile } = useAuthStore();

  const pageInfo = pageTitles[pathname] ?? { title: 'DoodhOS Admin', subtitle: 'Master Control Panel' };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header
      className="flex items-center justify-between px-8 py-5 sticky top-0 z-10"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #ECECEC',
      }}
    >
      <div>
        <h1 className="text-[22px] font-bold text-[#111111] leading-tight">{pageInfo.title}</h1>
        <p className="text-[13px] text-[#777777] mt-0.5">{pageInfo.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <GlobalSearch />

        <motion.button
          onClick={() => {
            import('sonner').then(({ toast }) => {
              toast.info('Notification system under development');
            });
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-[#ECECEC] bg-white"
        >
          <Bell size={16} className="text-[#555]" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: '#FF6B00' }}
          />
        </motion.button>

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold cursor-pointer flex-shrink-0"
          style={{ background: '#FF6B00', color: '#FFFFFF' }}
        >
          {getInitials(profile?.name)}
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#F7F7F7' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.svg" alt="DoodhOS Logo" className="h-16 w-auto mb-2 animate-pulse" />
          <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'MASTER_ADMIN') {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F7F7' }}>
      <AdminSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <motion.main
          className="flex-1 overflow-y-auto"
          style={{ padding: '32px' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
