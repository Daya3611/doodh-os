'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { collectionService } from '@/services/collectionService';
import { paymentService } from '@/services/paymentService';
import { farmerService } from '@/services/farmerService';
import { ledgerService } from '@/services/ledgerService';
import { purchaseService } from '@/services/purchaseService';
import { inventoryService } from '@/services/inventoryService';
import { Payment } from '@/services/paymentService';
import { Collection, Farmer, LedgerEntry, Purchase, InventoryItem } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FileDown, Download, FileText, Milk, Users, Wallet, Droplets, Book, Box, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

type ReportTab = 'milk' | 'farmer' | 'payment' | 'purchase' | 'ledger' | 'outstanding' | 'inventory';

const TABS: { id: ReportTab; label: string; icon: any }[] = [
  { id: 'milk', label: 'Milk Collection', icon: Milk },
  { id: 'farmer', label: 'Farmers', icon: Users },
  { id: 'payment', label: 'Payments', icon: Wallet },
  { id: 'purchase', label: 'Purchases', icon: Droplets },
  { id: 'ledger', label: 'Ledger', icon: Book },
  { id: 'outstanding', label: 'Outstanding', icon: FileText },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

export default function ReportsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [activeTab, setActiveTab] = useState<ReportTab>('milk');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [collections, setCollections] = useState<Collection[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedFarmer, setSelectedFarmer] = useState('all');

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      // Load all data to generate reports quickly
      const [colData, farData, pmtData, ldgData, purData, invData] = await Promise.all([
        collectionService.getAll(centerId),
        farmerService.getAll(centerId),
        paymentService.getAll(centerId),
        ledgerService.getAll(centerId),
        purchaseService.getAll(centerId),
        inventoryService.getAll(centerId)
      ]);
      setCollections(colData);
      setFarmers(farData);
      setPayments(pmtData);
      setLedgers(ldgData);
      setPurchases(purData);
      setInventory(invData);
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [centerId]);

  // Export Helper
  const exportToExcel = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'dd_MMM_yyyy')}.xlsx`);
    toast.success('Excel downloaded');
  };

  // Date filtering logic
  const filterByDate = (item: any) => {
    if (!dateRange.start && !dateRange.end) return true;
    const d = (item.createdAt as any)?.toDate ? (item.createdAt as any).toDate() : new Date(item.createdAt as any);
    if (!d) return true;
    
    const itemDateStr = format(d, 'yyyy-MM-dd');
    if (dateRange.start && itemDateStr < dateRange.start) return false;
    if (dateRange.end && itemDateStr > dateRange.end) return false;
    return true;
  };

  const filterByFarmer = (farmerId: string) => {
    if (selectedFarmer === 'all') return true;
    return farmerId === selectedFarmer;
  };

  // Render content based on tab
  const renderContent = () => {
    if (isLoading) return <div className="p-10 text-center text-[#777]">Generating reports...</div>;

    if (activeTab === 'milk') {
      const filtered = collections.filter(filterByDate).filter(c => filterByFarmer(c.farmerId));
      const totalLiters = filtered.reduce((s, c) => s + c.liters, 0);
      const totalAmt = filtered.reduce((s, c) => s + c.totalAmount, 0);
      
      const doExport = () => exportToExcel(filtered.map(c => ({
        Date: format((c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any), 'dd/MM/yyyy'),
        FarmerID: c.farmerId,
        Name: c.farmerName,
        Shift: c.shift,
        Animal: c.animalType,
        Liters: c.liters,
        FAT: c.fat,
        SNF: c.snf,
        Rate: c.rate,
        Total: c.totalAmount
      })), 'Milk_Collection_Report');

      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F7F7F7] p-4 rounded-xl border border-[#ECECEC]">
            <div className="flex gap-6">
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Liters</div><div className="text-[18px] font-bold text-[#111]">{totalLiters.toFixed(1)} L</div></div>
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Amount</div><div className="text-[18px] font-bold text-[#FF6B00]">₹{totalAmt.toFixed(2)}</div></div>
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Entries</div><div className="text-[18px] font-bold text-[#111]">{filtered.length}</div></div>
            </div>
            <button onClick={doExport} className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white text-[13px] font-bold rounded-lg hover:bg-gray-800"><FileDown size={14} /> Export Excel</button>
          </div>
          <div className="text-[13px] text-[#555] p-4 text-center border border-dashed border-[#ECECEC] rounded-xl">Use Excel export to view full detailed dataset.</div>
        </div>
      );
    }
    
    if (activeTab === 'outstanding') {
      // Outstanding = Negative Balances (Receivables) + Positive Balances (Payables)
      const payables = farmers.filter(f => (f.balance || 0) > 0);
      const receivables = farmers.filter(f => (f.balance || 0) < 0);
      
      const doExport = () => exportToExcel(farmers.map(f => ({
        FarmerID: f.id,
        Name: f.name,
        Village: f.village,
        Status: f.active ? 'Active' : 'Inactive',
        Balance: f.balance || 0,
        Type: (f.balance || 0) > 0 ? 'Payable (Owe to Farmer)' : ((f.balance || 0) < 0 ? 'Receivable (Owed by Farmer)' : 'Settled')
      })), 'Outstanding_Balance_Report');

      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F7F7F7] p-4 rounded-xl border border-[#ECECEC]">
            <div className="flex gap-6">
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Payables</div><div className="text-[18px] font-bold text-green-600">₹{payables.reduce((s, f) => s + (f.balance || 0), 0).toFixed(2)}</div></div>
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Receivables</div><div className="text-[18px] font-bold text-red-600">₹{receivables.reduce((s, f) => s + Math.abs(f.balance || 0), 0).toFixed(2)}</div></div>
            </div>
            <button onClick={doExport} className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white text-[13px] font-bold rounded-lg hover:bg-gray-800"><FileDown size={14} /> Export Excel</button>
          </div>
        </div>
      );
    }

    if (activeTab === 'ledger') {
      const filtered = ledgers.filter(filterByDate).filter(l => filterByFarmer(l.farmerId));
      const totalCredit = filtered.reduce((s, l) => s + l.credit, 0);
      const totalDebit = filtered.reduce((s, l) => s + l.debit, 0);

      const doExport = () => exportToExcel(filtered.map(l => ({
        Date: format((l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any), 'dd/MM/yyyy HH:mm'),
        FarmerID: l.farmerId,
        Type: l.transactionType,
        Description: l.description,
        Credit: l.credit,
        Debit: l.debit,
        RunningBalance: l.balance
      })), 'Ledger_Report');

      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F7F7F7] p-4 rounded-xl border border-[#ECECEC]">
            <div className="flex gap-6">
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Credits</div><div className="text-[18px] font-bold text-green-600">₹{totalCredit.toFixed(2)}</div></div>
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Total Debits</div><div className="text-[18px] font-bold text-red-600">₹{totalDebit.toFixed(2)}</div></div>
              <div><div className="text-[11px] text-[#777] uppercase tracking-wider mb-1">Transactions</div><div className="text-[18px] font-bold text-[#111]">{filtered.length}</div></div>
            </div>
            <button onClick={doExport} className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white text-[13px] font-bold rounded-lg hover:bg-gray-800"><FileDown size={14} /> Export Excel</button>
          </div>
        </div>
      );
    }
    
    // Generic fallback for other tabs
    return (
      <div className="text-center py-10">
        <button onClick={() => {
          let dataToExport: any[] = [];
          if (activeTab === 'farmer') dataToExport = farmers;
          if (activeTab === 'payment') dataToExport = payments.filter(filterByDate).filter(p => filterByFarmer(p.farmerId));
          if (activeTab === 'purchase') dataToExport = purchases.filter(filterByDate).filter(p => filterByFarmer(p.farmerId));
          if (activeTab === 'inventory') dataToExport = inventory;
          
          exportToExcel(dataToExport, `${activeTab}_report`);
        }} className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B00] text-white text-[14px] font-bold rounded-xl hover:bg-[#e66000]">
          <Download size={16} /> Download {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report (Excel)
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
          <FileText size={20} className="text-[#FF6B00]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#111] leading-tight">Reports & Export</h1>
          <p className="text-[13px] text-[#777] leading-tight mt-0.5">Generate and download financial reports</p>
        </div>
      </div>

      <div style={cardStyle} className="p-6">
        <div className="flex flex-wrap items-end gap-4 mb-6 pb-6 border-b border-[#ECECEC]">
          <div>
            <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-3 py-2 text-[13px] border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
              <span className="text-[#AAA]">-</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-3 py-2 text-[13px] border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Farmer Filter</label>
            <select value={selectedFarmer} onChange={e => setSelectedFarmer(e.target.value)} className="px-3 py-2 text-[13px] border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00] min-w-[200px] bg-white">
              <option value="all">All Farmers</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
            </select>
          </div>
          {(dateRange.start || dateRange.end || selectedFarmer !== 'all') && (
            <button onClick={() => { setDateRange({start: '', end: ''}); setSelectedFarmer('all'); }} className="px-3 py-2 text-[13px] font-semibold text-red-500 border border-red-100 bg-red-50 rounded-lg">
              Clear Filters
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Tabs Navigation */}
          <div className="w-full md:w-48 flex-shrink-0 flex flex-col gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all text-left ${activeTab === tab.id ? 'bg-[#FF6B00] text-white shadow-md' : 'text-[#555] hover:bg-[#F7F7F7]'}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            <h2 className="text-[16px] font-bold text-[#111] mb-4 flex items-center gap-2">
              {TABS.find(t => t.id === activeTab)?.label} Report
            </h2>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
