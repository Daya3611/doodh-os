'use client';

import { Fragment } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/context/translationContext';
import { auth } from '@/firebase/config';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Milk, BarChart3,
  Wallet, FileText, UserCog, Settings,
  LogOut, Droplets, Truck, CreditCard, Package
} from 'lucide-react';
import { SheetClose } from '@/components/ui/sheet';

type NavItem = { name: string; href: string; icon: React.ElementType };

const ALL_NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Farmers', href: '/farmers', icon: Users },
  { name: 'Collections', href: '/collections', icon: Milk },
  { name: 'Rate Chart', href: '/rate-chart', icon: BarChart3 },
  { name: 'Dispatch', href: '/dispatch', icon: Truck },
  { name: 'Accounts', href: '/accounts', icon: FileText },
  { name: 'Udhar Khata', href: '/udhar-khata', icon: CreditCard },
  { name: 'Payments', href: '/payments', icon: Wallet },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Staff', href: '/staff', icon: UserCog },
  { name: 'Subscription', href: '/subscription', icon: Wallet },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Staff can only see Dashboard + Collections + Inventory
const STAFF_ITEMS = ALL_NAV_ITEMS.filter(i =>
  ['/dashboard', '/collections', '/inventory'].includes(i.href)
);

export function DashboardSidebar({ isMobile }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuthStore();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await auth.signOut();
    signOut();
  };

  const getRoleLabel = () => {
    if (profile?.role === 'MASTER_ADMIN') return 'Master Admin';
    if (profile?.role === 'OWNER') return 'Center Owner';
    return 'Operator';
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Role-based nav filter
  const navItems =
    profile?.role === 'STAFF' ? STAFF_ITEMS : ALL_NAV_ITEMS;

  return (
    <aside
      className={`${isMobile ? 'flex' : 'hidden md:flex sticky top-0'} flex-col h-screen flex-shrink-0`}
      style={{ width: isMobile ? '100%' : 280, background: '#FFFFFF', borderRight: isMobile ? 'none' : '1px solid #ECECEC' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#ECECEC]">
        <img src="/logo.svg" alt="DoodhOS Logo" className="h-10 w-auto object-contain" />
        <span className="font-extrabold text-[20px] text-[#FF6B00] tracking-tight">DoodhOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          const linkContent = (
            <Link key={item.name} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group"
                style={{ background: isActive ? '#F5F5F5' : 'transparent' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                    style={{ background: '#FF6B00' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  size={19}
                  style={{ color: isActive ? '#FF6B00' : '#999', transition: 'color 0.15s' }}
                  className="group-hover:!text-[#FF6B00] flex-shrink-0"
                />
                <span
                  className="text-[14px] font-medium leading-none"
                  style={{ color: isActive ? '#111111' : '#666666' }}
                >
                  {t('nav.' + item.name.toLowerCase().replace(' ', '_'))}
                </span>
              </motion.div>
            </Link>
          );

          return isMobile ? (
            <SheetClose render={linkContent} key={item.name} />
          ) : (
            <Fragment key={item.name}>
              {linkContent}
            </Fragment>
          );
        })}
      </nav>

      {/* User card */}
      <div className="px-4 pb-6">
        <div className="rounded-2xl p-4" style={{ background: '#F7F7F7', border: '1px solid #ECECEC' }}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
              style={{ background: '#FF6B00', color: '#FFF' }}
            >
              {getInitials(profile?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#111111] truncate">{profile?.name || 'User'}</div>
              <div className="text-[11px] text-[#777777] truncate">{getRoleLabel()}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
            style={{ background: '#FFFFFF', border: '1px solid #ECECEC', color: '#555555' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF6B00'; e.currentTarget.style.color = '#FF6B00'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#ECECEC'; e.currentTarget.style.color = '#555555'; }}
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
