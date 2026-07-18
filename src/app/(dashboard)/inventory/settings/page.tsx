'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Settings, Save, AlertCircle, RefreshCw } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function InventorySettingsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    enableNegativeStock: false,
    autoGenerateSku: true,
    autoBarcode: true,
    gstEnabled: true,
    lowStockThreshold: 10,
  });

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const sett = await inventoryService.getInventorySettings(centerId);
      setSettings({
        enableNegativeStock: sett.enableNegativeStock,
        autoGenerateSku: sett.autoGenerateSku,
        autoBarcode: sett.autoBarcode,
        gstEnabled: sett.gstEnabled,
        lowStockThreshold: sett.lowStockThreshold || 10,
      });
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) return;

    setIsSaving(true);
    try {
      await inventoryService.saveInventorySettings(centerId, settings);
      toast.success('Inventory settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl p-6 bg-white border border-[#ECECEC] rounded-3xl animate-pulse space-y-4">
        <div className="h-5 bg-gray-100 rounded w-1/3" />
        <div className="h-28 bg-gray-50 rounded-xl" />
        <div className="h-28 bg-gray-50 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-[18px] font-extrabold text-[#111111] uppercase tracking-wide">Inventory Settings</h2>
      </div>

      <form onSubmit={handleSave} style={cardStyle} className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-[#FF6B00] border-b border-[#ECECEC] pb-3">
          <Settings size={18} />
          <h3 className="text-[14px] font-bold text-[#111111]">ERP Stock Configuration</h3>
        </div>

        <div className="space-y-4">
          
          {/* Negative Stock Toggle */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-[13px] font-bold text-[#111111] cursor-pointer" htmlFor="enableNegativeStock">
                Allow Negative Stock
              </label>
              <p className="text-[11px] text-[#777777] leading-relaxed">
                If enabled, the Sales screen will allow checkouts even if the quantity sold exceeds physical inventory. Useful for items sold as loose weight.
              </p>
            </div>
            <input
              type="checkbox"
              id="enableNegativeStock"
              checked={settings.enableNegativeStock}
              onChange={e => setSettings(prev => ({ ...prev, enableNegativeStock: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer mt-1"
            />
          </div>

          {/* Auto Generate SKU */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-[13px] font-bold text-[#111111] cursor-pointer" htmlFor="autoGenerateSku">
                Auto-generate SKU codes
              </label>
              <p className="text-[11px] text-[#777777] leading-relaxed">
                Automatically formats and generates product codes (e.g. SKU-COWF-4309) during creation based on the item name.
              </p>
            </div>
            <input
              type="checkbox"
              id="autoGenerateSku"
              checked={settings.autoGenerateSku}
              onChange={e => setSettings(prev => ({ ...prev, autoGenerateSku: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer mt-1"
            />
          </div>

          {/* Auto Generate Barcode */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-[13px] font-bold text-[#111111] cursor-pointer" htmlFor="autoBarcode">
                Auto-generate Barcodes
              </label>
              <p className="text-[11px] text-[#777777] leading-relaxed">
                Automatically generate alphanumeric barcodes for products if not supplied manually. Used for printing sticker labels.
              </p>
            </div>
            <input
              type="checkbox"
              id="autoBarcode"
              checked={settings.autoBarcode}
              onChange={e => setSettings(prev => ({ ...prev, autoBarcode: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer mt-1"
            />
          </div>

          {/* GST Taxes Enabled */}
          <div className="flex items-start justify-between gap-4 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="space-y-0.5">
              <label className="text-[13px] font-bold text-[#111111] cursor-pointer" htmlFor="gstEnabled">
                Enable GST calculations
              </label>
              <p className="text-[11px] text-[#777777] leading-relaxed">
                Applies item GST rates during purchases and sales invoicing calculations. Deactivating resets GST calculations to zero.
              </p>
            </div>
            <input
              type="checkbox"
              id="gstEnabled"
              checked={settings.gstEnabled}
              onChange={e => setSettings(prev => ({ ...prev, gstEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer mt-1"
            />
          </div>

          {/* Low Stock Threshold */}
          <div className="space-y-1.5 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl">
            <div className="flex justify-between items-center">
              <label className="text-[13px] font-bold text-[#111111] cursor-pointer" htmlFor="lowStockThreshold">
                Low Stock Notification Threshold
              </label>
              <input
                type="number"
                id="lowStockThreshold"
                value={settings.lowStockThreshold}
                onChange={e => setSettings(prev => ({ ...prev, lowStockThreshold: Number(e.target.value) }))}
                className="w-20 px-2 py-1 text-center bg-white border border-[#ECECEC] rounded-lg outline-none text-[12px] font-bold"
              />
            </div>
            <p className="text-[11px] text-[#777777] leading-relaxed">
              Triggers a Low Stock warning badge when available units fall below or equal this threshold level (applies to items without custom alert thresholds).
            </p>
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#ECECEC]">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-xl text-[13px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            Save Configuration
          </button>
        </div>

      </form>
    </div>
  );
}
