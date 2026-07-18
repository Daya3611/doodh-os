'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Home, Users, Milk, List, IndianRupee, PieChart, Settings, UserPlus } from 'lucide-react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative hidden lg:flex items-center text-left"
      >
        <Search size={15} className="absolute left-3 text-[#BBBBBB]" />
        <div className="topbar-search pl-9 pr-4 py-2 w-64 text-[13px] flex items-center justify-between text-[#777] bg-white border border-[#ECECEC] rounded-xl hover:border-[#FF6B00] transition-colors cursor-pointer shadow-sm">
          <span>Search anything...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-[#F7F7F7] px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Quick Links">
              <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                <Home className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/farmers'))}>
                <Users className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Farmers</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/collections/new'))}>
                <Milk className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>New Collection</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/payments'))}>
                <IndianRupee className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Payments</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Management">
              <CommandItem onSelect={() => runCommand(() => router.push('/rate-chart'))}>
                <List className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Rate Chart</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/reports'))}>
                <PieChart className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Reports</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/staff'))}>
                <UserPlus className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Staff</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
                <Settings className="mr-2 h-4 w-4 text-[#FF6B00]" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
