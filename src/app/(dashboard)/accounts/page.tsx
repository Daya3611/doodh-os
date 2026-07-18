'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { ledgerService } from '@/services/ledgerService';
import { Farmer, LedgerEntry } from '@/types';
import { calculateFarmerBalance } from '@/lib/balance';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, Wallet, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function AccountsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [farmersData, ledgerData] = await Promise.all([
        farmerService.getAll(centerId),
        ledgerService.getAll(centerId)
      ]);
      setFarmers(farmersData);
      setLedgers(ledgerData);
    } catch { toast.error('Failed to load accounts'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  const filtered = farmers.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group ledger entries by farmer ID
  const ledgerMap = new Map<string, LedgerEntry[]>();
  ledgers.forEach(l => {
    if (!ledgerMap.has(l.farmerId)) {
      ledgerMap.set(l.farmerId, []);
    }
    ledgerMap.get(l.farmerId)!.push(l);
  });

  // Calculate correct balance for each farmer using calculateFarmerBalance
  const farmerBalances = new Map<string, number>();
  farmers.forEach(f => {
    const transactions = ledgerMap.get(f.id) || [];
    const { balance } = calculateFarmerBalance(transactions);
    farmerBalances.set(f.id, balance);
  });

  // Calculate totals
  const totalOutstanding = farmers.reduce((sum, f) => sum + (farmerBalances.get(f.id) || 0), 0);
  const positiveBalances = farmers.filter(f => (farmerBalances.get(f.id) || 0) > 0).reduce((sum, f) => sum + (farmerBalances.get(f.id) || 0), 0);
  const negativeBalances = farmers.filter(f => (farmerBalances.get(f.id) || 0) < 0).reduce((sum, f) => sum + Math.abs(farmerBalances.get(f.id) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
              <Wallet size={16} className="text-orange-500" />
            </div>
            <div className="text-[13px] font-semibold text-[#777]">Total Outstanding</div>
          </div>
          <div className="text-[28px] font-bold text-[#111]">₹{totalOutstanding.toFixed(2)}</div>
        </div>
        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50">
              <ArrowUpRight size={16} className="text-green-500" />
            </div>
            <div className="text-[13px] font-semibold text-[#777]">Payable to Farmers</div>
          </div>
          <div className="text-[28px] font-bold text-green-600">₹{positiveBalances.toFixed(2)}</div>
        </div>
        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
              <ArrowDownRight size={16} className="text-red-500" />
            </div>
            <div className="text-[13px] font-semibold text-[#777]">Receivable from Farmers</div>
          </div>
          <div className="text-[28px] font-bold text-red-600">₹{negativeBalances.toFixed(2)}</div>
        </div>
      </div>

      {/* Main Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder="Search by farmer name or ID..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Farmer', 'Village', 'Status', 'Current Balance', 'Actions'].map(col => (
                  <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded-full animate-pulse bg-[#F0F0F0]" style={{ width: j === 0 ? '120px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-50">
                        <FileText size={26} className="text-orange-500" />
                      </div>
                      <div className="text-[15px] font-semibold text-[#111111]">No accounts found</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filtered.map((farmer, i) => {
                    const balance = farmerBalances.get(farmer.id) || 0;
                    return (
                      <motion.tr
                        key={farmer.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }}
                        className="group hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                        onClick={() => router.push(`/accounts/${farmer.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-semibold text-[#111111]">{farmer.name}</div>
                          <div className="text-[11px] text-[#AAAAAA] font-mono">{farmer.id}</div>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">{farmer.village}</td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                            style={farmer.active ? { background: '#DCFCE7', color: '#16A34A' } : { background: '#FEE2E2', color: '#DC2626' }}>
                            {farmer.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-[15px] font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {balance >= 0 ? '+' : '-'}₹{Math.abs(balance).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-[#AAA]">{balance >= 0 ? 'To Pay' : 'To Receive'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button className="p-2 rounded-xl border border-[#ECECEC] text-[#555] group-hover:border-orange-500 group-hover:text-orange-500 transition-colors">
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
