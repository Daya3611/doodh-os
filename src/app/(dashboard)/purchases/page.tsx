'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { purchaseService } from '@/services/purchaseService';
import { farmerService } from '@/services/farmerService';
import { InventoryItem, Farmer, PurchaseItem } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ShoppingCart, Package, CheckCircle2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function PurchasesPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [activeTab, setActiveTab] = useState<'purchase' | 'inventory'>('purchase');
  
  // Data state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  
  // Purchase flow state
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inventory form state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const load = async () => {
    if (!centerId) return;
    try {
      const [invData, farData] = await Promise.all([
        inventoryService.getAll(centerId),
        farmerService.getAll(centerId)
      ]);
      setInventory(invData);
      setFarmers(farData);
    } catch {
      toast.error('Failed to load data');
    }
  };

  useEffect(() => { load(); }, [centerId]);

  const handleAddProduct = async (data: any) => {
    if (!centerId) return;
    try {
      await inventoryService.add(centerId, {
        name: data.name,
        category: data.category,
        price: parseFloat(data.price),
        stock: parseInt(data.stock, 10),
        unit: data.unit
      });
      toast.success('Product added');
      setShowAddProduct(false);
      reset();
      load();
    } catch {
      toast.error('Failed to add product');
    }
  };

  const addToCart = (product: InventoryItem, qty: number) => {
    if (qty <= 0) return;
    if (qty > product.stock) {
      toast.error(`Only ${product.stock} ${product.unit} available`);
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity + qty > product.stock) {
          toast.error('Cannot exceed available stock');
          return prev;
        }
        return prev.map(item => item.productId === product.id
          ? { ...item, quantity: item.quantity + qty, subtotal: (item.quantity + qty) * item.price }
          : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: qty,
        price: product.price,
        subtotal: qty * product.price
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const currentFarmer = farmers.find(f => f.id === selectedFarmerId);

  const handleCheckout = async () => {
    if (!centerId || !profile) return;
    if (!currentFarmer) { toast.error('Please select a farmer'); return; }
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
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex border-b border-[#ECECEC]">
        <button
          onClick={() => setActiveTab('purchase')}
          className={`px-6 py-3 text-[14px] font-bold border-b-2 transition-colors ${activeTab === 'purchase' ? 'border-[#FF6B00] text-[#FF6B00]' : 'border-transparent text-[#777] hover:text-[#111]'}`}
        >
          <div className="flex items-center gap-2"><ShoppingCart size={16} /> New Purchase</div>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-6 py-3 text-[14px] font-bold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-[#FF6B00] text-[#FF6B00]' : 'border-transparent text-[#777] hover:text-[#111]'}`}
        >
          <div className="flex items-center gap-2"><Package size={16} /> Inventory Stock</div>
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-[18px] font-bold text-[#111]">Manage Inventory</h2>
            <button onClick={() => setShowAddProduct(!showAddProduct)} className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-[13px] font-bold rounded-xl hover:bg-[#e66000]">
              <Plus size={16} /> Add Product
            </button>
          </div>

          {showAddProduct && (
            <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={cardStyle} className="p-6 overflow-hidden" onSubmit={handleSubmit(handleAddProduct)}>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Product Name</label>
                  <input {...register('name')} required className="w-full px-3 py-2 border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Category</label>
                  <select {...register('category')} className="w-full px-3 py-2 border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00] bg-white">
                    <option value="Feed">Animal Feed</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Price (₹)</label>
                  <input type="number" step="0.01" {...register('price')} required className="w-full px-3 py-2 border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Stock Qty</label>
                  <input type="number" {...register('stock')} required className="w-full px-3 py-2 border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-2 block">Unit (e.g. Bag, Kg)</label>
                  <input {...register('unit')} required className="w-full px-3 py-2 border border-[#ECECEC] rounded-lg outline-none focus:border-[#FF6B00]" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="px-6 py-2 bg-[#111] text-white text-[13px] font-bold rounded-lg hover:bg-gray-800">Save Product</button>
              </div>
            </motion.form>
          )}

          <div style={cardStyle} className="overflow-hidden">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0] text-[11px] font-bold text-[#777] uppercase tracking-wider">
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Stock Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-6 py-4 text-[14px] font-bold text-[#111]">{item.name}</td>
                    <td className="px-6 py-4 text-[13px] text-[#555]">{item.category}</td>
                    <td className="px-6 py-4 text-[14px] font-bold text-green-600">₹{item.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[12px] font-bold ${item.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.stock} {item.unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'purchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Shop */}
          <div className="lg:col-span-2 space-y-5">
            <div style={cardStyle} className="p-6">
              <h3 className="text-[15px] font-bold text-[#111] mb-4">1. Select Farmer</h3>
              <select
                value={selectedFarmerId}
                onChange={e => setSelectedFarmerId(e.target.value)}
                className="w-full px-4 py-3 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[14px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
              >
                <option value="">-- Choose a Farmer --</option>
                {farmers.filter(f => f.active).map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.id}) - Bal: ₹{f.balance || 0}</option>
                ))}
              </select>
            </div>

            <div style={cardStyle} className="p-6">
              <h3 className="text-[15px] font-bold text-[#111] mb-4">2. Select Products</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {inventory.filter(i => i.stock > 0).map(item => (
                  <div key={item.id} className="border border-[#ECECEC] rounded-xl p-4 flex flex-col justify-between hover:border-[#FF6B00] transition-colors group cursor-pointer" onClick={() => addToCart(item, 1)}>
                    <div>
                      <div className="text-[10px] font-bold text-[#777] uppercase tracking-wider mb-1">{item.category}</div>
                      <div className="text-[15px] font-bold text-[#111]">{item.name}</div>
                      <div className="text-[13px] text-[#555] mt-1">₹{item.price.toFixed(2)} / {item.unit}</div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[11px] font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded">Stock: {item.stock}</span>
                      <button className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center group-hover:bg-[#FF6B00] group-hover:text-white transition-colors">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {inventory.filter(i => i.stock > 0).length === 0 && (
                  <div className="col-span-full py-10 text-center text-[13px] text-[#777]">No products in stock. Add items to inventory first.</div>
                )}
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
                        <button onClick={() => removeFromCart(item.productId)} className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 justify-end mt-1">
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
                  disabled={isSubmitting || cart.length === 0 || !selectedFarmerId}
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
      )}
    </div>
  );
}
