'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { InventoryItem, InventoryVariant, ItemStatus, VariantDraftRow } from '@/types';
import { getPresetVariantsForUnit } from '@/utils/variantPresets';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit3, Trash2, ChevronDown, ChevronUp,
  Barcode, Layers, Save, X, Printer, RefreshCw, AlertCircle,
  Copy, ArrowUp, ArrowDown, Sparkles, Check, ShoppingBag, Box, Percent, Lock, Info
} from 'lucide-react';
import { generateBarcodeSVG } from '@/utils/barcodeGenerator';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function ItemMasterPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown lists
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  // Item Form Modal state (3-Tier ERP Master Form)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [itemFormData, setItemFormData] = useState({
    name: '',
    category: '',
    brand: '',
    sku: '',
    barcode: '',
    description: '',
    gst: 0,
    baseUnit: 'KG', // Stock Unit (smallest inventory unit)
    stockUnit: 'KG',
    defaultPurchaseUnit: 'Bag', // Purchase Unit Name (e.g. Bag, Box, Tin)
    purchaseMultiplier: 50,    // 1 Purchase Unit contains 50 Stock Units
    purchasePrice: 2600,       // Purchase Price per Purchase Unit
    minimumStock: 5,
    stockInBaseUnit: 0,
    maximumStock: 100,
    status: 'active' as ItemStatus,
    image: '',
  });

  // Selling Variants state for the form
  const [variantDrafts, setVariantDrafts] = useState<VariantDraftRow[]>([]);

  // Barcode Modal state
  const [barcodeModalText, setBarcodeModalText] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState({
    autoGenerateSku: true,
    autoBarcode: true,
  });

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const itemsData = await inventoryService.getAll(centerId);
      setItems(itemsData);

      const sett = await inventoryService.getInventorySettings(centerId);
      setCategories(sett.categories);
      setBrands(sett.brands);
      setUnits(sett.units);
      setSettings({
        autoGenerateSku: sett.autoGenerateSku,
        autoBarcode: sett.autoBarcode
      });
    } catch {
      toast.error('Failed to load item lists');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  // Derived Cost per Stock Unit (Read-only badge: 2600 / 50 = ₹52 per KG)
  const costPerStockUnit = itemFormData.purchaseMultiplier > 0
    ? Number((itemFormData.purchasePrice / itemFormData.purchaseMultiplier).toFixed(4))
    : 0;

  // Handle auto-generation of SKU & Barcode
  const generateSkuAndBarcode = (nameStr: string) => {
    if (!nameStr) return;
    const clean = nameStr.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const rand = Math.floor(1000 + Math.random() * 9000);

    setItemFormData(prev => ({
      ...prev,
      sku: settings.autoGenerateSku && !prev.sku ? `SKU-${clean}-${rand}` : prev.sku,
      barcode: settings.autoBarcode && !prev.barcode ? `BAR-${clean}-${rand}` : prev.barcode,
    }));
  };

  // Helper to load smart presets for a stock unit
  const buildPresetsForUnit = (stockUnit: string, skuPrefix: string, basePurchasePrice: number, basePurchaseMult: number) => {
    const unitCost = basePurchaseMult > 0 ? (basePurchasePrice / basePurchaseMult) : 0;
    const presets = getPresetVariantsForUnit(stockUnit);

    return presets.map((p, idx) => {
      const mult = p.multiplier;
      const purchaseCost = Number((mult * unitCost).toFixed(2));
      return {
        name: p.name,
        multiplier: mult,
        packageSize: mult,
        purchasePrice: purchaseCost,
        pricingMode: 'manual' as const,
        profitMargin: 20,
        sellingPrice: purchaseCost > 0 ? Number((purchaseCost * 1.15).toFixed(2)) : 0,
        barcode: '',
        sku: `${skuPrefix || 'SKU'}-V${idx + 1}`,
        isDefault: p.isDefault || idx === 0,
        isActive: true,
      };
    });
  };

  const handleOpenAddModal = () => {
    const defaultUnit = units[0] || 'KG';
    const initialSku = '';
    const initialPurchasePrice = 2600;
    const initialPurchaseMult = 50;
    const presets = buildPresetsForUnit(defaultUnit, initialSku, initialPurchasePrice, initialPurchaseMult);

    setEditingItem(null);
    setItemFormData({
      name: '',
      category: categories[0] || '',
      brand: brands[0] || '',
      sku: initialSku,
      barcode: '',
      description: '',
      gst: 0,
      baseUnit: defaultUnit,
      stockUnit: defaultUnit,
      defaultPurchaseUnit: 'Bag',
      purchaseMultiplier: initialPurchaseMult,
      purchasePrice: initialPurchasePrice,
      minimumStock: 5,
      stockInBaseUnit: 0,
      maximumStock: 100,
      status: 'active',
      image: '',
    });

    setVariantDrafts(presets);
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = async (item: InventoryItem) => {
    const unit = item.stockUnit || item.baseUnit || 'KG';
    const purchaseMult = item.purchaseMultiplier || 50;
    const purchasePrice = item.purchasePrice || 0;

    setEditingItem(item);
    setItemFormData({
      name: item.name,
      category: item.category,
      brand: item.brand,
      sku: item.sku,
      barcode: item.barcode || '',
      description: item.description || '',
      gst: item.gst,
      baseUnit: unit,
      stockUnit: unit,
      defaultPurchaseUnit: item.defaultPurchaseUnit || 'Bag',
      purchaseMultiplier: purchaseMult,
      purchasePrice,
      minimumStock: item.minimumStock,
      stockInBaseUnit: item.stockInBaseUnit || 0,
      maximumStock: item.maximumStock,
      status: item.status,
      image: item.image || '',
    });

    if (centerId) {
      const existingVariants = await inventoryService.getVariants(centerId, item.id);
      if (existingVariants.length > 0) {
        const unitCost = purchaseMult > 0 ? (purchasePrice / purchaseMult) : 0;
        setVariantDrafts(existingVariants.map(v => {
          const mult = v.multiplier || v.packageSize || 1;
          const purchaseCost = Number((mult * unitCost).toFixed(2));
          const mode = v.pricingMode || 'manual';
          const margin = v.profitMargin || 20;
          const sellPrice = mode === 'auto' && purchaseCost > 0
            ? Number((purchaseCost * (1 + margin / 100)).toFixed(2))
            : v.sellingPrice;

          return {
            id: v.id,
            name: v.name,
            multiplier: mult,
            packageSize: mult,
            purchasePrice: purchaseCost,
            pricingMode: mode,
            profitMargin: margin,
            sellingPrice: sellPrice,
            barcode: v.barcode,
            sku: v.sku,
            isDefault: v.isDefault,
            isActive: v.isActive,
          };
        }));
      } else {
        setVariantDrafts(buildPresetsForUnit(unit, item.sku, purchasePrice, purchaseMult));
      }
    }
    setIsItemModalOpen(true);
  };

  // Auto-recalculate variant purchase costs and auto-selling prices when purchase parameters change
  const updatePurchasePricing = (newPurchasePrice: number, newPurchaseMultiplier: number) => {
    const unitCost = newPurchaseMultiplier > 0 ? (newPurchasePrice / newPurchaseMultiplier) : 0;
    setVariantDrafts(prev => prev.map(v => {
      const purchaseCost = Number((v.multiplier * unitCost).toFixed(2));
      const sellPrice = v.pricingMode === 'auto'
        ? Number((purchaseCost * (1 + (v.profitMargin || 0) / 100)).toFixed(2))
        : v.sellingPrice;
      return {
        ...v,
        purchasePrice: purchaseCost,
        sellingPrice: sellPrice,
      };
    }));
  };

  // When Stock Unit changes, option to suggest presets
  const handleStockUnitChange = (newUnit: string) => {
    const presets = buildPresetsForUnit(newUnit, itemFormData.sku, itemFormData.purchasePrice, itemFormData.purchaseMultiplier);
    setItemFormData(prev => ({
      ...prev,
      baseUnit: newUnit,
      stockUnit: newUnit,
    }));

    if (variantDrafts.length === 0 || variantDrafts.every(v => v.sellingPrice === 0)) {
      setVariantDrafts(presets);
    }
  };

  const handleApplyPresetVariants = () => {
    const presets = buildPresetsForUnit(itemFormData.stockUnit, itemFormData.sku, itemFormData.purchasePrice, itemFormData.purchaseMultiplier);
    setVariantDrafts(presets);
    toast.success(`Applied preset selling variants for ${itemFormData.stockUnit}`);
  };

  // Row handlers for selling variants
  const handleAddVariantRow = () => {
    const isFirst = variantDrafts.length === 0;
    const nextIdx = variantDrafts.length + 1;
    const unitCost = itemFormData.purchaseMultiplier > 0 ? (itemFormData.purchasePrice / itemFormData.purchaseMultiplier) : 0;
    const mult = 1;
    const purchaseCost = Number((mult * unitCost).toFixed(2));

    setVariantDrafts(prev => [
      ...prev,
      {
        name: '',
        multiplier: mult,
        packageSize: mult,
        purchasePrice: purchaseCost,
        pricingMode: 'manual',
        profitMargin: 20,
        sellingPrice: 0,
        barcode: '',
        sku: `${itemFormData.sku || 'SKU'}-V${nextIdx}`,
        isDefault: isFirst,
        isActive: true,
      }
    ]);
  };

  const handleUpdateVariantRow = (index: number, field: keyof VariantDraftRow, value: any) => {
    const unitCost = itemFormData.purchaseMultiplier > 0 ? (itemFormData.purchasePrice / itemFormData.purchaseMultiplier) : 0;

    setVariantDrafts(prev => prev.map((row, idx) => {
      if (idx !== index) return row;
      const updated = { ...row, [field]: value };

      if (field === 'multiplier') {
        const mult = Number(value) || 0;
        updated.packageSize = mult;
        updated.purchasePrice = Number((mult * unitCost).toFixed(2));
        if (updated.pricingMode === 'auto') {
          updated.sellingPrice = Number((updated.purchasePrice * (1 + (updated.profitMargin || 0) / 100)).toFixed(2));
        }
      }

      if (field === 'pricingMode') {
        if (value === 'auto') {
          updated.sellingPrice = Number((updated.purchasePrice * (1 + (updated.profitMargin || 0) / 100)).toFixed(2));
        }
      }

      if (field === 'profitMargin') {
        const margin = Number(value) || 0;
        if (updated.pricingMode === 'auto') {
          updated.sellingPrice = Number((updated.purchasePrice * (1 + margin / 100)).toFixed(2));
        }
      }

      return updated;
    }));
  };

  const handleSetDefaultVariant = (index: number) => {
    setVariantDrafts(prev => prev.map((row, idx) => ({
      ...row,
      isDefault: idx === index,
    })));
  };

  const handleDuplicateVariantRow = (index: number) => {
    const target = variantDrafts[index];
    if (!target) return;
    const duplicated: VariantDraftRow = {
      ...target,
      id: undefined,
      name: target.name ? `${target.name} (Copy)` : 'Copy',
      sku: `${target.sku}-COPY`,
      isDefault: false,
    };
    const updated = [...variantDrafts];
    updated.splice(index + 1, 0, duplicated);
    setVariantDrafts(updated);
  };

  const handleDeleteVariantRow = (index: number) => {
    if (variantDrafts.length <= 1) {
      toast.error('Product must have at least one selling variant');
      return;
    }
    const wasDefault = variantDrafts[index].isDefault;
    const updated = variantDrafts.filter((_, idx) => idx !== index);
    if (wasDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    setVariantDrafts(updated);
  };

  const handleReorderVariantRow = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= variantDrafts.length) return;
    const updated = [...variantDrafts];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setVariantDrafts(updated);
  };

  // Form Submit Handler with Strict Validations
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) return;

    // 1. Mandatory Basic Fields
    if (!itemFormData.name || !itemFormData.category || !itemFormData.brand || !itemFormData.sku || !itemFormData.stockUnit) {
      toast.error('Please fill all mandatory basic information fields');
      return;
    }

    // 2. Purchase Settings Validations
    if (!itemFormData.defaultPurchaseUnit) {
      toast.error('Purchase Unit Name (e.g. Bag) is required');
      return;
    }
    if (Number(itemFormData.purchaseMultiplier) <= 0) {
      toast.error(`Contains Quantity in ${itemFormData.stockUnit} must be greater than 0`);
      return;
    }

    // 3. Selling Variants Validations
    if (variantDrafts.length === 0) {
      toast.error('At least one selling variant is required');
      return;
    }

    // Check empty variant names
    for (let i = 0; i < variantDrafts.length; i++) {
      if (!variantDrafts[i].name.trim()) {
        toast.error(`Variant #${i + 1} name cannot be empty`);
        return;
      }
    }

    // Prevent duplicate variant names
    const names = variantDrafts.map(v => v.name.trim().toLowerCase());
    const duplicateName = names.find((name, idx) => names.indexOf(name) !== idx);
    if (duplicateName) {
      toast.error(`Duplicate variant name "${duplicateName}" is not allowed`);
      return;
    }

    // Multiplier > 0 & Selling Price >= 0
    for (let i = 0; i < variantDrafts.length; i++) {
      const mult = Number(variantDrafts[i].multiplier || variantDrafts[i].packageSize || 0);
      if (mult <= 0) {
        toast.error(`Variant "${variantDrafts[i].name}" quantity must be greater than 0`);
        return;
      }
      if (Number(variantDrafts[i].sellingPrice) < 0) {
        toast.error(`Selling price for variant "${variantDrafts[i].name}" cannot be negative`);
        return;
      }
    }

    // One and only one default variant
    const defaultCount = variantDrafts.filter(v => v.isDefault).length;
    let finalVariants = [...variantDrafts];
    if (defaultCount === 0) {
      finalVariants[0].isDefault = true;
    } else if (defaultCount > 1) {
      toast.error('Please mark exactly one variant as Default');
      return;
    }

    setIsSaving(true);
    try {
      await inventoryService.saveItemWithVariants(
        centerId,
        {
          ...itemFormData,
          baseUnit: itemFormData.stockUnit,
          averageCostPerBaseUnit: costPerStockUnit,
        },
        finalVariants,
        editingItem?.id
      );

      toast.success(editingItem ? 'Product and packaging variants updated!' : 'Product created with 3-tier unit settings!');
      setIsItemModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!centerId) return;
    if (!confirm('Are you sure you want to delete this product? All associated selling variants will be permanently removed.')) return;

    try {
      await inventoryService.delete(centerId, itemId);
      toast.success('Product deleted');
      loadData();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  // Item List Variants row expansion
  const [itemVariantsMap, setItemVariantsMap] = useState<Record<string, InventoryVariant[]>>({});

  const loadVariants = async (itemId: string) => {
    if (!centerId) return;
    const data = await inventoryService.getVariants(centerId, itemId);
    setItemVariantsMap(prev => ({ ...prev, [itemId]: data }));
  };

  const handleToggleRow = (itemId: string) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
    } else {
      setExpandedItemId(itemId);
      loadVariants(itemId);
    }
  };

  // Barcode Printer
  const handlePrintBarcode = () => {
    const content = document.getElementById('printable-barcode-area')?.innerHTML;
    if (!content) return;
    const win = window.open('', '', 'width=400,height=300');
    if (win) {
      win.document.write(`<html><head><title>Print Barcode</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;">${content}</body></html>`);
      win.document.close();
      win.print();
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = !categoryFilter || item.category === categoryFilter;
    const matchesBrand = !brandFilter || item.brand === brandFilter;
    const matchesStatus = !statusFilter || item.status === statusFilter;

    return matchesSearch && matchesCat && matchesBrand && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-[#111111] tracking-tight">Inventory Items & Catalog</h1>
          <p className="text-[13px] text-[#777777] mt-0.5">
            Professional ERP Unit Conversion & Automatic Variant Costing (Marg ERP / Tally Standard)
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-2xl font-bold text-[13.5px] transition-all shadow-[0_4px_14px_rgba(255,107,0,0.35)]"
        >
          <Plus size={16} /> Create Product
        </button>
      </div>

      {/* 2. Search & Filters Bar */}
      <div style={cardStyle} className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AAAAAA]" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or barcode..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111111] outline-none focus:border-[#FF6B00]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-semibold text-[#555] outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-semibold text-[#555] outline-none"
          >
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-semibold text-[#555] outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={loadData}
            title="Refresh list"
            className="p-2.5 border border-[#ECECEC] bg-[#F7F7F7] rounded-xl text-[#555] hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 3. Items Master Table */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #ECECEC' }}>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider"></th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Product & Details</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Category / Brand</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Purchase Config</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-right">Physical Stock</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-center">Status</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F7F7F7]">
                    <td colSpan={7} className="p-6">
                      <div className="h-6 bg-[#F0F0F0] rounded w-full animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#AAAAAA] text-[13px]">
                    <AlertCircle size={32} className="mx-auto opacity-40 mb-2" />
                    No inventory items found. Click 'Create Product' above.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isExpanded = expandedItemId === item.id;
                  const isLowStock = item.stockInBaseUnit <= item.minimumStock;
                  const stockUnit = item.stockUnit || item.baseUnit || 'KG';
                  const variants = itemVariantsMap[item.id] || [];
                  const unitCost = item.averageCostPerBaseUnit || (item.purchaseMultiplier > 0 ? Number((item.purchasePrice / item.purchaseMultiplier).toFixed(2)) : 0);

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] transition-colors">
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleRow(item.id)}
                            className="p-1 rounded-lg hover:bg-gray-100 text-[#555]"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-[#111111]">{item.name}</span>
                            <div className="flex gap-2 items-center text-[10px] text-[#777777] mt-0.5 font-mono">
                              <span>SKU: {item.sku}</span>
                              {item.barcode && (
                                <button onClick={() => setBarcodeModalText(item.barcode!)} className="flex items-center gap-0.5 hover:text-[#FF6B00] text-gray-500">
                                  <Barcode size={10} /> Barcode
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-[13px] text-[#555] font-semibold">
                          <div>{item.category}</div>
                          <div className="text-[11px] text-[#999] font-normal">{item.brand}</div>
                        </td>
                        <td className="p-4 text-[12.5px] text-[#555]">
                          <div>
                            <span className="font-extrabold text-[#111]">₹{formatCurrency(item.purchasePrice)}</span>
                            <span className="text-[11px] text-[#777] font-semibold ml-1">
                              / {item.defaultPurchaseUnit || 'Bag'} ({item.purchaseMultiplier || 1} {stockUnit})
                            </span>
                          </div>
                          <div className="text-[10.5px] text-blue-600 font-bold mt-0.5">
                            Cost: ₹{unitCost}/{stockUnit}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="font-extrabold text-[14px] text-[#111]">
                            {item.stockInBaseUnit} {stockUnit}
                          </div>
                          {isLowStock && (
                            <span className="text-[9px] bg-orange-50 text-orange-600 font-extrabold border border-orange-200 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">
                              Low Stock
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg border uppercase"
                            style={item.status === 'active' ? { background: '#DCFCE7', color: '#16A34A', borderColor: '#BBF7D0' } : { background: '#FEE2E2', color: '#DC2626', borderColor: '#FECACA' }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit Product & Unit Conversion Master"
                              className="p-2 text-[#FF6B00] hover:bg-[#FFF0E6] rounded-xl transition-colors flex items-center gap-1 text-[12px] font-bold"
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              title="Delete Product"
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Selling Variants & Dynamic Stock Breakdown */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-[#FAFBFD] p-5 border-b border-[#ECECEC]">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3"
                              >
                                <div className="flex items-center justify-between border-b border-[#EBEBEB] pb-2">
                                  <h4 className="text-[12px] font-extrabold text-[#555] uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers size={14} className="text-[#FF6B00]" /> Selling Units & Calculated Stock Packs
                                  </h4>
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    className="text-[11px] font-bold text-[#FF6B00] hover:underline"
                                  >
                                    Manage Pricing in Master Form
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                  {variants.length === 0 ? (
                                    <div className="text-[11px] text-[#999] py-2">No variants created. Open Edit to add selling units.</div>
                                  ) : (
                                    variants.map(v => {
                                      const mult = v.multiplier || v.packageSize || 1;
                                      const displayPackages = Math.floor((item.stockInBaseUnit || 0) / mult);
                                      const remainder = Number(((item.stockInBaseUnit || 0) % mult).toFixed(2));
                                      const autoPurchaseCost = Number((mult * unitCost).toFixed(2));

                                      return (
                                        <div key={v.id} className="bg-white border border-[#EDEDED] rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[13px] font-bold text-[#111111]">{v.name}</span>
                                              <span className="text-[11px] text-[#666] font-semibold">({mult} {stockUnit})</span>
                                              {v.isDefault && (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-extrabold rounded-md uppercase tracking-wider">
                                                  ✓ Default Selling Unit
                                                </span>
                                              )}
                                              {v.pricingMode === 'auto' && (
                                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[8px] font-extrabold rounded-md uppercase tracking-wider">
                                                  Auto {v.profitMargin}% Margin
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex gap-3 text-[10px] font-mono text-[#777] mt-0.5">
                                              {v.barcode && (
                                                <button onClick={() => setBarcodeModalText(v.barcode)} className="flex items-center gap-0.5 hover:underline">
                                                  <Barcode size={10} /> Barcode: {v.barcode}
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap gap-4 text-[12px]">
                                            <div>
                                              <span className="text-[#888]">Purchase Cost:</span> <span className="font-bold text-[#555]">₹{formatCurrency(autoPurchaseCost)}</span>
                                            </div>
                                            <div>
                                              <span className="text-[#888]">Selling Price:</span> <span className="font-extrabold text-[#111]">₹{formatCurrency(v.sellingPrice)}</span>
                                            </div>
                                            <div className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                              <span className="text-blue-600 font-medium text-[11px]">Calculated Stock:</span>
                                              <span className="font-extrabold text-blue-700 ml-1">
                                                {displayPackages} {v.name}{remainder > 0 ? ` (+ ${remainder} ${stockUnit})` : ''}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 3-Tier ERP Product & Unit Master Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-[#ECECEC] overflow-hidden my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#ECECEC] px-6 py-4 shrink-0 bg-white z-10">
              <div>
                <h3 className="text-[17px] font-extrabold text-[#111111]">
                  {editingItem ? 'Edit Product — ERP Unit Conversion & Pricing Master' : 'Create Product — ERP Unit Conversion & Pricing Master'}
                </h3>
                <p className="text-[12px] text-[#777]">
                  Define Purchase Unit (e.g. 1 Bag contains 50 KG) and Selling Variants. Stock is always tracked in the Stock Unit.
                </p>
              </div>
              <button onClick={() => setIsItemModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Form wrapping body + footer */}
            <form onSubmit={handleSaveItem} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* SECTION 1: BASIC INFORMATION */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                    <h4 className="text-[12px] font-extrabold text-[#FF6B00] uppercase tracking-wider flex items-center gap-1.5">
                      <Box size={14} /> Basic Product Information
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cow Feed Gold"
                        value={itemFormData.name}
                        onChange={e => {
                          setItemFormData(prev => ({ ...prev, name: e.target.value }));
                          if (!editingItem) generateSkuAndBarcode(e.target.value);
                        }}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Category *</label>
                      <select
                        required
                        value={itemFormData.category}
                        onChange={e => setItemFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Brand *</label>
                      <select
                        required
                        value={itemFormData.brand}
                        onChange={e => setItemFormData(prev => ({ ...prev, brand: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
                      >
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">SKU Code *</label>
                      <input
                        type="text"
                        required
                        placeholder="SKU Code"
                        value={itemFormData.sku}
                        onChange={e => setItemFormData(prev => ({ ...prev, sku: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Barcode (Optional)</label>
                      <input
                        type="text"
                        placeholder="Barcode"
                        value={itemFormData.barcode}
                        onChange={e => setItemFormData(prev => ({ ...prev, barcode: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">GST Rate (%)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={itemFormData.gst || ''}
                        onChange={e => setItemFormData(prev => ({ ...prev, gst: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Status</label>
                      <select
                        value={itemFormData.status}
                        onChange={e => setItemFormData(prev => ({ ...prev, status: e.target.value as ItemStatus }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Description</label>
                      <input
                        type="text"
                        placeholder="Product notes or specifications..."
                        value={itemFormData.description}
                        onChange={e => setItemFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: STOCK SETTINGS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                    <h4 className="text-[12px] font-extrabold text-[#111] uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-[#FF6B00]" /> Stock Unit (Smallest Physical Inventory Unit)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                        Stock Unit * <span className="text-[9px] text-[#FF6B00] font-bold">(Smallest Unit e.g. KG)</span>
                      </label>
                      <select
                        required
                        value={itemFormData.stockUnit}
                        onChange={e => handleStockUnitChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-bold text-[#111] outline-none focus:border-[#FF6B00]"
                      >
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                        Initial Physical Stock ({itemFormData.stockUnit})
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={itemFormData.stockInBaseUnit || ''}
                        onChange={e => setItemFormData(prev => ({ ...prev, stockInBaseUnit: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-bold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Min Alert Stock ({itemFormData.stockUnit})</label>
                      <input
                        type="number"
                        placeholder="5"
                        value={itemFormData.minimumStock || ''}
                        onChange={e => setItemFormData(prev => ({ ...prev, minimumStock: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Max Stock Limit ({itemFormData.stockUnit})</label>
                      <input
                        type="number"
                        placeholder="100"
                        value={itemFormData.maximumStock || ''}
                        onChange={e => setItemFormData(prev => ({ ...prev, maximumStock: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: PURCHASE SETTINGS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2">
                    <h4 className="text-[12px] font-extrabold text-[#111] uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag size={14} className="text-[#FF6B00]" /> Purchase Settings (Single Entry)
                    </h4>

                    {/* READ-ONLY COST PER BASE UNIT BADGE */}
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-xl text-[12.5px] font-extrabold flex items-center gap-2" title="Read-only auto-calculated unit cost">
                      <Lock size={12} className="text-blue-500" />
                      <span>Cost per {itemFormData.stockUnit}:</span>
                      <span className="text-blue-950 font-extrabold text-[14px]">
                        ₹{itemFormData.purchasePrice && itemFormData.purchaseMultiplier ? (itemFormData.purchasePrice / itemFormData.purchaseMultiplier).toFixed(2) : '0.00'} / {itemFormData.stockUnit}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#FAFBFD] border border-[#ECECEC] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Purchase Unit Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bag, Box, Tin"
                        value={itemFormData.defaultPurchaseUnit}
                        onChange={e => setItemFormData(prev => ({ ...prev, defaultPurchaseUnit: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-[#ECECEC] rounded-xl text-[13px] font-bold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                        Contains Quantity * <span className="text-[9.5px] text-[#FF6B00] font-bold">(1 {itemFormData.defaultPurchaseUnit || 'Bag'} contains)</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          placeholder="50"
                          value={itemFormData.purchaseMultiplier || ''}
                          onChange={e => {
                            const mult = Number(e.target.value);
                            setItemFormData(prev => ({ ...prev, purchaseMultiplier: mult }));
                            updatePurchasePricing(itemFormData.purchasePrice, mult);
                          }}
                          className="w-full px-4 py-2.5 bg-white border border-[#ECECEC] rounded-xl text-[13px] font-extrabold text-[#111] outline-none focus:border-[#FF6B00]"
                        />
                        <span className="text-[12px] font-extrabold text-[#111] bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 shrink-0">
                          {itemFormData.stockUnit}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-[#FF6B00] mt-1 flex items-center gap-1">
                        <span>1 {itemFormData.defaultPurchaseUnit || 'Bag'} = {itemFormData.purchaseMultiplier || 0} {itemFormData.stockUnit}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                        Purchase Price per {itemFormData.defaultPurchaseUnit || 'Bag'} (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="2600.00"
                        value={itemFormData.purchasePrice || ''}
                        onChange={e => {
                          const p = Number(e.target.value);
                          setItemFormData(prev => ({ ...prev, purchasePrice: p }));
                          updatePurchasePricing(p, itemFormData.purchaseMultiplier);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-[#ECECEC] rounded-xl text-[13.5px] font-extrabold text-[#111] outline-none focus:border-[#FF6B00]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: SELLING VARIANTS GRID */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0F0F0] pb-3">
                    <div>
                      <h4 className="text-[13px] font-extrabold text-[#111] uppercase tracking-wider flex items-center gap-2">
                        <Layers size={16} className="text-[#FF6B00]" /> Selling Variants (Outward Selling Units)
                      </h4>
                      <p className="text-[11px] text-[#777] mt-0.5">
                        Purchase Cost is read-only and automatically computed. Enter selling prices or set auto profit margins.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleApplyPresetVariants}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#FF6B00] border border-orange-200 rounded-xl text-[11.5px] font-bold transition-colors"
                      >
                        <Sparkles size={13} /> Auto Presets ({itemFormData.stockUnit})
                      </button>
                      <button
                        type="button"
                        onClick={handleAddVariantRow}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111] hover:bg-gray-800 text-white rounded-xl text-[11.5px] font-bold transition-colors"
                      >
                        <Plus size={14} /> Add Variant
                      </button>
                    </div>
                  </div>

                  {/* EDITABLE VARIANT TABLE */}
                  <div className="border border-[#ECECEC] rounded-2xl overflow-hidden shadow-sm bg-white">
                    <div className="overflow-x-auto max-h-[280px]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[#FAFAFA] border-b border-[#ECECEC] z-10">
                          <tr>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider text-center w-14">Default</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[150px]">Variant Name *</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[130px]">
                              Contains ({itemFormData.stockUnit}) *
                            </th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[130px]">Purchase Cost (Auto)</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[140px]">Pricing Mode</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[130px]">Selling Price (₹)</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider min-w-[110px]">Barcode</th>
                            <th className="p-3 text-[10px] uppercase font-bold text-[#777] tracking-wider text-center w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F7F7F7]">
                          {variantDrafts.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-[12px] text-[#999]">
                                No selling variants added. Click <b>Auto Presets</b> or <b>Add Variant</b> above.
                              </td>
                            </tr>
                          ) : (
                            variantDrafts.map((row, idx) => {
                              const mult = row.multiplier || row.packageSize || 1;
                              const autoPurchaseCost = Number((mult * costPerStockUnit).toFixed(2));
                              const isAuto = row.pricingMode === 'auto';

                              return (
                                <tr key={row.id || idx} className={`hover:bg-[#FAFBFD] transition-colors ${row.isDefault ? 'bg-blue-50/30' : ''}`}>
                                  {/* Default Variant Radio */}
                                  <td className="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleSetDefaultVariant(idx)}
                                      className={`w-6 h-6 mx-auto rounded-full border-2 flex items-center justify-center transition-all ${row.isDefault
                                          ? 'border-[#FF6B00] bg-[#FF6B00] text-white shadow-sm'
                                          : 'border-gray-300 bg-white text-transparent hover:border-gray-400'
                                        }`}
                                      title={row.isDefault ? 'Default Selling Unit' : 'Click to set as default selling unit'}
                                    >
                                      <Check size={12} strokeWidth={3} />
                                    </button>
                                  </td>

                                  {/* Variant Name */}
                                  <td className="p-2.5">
                                    <input
                                      type="text"
                                      required
                                      placeholder="e.g. 50 KG Bag"
                                      value={row.name}
                                      onChange={e => handleUpdateVariantRow(idx, 'name', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                                    />
                                  </td>

                                  {/* Multiplier / Contains (Stock Units) */}
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        required
                                        min="0.0001"
                                        step="any"
                                        placeholder="1"
                                        value={mult || ''}
                                        onChange={e => handleUpdateVariantRow(idx, 'multiplier', Number(e.target.value))}
                                        className="w-full px-3 py-1.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-bold text-[#111] outline-none focus:border-[#FF6B00]"
                                      />
                                      <span className="text-[10.5px] font-bold text-[#777] shrink-0">{itemFormData.stockUnit}</span>
                                    </div>
                                  </td>

                                  {/* Purchase Cost (Read-Only Auto Badge) */}
                                  <td className="p-2.5">
                                    <div className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-700 flex items-center justify-between" title="Read-only: auto-calculated from purchase price">
                                      <span>₹{autoPurchaseCost}</span>
                                      <Lock size={11} className="text-gray-400" />
                                    </div>
                                  </td>

                                  {/* Pricing Mode & Margin */}
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateVariantRow(idx, 'pricingMode', isAuto ? 'manual' : 'auto')}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase border transition-all ${isAuto
                                            ? 'bg-green-100 text-green-700 border-green-300'
                                            : 'bg-gray-100 text-gray-600 border-gray-300'
                                          }`}
                                      >
                                        {isAuto ? 'Auto Margin' : 'Manual'}
                                      </button>

                                      {isAuto && (
                                        <div className="flex items-center gap-0.5 w-16">
                                          <input
                                            type="number"
                                            placeholder="20"
                                            value={row.profitMargin || ''}
                                            onChange={e => handleUpdateVariantRow(idx, 'profitMargin', Number(e.target.value))}
                                            className="w-full px-1.5 py-1 bg-[#F7F7F7] border border-[#ECECEC] rounded-lg text-[11px] font-bold text-[#111] text-right outline-none focus:border-[#FF6B00]"
                                          />
                                          <Percent size={10} className="text-gray-500" />
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Selling Price */}
                                  <td className="p-2.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      readOnly={isAuto}
                                      placeholder="0.00"
                                      value={row.sellingPrice || ''}
                                      onChange={e => handleUpdateVariantRow(idx, 'sellingPrice', Number(e.target.value))}
                                      className={`w-full px-3 py-1.5 border rounded-xl text-[12.5px] font-bold outline-none transition-colors ${isAuto
                                          ? 'bg-green-50/50 border-green-200 text-green-800'
                                          : 'bg-[#F7F7F7] border-[#ECECEC] text-[#111] focus:border-[#FF6B00]'
                                        }`}
                                    />
                                  </td>

                                  {/* Barcode */}
                                  <td className="p-2.5">
                                    <input
                                      type="text"
                                      placeholder="Barcode"
                                      value={row.barcode}
                                      onChange={e => handleUpdateVariantRow(idx, 'barcode', e.target.value)}
                                      className="w-full px-3 py-1.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12.5px] font-mono text-[#111] outline-none focus:border-[#FF6B00]"
                                    />
                                  </td>

                                  {/* Actions */}
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleReorderVariantRow(idx, 'up')}
                                        title="Move Up"
                                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                      >
                                        <ArrowUp size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === variantDrafts.length - 1}
                                        onClick={() => handleReorderVariantRow(idx, 'down')}
                                        title="Move Down"
                                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                      >
                                        <ArrowDown size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateVariantRow(idx)}
                                        title="Duplicate Row"
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      >
                                        <Copy size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteVariantRow(idx)}
                                        title="Delete Row"
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
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

              {/* PINNED MODAL FOOTER */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#ECECEC] shrink-0 bg-white z-10">
                <div className="text-[11.5px] text-[#777] font-semibold">
                  Total Selling Variants: <b className="text-[#111]">{variantDrafts.length}</b> | Default Selling Unit: <b className="text-[#FF6B00]">{variantDrafts.find(v => v.isDefault)?.name || 'None'}</b>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsItemModalOpen(false)}
                    className="px-5 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#FF6B00] hover:bg-orange-600 text-white rounded-xl text-[13px] font-bold transition-all shadow-[0_4px_14px_rgba(255,107,0,0.35)] disabled:opacity-50"
                  >
                    {isSaving ? 'Saving Product...' : editingItem ? 'Save Changes' : 'Create Product'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Barcode Printable Modal */}
      {barcodeModalText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl border border-[#ECECEC] text-center"
          >
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <h3 className="text-[15px] font-bold text-[#111111]">Generate Barcode</h3>
              <button onClick={() => setBarcodeModalText(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-2xl p-6 flex flex-col items-center" id="printable-barcode-area">
              <div
                className="w-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: generateBarcodeSVG(barcodeModalText, 60, 2) }}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setBarcodeModalText(null)}
                className="flex-1 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrintBarcode}
                className="flex-1 py-2.5 bg-[#FF6B00] text-white rounded-xl text-[13px] font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
