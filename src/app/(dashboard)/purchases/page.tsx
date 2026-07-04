'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { purchaseService } from '@/services/purchaseService';
import { farmerService } from '@/services/farmerService';
import { Farmer, PurchaseItem } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, ShoppingCart, Trash2, CheckCircle2 } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function PurchasesPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  
  // Purchase flow state
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual entry state
  const [itemName, setItemName] = useState('');
  const [itemRate, setItemRate] = useState<number | ''>('');
  const [itemQty, setItemQty] = useState<number | ''>('');

  const load = async () => {
    if (!centerId) return;
    try {
      const farData = await farmerService.getAll(centerId);
      setFarmers(farData);
    } catch {
      toast.error('Failed to load farmers');
    }
  };

  useEffect(() => { load(); }, [centerId]);

  const addToCart = () => {
    if (!itemName.trim() || !itemRate || !itemQty) {
      toast.error('Please fill all item details');
      return;
    }
    const qty = Number(itemQty);
    const rate = Number(itemRate);
    if (qty <= 0 || rate <= 0) {
      toast.error('Quantity and rate must be greater than zero');
      return;
    }
    
    setCart(prev => [...prev, {
      productId: `manual-${Date.now()}`,
      name: itemName.trim(),
      quantity: qty,
      price: rate,
      subtotal: qty * rate
    }]);

    // reset entry
    setItemName('');
    setItemRate('');
    setItemQty('');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const currentFarmer = farmers.find(f => f.id.toLowerCase() === selectedFarmerId.toLowerCase());

  const handleCheckout = async () => {
    if (!centerId || !profile) return;
    if (!currentFarmer) { toast.error('Please select a valid farmer'); return; }
    if (cart.length === 0) { toast.error('Cart is empty'); return; }

    setIsSubmitting(true);
    try {
      await purchaseService.add(
        centerId,
        currentFarmer.id,
        currentFarmer.name,
        cart,
        cartTotal,
        profile.uid || 'unknown'
      );
      toast.success('Purchase completed & Ledger updated');
      setCart([]);
      setSelectedFarmerId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex border-b border-[#ECECEC]">
        <div className="px-6 py-3 text-[14px] font-bold border-b-2 border-[#FF6B00] text-[#FF6B00]">
          <div className="flex items-center gap-2"><ShoppingCart size={16} /> New Purchase Entry</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Side */}
        <div className="lg:col-span-2 space-y-5">
          {/* Farmer Selection */}
          <div style={cardStyle} className="p-6">
            <h3 className="text-[15px] font-bold text-[#111] mb-4">1. Select Farmer</h3>
            <div className="relative">
              <input
                list="farmer-list"
                value={selectedFarmerId}
                onChange={e => setSelectedFarmerId(e.target.value)}
                placeholder="Type or select Farmer ID..."
                autoComplete="off"
                className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[14px] font-semibold text-[#111] outline-none focus:border-[#FF6B00] uppercase"
              />
              <datalist id="farmer-list">
                {farmers.filter(f => f.active).map(f => (
                  <option key={f.id} value={f.id}>{f.name} - {f.village}</option>
                ))}
              </datalist>
              <div className="h-6 mt-2">
                {currentFarmer ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} style={{ color: '#22C55E' }} />
                    <span className="text-[13px] font-semibold" style={{ color: '#22C55E' }}>{currentFarmer.name}</span>
                    <span className="text-[12px] text-[#AAAAAA]">· Balance: {currentFarmer.balance >= 0 ? '+' : '-'}₹{Math.abs(currentFarmer.balance || 0).toFixed(2)}</span>
                  </motion.div>
                ) : selectedFarmerId ? (
                  <span className="text-[12px] text-red-500">Farmer not found. Check ID.</span>
                ) : (
                  <span className="text-[12px] text-[#BBBBBB]">Enter farmer ID to auto-fill details</span>
                )}
              </div>
            </div>
          </div>

          {/* Manual Entry */}
          <div style={cardStyle} className="p-6">
            <h3 className="text-[15px] font-bold text-[#111] mb-4">2. Add Item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. Cow Feed 50kg"
                  className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[14px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Rate (₹)</label>
                <input
                  type="number"
                  value={itemRate}
                  onChange={e => setItemRate(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[14px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Qty</label>
                <input
                  type="number"
                  value={itemQty}
                  onChange={e => setItemQty(e.target.value ? Number(e.target.value) : '')}
                  placeholder="1"
                  className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[14px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  onClick={addToCart}
                  className="w-full py-3 bg-orange-50 text-[#FF6B00] text-[14px] font-bold rounded-xl hover:bg-[#FF6B00] hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="space-y-5">
          <div style={cardStyle} className="overflow-hidden flex flex-col h-[500px]">
            <div className="px-5 py-4 border-b border-[#ECECEC] bg-[#FAFAFA]">
              <h3 className="text-[15px] font-bold text-[#111]">Cart Summary</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-5 divide-y divide-[#F0F0F0]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#AAA]">
                  <ShoppingCart size={32} className="mb-2 opacity-50" />
                  <p className="text-[13px]">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="text-[14px] font-bold text-[#111]">{item.name}</div>
                      <div className="text-[12px] text-[#777]">{item.quantity} x ₹{item.price.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-[#111]">₹{item.subtotal.toFixed(2)}</div>
                      <button onClick={() => removeFromCart(item.productId!)} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 justify-end mt-1">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-5 border-t border-[#ECECEC] bg-[#FAFAFA]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[14px] font-semibold text-[#777]">Total Amount</span>
                <span className="text-[24px] font-extrabold text-[#FF6B00]">₹{cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0 || !currentFarmer}
                className="w-full py-3.5 bg-[#111] text-white text-[14px] font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Processing...' : 'Complete Purchase'}
              </button>
              <div className="mt-3 text-center text-[10px] text-[#777]">
                Amount will be automatically deducted from the farmer's balance ledger.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
