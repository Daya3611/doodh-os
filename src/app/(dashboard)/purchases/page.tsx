'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inventory/purchases');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
