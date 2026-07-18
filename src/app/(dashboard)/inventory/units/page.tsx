'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Plus, Trash2, Scale } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function UnitsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<string[]>([]);
  const [newUnit, setNewUnit] = useState('');

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const sett = await inventoryService.getInventorySettings(centerId);
      setUnits(sett.units || []);
    } catch {
      toast.error('Failed to load units');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !newUnit.trim()) return;

    const trimmed = newUnit.trim();
    if (units.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Unit already exists');
      return;
    }

    const updated = [...units, trimmed];
    try {
      await inventoryService.saveInventorySettings(centerId, { units: updated });
      setUnits(updated);
      setNewUnit('');
      toast.success('Unit added successfully');
    } catch {
      toast.error('Failed to save unit');
    }
  };

  const handleDelete = async (unitToDelete: string) => {
    if (!centerId) return;
    if (!confirm(`Are you sure you want to delete unit "${unitToDelete}"?`)) return;

    const updated = units.filter(u => u !== unitToDelete);
    try {
      await inventoryService.saveInventorySettings(centerId, { units: updated });
      setUnits(updated);
      toast.success('Unit deleted');
    } catch {
      toast.error('Failed to delete unit');
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-[18px] font-extrabold text-[#111111] uppercase tracking-wide">Manage Units</h2>
      </div>

      <div style={cardStyle} className="p-6 space-y-4">
        {/* Add Unit Form */}
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            required
            placeholder="e.g. Box, Bottle, Can, KG, Packet..."
            value={newUnit}
            onChange={e => setNewUnit(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#FF6B00] hover:bg-orange-600 text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Plus size={16} /> Add Unit
          </button>
        </form>

        {/* Units List */}
        <div className="border-t border-[#ECECEC] pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#999999] flex flex-col items-center gap-2">
              <Scale size={24} className="opacity-40" />
              No units found. Add one above.
            </div>
          ) : (
            <div className="divide-y divide-[#F7F7F7]">
              {units.map((unit, index) => (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={unit}
                  className="py-3 flex justify-between items-center text-[13px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-orange-50 text-[#FF6B00] flex items-center justify-center text-[11px] font-extrabold">{index + 1}</span>
                    <span className="font-semibold text-[#111111]">{unit}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(unit)}
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
