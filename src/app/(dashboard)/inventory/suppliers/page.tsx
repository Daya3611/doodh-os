'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { supplierService } from '@/services/supplierService';
import { Supplier, SupplierPayment } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit3, Trash2, Wallet, 
  History, ArrowUpRight, Save, X, BookOpen, Printer
} from 'lucide-react';
import { formatCurrency } from '@/utils/format';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function SuppliersPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Supplier Form Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    gst: '',
    address: '',
    pendingAmount: 0,
  });

  // Record Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'upi' | 'bank',
    notes: '',
  });

  // Supplier Ledger Modal state
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const data = await supplierService.getAll(centerId);
      setSuppliers(data);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({ name: '', mobile: '', gst: '', address: '', pendingAmount: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      mobile: sup.mobile,
      gst: sup.gst || '',
      address: sup.address || '',
      pendingAmount: sup.pendingAmount || 0,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) return;

    if (!formData.name || !formData.mobile) {
      toast.error('Name and mobile number are required');
      return;
    }

    try {
      if (editingSupplier) {
        await supplierService.update(centerId, editingSupplier.id, formData);
        toast.success('Supplier updated successfully');
      } else {
        await supplierService.add(centerId, formData);
        toast.success('Supplier created successfully');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save supplier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!centerId) return;
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await supplierService.delete(centerId, id);
      toast.success('Supplier deleted');
      loadData();
    } catch {
      toast.error('Failed to delete supplier');
    }
  };

  // Record Payment
  const handleOpenPayment = (sup: Supplier) => {
    setPaymentSupplier(sup);
    setPaymentFormData({ amount: '', paymentMethod: 'cash', notes: '' });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !paymentSupplier) return;

    const amountNum = Number(paymentFormData.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await supplierService.recordPayment(
        centerId,
        paymentSupplier.id,
        amountNum,
        paymentFormData.paymentMethod,
        paymentFormData.notes,
        profile?.name || 'unknown'
      );
      toast.success('Supplier payment recorded & balance updated');
      setIsPaymentModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  // View Ledger
  const handleOpenLedger = async (sup: Supplier) => {
    if (!centerId) return;
    setLedgerSupplier(sup);
    setIsLedgerModalOpen(true);
    try {
      const entries = await supplierService.getLedger(centerId, sup.id);
      setLedgerEntries(entries);
    } catch {
      toast.error('Failed to load supplier ledger');
    }
  };

  // Filter suppliers
  const filtered = suppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.mobile.includes(searchTerm) ||
    (sup.gst && sup.gst.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalOutstanding = suppliers.reduce((sum, s) => sum + (s.pendingAmount || 0), 0);

  return (
    <div className="space-y-5">
      {/* 1. Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div style={cardStyle} className="p-6 col-span-2 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <div>
              <div className="text-[12px] font-bold text-[#777777] uppercase leading-none">Total Outstanding Payable</div>
              <div className="text-[26px] font-black text-[#111111] mt-1.5 leading-none">
                ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-3 bg-[#FF6B00] text-white text-[13px] font-bold rounded-xl hover:bg-orange-600 transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Supplier
          </button>
        </div>

        {/* Search */}
        <div style={cardStyle} className="p-5 flex items-center">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[12px] rounded-xl bg-[#F7F7F7] border border-[#ECECEC] outline-none focus:border-[#FF6B00] font-semibold text-[#111]"
              placeholder="Search by supplier name, mobile, GST..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. Suppliers Table */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #ECECEC' }}>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Supplier Name</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Contact</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">GSTIN</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-right">Outstanding Amount</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F7F7F7]">
                    <td colSpan={5} className="p-6"><div className="h-6 bg-gray-100 rounded w-full animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#AAAAAA] text-[13px]">
                    No suppliers registered. Add your first supplier above.
                  </td>
                </tr>
              ) : (
                filtered.map(sup => (
                  <tr key={sup.id} className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] transition-colors">
                    <td className="p-4">
                      <span className="text-[14px] font-bold text-[#111111]">{sup.name}</span>
                      <div className="text-[10px] text-[#777777] font-mono mt-0.5">{sup.address || 'No address specified'}</div>
                    </td>
                    <td className="p-4 text-[13px] text-[#555] font-semibold">{sup.mobile}</td>
                    <td className="p-4 text-[13px] text-[#555] font-mono">{sup.gst || '-'}</td>
                    <td className="p-4 text-right">
                      <span className={`text-[15px] font-extrabold ${sup.pendingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{formatCurrency(sup.pendingAmount)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenPayment(sup)}
                          title="Record Payment"
                          className="px-2.5 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-lg text-[11px] font-bold hover:bg-green-100 transition-all flex items-center gap-1"
                        >
                          <Wallet size={12} /> Pay
                        </button>
                        <button
                          onClick={() => handleOpenLedger(sup)}
                          title="View Ledger"
                          className="px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-all flex items-center gap-1"
                        >
                          <BookOpen size={12} /> Ledger
                        </button>
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          title="Edit"
                          className="p-1.5 text-[#FF6B00] hover:bg-[#FFF0E6] rounded-xl transition-colors"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(sup.id)}
                          title="Delete"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Add/Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl border border-[#ECECEC]"
          >
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <h3 className="text-[16px] font-bold text-[#111111]">
                {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Godrej Vetfeed Dist"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Mobile Number *</label>
                <input
                  type="text"
                  required
                  placeholder="10-digit phone number"
                  value={formData.mobile}
                  onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  value={formData.gst}
                  onChange={e => setFormData(prev => ({ ...prev, gst: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Address</label>
                <input
                  type="text"
                  placeholder="Supplier location"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              {!editingSupplier && (
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Initial Outstanding Balance (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.pendingAmount || ''}
                    onChange={e => setFormData(prev => ({ ...prev, pendingAmount: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECECEC] mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 transition-colors"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl border border-[#ECECEC]"
          >
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <h3 className="text-[16px] font-bold text-[#111111]">Record Outward Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600 font-semibold">
                Paying To: <span className="font-extrabold">{paymentSupplier?.name}</span> <br/>
                Current Balance: <span className="font-extrabold">₹{formatCurrency(paymentSupplier?.pendingAmount)}</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentFormData.amount}
                  onChange={e => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Payment Mode *</label>
                <select
                  value={paymentFormData.paymentMethod}
                  onChange={e => setPaymentFormData(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Notes / Reference No</label>
                <input
                  type="text"
                  placeholder="e.g. Transaction ID, Check No"
                  value={paymentFormData.notes}
                  onChange={e => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECECEC] mt-4">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-5 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-[13px] font-bold hover:bg-green-700 transition-colors"
                >
                  Submit Payment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Supplier Ledger Modal */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl border border-[#ECECEC]"
          >
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">Supplier Account Ledger</h3>
                <p className="text-[11px] text-[#777777]">Chronological statement for <span className="font-bold text-[#FF6B00]">{ledgerSupplier?.name}</span></p>
              </div>
              <button onClick={() => setIsLedgerModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-x-auto border border-[#ECECEC] rounded-2xl bg-white" id="printable-ledger-area">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#ECECEC] font-bold text-[#777777] uppercase text-[9px] tracking-wider">
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Debit (Payment)</th>
                    <th className="p-3 text-right">Credit (Purchase)</th>
                    <th className="p-3 text-right">Outstanding Bal</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#AAAAAA] text-[13px]">
                        No ledger history found for this supplier.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map(entry => {
                      const d = (entry.date as any).toDate ? (entry.date as any).toDate() : new Date(entry.date as any);
                      const isPurchase = entry.type === 'purchase';
                      return (
                        <tr key={entry.id} className="border-b border-[#F7F7F7] last:border-none hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-semibold text-[#555]">
                            {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-[#777]">{entry.referenceNumber}</td>
                          <td className="p-3 font-semibold text-[#333]">{entry.description}</td>
                          <td className="p-3 text-right font-extrabold text-green-600">
                            {entry.debit > 0 ? `-₹${formatCurrency(entry.debit)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-extrabold text-[#111111]">
                            {entry.credit > 0 ? `+₹${formatCurrency(entry.credit)}` : '-'}
                          </td>
                          <td className="p-3 text-right font-black text-[#FF6B00]">
                            ₹{formatCurrency(entry.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#ECECEC]">
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="flex-1 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
              >
                Close Statement
              </button>
              <button
                onClick={() => {
                  const printContent = document.getElementById('printable-ledger-area');
                  if (!printContent) return;
                  const win = window.open('', '', 'width=800,height=600');
                  if (win) {
                    win.document.write('<html><head><title>Supplier Ledger</title><style>body { padding: 40px; font-family: sans-serif; } table { width:100%; border-collapse:collapse; margin-top:20px; font-size:12px; } th, td { border:1px solid #ddd; padding:8px; text-align:left; } th { background:#f5f5f5; }</style></head><body>');
                    win.document.write(`<h2>Supplier Statement: ${ledgerSupplier?.name}</h2>`);
                    win.document.write(printContent.innerHTML);
                    win.document.write('</body></html>');
                    win.document.close();
                    win.focus();
                    win.print();
                    win.close();
                  }
                }}
                className="flex-1 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print Statement
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
