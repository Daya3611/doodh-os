'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { InventoryItem, InventoryVariant, ItemStatus } from '@/types';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/format';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit3, Trash2, ChevronDown, ChevronUp, 
  Barcode, Layers, Save, X, Printer, RefreshCw, AlertCircle
} from 'lucide-react';
import { generateBarcodeSVG } from '@/utils/barcodeGenerator';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

export default function ItemMasterPage() {
  const { profile, user } = useAuthStore();
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

  // Item Form Modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    category: '',
    brand: '',
    sku: '',
    barcode: '',
    description: '',
    gst: 0,
    baseUnit: '',
    minimumStock: 5,
    stockInBaseUnit: 0,
    maximumStock: 100,
    status: 'active' as ItemStatus,
    image: '',
  });

  // Variant Form Modal state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [variantItemId, setVariantItemId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<InventoryVariant | null>(null);
  const [variantFormData, setVariantFormData] = useState({
    name: '',
    purchasePrice: 0,
    sellingPrice: 0,
    /** Opening Quantity (New Variant Only) — transient UI field, never stored on variant. */
    openingQty: 0,
    barcode: '',
    sku: '',
    packageSize: 1,
    isDefault: false,
    isActive: true,
    parentBaseUnit: 'KG',
    /** True when this variant has historical purchase/sale/adjustment records. Locks packageSize. */
    hasTransactions: false,
  });

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

  // Handle auto-generation on form name update
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

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemFormData({
      name: '',
      category: categories[0] || '',
      brand: brands[0] || '',
      sku: '',
      barcode: '',
      description: '',
      gst: 0,
      baseUnit: units[0] || 'Piece',
      minimumStock: 5,
      stockInBaseUnit: 0,
      maximumStock: 100,
      status: 'active',
      image: '',
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      category: item.category,
      brand: item.brand,
      sku: item.sku,
      barcode: item.barcode || '',
      description: item.description || '',
      gst: item.gst,
      baseUnit: item.baseUnit,
      minimumStock: item.minimumStock,
      stockInBaseUnit: item.stockInBaseUnit || 0,
      maximumStock: item.maximumStock,
      status: item.status,
      image: item.image || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) return;

    if (!itemFormData.name || !itemFormData.category || !itemFormData.brand || !itemFormData.sku) {
      toast.error('Please fill all mandatory fields');
      return;
    }

    try {
      if (editingItem) {
        await inventoryService.update(centerId, editingItem.id, itemFormData);
        toast.success('Item updated successfully');
      } else {
        await inventoryService.add(centerId, itemFormData);
        toast.success('Item created successfully');
      }
      setIsItemModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!centerId) return;
    if (!confirm('Are you sure you want to delete this item? All associated variants will be removed.')) return;

    try {
      await inventoryService.delete(centerId, itemId);
      toast.success('Item deleted');
      loadData();
    } catch {
      toast.error('Failed to delete item');
    }
  };

  // Variants management
  const [itemVariants, setItemVariants] = useState<InventoryVariant[]>([]);
  
  const loadVariants = async (itemId: string) => {
    if (!centerId) return;
    const data = await inventoryService.getVariants(centerId, itemId);
    setItemVariants(data);
  };

  const handleToggleRow = (itemId: string) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
      setItemVariants([]);
    } else {
      setExpandedItemId(itemId);
      loadVariants(itemId);
    }
  };

  // Smart base unit defaults based on the item's own unit
  const inferConversionUnit = (itemUnit: string): string => {
    const u = (itemUnit || '').toLowerCase();
    if (['bag', 'packet', 'bottle', 'box', 'can', 'piece'].includes(u)) return 'KG';
    if (['litre', 'l'].includes(u)) return 'ML';
    return itemUnit || 'KG';
  };

  const handleOpenAddVariant = (item: InventoryItem) => {
    setVariantItemId(item.id);
    setEditingVariant(null);
    // Auto-assign isDefault if this item has no variants yet
    const autoDefault = itemVariants.length === 0;
    setVariantFormData({
      name: '',
      purchasePrice: 0,
      sellingPrice: 0,
      openingQty: 0,
      barcode: '',
      sku: `${item.sku}-V${Math.floor(10 + Math.random() * 90)}`,
      packageSize: 1,
      isDefault: autoDefault,
      isActive: true,
      parentBaseUnit: item.baseUnit || 'KG',
      hasTransactions: false,
    });
    setIsVariantModalOpen(true);
  };

  const handleOpenEditVariant = async (variant: InventoryVariant) => {
    setVariantItemId(variant.itemId);
    setEditingVariant(variant);
    const parentItem = items.find(i => i.id === variant.itemId);
    // Check if this variant has historical transactions — if so, packageSize must be locked
    let hasTxns = false;
    if (centerId) {
      try { hasTxns = await inventoryService.variantHasTransactions(centerId, variant.id); } catch {}
    }
    setVariantFormData({
      name: variant.name,
      purchasePrice: variant.purchasePrice,
      sellingPrice: variant.sellingPrice,
      openingQty: 0, // Not used when editing; field is hidden
      barcode: variant.barcode,
      sku: variant.sku,
      packageSize: variant.packageSize || 1,
      isDefault: variant.isDefault || false,
      isActive: variant.isActive !== false,
      parentBaseUnit: parentItem?.baseUnit || 'KG',
      hasTransactions: hasTxns,
    });
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !variantItemId) return;

    const name = variantFormData.name.trim();
    const { sku, purchasePrice, sellingPrice, packageSize, parentBaseUnit, isDefault, openingQty } = variantFormData;

    // === Validation ===
    if (!name) { toast.error('Variant name is required'); return; }
    if (!sku) { toast.error('Variant SKU is required'); return; }
    if (packageSize <= 0) { toast.error('Package size must be greater than 0'); return; }
    if (purchasePrice < 0) { toast.error('Purchase price cannot be negative'); return; }
    if (sellingPrice < 0) { toast.error('Selling price cannot be negative'); return; }

    // Duplicate name check
    const isDuplicate = itemVariants.some(
      v => v.id !== editingVariant?.id && v.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) { toast.error(`A variant named "${name}" already exists on this item`); return; }

    // Base unit name collision check (only reject for non-default variants)
    if (name.toLowerCase() === parentBaseUnit.toLowerCase() && !isDefault) {
      toast.error(`Variant name cannot match the base unit "${parentBaseUnit}" unless it is marked as the default variant`);
      return;
    }

    try {
      if (editingVariant) {
        await inventoryService.updateVariant(centerId, editingVariant.id, {
          name,
          purchasePrice,
          sellingPrice,
          barcode: variantFormData.barcode,
          sku,
          // packageSize is NOT updated here if hasTransactions — UI already disables the field
          packageSize: variantFormData.hasTransactions ? editingVariant.packageSize : packageSize,
          isDefault,
          isActive: variantFormData.isActive
        });
        // Enforce single-default if this was promoted
        if (isDefault && !editingVariant.isDefault) {
          await inventoryService.setDefaultVariant(centerId, editingVariant.id, variantItemId);
        }
        toast.success('Variant updated');
      } else {
        const addedVarId = await inventoryService.addVariant(centerId, {
          itemId: variantItemId,
          name,
          purchasePrice,
          sellingPrice,
          barcode: variantFormData.barcode,
          sku,
          packageSize,
          isDefault,
          isActive: variantFormData.isActive
        });

        // Enforce single-default if new variant is the default
        if (isDefault) {
          await inventoryService.setDefaultVariant(centerId, addedVarId, variantItemId);
        }

        // Apply opening stock to parent item if specified
        if (openingQty > 0) {
          const parentItem = items.find(i => i.id === variantItemId);
          if (parentItem) {
            const addedStock = openingQty * packageSize;
            await inventoryService.update(centerId, variantItemId, {
              stockInBaseUnit: (parentItem.stockInBaseUnit || 0) + addedStock
            });
            await inventoryService.addAdjustment(centerId, {
              itemId: variantItemId,
              itemName: parentItem.name,
              variantId: addedVarId,
              variantName: name,
              quantity: openingQty,
              packageSizeSnapshot: packageSize,
              reason: 'opening_balance',
              notes: 'Added via new variant opening quantity'
            }, user?.email || 'admin');
          }
        }
        toast.success('Variant added');
      }
      setIsVariantModalOpen(false);
      loadVariants(variantItemId);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save variant');
    }
  };

  const handleDeleteVariant = async (v: InventoryVariant) => {
    if (!centerId) return;

    // Guard: cannot delete the only variant
    if (itemVariants.length <= 1) {
      toast.error('Cannot delete the only variant on this item');
      return;
    }
    // Guard: cannot delete the default variant unless another is promoted first
    if (v.isDefault) {
      toast.error('Promote another variant to Default before deleting this one');
      return;
    }

    if (!confirm('Delete this variant?')) return;

    try {
      await inventoryService.deleteVariant(centerId, v.id);
      toast.success('Variant removed');
      loadVariants(v.itemId);
      loadData();
    } catch {
      toast.error('Failed to remove variant');
    }
  };

  const handlePromoteDefault = async (v: InventoryVariant) => {
    if (!centerId) return;
    try {
      await inventoryService.setDefaultVariant(centerId, v.id, v.itemId);
      toast.success(`"${v.name}" is now the default variant`);
      loadVariants(v.itemId);
    } catch {
      toast.error('Failed to set default variant');
    }
  };

  // Searching logic
  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      item.name.toLowerCase().includes(term) ||
      item.sku.toLowerCase().includes(term) ||
      (item.barcode && item.barcode.toLowerCase().includes(term)) ||
      item.category.toLowerCase().includes(term) ||
      item.brand.toLowerCase().includes(term);

    const matchCategory = categoryFilter ? item.category === categoryFilter : true;
    const matchBrand = brandFilter ? item.brand === brandFilter : true;
    const matchStatus = statusFilter ? item.status === statusFilter : true;

    return matchSearch && matchCategory && matchBrand && matchStatus;
  });

  const handlePrintBarcode = () => {
    const printContent = document.getElementById('printable-barcode-area');
    if (!printContent) return;
    const win = window.open('', '', 'width=600,height=400');
    if (win) {
      win.document.write('<html><head><title>Print Barcode</title><style>body { display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 0; padding: 20px; font-family: monospace; }</style></head><body>');
      win.document.write(printContent.innerHTML);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Controls Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <h2 className="text-[18px] font-extrabold text-[#111111] uppercase tracking-wide">Item Master Catalog</h2>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-5 py-3 bg-[#FF6B00] text-white text-[13px] font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} /> Add New Item
        </button>
      </div>

      {/* 2. Filters Grid */}
      <div style={cardStyle} className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-[12px] rounded-xl bg-[#F7F7F7] border border-[#ECECEC] outline-none focus:border-[#FF6B00] font-semibold text-[#111]"
            placeholder="Search by name, SKU, Barcode..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category */}
        <select
          className="w-full px-3 py-2.5 text-[12px] rounded-xl bg-[#F7F7F7] border border-[#ECECEC] outline-none font-semibold text-[#555] cursor-pointer"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Brand */}
        <select
          className="w-full px-3 py-2.5 text-[12px] rounded-xl bg-[#F7F7F7] border border-[#ECECEC] outline-none font-semibold text-[#555] cursor-pointer"
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Status */}
        <select
          className="w-full px-3 py-2.5 text-[12px] rounded-xl bg-[#F7F7F7] border border-[#ECECEC] outline-none font-semibold text-[#555] cursor-pointer"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* 3. Items Table */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #ECECEC' }}>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider"></th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Item Details</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Category</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider">Brand</th>
                <th className="p-4 text-[10px] uppercase font-bold text-[#999] tracking-wider text-right">Available Stock</th>
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
                    No inventory items found. Add items to catalog.
                  </td>
                </tr>
              ) : (
                 filteredItems.map(item => {
                  const isExpanded = expandedItemId === item.id;
                  const isLowStock = item.stockInBaseUnit <= item.minimumStock;
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
                        <td className="p-4 text-[13px] text-[#555] font-semibold">{item.category}</td>
                        <td className="p-4 text-[13px] text-[#555] font-semibold">{item.brand}</td>
                        <td className="p-4 text-right">
                          <div className="font-extrabold text-[14px]">
                            {item.stockInBaseUnit} {item.baseUnit}
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
                              onClick={() => handleOpenAddVariant(item)}
                              title="Add Variant"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                            >
                              <Layers size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit"
                              className="p-2 text-[#FF6B00] hover:bg-[#FFF0E6] rounded-xl transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              title="Delete"
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Variants Row */}
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
                                  <h4 className="text-[12px] font-extrabold text-[#555] uppercase tracking-wider">Product Variants</h4>
                                  <button
                                    onClick={() => handleOpenAddVariant(item)}
                                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <Plus size={12} /> Add Variant
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {itemVariants.length === 0 ? (
                                    <div className="text-[11px] text-[#999] py-2">No variants created. The item acts as standard single variant.</div>
                                  ) : (
                                    itemVariants.map(v => {
                                      const packageSize = v.packageSize || 1;
                                      const wholeUnits = Math.floor((item.stockInBaseUnit || 0) / packageSize);
                                      const remainder = Number(((item.stockInBaseUnit || 0) % packageSize).toFixed(2));
                                      const isInactive = !v.isActive;
                                      return (
                                        <div key={v.id} className={`bg-white border border-[#EDEDED] rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 ${isInactive ? 'opacity-60 bg-gray-50' : ''}`}>
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[13px] font-bold text-[#111111]">{v.name}</span>
                                              {v.isDefault ? (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-extrabold rounded-md uppercase tracking-wider">
                                                  ✓ Default
                                                </span>
                                              ) : (
                                                <button
                                                  onClick={() => handlePromoteDefault(v)}
                                                  className="px-1.5 py-0.5 bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 text-[8px] font-extrabold rounded-md uppercase tracking-wider border border-gray-200 hover:border-blue-200 transition-colors"
                                                  title="Promote to default variant"
                                                >
                                                  Set Default
                                                </button>
                                              )}
                                              {isInactive && (
                                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 text-[8px] font-extrabold rounded-md uppercase tracking-wider">
                                                  Inactive
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex gap-3 text-[10px] font-mono text-[#777] mt-0.5">
                                              <span>SKU: {v.sku}</span>
                                              <span>1 {v.name} = {packageSize} {item.baseUnit}</span>
                                              {v.barcode && (
                                                <button onClick={() => setBarcodeModalText(v.barcode)} className="flex items-center gap-0.5 hover:underline">
                                                  <Barcode size={10} /> {v.barcode}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap gap-3 text-[12px]">
                                            <div>
                                              <span className="text-[#888]">Buy:</span> <span className="font-extrabold text-[#111]">₹{formatCurrency(v.purchasePrice)}</span>
                                            </div>
                                            <div>
                                              <span className="text-[#888]">Sell:</span> <span className="font-extrabold text-[#111]">₹{formatCurrency(v.sellingPrice)}</span>
                                            </div>
                                            <div>
                                              <span className="text-[#888]">Available:</span>
                                              <span className="font-extrabold text-blue-600 ml-1">
                                                {wholeUnits} {v.name}{remainder > 0 ? ` + ${remainder} ${item.baseUnit}` : ''}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                            <button
                                              onClick={() => handleOpenEditVariant(v)}
                                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteVariant(v)}
                                              className={`p-1.5 rounded-lg ${
                                                v.isDefault
                                                  ? 'text-gray-300 cursor-not-allowed'
                                                  : 'text-red-500 hover:bg-red-50'
                                              }`}
                                              title={v.isDefault ? 'Promote another variant to default before deleting' : 'Delete variant'}
                                            >
                                              <Trash2 size={12} />
                                            </button>
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

      {/* 4. Add/Edit Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl border border-[#ECECEC]"
          >
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <h3 className="text-[16px] font-bold text-[#111111]">
                {editingItem ? 'Edit Product Item' : 'Create Product Item'}
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Item Name *</label>
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
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Base Unit * <span className="text-[9px] font-normal text-[#AAAAAA] normal-case">(Stock is tracked in this unit)</span></label>
                <select
                  required
                  value={itemFormData.baseUnit}
                  onChange={e => setItemFormData(prev => ({ ...prev, baseUnit: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#555] outline-none"
                >
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
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

              {/* Pricing tip */}
              <div className="sm:col-span-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-700 font-semibold flex items-start gap-2">
                <span className="text-blue-500 mt-0.5 shrink-0">ℹ</span>
                <span>Prices are managed per variant. After saving this item, expand it in the table and add variants (e.g. 50 KG Bag, 25 KG Bag, Loose KG) with individual purchase and selling prices.</span>
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

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Minimum Alert Stock</label>
                <input
                  type="number"
                  placeholder="5"
                  value={itemFormData.minimumStock || ''}
                  onChange={e => setItemFormData(prev => ({ ...prev, minimumStock: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Maximum Stock Level</label>
                <input
                  type="number"
                  placeholder="100"
                  value={itemFormData.maximumStock || ''}
                  onChange={e => setItemFormData(prev => ({ ...prev, maximumStock: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Description</label>
                <textarea
                  placeholder="Describe product..."
                  value={itemFormData.description}
                  onChange={e => setItemFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-3 border-t border-[#ECECEC] mt-4">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-5 py-2.5 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 transition-colors"
                >
                  Save Item
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Add/Edit Variant Modal */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl border border-[#ECECEC]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#ECECEC] px-6 py-4">
              <h3 className="text-[16px] font-bold text-[#111111]">
                {editingVariant ? 'Edit Variant' : 'Add New Variant'}
              </h3>
            </div>
            {/* Scrollable Form Content */}
            <form onSubmit={handleSaveVariant} className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Variant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bag, Box, Loose"
                  value={variantFormData.name}
                  onChange={e => setVariantFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                />
              </div>

              {/* Package Size Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                    Package Contains *
                    {variantFormData.hasTransactions && (
                      <span className="ml-1 text-[9px] font-extrabold text-orange-600 normal-case">LOCKED</span>
                    )}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50"
                    disabled={variantFormData.hasTransactions}
                    value={variantFormData.packageSize || ''}
                    onChange={e => setVariantFormData(prev => ({ ...prev, packageSize: Number(e.target.value) || 1 }))}
                    className={`w-full px-4 py-2 border rounded-xl text-[13px] font-semibold text-[#111] outline-none transition-colors ${
                      variantFormData.hasTransactions
                        ? 'bg-orange-50 border-orange-200 text-orange-700 cursor-not-allowed opacity-80'
                        : 'bg-[#F7F7F7] border-[#ECECEC] focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Base Unit</label>
                  <input
                    type="text"
                    readOnly
                    value={variantFormData.parentBaseUnit}
                    className="w-full px-4 py-2 bg-gray-100 border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-gray-500 outline-none select-none"
                  />
                </div>
              </div>

              {/* Transaction lock warning */}
              {variantFormData.hasTransactions && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                  <span className="text-orange-500 text-[14px] mt-0.5 shrink-0">⚠</span>
                  <div>
                    <p className="text-[11px] font-extrabold text-orange-700">Package size is locked</p>
                    <p className="text-[10px] text-orange-600 font-semibold mt-0.5">
                      This variant has historical transactions. Changing the conversion ratio would corrupt past records.
                      To change the package size, create a new variant instead.
                    </p>
                  </div>
                </div>
              )}

              {/* Unit Conversion Preview */}
              {variantFormData.packageSize > 0 && variantFormData.name && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-1.5">
                  <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">Unit Conversion Preview</span>
                  {[1, 10, 20].map(multiplier => (
                    <div key={multiplier} className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-amber-900">
                        {multiplier} {variantFormData.name}
                      </span>
                      <span className="text-amber-700 font-semibold">
                        = {multiplier * variantFormData.packageSize} {variantFormData.parentBaseUnit}
                      </span>
                    </div>
                  ))}
                </div>
              )}


              {/* Pricing Section with Auto-Calculated readOnly base unit prices */}
              <div className="border border-[#F0F0F0] rounded-2xl p-3 bg-[#FAFAFA] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#FF6B00] uppercase tracking-wider">Pricing Configuration</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-2 gap-3">
                  <span className="text-[9px] font-extrabold text-[#999] uppercase tracking-wider">Per {variantFormData.name || 'Variant'} (₹)</span>
                  <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wider">Per {variantFormData.parentBaseUnit} (₹)</span>
                </div>

                {/* Purchase Price Row */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-[9.5px] font-bold text-[#777] mb-0.5 block">Purchase Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={variantFormData.purchasePrice || ''}
                      onChange={e => {
                        const p = Number(e.target.value);
                        setVariantFormData(prev => ({ ...prev, purchasePrice: p }));
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-blue-500 mb-0.5 block">Calculated (auto)</label>
                    <input
                      type="number"
                      readOnly
                      placeholder="auto"
                      value={variantFormData.packageSize > 0 && variantFormData.purchasePrice > 0
                        ? Number((variantFormData.purchasePrice / variantFormData.packageSize).toFixed(4))
                        : ''}
                      className="w-full px-3.5 py-2 bg-gray-100 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-500 outline-none select-none"
                    />
                  </div>
                </div>

                {/* Selling Price Row */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="text-[9.5px] font-bold text-[#777] mb-0.5 block">Selling Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={variantFormData.sellingPrice || ''}
                      onChange={e => {
                        const s = Number(e.target.value);
                        setVariantFormData(prev => ({ ...prev, sellingPrice: s }));
                      }}
                      className="w-full px-3.5 py-2 bg-white border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-green-600 mb-0.5 block">Calculated (auto)</label>
                    <input
                      type="number"
                      readOnly
                      placeholder="auto"
                      value={variantFormData.packageSize > 0 && variantFormData.sellingPrice > 0
                        ? Number((variantFormData.sellingPrice / variantFormData.packageSize).toFixed(4))
                        : ''}
                      className="w-full px-3.5 py-2 bg-gray-100 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-500 outline-none select-none"
                    />
                  </div>
                </div>

                {/* Margin summary */}
                {variantFormData.purchasePrice > 0 && variantFormData.sellingPrice > 0 && (
                  <div className="flex items-center gap-4 pt-1.5 border-t border-[#EBEBEB]">
                    <div className="flex items-center gap-1">
                      <span className="text-[9.5px] text-[#999] font-semibold">Margin:</span>
                      <span className={`text-[10.5px] font-extrabold ${
                        variantFormData.sellingPrice >= variantFormData.purchasePrice ? 'text-green-600' : 'text-red-500'
                      }`}>
                        ₹{(variantFormData.sellingPrice - variantFormData.purchasePrice).toFixed(2)}
                        {' '}({variantFormData.purchasePrice > 0
                          ? (((variantFormData.sellingPrice - variantFormData.purchasePrice) / variantFormData.purchasePrice) * 100).toFixed(1)
                          : 0}%)
                      </span>
                    </div>
                    {variantFormData.packageSize > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9.5px] text-[#999] font-semibold">Margin/{variantFormData.parentBaseUnit}:</span>
                        <span className="text-[10.5px] font-extrabold text-purple-600">
                          ₹{((variantFormData.sellingPrice - variantFormData.purchasePrice) / variantFormData.packageSize).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Variant SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="SKU"
                    value={variantFormData.sku}
                    onChange={e => setVariantFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Barcode</label>
                  <input
                    type="text"
                    placeholder="Barcode"
                    value={variantFormData.barcode}
                    onChange={e => setVariantFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                  />
                </div>
              </div>

              {/* Opening Quantity — only shown when adding a new variant */}
              {!editingVariant && (
                <div>
                  <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">
                    Opening Quantity <span className="text-[9px] font-normal normal-case text-[#AAAAAA]">(New Variant Only)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={variantFormData.openingQty || ''}
                    onChange={e => setVariantFormData(prev => ({ ...prev, openingQty: Number(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
                  />
                  {variantFormData.openingQty > 0 && variantFormData.packageSize > 0 && (
                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                      = {variantFormData.openingQty * variantFormData.packageSize} {variantFormData.parentBaseUnit} will be added to item stock
                    </p>
                  )}
                </div>
              )}

              {/* Status & Default Config */}
              <div className="border border-[#F0F0F0] rounded-2xl p-3 bg-[#FAFAFA] space-y-2">
                <span className="text-[10px] font-extrabold text-[#555] uppercase tracking-wider block">Status & Configuration</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setVariantFormData(prev => ({ ...prev, isDefault: !prev.isDefault }))}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold border-2 transition-all flex items-center justify-center gap-2 ${
                      variantFormData.isDefault
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    Set Default
                  </button>

                  <button
                    type="button"
                    onClick={() => setVariantFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-extrabold border-2 transition-all flex items-center justify-center gap-2 ${
                      variantFormData.isActive
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    Active
                </button>
              </div>
            </div>

              {/* Modal Footer (Sticky inside form layout but scroll-relative) */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#ECECEC] sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsVariantModalOpen(false)}
                  className="px-5 py-2 border border-[#ECECEC] rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#111] text-white rounded-xl text-[13px] font-bold hover:bg-gray-800 transition-colors"
                >
                  Save Variant
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 6. Barcode Modal */}
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
