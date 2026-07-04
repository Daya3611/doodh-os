'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { ledgerService } from '@/services/ledgerService';
import { Farmer, LedgerEntry } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, FileDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function FarmerLedgerPage({ params }: { params: Promise<{ farmerId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { farmerId } = resolvedParams;
  
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!centerId || !farmerId) return;
      setIsLoading(true);
      try {
        const [f, l] = await Promise.all([
          farmerService.getById(centerId, farmerId),
          ledgerService.getByFarmer(centerId, farmerId)
        ]);
        setFarmer(f);
        setLedger(l);
      } catch {
        toast.error('Failed to load ledger');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [centerId, farmerId]);

  const exportExcel = () => {
    if (!farmer) return;
    const data = ledger.map(l => {
      const d = (l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any);
      return {
        Date: format(d, 'dd/MM/yyyy hh:mm a'),
        Type: l.transactionType,
        Description: l.description,
        Credit: l.credit > 0 ? l.credit : '',
        Debit: l.debit > 0 ? l.debit : '',
        Balance: l.balance
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, `Ledger_${farmer.name.replace(/\s+/g, '_')}_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  if (isLoading) return <div className="p-10 text-center text-[#777]">Loading ledger...</div>;
  if (!farmer) return <div className="p-10 text-center text-red-500">Farmer not found</div>;

  const balance = farmer.balance || 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#ECECEC] bg-white text-[#555] hover:bg-gray-50">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="text-[11px] text-[#AAAAAA] uppercase tracking-wider">Farmer Account</div>
            <div className="text-[18px] font-bold text-[#111111] flex items-center gap-2">
              {farmer.name} <span className="text-[13px] text-[#777] font-normal font-mono">({farmer.id})</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-[#ECECEC] bg-white text-[#555] hover:bg-gray-50 transition-colors">
            <FileDown size={14} /> Export Excel
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-[#ECECEC] bg-white text-[#555] hover:bg-gray-50 transition-colors">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div style={{ ...cardStyle, padding: '24px' }} className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-white">
        <div>
          <div className="text-[13px] font-semibold text-[#777] mb-1">Current Balance</div>
          <div className={`text-[32px] font-extrabold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : '-'}₹{Math.abs(balance).toFixed(2)}
          </div>
          <div className="text-[12px] text-[#555]">
            {balance >= 0 ? 'Center owes farmer (Payable)' : 'Farmer owes center (Receivable)'}
          </div>
        </div>
        <div>
          <button onClick={() => router.push(`/payments?farmerId=${farmer.id}`)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-[#111] text-white hover:bg-gray-800 transition-colors">
            <Plus size={16} /> Add Payment
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0]">
          <h3 className="text-[14px] font-bold text-[#111]">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0', background: '#FAFAFA' }}>
                {['Date', 'Type', 'Description', 'Credit (+)', 'Debit (-)', 'Balance'].map(col => (
                  <th key={col} className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#777]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[13px] text-[#777]">No transactions yet.</td>
                </tr>
              ) : (
                ledger.map(l => {
                  const d = (l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any);
                  const typeLabel = l.transactionType.replace('_', ' ');
                  return (
                    <tr key={l.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-[13px] font-medium text-[#111]">{format(d, 'dd MMM yyyy')}</div>
                        <div className="text-[11px] text-[#AAA]">{format(d, 'hh:mm a')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gray-100 text-gray-600">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#555]">{l.description}</td>
                      <td className="px-6 py-4 text-[14px] font-semibold text-green-600">
                        {l.credit > 0 ? `₹${l.credit.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-[14px] font-semibold text-red-600">
                        {l.debit > 0 ? `₹${l.debit.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-[14px] font-bold ${l.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {l.balance >= 0 ? '+' : '-'}₹{Math.abs(l.balance).toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
