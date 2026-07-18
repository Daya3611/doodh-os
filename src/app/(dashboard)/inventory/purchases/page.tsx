'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { supplierService } from '@/services/supplierService';
import { farmerService } from '@/services/farmerService';
import { inventoryService } from '@/services/inventoryService';
import { purchaseService } from '@/services/purchaseService';
import { Supplier, Farmer, InventoryItem, InventoryVariant, PurchaseEntry, PurchaseEntryItem } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, ShoppingBag, Trash2, ArrowLeftRight, Check, Search, Calendar } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function PurchasesPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseEntry[]>([]);

  // Selection state
  const [vendorType, setVendorType] = useState<'supplier' | 'farmer'>('supplier');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank' | 'outstanding' | 'farmer_ledger'>('outstanding');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partially_paid' | 'pending'>('pending');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Cart search and selection
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemVariants, setItemVariants] = useState<InventoryVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [rateInput, setRateInput] = useState<number | ''>('');
  const [discountInput, setDiscountInput] = useState<number | ''>('');
  
  // Transport & Discount
  const [overallDiscount, setOverallDiscount] = useState<number | ''>('');
  const [transportCost, setTransportCost] = useState<number | ''>('');

  // Cart list
  const [cart, setCart] = useState<PurchaseEntryItem[]>([]);

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [sups, fars, itemsData, history] = await Promise.all([
        supplierService.getAll(centerId),
        farmerService.getAll(centerId),
        inventoryService.getAll(centerId),
        purchaseService.getAll(centerId)
      ]);
      setSuppliers(sups);
      setFarmers(fars);
      setItems(itemsData.filter(i => i.status === 'active'));
      setRecentPurchases(history);
    } catch {
      toast.error('Failed to load data components');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  // Handle payment status auto toggle based on paid amount
  const computeGrandTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const transport = Number(transportCost) || 0;
    const discount = Number(overallDiscount) || 0;
    return subtotal + transport - discount;
  };

  useEffect(() => {
    const grandTotal = computeGrandTotal();
    const paid = Number(paidAmount) || 0;

    if (paymentMode === 'cash' || paymentMode === 'upi' || paymentMode === 'bank') {
      setPaidAmount(grandTotal);
      setPaymentStatus('paid');
    } else if (paymentMode === 'farmer_ledger') {
      setPaidAmount(0);
      setPaymentStatus('paid'); // marked paid since credited to ledger
    } else {
      // Outstanding
      if (paid === 0) {
        setPaymentStatus('pending');
      } else if (paid >= grandTotal) {
        setPaymentStatus('paid');
      } else {
        setPaymentStatus('partially_paid');
      }
    }
  }, [paymentMode, cart, transportCost, overallDiscount, paidAmount]);

  const handleSelectItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setSelectedItem(item);
    setSearchItemTerm(item.name);
    
    // Load variants
    try {
      const allVars = await inventoryService.getVariants(centerId!, item.id);
      // Only show variants where purchaseAllowed is not explicitly false (backward-compat for old records)
      const purchaseVars = allVars.filter(v => v.purchaseAllowed !== false && v.status === 'active');
      setItemVariants(purchaseVars);
      if (purchaseVars.length > 0) {
        setSelectedVariantId(purchaseVars[0].id);
        setRateInput(purchaseVars[0].purchasePrice);
        setQtyInput(1);
        setDiscountInput(0);
      } else {
        setSelectedVariantId('');
        setRateInput('');
        toast.warning('No purchase-eligible variants for this item. Enable "Allow in Purchases" on at least one variant.');
      }
    } catch {
      toast.error('Failed to load item variants');
    }
  };


  const handleVariantChange = (variantId: string) => {
    const v = itemVariants.find(varObj => varObj.id === variantId);
    if (v) {
      setSelectedVariantId(variantId);
      setRateInput(v.purchasePrice);
    }
  };

  const handleAddToCart = () => {
    if (!selectedItem || !selectedVariantId || !qtyInput || !rateInput) {
      toast.error('Please select item, variant, quantity and rate');
      return;
    }

    const qty = Number(qtyInput);
    const rate = Number(rateInput);
    const disc = Number(discountInput) || 0;
    const variant = itemVariants.find(v => v.id === selectedVariantId);

    if (qty <= 0 || rate <= 0) {
      toast.error('Quantity and rate must be positive values');
      return;
    }

    if (!variant) return;

    // Check if variant already exists in cart
    const exists = cart.findIndex(c => c.variantId === selectedVariantId);

    // Calculate tax amounts
    const gstPercent = selectedItem.gst || 0;
    const baseTotal = (qty * rate) - disc;
    const gstAmount = (baseTotal * gstPercent) / 100;
    const total = baseTotal + gstAmount;

    const cartItem: PurchaseEntryItem = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      variantId: selectedVariantId,
      variantName: variant.name,
      quantity: qty,
      purchaseRate: rate,
      gstPercent,
      gstAmount,
      discount: disc,
      total
    };

    if (exists > -1) {
      const newCart = [...cart];
      newCart[exists] = cartItem;
      setCart(newCart);
      toast.info('Cart updated with modified variant details');
    } else {
      setCart(prev => [...prev, cartItem]);
      toast.success('Item added to purchase cart');
    }

    // Reset search fields
    setSelectedItem(null);
    setItemVariants([]);
    setSelectedVariantId('');
    setSearchItemTerm('');
    setQtyInput('');
    setRateInput('');
    setDiscountInput('');
  };

  const handleRemoveFromCart = (variantId: string) => {
    setCart(prev => prev.filter(c => c.variantId !== variantId));
  };

  const handleSavePurchase = async () => {
    if (!centerId) return;

    if (!selectedVendorId) {
      toast.error(`Please select a valid ${vendorType}`);
      return;
    }

    if (cart.length === 0) {
      toast.error('Cart is empty. Add products to purchase.');
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const gstTotal = cart.reduce((sum, item) => sum + item.gstAmount, 0);
    const discount = Number(overallDiscount) || 0;
    const transport = Number(transportCost) || 0;
    const grandTotal = subtotal + transport - discount;

    const vendorName = vendorType === 'supplier'
      ? suppliers.find(s => s.id === selectedVendorId)?.name || 'Unknown'
      : farmers.find(f => f.id === selectedVendorId)?.name || 'Unknown';

    const pData = {
      supplierId: selectedVendorId,
      supplierName: vendorName,
      date: new Date(purchaseDate),
      items: cart,
      total: subtotal,
      gstTotal,
      discount,
      transport,
      grandTotal,
      paymentMode,
      paymentStatus,
      paidAmount: Number(paidAmount) || 0,
      notes,
    };

    setIsLoading(true);
    try {
      await purchaseService.add(centerId, pData, profile?.name || 'user');
      toast.success('Purchase Invoice saved successfully');
      
      // Reset form
      setCart([]);
      setSelectedVendorId('');
      setOverallDiscount('');
      setTransportCost('');
      setPaidAmount('');
      setNotes('');
      
      // Reload lists
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save purchase');
      setIsLoading(false);
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!centerId) return;
    if (!confirm('Are you sure you want to delete this purchase? Stock increases will be reversed.')) return;

    try {
      await purchaseService.delete(centerId, id);
      toast.success('Purchase entry deleted & stock reverted');
      loadData();
    } catch {
      toast.error('Failed to delete purchase record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form Side */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Vendor Details */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2 flex items-center gap-1.5">
              <ArrowLeftRight size={15} className="text-[#FF6B00]" /> 1. Vendor & Terms
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Vendor Type</label>
                <div className="flex bg-[#F7F7F7] border border-[#ECECEC] rounded-xl p-1 gap-1">
                  <button
                    onClick={() => { setVendorType('supplier'); setSelectedVendorId(''); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${vendorType === 'supplier' ? 'bg-[#111] text-white' : 'text-[#777]'}`}
                  >
                    Supplier
                  </button>
                  <button
                    onClick={() => { setVendorType('farmer'); setSelectedVendorId(''); setPaymentMode('farmer_ledger'); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${vendorType === 'farmer' ? 'bg-[#111] text-white' : 'text-[#777]'}`}
                  >
                    Farmer
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                  Select {vendorType === 'supplier' ? 'Supplier' : 'Farmer'} *
                </label>
                <select
                  required
                  value={selectedVendorId}
                  onChange={e => setSelectedVendorId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                >
                  <option value="">-- Choose --</option>
                  {vendorType === 'supplier' 
                    ? suppliers.map(s => <option key={s.id} value={s.id}>{s.name} (₹{formatCurrency(s.pendingAmount)})</option>)
                    : farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)
                  }
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Purchase Date *</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add Products */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2 flex items-center gap-1.5">
              <Plus size={15} className="text-[#FF6B00]" /> 2. Add Stock Products
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5 relative">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Search Item</label>
                <input
                  type="text"
                  placeholder="Type name, SKU or scan barcode..."
                  value={searchItemTerm}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchItemTerm(val);
                    // Clear selected item if typed text does not match the chosen item's name
                    if (selectedItem && val !== selectedItem.name) {
                      setSelectedItem(null);
                      setItemVariants([]);
                      setSelectedVariantId('');
                      setRateInput('');
                      setQtyInput('');
                    }
                  }}
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

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Variant</label>
                <select
                  value={selectedVariantId}
                  onChange={e => handleVariantChange(e.target.value)}
                  disabled={itemVariants.length === 0}
                  className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#555] outline-none disabled:opacity-50"
                >
                  <option value="">Select Variant</option>
                  {itemVariants.map(v => (
                    <option key={v.id} value={v.id}>{v.name} (Stock: {v.currentStock})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Qty</label>
                <input
                  type="number"
                  placeholder="1"
                  value={qtyInput}
                  onChange={e => setQtyInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Rate (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                />
              </div>

              <div className="sm:col-span-10">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Row Discount (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-2.5 bg-orange-50 text-[#FF6B00] border border-orange-200 hover:bg-[#FF6B00] hover:text-white rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Cart Table */}
          <div style={cardStyle} className="p-6 space-y-4 overflow-hidden">
            <h3 className="text-[14px] font-bold text-[#111111]">Purchase Cart Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                    <th className="pb-2">Product Name</th>
                    <th className="pb-2">Variant</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Tax (GST)</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#AAAAAA]">Cart is empty. Search products above.</td>
                    </tr>
                  ) : (
                    cart.map(item => (
                      <tr key={item.variantId} className="border-b border-[#F7F7F7] last:border-none">
                        <td className="py-2.5 font-bold text-[#111111]">{item.itemName}</td>
                        <td className="py-2.5 text-[#555]">{item.variantName}</td>
                        <td className="py-2.5 text-right font-semibold">{item.quantity}</td>
                        <td className="py-2.5 text-right">₹{formatCurrency(item.purchaseRate)}</td>
                        <td className="py-2.5 text-right text-[11px] text-gray-500">
                          ₹{formatCurrency(item.gstAmount)} ({item.gstPercent}%)
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-[#111111]">₹{formatCurrency(item.total)}</td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={() => handleRemoveFromCart(item.variantId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Sidebar Checklist */}
        <div className="space-y-6">
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[15px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2">3. Purchase Summary</h3>
            
            <div className="space-y-3.5 text-[13px] font-semibold text-[#555]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-[#111]">₹{formatCurrency(cart.reduce((sum, item) => sum + (item.total ?? 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Transport Fees</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transportCost}
                  onChange={e => setTransportCost(e.target.value ? Number(e.target.value) : '')}
                  className="w-24 px-2 py-1 text-right bg-[#F7F7F7] border border-[#ECECEC] rounded-lg outline-none text-[12px]"
                />
              </div>
              <div className="flex justify-between items-center">
                <span>Overall Discount</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={overallDiscount}
                  onChange={e => setOverallDiscount(e.target.value ? Number(e.target.value) : '')}
                  className="w-24 px-2 py-1 text-right bg-[#F7F7F7] border border-[#ECECEC] rounded-lg outline-none text-[12px]"
                />
              </div>

              <div className="flex justify-between pt-3 border-t border-[#ECECEC] items-center">
                <span className="text-[14px] font-bold text-[#111111]">Grand Total</span>
                <span className="text-[20px] font-black text-[#FF6B00]">₹{formatCurrency(computeGrandTotal())}</span>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#ECECEC]">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Payment Terms</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#555] outline-none"
                >
                  {vendorType === 'supplier' && <option value="outstanding">Outstanding Ledger</option>}
                  {vendorType === 'farmer' && <option value="farmer_ledger">Farmer Balance Ledger</option>}
                  <option value="cash">Cash Payment</option>
                  <option value="upi">UPI / Online</option>
                  <option value="bank">Bank / Cheque</option>
                </select>
              </div>

              {paymentMode === 'outstanding' && (
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Paid Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                  />
                </div>
              )}

              <div className="text-[11px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-gray-500 font-semibold leading-relaxed">
                Status: <span className="font-extrabold text-[#111] uppercase">{paymentStatus}</span> <br/>
                Stock increments and accounting updates will process atomically on save.
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Bill No, Challan Ref"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] text-[#111] outline-none"
                />
              </div>

              <button
                onClick={handleSavePurchase}
                disabled={isLoading || cart.length === 0 || !selectedVendorId}
                className="w-full py-3.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2 cursor-pointer"
              >
                Complete Purchase
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Previous Purchase Records */}
      <div style={cardStyle} className="p-6 space-y-4">
        <h3 className="text-[15px] font-bold text-[#111111]">Recent Purchase Entries</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                <th className="pb-2">Bill No</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Supplier / Vendor</th>
                <th className="pb-2 text-right">Items Count</th>
                <th className="pb-2 text-right">Grand Total</th>
                <th className="pb-2 text-center">Payment</th>
                <th className="pb-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">No purchases found.</td>
                </tr>
              ) : (
                recentPurchases.slice(0, 10).map(p => {
                  const d = (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any);
                  return (
                    <tr key={p.id} className="border-b border-[#F7F7F7] last:border-none">
                      <td className="py-2.5 font-bold font-mono text-[#111111]">{p.purchaseNumber}</td>
                      <td className="py-2.5 text-[#555]">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 font-semibold text-[#333]">{p.supplierName}</td>
                      <td className="py-2.5 text-right">{p.items.length} items</td>
                      <td className="py-2.5 text-right font-extrabold">₹{formatCurrency(p.grandTotal)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${p.paymentStatus === 'paid' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                          {p.paymentStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => handleDeletePurchase(p.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
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
