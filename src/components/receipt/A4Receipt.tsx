import React from 'react';
import { Collection, Farmer, PrinterSettingsFormData } from '@/types';
import { format } from 'date-fns';

interface A4ReceiptProps {
  collection: Collection;
  farmer: Farmer | null;
  settings: PrinterSettingsFormData;
  centerName?: string;
  centerVillage?: string;
  centerPhone?: string;
}

export const A4Receipt = React.forwardRef<HTMLDivElement, A4ReceiptProps>(
  ({ collection, farmer, settings, centerName, centerVillage, centerPhone }, ref) => {
    const d = (collection.createdAt as any)?.toDate ? (collection.createdAt as any).toDate() : new Date(collection.createdAt as any);
    
    return (
      <div ref={ref} className="a4-receipt-container" style={{ width: '210mm', minHeight: '148mm', margin: '0 auto', background: 'white', padding: '20mm' }}>
        <style type="text/css">
          {`
            @media print {
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; background: white; }
              html { background: white; }
              
              .a4-receipt-container {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #000;
                width: 100%;
                margin: 0;
                padding: 15mm;
                box-sizing: border-box;
              }
              .no-print { display: none; }
            }
          `}
        </style>
        
        <div className="a4-receipt-container border border-slate-200">
          {/* Header */}
          <div className="flex justify-between items-start mb-8 border-b border-slate-300 pb-6">
            <div className="flex items-center gap-4">
              {settings.printLogo && (
                <div style={{ width: '60px', height: '60px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#888' }}>
                  LOGO
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold m-0 p-0 text-[#111]">{centerName || 'DOODHOS'}</h1>
                <p className="text-sm text-slate-600 m-0 mt-1">Milk Collection Center</p>
                {centerVillage && <p className="text-sm text-slate-500 m-0">{centerVillage}</p>}
                {centerPhone && <p className="text-sm text-slate-500 m-0">Ph: {centerPhone}</p>}
              </div>
            </div>
            
            <div className="text-right">
              <h2 className="text-3xl font-light text-slate-400 m-0 uppercase tracking-widest">Receipt</h2>
              <div className="mt-2 text-sm text-slate-600">
                <div className="font-semibold text-slate-800">No. RC{collection.id.slice(-6).toUpperCase()}</div>
                <div>Date: {format(d, 'dd MMM yyyy')}</div>
                <div>Time: {format(d, 'hh:mm a')}</div>
              </div>
            </div>
          </div>

          {/* Farmer Info */}
          <div className="bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Farmer Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">Name</div>
                <div className="font-bold text-lg text-slate-800">{collection.farmerName}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">ID</div>
                <div className="font-semibold text-slate-800">{collection.farmerId}</div>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wider">Item Description</th>
                <th className="py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wider text-center">Shift</th>
                <th className="py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wider text-right">Liters</th>
                <th className="py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wider text-right">Rate / L</th>
                <th className="py-3 px-2 text-sm font-semibold text-slate-700 uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-4 px-2">
                  <div className="font-semibold text-slate-800 capitalize">{collection.animalType} Milk</div>
                  <div className="text-sm text-slate-500 mt-1">FAT: {collection.fat.toFixed(1)} &nbsp; | &nbsp; SNF: {collection.snf.toFixed(1)} {collection.clr ? ` | CLR: ${collection.clr}` : ''}</div>
                </td>
                <td className="py-4 px-2 text-center text-slate-700 capitalize">{collection.shift}</td>
                <td className="py-4 px-2 text-right text-slate-700 font-medium">{collection.liters.toFixed(2)}</td>
                <td className="py-4 px-2 text-right text-slate-700 font-medium">₹{collection.rate.toFixed(2)}</td>
                <td className="py-4 px-2 text-right text-slate-800 font-bold">₹{collection.totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-between items-start">
            <div className="w-1/2">
              {settings.printQrCode && (
                <div className="border border-slate-200 p-2 inline-block rounded">
                   <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '10px' }}>QR CODE</div>
                </div>
              )}
            </div>
            
            <div className="w-1/3">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-800">₹{collection.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 border-t-2 border-slate-800 mt-1">
                <span className="text-lg font-bold text-slate-800">TOTAL</span>
                <span className="text-xl font-bold text-slate-800">₹{collection.totalAmount.toFixed(2)}</span>
              </div>
              
              {settings.printBalance && farmer && (
                <div className="flex justify-between py-2 border-t border-slate-200 mt-2 text-sm">
                  <span className="text-slate-500">A/C Balance</span>
                  <span className="font-semibold text-slate-700">
                    {(farmer.balance || 0) >= 0 ? '+' : '-'}₹{Math.abs(farmer.balance || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
            {settings.footerMessage ? (
              <div style={{ whiteSpace: 'pre-line' }}>{settings.footerMessage}</div>
            ) : (
              <div>Thank you for your business!</div>
            )}
            <div className="mt-2 text-xs text-slate-400">Printed on {format(new Date(), 'dd/MM/yyyy hh:mm a')}</div>
          </div>
        </div>
      </div>
    );
  }
);
A4Receipt.displayName = 'A4Receipt';
