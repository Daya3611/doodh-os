'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { purchaseService } from '@/services/purchaseService';
import { salesService } from '@/services/salesService';
import { supplierService } from '@/services/supplierService';
import { InventoryItem, PurchaseEntry, SalesEntry, Supplier, StockAdjustment, InventoryLog } from '@/types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { FileDown, Calendar, Search, Printer, FileText, TrendingUp, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
};

type DateRangeOption = 'today' | 'yesterday' | '7days' | '30days' | 'fy' | 'custom';

export default function ReportsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<string>('current-stock');
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('7days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Primary datasets
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [sales, setSales] = useState<SalesEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);

  // Derived variants details
  const [flatVariants, setFlatVariants] = useState<any[]>([]);

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [itemsData, purchasesData, salesData, suppliersData, adjustmentsData, logsData] = await Promise.all([
        inventoryService.getAll(centerId),
        purchaseService.getAll(centerId),
        salesService.getAll(centerId),
        supplierService.getAll(centerId),
        inventoryService.getAdjustments(centerId),
        inventoryService.getLogs(centerId)
      ]);

      setItems(itemsData);
      setPurchases(purchasesData);
      setSales(salesData);
      setSuppliers(suppliersData);
      setAdjustments(adjustmentsData);
      setLogs(logsData);

      // Construct flat variants list
      const tempVariants: any[] = [];
      for (const item of itemsData) {
        const vars = await inventoryService.getVariants(centerId, item.id);
        vars.forEach(v => {
          tempVariants.push({
            ...v,
            itemName: item.name,
            itemCategory: item.category,
            itemBrand: item.brand,
            itemUnit: item.baseUnit,
            parentStock: item.stockInBaseUnit || 0
          });
        });
      }
      setFlatVariants(tempVariants);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load reports datasets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  // Set default dates for date range presets
  useEffect(() => {
    const today = new Date();
    const tempStart = new Date();
    const tempEnd = new Date();

    if (dateRangeOption === 'today') {
      setStartDate(today.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (dateRangeOption === 'yesterday') {
      tempStart.setDate(today.getDate() - 1);
      tempEnd.setDate(today.getDate() - 1);
      setStartDate(tempStart.toISOString().split('T')[0]);
      setEndDate(tempEnd.toISOString().split('T')[0]);
    } else if (dateRangeOption === '7days') {
      tempStart.setDate(today.getDate() - 6);
      setStartDate(tempStart.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (dateRangeOption === '30days') {
      tempStart.setDate(today.getDate() - 29);
      setStartDate(tempStart.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (dateRangeOption === 'fy') {
      // Indian Financial Year: April 1st to March 31st
      const currentYear = today.getFullYear();
      const isBeforeApril = today.getMonth() < 3; // 0,1,2 = Jan, Feb, Mar
      const fyStartYear = isBeforeApril ? currentYear - 1 : currentYear;
      
      const fyStart = new Date(fyStartYear, 3, 1); // April 1st
      const fyEnd = new Date(fyStartYear + 1, 2, 31); // March 31st next year
      setStartDate(fyStart.toISOString().split('T')[0]);
      setEndDate(fyEnd.toISOString().split('T')[0]);
    }
  }, [dateRangeOption]);

  // Helper to filter entries by date
  const isWithinDateRange = (dateInput: any) => {
    if (!startDate || !endDate) return true;
    const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  };

  // Compile Report Data depending on selected report type
  const getReportData = (): { columns: string[], rows: any[], title: string, totals?: Record<string, number> } => {
    let columns: string[] = [];
    let rows: any[] = [];
    let title = 'Report';
    const totals: Record<string, number> = {};

    const searchLower = searchTerm.toLowerCase();

    switch (reportType) {
      case 'current-stock':
        title = 'Current Stock Levels';
        columns = ['Item Name', 'Category', 'Brand', 'SKU', 'Stock (Base Unit)', 'Unit', 'Equivalents', 'Alert Limit'];
        rows = items
          .filter(item => item.name.toLowerCase().includes(searchLower) || item.sku.toLowerCase().includes(searchLower))
          .map(item => {
            const stockBase = item.stockInBaseUnit || 0;
            // Build equivalents string: "10 Bags, 20 Small Bags"
            const itemVars = flatVariants.filter(fv => fv.itemId === item.id);
            const equivalents = itemVars
              .map(v => `${Math.floor(stockBase / (v.packageSize || 1))} ${v.name}`)
              .join(', ');
            return {
              'Item Name': item.name,
              'Category': item.category,
              'Brand': item.brand,
              'SKU': item.sku,
              'Stock (Base Unit)': stockBase,
              'Unit': item.baseUnit,
              'Equivalents': equivalents || '-',
              'Alert Limit': item.minimumStock
            };
          });
        totals['Total Items'] = rows.length;
        totals['Total Physical Qty'] = rows.reduce((sum, r) => sum + (r['Stock (Base Unit)'] || 0), 0);
        break;

      case 'stock-value':
        title = 'Stock Valuation Statement';
        columns = ['Item Name', 'Category', 'Brand', 'SKU', 'Purchase Price', 'Selling Price', 'On Hand Stock', 'Valuation Cost'];
        rows = items
          .filter(item => item.name.toLowerCase().includes(searchLower) || item.sku.toLowerCase().includes(searchLower))
          .map(item => {
            const defaultVar = flatVariants.find(fv => fv.itemId === item.id && fv.isDefault) || flatVariants.find(fv => fv.itemId === item.id);
            const purchasePrice = defaultVar ? defaultVar.purchasePrice : 0;
            const packageSize = defaultVar ? defaultVar.packageSize : 1;
            const pricePerBaseUnit = purchasePrice / packageSize;
            
            const sellingPrice = defaultVar ? defaultVar.sellingPrice : 0;
            const sellingPricePerBaseUnit = sellingPrice / packageSize;

            const cost = (item.stockInBaseUnit || 0) * pricePerBaseUnit;
            return {
              'Item Name': item.name,
              'Category': item.category,
              'Brand': item.brand,
              'SKU': item.sku,
              'Purchase Price': Number(pricePerBaseUnit).toFixed(2),
              'Selling Price': Number(sellingPricePerBaseUnit).toFixed(2),
              'On Hand Stock': `${item.stockInBaseUnit || 0} ${item.baseUnit || 'KG'}`,
              'Valuation Cost': cost
            };
          });
        totals['Total Valuation (Cost)'] = rows.reduce((sum, r) => sum + r['Valuation Cost'], 0);
        totals['Total Units'] = items.reduce((sum, item) => sum + (item.stockInBaseUnit || 0), 0);
        break;

      case 'purchase-report':
        title = 'Purchase Transactions Statement';
        columns = ['Bill No', 'Date', 'Supplier', 'Payment Mode', 'GST paid', 'Discount', 'Transport', 'Grand Total'];
        rows = purchases
          .filter(p => isWithinDateRange(p.date) && (p.purchaseNumber.toLowerCase().includes(searchLower) || p.supplierName.toLowerCase().includes(searchLower)))
          .map(p => {
            const d = (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any);
            return {
              'Bill No': p.purchaseNumber,
              'Date': d.toLocaleDateString('en-IN'),
              'Supplier': p.supplierName,
              'Payment Mode': p.paymentMode.replace('_', ' ').toUpperCase(),
              'GST paid': p.gstTotal || 0,
              'Discount': p.discount || 0,
              'Transport': p.transport || 0,
              'Grand Total': p.grandTotal
            };
          });
        totals['Total Purchases Amount'] = rows.reduce((sum, r) => sum + r['Grand Total'], 0);
        totals['Total GST Paid'] = rows.reduce((sum, r) => sum + r['GST paid'], 0);
        totals['Bills Count'] = rows.length;
        break;

      case 'sales-report':
        title = 'Sales Invoices Statement';
        columns = ['Invoice No', 'Date', 'Customer', 'Payment Mode', 'GST collected', 'Discount', 'Grand Total'];
        rows = sales
          .filter(s => isWithinDateRange(s.date) && (s.invoiceNumber.toLowerCase().includes(searchLower) || s.customerName.toLowerCase().includes(searchLower)))
          .map(s => {
            const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
            return {
              'Invoice No': s.invoiceNumber,
              'Date': d.toLocaleDateString('en-IN'),
              'Customer': s.customerName,
              'Payment Mode': s.paymentMode.replace('_', ' ').toUpperCase(),
              'GST collected': s.gstTotal || 0,
              'Discount': s.discount || 0,
              'Grand Total': s.grandTotal
            };
          });
        totals['Total Revenue'] = rows.reduce((sum, r) => sum + r['Grand Total'], 0);
        totals['Total GST Collected'] = rows.reduce((sum, r) => sum + r['GST collected'], 0);
        totals['Invoice Count'] = rows.length;
        break;

      case 'supplier-report':
        title = 'Supplier Outstandings Statement';
        columns = ['Supplier Name', 'Mobile', 'GSTIN', 'Address', 'Outstanding Payable'];
        rows = suppliers
          .filter(s => s.name.toLowerCase().includes(searchLower))
          .map(s => ({
            'Supplier Name': s.name,
            'Mobile': s.mobile,
            'GSTIN': s.gst || '-',
            'Address': s.address || '-',
            'Outstanding Payable': s.pendingAmount || 0
          }));
        totals['Total Outstanding Payables'] = rows.reduce((sum, r) => sum + r['Outstanding Payable'], 0);
        totals['Total Suppliers'] = rows.length;
        break;

      case 'stock-adjustment-report':
        title = 'Inventory Adjustments Statement';
        columns = ['Date', 'Item Name', 'Variant', 'Net Change', 'Reason', 'Details'];
        rows = adjustments
          .filter(a => isWithinDateRange(a.createdAt) && (a.itemName.toLowerCase().includes(searchLower) || a.reason.toLowerCase().includes(searchLower)))
          .map(a => {
            const d = (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any);
            return {
              'Date': d.toLocaleDateString('en-IN'),
              'Item Name': a.itemName,
              'Variant': a.variantName,
              'Net Change': a.quantity,
              'Reason': a.reason.replace('_', ' ').toUpperCase(),
              'Details': a.notes || '-'
            };
          });
        totals['Total Adjustments Count'] = rows.length;
        break;

      case 'low-stock-report':
        title = 'Low Stock Alert Log';
        columns = ['Item Name', 'SKU', 'Category', 'Brand', 'On Hand Stock', 'Unit', 'Alert Threshold'];
        rows = items
          .filter(item => item.stockInBaseUnit <= item.minimumStock && (item.name.toLowerCase().includes(searchLower) || item.sku.toLowerCase().includes(searchLower)))
          .map(item => ({
            'Item Name': item.name,
            'SKU': item.sku,
            'Category': item.category,
            'Brand': item.brand,
            'On Hand Stock': item.stockInBaseUnit,
            'Unit': item.baseUnit,
            'Alert Threshold': item.minimumStock
          }));
        totals['Alerting Products Count'] = rows.length;
        break;

      case 'profit-report':
        title = 'Product Margin Statement';
        columns = ['Invoice No', 'Date', 'Product', 'Variant', 'Qty', 'Selling Subtotal', 'Estimated Cost', 'Estimated Margin'];
        // Compute profit from sales invoice items
        sales
          .filter(s => isWithinDateRange(s.date) && (s.invoiceNumber.toLowerCase().includes(searchLower) || s.customerName.toLowerCase().includes(searchLower)))
          .forEach(s => {
            const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
            s.items.forEach(si => {
              // Find variant purchase price to calculate cost
              const variant = flatVariants.find(fv => fv.id === si.variantId);
              const pPrice = variant ? variant.purchasePrice : 0;
              const cost = si.quantity * pPrice;
              const margin = si.total - cost;

              rows.push({
                'Invoice No': s.invoiceNumber,
                'Date': d.toLocaleDateString('en-IN'),
                'Product': si.itemName,
                'Variant': si.variantName,
                'Qty': si.quantity,
                'Selling Subtotal': si.total,
                'Estimated Cost': cost,
                'Estimated Margin': margin
              });
            });
          });
        totals['Total Revenue (Tax Incl)'] = rows.reduce((sum, r) => sum + r['Selling Subtotal'], 0);
        totals['Est Cost of Goods'] = rows.reduce((sum, r) => sum + r['Estimated Cost'], 0);
        totals['Est Gross Margin (Profit)'] = rows.reduce((sum, r) => sum + r['Estimated Margin'], 0);
        break;

      case 'category-report':
        title = 'Category Stock Summary';
        columns = ['Category Name', 'Products Count', 'Stock Quantities', 'Est Value (Cost)'];
        
        // Compile category totals
        const catSummary: Record<string, { count: number, stock: number, value: number }> = {};
        items.forEach(item => {
          if (!catSummary[item.category]) {
            catSummary[item.category] = { count: 0, stock: 0, value: 0 };
          }
          catSummary[item.category].count += 1;
          catSummary[item.category].stock += item.stockInBaseUnit || 0;
        });

        // Compute category stock value using per-item stockInBaseUnit × price-per-base-unit
        // (using each item's default or first variant to derive the base unit price)
        // This MUST use items, not flatVariants, to avoid double-counting when an item has multiple variants.
        items.forEach(item => {
          if (!catSummary[item.category]) return;
          const defaultVar =
            flatVariants.find(fv => fv.itemId === item.id && fv.isDefault) ||
            flatVariants.find(fv => fv.itemId === item.id);
          const pricePerBase = defaultVar
            ? defaultVar.purchasePrice / (defaultVar.packageSize || 1)
            : 0;
          catSummary[item.category].value += (item.stockInBaseUnit || 0) * pricePerBase;
        });

        Object.keys(catSummary).forEach(cat => {
          rows.push({
            'Category Name': cat,
            'Products Count': catSummary[cat].count,
            'Stock Quantities': catSummary[cat].stock,
            'Est Value (Cost)': catSummary[cat].value
          });
        });

        totals['Total Categories'] = rows.length;
        totals['Total Stock Units'] = rows.reduce((sum, r) => sum + r['Stock Quantities'], 0);
        totals['Total Valuation'] = rows.reduce((sum, r) => sum + r['Est Value (Cost)'], 0);
        break;

      case 'variant-report':
        title = 'Variant Stock Statement';
        columns = [
          'Variant Name',
          'Parent Product',
          'Category',
          'SKU',
          'Barcode',
          'Stock (Variant Unit)',
          'Conversion Ratio',
          'Stock (Base Unit)',
          'Purchase Cost',
          'Selling Value',
          'Status'
        ];
        rows = flatVariants
          .filter(v => v.itemName.toLowerCase().includes(searchLower) || v.name.toLowerCase().includes(searchLower))
          .map(v => {
            const packageSize = v.packageSize || 1;
            const statusLabel = (v.isActive !== false) ? 'ACTIVE' : 'INACTIVE';
            const parentStock = v.parentStock || 0;
            return {
              'Variant Name': v.name,
              'Parent Product': v.itemName,
              'Category': v.itemCategory,
              'SKU': v.sku,
              'Barcode': v.barcode || '-',
              'Stock (Variant Unit)': `${Number(parentStock / packageSize).toFixed(2)} ${v.name || 'Bag'}`,
              'Conversion Ratio': `1 ${v.name || 'Bag'} = ${packageSize} ${v.itemUnit}`,
              'Stock (Base Unit)': `${Number(parentStock).toFixed(2)} ${v.itemUnit}`,
              'Purchase Cost': v.purchasePrice,
              'Selling Value': v.sellingPrice,
              'Status': statusLabel
            };
          });
        totals['Total Unique Variants'] = rows.length;
        totals['Total Stock (Base Units)'] = items.reduce((sum, item) => sum + (item.stockInBaseUnit || 0), 0);
        break;

      case 'purchase-variant-report':
        title = 'Itemized Purchase Statement (Variants)';
        columns = [
          'Bill No',
          'Date',
          'Supplier',
          'Product',
          'Variant',
          'Purchased Qty (Variant Unit)',
          'Conversion Ratio',
          'Converted Qty (Base Unit)',
          'Purchase Price (Pack)',
          'Total Cost'
        ];
        rows = [];
        purchases
          .filter(p => isWithinDateRange(p.date) && (p.purchaseNumber.toLowerCase().includes(searchLower) || p.supplierName.toLowerCase().includes(searchLower)))
          .forEach(p => {
            const d = (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any);
            p.items.forEach(pi => {
              const matchedVar = flatVariants.find(fv => fv.id === pi.variantId);
              const packageSize = pi.packageSizeSnapshot !== undefined ? pi.packageSizeSnapshot : (matchedVar?.packageSize || matchedVar?.conversionValue || 1);
              const baseUnit = matchedVar?.itemUnit || 'KG';
              const varUnit = pi.variantName || matchedVar?.name || 'Bag';
              const convertedQty = pi.quantity * packageSize;

              rows.push({
                'Bill No': p.purchaseNumber,
                'Date': d.toLocaleDateString('en-IN'),
                'Supplier': p.supplierName,
                'Product': pi.itemName,
                'Variant': pi.variantName,
                'Purchased Qty (Variant Unit)': `${pi.quantity} ${varUnit}`,
                'Conversion Ratio': `1 ${varUnit} = ${packageSize} ${baseUnit}`,
                'Converted Qty (Base Unit)': `${convertedQty.toFixed(2)} ${baseUnit}`,
                'Purchase Price (Pack)': pi.purchaseRate,
                'Total Cost': pi.total
              });
            });
          });
        totals['Total Transactions'] = rows.length;
        totals['Total Purchase Outlay'] = rows.reduce((sum, r) => sum + r['Total Cost'], 0);
        break;

      case 'sales-variant-report':
        title = 'Itemized Sales Statement (Variants)';
        columns = [
          'Invoice No',
          'Date',
          'Customer',
          'Product',
          'Variant',
          'Sold Qty (Variant Unit)',
          'Conversion Ratio',
          'Converted Qty (Base Unit)',
          'Selling Price (Pack)',
          'Total Revenue'
        ];
        rows = [];
        sales
          .filter(s => isWithinDateRange(s.date) && (s.invoiceNumber.toLowerCase().includes(searchLower) || s.customerName.toLowerCase().includes(searchLower)))
          .forEach(s => {
            const d = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
            s.items.forEach(si => {
              const matchedVar = flatVariants.find(fv => fv.id === si.variantId);
              const packageSize = si.packageSizeSnapshot !== undefined ? si.packageSizeSnapshot : (matchedVar?.packageSize || matchedVar?.conversionValue || 1);
              const baseUnit = matchedVar?.itemUnit || 'KG';
              const varUnit = si.variantName || matchedVar?.name || 'Bag';
              const convertedQty = si.quantity * packageSize;

              rows.push({
                'Invoice No': s.invoiceNumber,
                'Date': d.toLocaleDateString('en-IN'),
                'Customer': s.customerName,
                'Product': si.itemName,
                'Variant': si.variantName,
                'Sold Qty (Variant Unit)': `${si.quantity} ${varUnit}`,
                'Conversion Ratio': `1 ${varUnit} = ${packageSize} ${baseUnit}`,
                'Converted Qty (Base Unit)': `${convertedQty.toFixed(2)} ${baseUnit}`,
                'Selling Price (Pack)': si.sellingPrice,
                'Total Revenue': si.total
              });
            });
          });
        totals['Total Transactions'] = rows.length;
        totals['Total Revenue Generated'] = rows.reduce((sum, r) => sum + r['Total Revenue'], 0);
        break;
    }

    return { columns, rows, title, totals };
  };

  const reportData = getReportData();

  // Excel Exporter
  const handleExportExcel = () => {
    if (reportData.rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(reportData.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${reportType.replace('-', '_')}_statement.xlsx`);
    toast.success('Excel Statement Downloaded');
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (reportData.rows.length === 0) {
      toast.error('No data to export');
      return;
    }
    const header = reportData.columns.join(',');
    const body = reportData.rows
      .map(r => reportData.columns.map(col => `"${String(r[col] || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(header + '\n' + body);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `${reportType.replace('-', '_')}_statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Statement Downloaded');
  };

  // PDF Print Trigger
  const handlePrintPDF = () => {
    const printContent = document.getElementById('printable-report-area');
    if (!printContent) return;
    const win = window.open('', '', 'width=900,height=600');
    if (win) {
      win.document.write('<html><head><title>Inventory Report</title><style>body { padding: 40px; font-family: sans-serif; } table { width:100%; border-collapse:collapse; margin-top:20px; font-size:12px; } th, td { border:1px solid #ddd; padding:8px; text-align:left; } th { background:#f5f5f5; } h2, p { margin:0; }</style></head><body>');
      win.document.write(`<h2>DoodhOS ERP - Inventory Statement</h2>`);
      win.document.write(`<p>Report: ${reportData.title}</p>`);
      if (startDate && endDate) {
        win.document.write(`<p>Period: ${startDate} to ${endDate}</p>`);
      }
      win.document.write('<hr/>');
      win.document.write(printContent.innerHTML);
      win.document.write('</body></html>');
      win.document.close();
      win.focus();
      win.print();
      win.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Filters */}
      <div style={cardStyle} className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        
        {/* Report Selector */}
        <div className="md:col-span-3">
          <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Report Type</label>
          <select
            value={reportType}
            onChange={e => setReportType(e.target.value)}
            className="w-full px-3 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#555] outline-none cursor-pointer"
          >
            <option value="current-stock">1. Current Stock Level</option>
            <option value="stock-value">2. Stock Valuation</option>
            <option value="purchase-report">3. Purchases Statement</option>
            <option value="sales-report">4. Sales Statement</option>
            <option value="supplier-report">5. Supplier Outstandings</option>
            <option value="stock-adjustment-report">6. Stock Adjustments</option>
            <option value="low-stock-report">7. Low Stock Alerts</option>
            <option value="profit-report">8. Product Margins / Profit</option>
            <option value="category-report">9. Category Summary</option>
            <option value="variant-report">10. Variant Levels</option>
            <option value="purchase-variant-report">11. Purchases by Variant</option>
            <option value="sales-variant-report">12. Sales by Variant</option>
          </select>
        </div>

        {/* Date presets */}
        <div className="md:col-span-2">
          <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Date Period</label>
          <select
            value={dateRangeOption}
            onChange={e => setDateRangeOption(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#555] outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="fy">Financial Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Pickers */}
        <div className="md:col-span-4 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">From</label>
            <input
              type="date"
              disabled={dateRangeOption !== 'custom'}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#111] outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">To</label>
            <input
              type="date"
              disabled={dateRangeOption !== 'custom'}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#111] outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Search inside report */}
        <div className="md:col-span-3">
          <label className="text-[11px] font-bold text-[#777] uppercase tracking-wider mb-1 block">Filter Results</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search rows..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-[#F7F7F7] border border-[#ECECEC] rounded-xl text-[12px] font-semibold text-[#111] outline-none focus:border-[#FF6B00]"
            />
          </div>
        </div>

      </div>

      {/* 2. Totals summary */}
      {reportData.totals && Object.keys(reportData.totals).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.keys(reportData.totals).map(key => (
            <div key={key} style={cardStyle} className="p-5 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-[#777777] uppercase leading-none">{key}</span>
              <span className="text-[20px] font-extrabold text-[#111111] mt-3 block">
                {typeof reportData.totals?.[key] === 'number' && key.toLowerCase().includes('value') || key.toLowerCase().includes('total') || key.toLowerCase().includes('revenue') || key.toLowerCase().includes('margin') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('gst')
                  ? `₹${reportData.totals![key].toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                  : reportData.totals?.[key]
                }
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Report Data Table & Export */}
      <div style={cardStyle} className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[#111111] flex items-center gap-2">
            <FileText size={16} className="text-[#FF6B00]" /> {reportData.title}
          </h3>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPDF}
              className="p-2 border border-[#ECECEC] hover:bg-gray-50 text-gray-700 rounded-xl transition-all"
              title="Print Statement"
            >
              <Printer size={15} />
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-[#111] text-[12px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown size={14} /> CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-[#FF6B00] hover:bg-orange-600 text-white text-[12px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown size={14} /> Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-[#ECECEC] rounded-2xl" id="printable-report-area">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#ECECEC] text-[10px] text-[#777777] uppercase font-bold">
                {reportData.columns.map(col => (
                  <th key={col} className="p-3.5">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F7F7F7]">
                    <td colSpan={reportData.columns.length} className="p-6">
                      <div className="h-6 bg-gray-100 rounded w-full animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportData.columns.length} className="p-12 text-center text-[#AAAAAA]">
                    No matching report entries found. Adjust date filters.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#F7F7F7] last:border-none hover:bg-gray-50 transition-colors">
                    {reportData.columns.map(col => {
                      const val = row[col];
                      const isNumber = typeof val === 'number';
                      const isRateOrCost = col.toLowerCase().includes('price') || col.toLowerCase().includes('value') || col.toLowerCase().includes('cost') || col.toLowerCase().includes('total') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('margin') || col.toLowerCase().includes('gst') || col.toLowerCase().includes('discount') || col.toLowerCase().includes('payable');
                      
                      return (
                        <td key={col} className={`p-3.5 ${isNumber ? 'text-right font-mono' : ''} ${isRateOrCost ? 'font-bold' : ''}`}>
                          {isRateOrCost && isNumber ? `₹${val.toFixed(2)}` : val}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
