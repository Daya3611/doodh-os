'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Package, FolderOpen, Award, Scale,
  Truck, ShoppingBag, Receipt, Sliders, BarChart3, Settings
} from 'lucide-react';

const tabs = [
  { name: 'Dashboard', href: '/inventory', icon: LayoutDashboard },
  { name: 'Items', href: '/inventory/items', icon: Package },
  { name: 'Categories', href: '/inventory/categories', icon: FolderOpen },
  { name: 'Brands', href: '/inventory/brands', icon: Award },
  { name: 'Units', href: '/inventory/units', icon: Scale },
  { name: 'Suppliers', href: '/inventory/suppliers', icon: Truck },
  { name: 'Purchases', href: '/inventory/purchases', icon: ShoppingBag },
  { name: 'Sales', href: '/inventory/sales', icon: Receipt },
  { name: 'Stock Adjustments', href: '/inventory/adjustments', icon: Sliders },
  { name: 'Reports', href: '/inventory/reports', icon: BarChart3 },
  { name: 'Settings', href: '/inventory/settings', icon: Settings },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Horizontal Sub-Navigation Tab Bar */}
      <div 
        className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[#ECECEC]"
        style={{
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          // Strict active check: `/inventory` matches exactly, other subroutes match prefix
          const isActive = tab.href === '/inventory' 
            ? pathname === '/inventory' 
            : pathname.startsWith(tab.href);
          
          const Icon = tab.icon;

          return (
            <Link key={tab.name} href={tab.href}>
              <motion.div
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="relative flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer text-[13px] font-bold transition-colors select-none whitespace-nowrap"
                style={{
                  color: isActive ? '#FF6B00' : '#666666',
                  background: isActive ? '#FFF0E6' : 'transparent',
                }}
              >
                <Icon size={16} />
                {tab.name}
                {isActive && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full"
                    style={{ background: '#FF6B00' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Viewport for sub-pages */}
      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
}
