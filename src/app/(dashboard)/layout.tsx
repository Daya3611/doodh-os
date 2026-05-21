'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';

// Page title mapping
const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your center\'s performance today' },
  '/farmers': { title: 'Farmers', subtitle: 'Manage milk contributing farmers in your center' },
  '/collections': { title: 'Collections', subtitle: 'Daily milk collection records' },
  '/collections/new': { title: 'New Collection', subtitle: 'Fast data entry mode for milk collection' },
  '/rate-chart': { title: 'Rate Chart', subtitle: 'Manage milk rates based on FAT and SNF parameters' },
  '/payments': { title: 'Payments', subtitle: 'Track and manage farmer payments' },
  '/reports': { title: 'Reports', subtitle: 'Collection analytics and financial reports' },
  '/staff': { title: 'Staff', subtitle: 'Manage collection center staff and roles' },
  '/settings': { title: 'Settings', subtitle: 'Configure your center preferences' },
};

function TopBar() {
  const pathname = usePathname();
  const { profile } = useAuthStore();

  const pageInfo = pageTitles[pathname] ?? { title: 'DoodhOS', subtitle: 'Milk Collection Center' };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header
      className="flex items-center justify-between px-8 py-5 sticky top-0 z-10"
      style={{
        background: '#F7F7F7',
        borderBottom: '1px solid #ECECEC',
      }}
    >
      {/* Left: Page Title */}
      <div>
        <h1 className="text-[22px] font-bold text-[#111111] leading-tight">{pageInfo.title}</h1>
        <p className="text-[13px] text-[#777777] mt-0.5">{pageInfo.subtitle}</p>
      </div>

      {/* Right: Search + Notifications + Avatar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:flex items-center">
          <Search size={15} className="absolute left-3 text-[#BBBBBB]" />
          <input
            className="topbar-search pl-9 pr-4 py-2 w-52 text-[13px]"
            placeholder="Search something..."
          />
        </div>

        {/* Notifications */}
        <motion.button
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

        {/* Avatar */}
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isLoading } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#F7F7F7' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: '#FF6B00' }}
          >
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F7F7' }}>
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main */}
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
