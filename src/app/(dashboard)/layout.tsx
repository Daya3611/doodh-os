'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { Bell, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { subscriptionService, CenterSubscription } from '@/services/subscriptionService';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';

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
  '/subscription': { title: 'Subscription', subtitle: 'Manage your DoodhOS plan, add-ons, and billing' },
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
      {/* Left: Page Title & Mobile Menu */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Trigger */}
        <div className="md:hidden flex items-center">
          <Sheet>
            <SheetTrigger 
              render={
                <button className="p-2 -ml-2 text-[#111] hover:bg-black/5 rounded-lg transition-colors">
                  <Menu size={22} />
                </button>
              }
            />
            <SheetContent side="left" className="w-[280px] p-0 border-none bg-white">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Access the different sections of DoodhOS</SheetDescription>
              <DashboardSidebar isMobile={true} />
            </SheetContent>
          </Sheet>
        </div>

        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-[#111111] leading-tight">{pageInfo.title}</h1>
          <p className="text-[12px] sm:text-[13px] text-[#777777] mt-0.5 hidden sm:block">{pageInfo.subtitle}</p>
        </div>
      </div>

      {/* Right: Search + Notifications + Avatar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <GlobalSearch />

        {/* Notifications */}
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
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [subscription, setSubscription] = useState<CenterSubscription | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (profile?.centerId) {
      subscriptionService.getSubscription(profile.centerId).then(sub => {
        setSubscription(sub);
      });
    }
  }, [profile?.centerId]);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#F7F7F7' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.svg" alt="DoodhOS Logo" className="h-35 w-auto mb-2 animate-pulse" />
          <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isExpired = subscription?.status === 'EXPIRED';
  const isSubscriptionPage = pathname === '/subscription';

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
          {isExpired && !isSubscriptionPage ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-10">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-700 mb-2">Subscription Expired</h2>
              <p className="text-red-600 mb-6">Your center's subscription has expired. Please upgrade your plan to continue using the DoodhOS platform.</p>
              <button onClick={() => router.push('/subscription')} className="px-6 py-3 bg-[#FF6B00] text-white rounded-xl font-bold hover:bg-orange-600 transition-colors">
                View Subscription Plans
              </button>
            </div>
          ) : (
            children
          )}
        </motion.main>
      </div>
    </div>
  );
}
