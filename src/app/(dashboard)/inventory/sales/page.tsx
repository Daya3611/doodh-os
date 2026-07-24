'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { inventoryService } from '@/services/inventoryService';
import { salesService } from '@/services/salesService';
import { Farmer, InventoryItem, InventoryVariant, SalesEntry, SalesEntryItem } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Trash2, ArrowLeftRight, Check, Search, Calendar, UserCheck } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function SalesPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recentSales, setRecentSales] = useState<SalesEntry[]>([]);

  // Selection state
  const [customerType, setCustomerType] = useState<'farmer' | 'guest'>('farmer');
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank' | 'farmer_ledger'>('cash');
  const [notes, setNotes] = useState('');

  // Cart search and selection
  const [searchItemTerm, setSearchItemTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemVariants, setItemVariants] = useState<InventoryVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [rateInput, setRateInput] = useState<number | ''>('');
  const [discountInput, setDiscountInput] = useState<number | ''>('');

  // Overall discount
  const [overallDiscount, setOverallDiscount] = useState<number | ''>('');

  // Cart list
  const [cart, setCart] = useState<SalesEntryItem[]>([]);

  // Settings
  const [settings, setSettings] = useState({
    enableNegativeStock: false,
  });

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [fars, itemsData, history, sett] = await Promise.all([
        farmerService.getAll(centerId),
        inventoryService.getAll(centerId),
        salesService.getAll(centerId),
        inventoryService.getInventorySettings(centerId)
      ]);
      setFarmers(fars);
      setItems(itemsData.filter(i => i.status === 'active'));
      setRecentSales(history);
      setSettings({
        enableNegativeStock: sett.enableNegativeStock
      });
    } catch {
      toast.error('Failed to load sales data components');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const computeGrandTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const discount = Number(overallDiscount) || 0;
    return Math.max(0, subtotal - discount);
  };

  const handleSelectItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setSelectedItem(item);
    setSearchItemTerm(item.name);

    // Load variants
    try {
      const allVars = await inventoryService.getVariants(centerId!, item.id);
      const salesVars = allVars.filter(v => v.isActive !== false);
      setItemVariants(salesVars);
      if (salesVars.length > 0) {
        setSelectedVariantId(salesVars[0].id);
        setRateInput(salesVars[0].sellingPrice);
        setQtyInput(1);
        setDiscountInput(0);
      } else {
        setSelectedVariantId('');
        setRateInput('');
        toast.warning('No active variants for this item.');
      }
    } catch {
      toast.error('Failed to load item variants');
    }
  };


  const handleVariantChange = (variantId: string) => {
    const v = itemVariants.find(varObj => varObj.id === variantId);
    if (v) {
      setSelectedVariantId(variantId);
      setRateInput(v.sellingPrice);
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
      toast.error('Quantity and price must be positive values');
      return;
    }

    if (!variant) return;

    // Check negative stock constraint
    const packageSize = variant.packageSize || 1;
    const requestedBaseQty = qty * packageSize;
    const availableStock = selectedItem.stockInBaseUnit || 0;
    if (!settings.enableNegativeStock && availableStock < requestedBaseQty) {
      toast.error(`Insufficient stock. Available: ${availableStock} ${selectedItem.baseUnit || 'units'}.`);
      return;
    }

    // Calculate tax amounts
    const gstPercent = selectedItem.gst || 0;
    const baseTotal = (qty * rate) - disc;
    const gstAmount = (baseTotal * gstPercent) / 100;
    const total = baseTotal + gstAmount;

    const cartItem: SalesEntryItem = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      variantId: selectedVariantId,
      variantName: variant.name,
      quantity: qty,
      packageSizeSnapshot: packageSize,
      sellingPrice: rate,
      gstPercent,
      gstAmount,
      discount: disc,
      total
    };

    const exists = cart.findIndex(c => c.variantId === selectedVariantId);
    if (exists > -1) {
      const newCart = [...cart];
      newCart[exists] = cartItem;
      setCart(newCart);
      toast.info('Cart updated with modified variant details');
    } else {
      setCart(prev => [...prev, cartItem]);
      toast.success('Product added to invoice cart');
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

  const handleSaveInvoice = async () => {
    if (!centerId) return;

    let customerNameStr = '';
    let fId: string | undefined = undefined;

    if (customerType === 'farmer') {
      if (!selectedFarmerId) {
        toast.error('Please select a farmer');
        return;
      }
      fId = selectedFarmerId;
      customerNameStr = farmers.find(f => f.id === selectedFarmerId)?.name || '';
    } else {
      if (!guestName.trim()) {
        toast.error('Please specify customer name');
        return;
      }
      customerNameStr = guestName.trim();
    }

    if (cart.length === 0) {
      toast.error('Invoice cart is empty');
      return;
    }

    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const gstTotal = cart.reduce((sum, item) => sum + item.gstAmount, 0);
    const discount = Number(overallDiscount) || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const sData = {
      farmerId: fId,
      customerName: customerNameStr,
      date: new Date(salesDate),
      items: cart,
      total: subtotal,
      gstTotal,
      discount,
      grandTotal,
      paymentMode,
      notes,
    };

    setIsLoading(true);
    try {
      await salesService.add(centerId, sData, profile?.name || 'user');
      toast.success('Sales Invoice completed & stock updated');

      // Reset form
      setCart([]);
      setSelectedFarmerId('');
      setGuestName('');
      setOverallDiscount('');
      setNotes('');

      // Reload lists
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sales invoice');
      setIsLoading(false);
    }
  };

  const currentFarmer = farmers.find(f => f.id === selectedFarmerId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Form Side */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer Selection */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2 flex items-center gap-1.5">
              <UserCheck size={15} className="text-[#FF6B00]" /> 1. Customer Selection
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Customer Type</label>
                <div className="flex bg-[#F7F7F7] border border-[#ECECEC] rounded-xl p-1 gap-1">
                  <button
                    onClick={() => { setCustomerType('farmer'); setGuestName(''); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${customerType === 'farmer' ? 'bg-[#111] text-white' : 'text-[#777]'}`}
                  >
                    Farmer Ledger
                  </button>
                  <button
                    onClick={() => { setCustomerType('guest'); setSelectedFarmerId(''); setPaymentMode('cash'); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${customerType === 'guest' ? 'bg-[#111] text-white' : 'text-[#777]'}`}
                  >
                    Guest Customer
                  </button>
                </div>
              </div>

              <div>
                {customerType === 'farmer' ? (
                  <>
                    <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Select Farmer *</label>
                    <select
                      value={selectedFarmerId}
                      onChange={e => setSelectedFarmerId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                    >
                      <option value="">-- Choose --</option>
                      {farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Customer Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                    />
                  </>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={salesDate}
                  onChange={e => setSalesDate(e.target.value)}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                />
              </div>
            </div>

            {customerType === 'farmer' && currentFarmer && (
              <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between text-[13px] font-bold text-[#FF6B00]">
                <span>Outstanding Farmer Balance:</span>
                <span>
                  {currentFarmer.balance >= 0 ? '+' : '-'}₹{Math.abs(currentFarmer.balance || 0).toFixed(2)}
                  <span className="text-[10px] text-[#777] ml-1 font-medium">({currentFarmer.balance >= 0 ? 'To Pay' : 'To Receive'})</span>
                </span>
              </div>
            )}
          </div>

          {/* Add Cart Items */}
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[14px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2 flex items-center gap-1.5">
              <Plus size={15} className="text-[#FF6B00]" /> 2. Add Invoice Items
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5 relative">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Search Item</label>
                <input
                  type="text"
                  placeholder="Scan barcode or type name..."
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

                {searchItemTerm && !selectedItem && (() => {
                  const filtered = items.filter(i =>
                    i.name.toLowerCase().includes(searchItemTerm.toLowerCase()) ||
                    i.sku.toLowerCase().includes(searchItemTerm.toLowerCase()) ||
                    (i.barcode && i.barcode.toLowerCase().includes(searchItemTerm.toLowerCase()))
                  );

                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#ECECEC] rounded-xl shadow-lg max-h-48 overflow-y-auto z-10 p-2 divide-y divide-gray-50">
                      {filtered.length > 0 ? (
                        filtered.map(i => (
                          <div
                            key={i.id}
                            onClick={() => handleSelectItem(i.id)}
                            className="p-2 text-[12px] font-bold text-[#333] hover:bg-gray-50 cursor-pointer flex justify-between"
                          >
                            <span>{i.name}</span>
                            <span className="text-gray-400 font-mono text-[10px]">{i.sku}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center space-y-2">
                          <p className="text-[12px] font-semibold text-gray-500">No inventory item found.</p>
                          <a
                            href="/inventory/items"
                            className="inline-block px-3 py-1.5 bg-[#FF6B00] text-white rounded-lg text-[11px] font-bold hover:bg-[#e05e00] transition-colors"
                          >
                            Add Item to Inventory
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                    <option key={v.id} value={v.id}>{v.name} (Stock: {Math.floor(((selectedItem?.stockInBaseUnit) || 0) / (v.packageSize || 1))})</option>
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
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Selling Price</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none"
                  readOnly
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
            <h3 className="text-[14px] font-bold text-[#111111]">Invoice Sales Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                    <th className="pb-2">Product Name</th>
                    <th className="pb-2">Variant</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">GST</th>
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
                        <td className="py-2.5 text-right">₹{formatCurrency(item.sellingPrice)}</td>
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

        {/* Right Sidebar checklist */}
        <div className="space-y-6">
          <div style={cardStyle} className="p-6 space-y-4">
            <h3 className="text-[15px] font-bold text-[#111111] border-b border-[#ECECEC] pb-2">3. Invoice Summary</h3>

            <div className="space-y-3.5 text-[13px] font-semibold text-[#555]">
              <div className="flex justify-between">
                <span>Subtotal (incl. Tax)</span>
                <span className="text-[#111]">₹{formatCurrency(cart.reduce((sum, item) => sum + (item.total ?? 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Overall Discount (₹)</span>
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
                  <option value="cash">Cash Payment</option>
                  <option value="upi">UPI / Online</option>
                  <option value="bank">Bank / Cheque</option>
                  {customerType === 'farmer' && <option value="farmer_ledger">Farmer Balance Ledger</option>}
                </select>
              </div>

              <div className="text-[11px] bg-gray-50 border border-gray-100 rounded-xl p-3 text-gray-500 font-semibold leading-relaxed">
                {paymentMode === 'farmer_ledger' ? (
                  <span className="text-red-500 font-bold">WARNING: This invoice total will be deducted from the farmer's balance.</span>
                ) : (
                  <span>Transaction will settle immediately in full.</span>
                )}
                <br />
                Stock levels decrease automatically.
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Delivered, Pending collection"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] text-[#111] outline-none"
                />
              </div>

              <button
                onClick={handleSaveInvoice}
                disabled={isLoading || cart.length === 0 || (customerType === 'farmer' && !selectedFarmerId) || (customerType === 'guest' && !guestName)}
                className="w-full py-3.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2 cursor-pointer"
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Previous Sales Invoices */}
      <div style={cardStyle} className="p-6 space-y-4">
        <h3 className="text-[15px] font-bold text-[#111111]">Recent Sales Invoices</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#ECECEC] text-[10px] text-[#999999] uppercase font-bold">
                <th className="pb-2">Invoice No</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Customer Name</th>
                <th className="pb-2 text-right">Items Count</th>
                <th className="pb-2 text-right">Grand Total</th>
                <th className="pb-2 text-center">Settlement</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">No invoices recorded yet.</td>
                </tr>
              ) : (
                recentSales.slice(0, 10).map(s => {
                  const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
                  return (
                    <tr key={s.id} className="border-b border-[#F7F7F7] last:border-none">
                      <td className="py-2.5 font-bold font-mono text-[#111111]">{s.invoiceNumber}</td>
                      <td className="py-2.5 text-[#555]">{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="py-2.5 font-semibold text-[#333]">{s.customerName}</td>
                      <td className="py-2.5 text-right">{s.items.length} items</td>
                      <td className="py-2.5 text-right font-extrabold">₹{formatCurrency(s.grandTotal)}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${s.paymentMode === 'farmer_ledger' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-green-50 border-green-200 text-green-600'}`}>
                          {s.paymentMode.replace('_', ' ')}
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
  );
}
