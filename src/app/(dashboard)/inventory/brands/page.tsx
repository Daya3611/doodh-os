'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Trash2, Award } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function BrandsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [brands, setBrands] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState('');

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const sett = await inventoryService.getInventorySettings(centerId);
      setBrands(sett.brands || []);
    } catch {
      toast.error('Failed to load brands');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !newBrand.trim()) return;

    const trimmed = newBrand.trim();
    if (brands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Brand already exists');
      return;
    }

    const updated = [...brands, trimmed];
    try {
      await inventoryService.saveInventorySettings(centerId, { brands: updated });
      setBrands(updated);
      setNewBrand('');
      toast.success('Brand added successfully');
    } catch {
      toast.error('Failed to save brand');
    }
  };

  const handleDelete = async (brandToDelete: string) => {
    if (!centerId) return;
    if (!confirm(`Are you sure you want to delete brand "${brandToDelete}"?`)) return;

    const updated = brands.filter(b => b !== brandToDelete);
    try {
      await inventoryService.saveInventorySettings(centerId, { brands: updated });
      setBrands(updated);
      toast.success('Brand deleted');
    } catch {
      toast.error('Failed to delete brand');
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-[18px] font-extrabold text-[#111111] uppercase tracking-wide">Manage Brands</h2>
      </div>

      <div style={cardStyle} className="p-6 space-y-4">
        {/* Add Brand Form */}
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            required
            placeholder="e.g. Godrej Vetfeed, Cargill, Himalaya..."
            value={newBrand}
            onChange={e => setNewBrand(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#FF6B00] hover:bg-orange-600 text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} /> Add Brand
          </button>
        </form>

        {/* Brands List */}
        <div className="border-t border-[#ECECEC] pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#999999] flex flex-col items-center gap-2">
              <Award size={24} className="opacity-40" />
              No brands found. Add one above.
            </div>
          ) : (
            <div className="divide-y divide-[#F7F7F7]">
              {brands.map((brand, index) => (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={brand}
                  className="py-3 flex justify-between items-center text-[13px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#FF6B00] flex items-center justify-center text-[11px] font-extrabold">{index + 1}</span>
                    <span className="font-semibold text-[#111111]">{brand}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(brand)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
