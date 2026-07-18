'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { auth } from '@/firebase/config';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Building2, Users, Wallet,
  CreditCard, BarChart4, LifeBuoy, Bell,
  FileText, Settings, LogOut
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Centers', href: '/admin/centers', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: Wallet },
  { name: 'Payments', href: '/admin/payments', icon: CreditCard },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart4 },
  { name: 'Support', href: '/admin/support', icon: LifeBuoy },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Audit Logs', href: '/admin/logs', icon: FileText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuthStore();

  const handleLogout = async () => {
    await auth.signOut();
    signOut();
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside
      className="hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0"
      style={{ width: 280, background: '#FFFFFF', borderRight: '1px solid #ECECEC' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#ECECEC]">
        <img src="/logo.svg" alt="DoodhOS Logo" className="h-10 w-auto object-contain" />
        <span className="font-extrabold text-[20px] text-[#FF6B00] tracking-tight">DoodhOS<span className="text-[#111111]">Admin</span></span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
        {ADMIN_NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group"
                style={{ background: isActive ? '#F5F5F5' : 'transparent' }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeAdminIndicator"
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
                  {item.name}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
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
              <div className="text-[13px] font-semibold text-[#111111] truncate">{profile?.name || 'Master Admin'}</div>
              <div className="text-[11px] text-[#777777] truncate">Platform Owner</div>
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
