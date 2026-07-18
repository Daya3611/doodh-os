'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { InventoryItem, InventoryVariant, StockAdjustment, InventoryLog } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sliders, Search, Calendar, FileText, RefreshCw, ClipboardList } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function StockAdjustmentsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [auditLogs, setAuditLogs] = useState<InventoryLog[]>([]);

  // Search & Form State
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemVariants, setItemVariants] = useState<InventoryVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  
  // Adjustment fields
  const [qtyAdjust, setQtyAdjust] = useState<number | ''>('');
  const [adjustType, setAdjustType] = useState<'addition' | 'deduction'>('deduction');
  const [reason, setReason] = useState<'damage' | 'expired' | 'lost' | 'manual_correction' | 'opening_balance' | 'other'>('damage');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [itemsData, adjs, logs] = await Promise.all([
        inventoryService.getAll(centerId),
        inventoryService.getAdjustments(centerId),
        inventoryService.getLogs(centerId)
      ]);
      setItems(itemsData.filter(i => i.status === 'active'));
      setAdjustments(adjs);
      setAuditLogs(logs);
    } catch {
      toast.error('Failed to load stock adjustment components');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  // Adjust defaults when adjustment type changes
  useEffect(() => {
    if (adjustType === 'addition') {
      setReason('opening_balance');
    } else {
      setReason('damage');
    }
  }, [adjustType]);

  const handleSelectItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setSelectedItem(item);
    setSearchItemTerm(item.name);
    
    try {
      const vars = await inventoryService.getVariants(centerId!, item.id);
      setItemVariants(vars);
      if (vars.length > 0) {
        setSelectedVariantId(vars[0].id);
      }
    } catch {
      toast.error('Failed to load item variants');
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !selectedItem || !selectedVariantId || !qtyAdjust) {
      toast.error('Please complete all form fields');
      return;
    }

    const rawQty = Number(qtyAdjust);
    if (rawQty <= 0) {
      toast.error('Adjustment quantity must be positive');
      return;
    }

    // Set positive or negative quantity based on type
    const netQuantity = adjustType === 'addition' ? rawQty : -rawQty;

    const variant = itemVariants.find(v => v.id === selectedVariantId);
    if (!variant) return;

    // Enforce sufficient stock on deduction
    if (adjustType === 'deduction' && (variant.currentStock || 0) < rawQty) {
      toast.error(`Cannot deduct more than available. Available: ${variant.currentStock} ${variant.unit}`);
      return;
    }

    const adjData = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      variantId: selectedVariantId,
      variantName: variant.name,
      quantity: netQuantity,
      reason,
      notes,
    };

    setIsLoading(true);
    try {
      await inventoryService.addAdjustment(centerId, adjData, profile?.name || 'user');
      toast.success('Stock adjustment completed');
      
      // Reset form
      setSelectedItem(null);
      setItemVariants([]);
      setSelectedVariantId('');
      setSearchItemTerm('');
      setQtyAdjust('');
      setNotes('');
      
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record adjustment');
      setIsLoading(false);
    }
  };

  const getReasonLabel = (val: string) => {
    return val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form Panel */}
        <div style={cardStyle} className="p-6 h-fit space-y-4">
          <h3 className="text-[15px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2 flex items-center gap-1.5">
            <Sliders size={16} className="text-[#FF6B00]" /> Stock Correction Form
          </h3>

          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            <div className="relative">
              <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">1. Search Item</label>
              <input
                type="text"
                placeholder="Scan barcode or type name..."
                value={searchItemTerm}
                onChange={e => setSearchItemTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
              />
              
              {searchItemTerm && !selectedItem && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#ECECEC] rounded-xl shadow-lg max-h-48 overflow-y-auto z-10 p-2 divide-y divide-gray-50">
                  {items
                    .filter(i => i.name.toLowerCase().includes(searchItemTerm.toLowerCase()) || i.sku.toLowerCase().includes(searchItemTerm.toLowerCase()) || (i.barcode && i.barcode.toLowerCase().includes(searchItemTerm.toLowerCase())))
                    .map(i => (
                      <div
                        key={i.id}
                        onClick={() => handleSelectItem(i.id)}
                        className="p-2 text-[12px] font-bold text-[#333] hover:bg-gray-50 cursor-pointer flex justify-between"
                      >
                        <span>{i.name}</span>
                        <span className="text-gray-400 font-mono text-[10px]">{i.sku}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">2. Select Variant</label>
              <select
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                disabled={itemVariants.length === 0}
                className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#555] outline-none disabled:opacity-50"
              >
                <option value="">-- Choose Variant --</option>
                {itemVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.name} (Available: {v.currentStock} {v.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">3. Adjust Type</label>
                <div className="flex bg-[#F7F7F7] border border-[#ECECEC] rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduction')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${adjustType === 'deduction' ? 'bg-[#DC2626] text-white' : 'text-[#777]'}`}
                  >
                    Deduct
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('addition')}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${adjustType === 'addition' ? 'bg-[#16A34A] text-white' : 'text-[#777]'}`}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">4. Qty Adjust</label>
                <input
                  type="number"
                  required
                  placeholder="Count"
                  value={qtyAdjust}
                  onChange={e => setQtyAdjust(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">5. Adjustment Reason</label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
              >
                {adjustType === 'deduction' ? (
                  <>
                    <option value="damage">Damage / Spoiled</option>
                    <option value="expired">Expired Goods</option>
                    <option value="lost">Lost / Misplaced</option>
                    <option value="manual_correction">Manual Correction</option>
                    <option value="other">Other Outward Loss</option>
                  </>
                ) : (
                  <>
                    <option value="opening_balance">Opening Balance</option>
                    <option value="manual_correction">Manual Addition</option>
                    <option value="other">Other Inward Return</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Notes / Reason Details</label>
              <textarea
                placeholder="Details of damage, return references etc..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !selectedVariantId || !qtyAdjust}
              className="w-full py-3.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Post Stock Adjustment
            </button>
          </form>
        </div>

        {/* Right Audit Logs Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* History of Adjustments */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[15px] font-bold text-[#111111] flex items-center gap-1.5">
              <ClipboardList size={16} className="text-[#FF6B00]" /> Recent Corrections History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Item Name</th>
                    <th className="pb-2">Variant</th>
                    <th className="pb-2 text-right">Net Qty</th>
                    <th className="pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">No stock corrections recorded.</td>
                    </tr>
                  ) : (
                    adjustments.slice(0, 5).map(adj => {
                      const d = (adj.createdAt as any).toDate ? (adj.createdAt as any).toDate() : new Date(adj.createdAt as any);
                      const isAddition = adj.quantity > 0;
                      return (
                        <tr key={adj.id} className="border-b border-[#F7F7F7] last:border-none">
                          <td className="py-2.5 font-semibold text-gray-500">
                            {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="py-2.5 font-bold text-[#111111]">{adj.itemName}</td>
                          <td className="py-2.5 text-[#555]">{adj.variantName}</td>
                          <td className={`py-2.5 text-right font-black ${isAddition ? 'text-green-600' : 'text-red-600'}`}>
                            {isAddition ? `+${adj.quantity}` : adj.quantity}
                          </td>
                          <td className="py-2.5 font-semibold">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${isAddition ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {getReasonLabel(adj.reason)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Logs */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[15px] font-bold text-[#111111] flex items-center gap-1.5">
              <ClipboardList size={16} className="text-[#FF6B00]" /> Inventory Audit Logs
            </h3>
            <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-[#ECECEC] text-[9px] text-[#999999] uppercase font-bold sticky top-0 bg-white">
                    <th className="pb-2">Date/User</th>
                    <th className="pb-2">Item/Variant</th>
                    <th className="pb-2 text-right">Prev</th>
                    <th className="pb-2 text-right">New</th>
                    <th className="pb-2 text-right">Net Change</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">No audit movements recorded.</td>
                    </tr>
                  ) : (
                    auditLogs.slice(0, 15).map(log => {
                      const d = (log.createdAt as any).toDate ? (log.createdAt as any).toDate() : new Date(log.createdAt as any);
                      const isAddition = log.quantity > 0;
                      return (
                        <tr key={log.id} className="border-b border-[#F7F7F7] last:border-none">
                          <td className="py-2 text-[#777777]">
                            <span className="font-bold">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> <br/>
                            <span className="text-[9px]">{log.createdBy}</span>
                          </td>
                          <td className="py-2 text-[#111111]">
                            <span className="font-bold">{log.itemName}</span> <br/>
                            <span className="text-[9px] text-gray-500">{log.variantName}</span>
                          </td>
                          <td className="py-2 text-right text-gray-500">{log.prevStock}</td>
                          <td className="py-2 text-right text-gray-500">{log.newStock}</td>
                          <td className={`py-2 text-right font-extrabold ${isAddition ? 'text-green-600' : 'text-red-600'}`}>
                            {isAddition ? `+${log.quantity}` : log.quantity}
                          </td>
                          <td className="py-2">
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase ${log.actionType === 'purchase' ? 'bg-blue-50 text-blue-600' : log.actionType === 'sale' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-700'}`}>
                              {log.actionType}
                            </span>
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

      </div>
    </div>
  );
}
