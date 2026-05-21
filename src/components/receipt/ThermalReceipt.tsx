import React from 'react';
import { Collection, Farmer } from '@/types';
import { format } from 'date-fns';

interface ThermalReceiptProps {
  collection: Collection;
  farmer: Farmer | null;
  settings?: {
    width?: '58mm' | '80mm';
    centerName?: string;
    centerPhone?: string;
    centerVillage?: string;
    footerText?: string;
  };
}

export const ThermalReceipt = React.forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ collection, farmer, settings }, ref) => {
    const width = settings?.width === '58mm' ? '58mm' : '80mm';
    const d = (collection.createdAt as any)?.toDate ? (collection.createdAt as any).toDate() : new Date(collection.createdAt as any);
    
    return (
      <div ref={ref} className="receipt-container" style={{ width, margin: '0 auto', background: 'white', padding: '10px' }}>
        <style type="text/css">
          {`
            @media print {
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; }
              .receipt-container {
                font-family: monospace;
                font-size: 12px;
                color: #000;
                line-height: 1.4;
              }
              .divider { border-top: 1px dashed #000; margin: 8px 0; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .flex-between { display: flex; justify-content: space-between; }
              .bold { font-weight: bold; }
              .title { font-size: 16px; font-weight: bold; }
              .no-print { display: none; }
            }
          `}
        </style>
        
        <div className="receipt-container">
          {/* Header */}
          <div className="text-center">
            <div className="title">{settings?.centerName || 'DOODHOS'}</div>
            <div>Milk Collection Center</div>
            {settings?.centerVillage && <div>Village: {settings.centerVillage}</div>}
            {settings?.centerPhone && <div>Phone: {settings.centerPhone}</div>}
          </div>

          <div className="divider" />

          {/* Receipt Info */}
          <div className="flex-between">
            <span>Receipt No:</span>
            <span>RC{collection.id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex-between">
            <span>Date:</span>
            <span>{format(d, 'dd/MM/yyyy')}</span>
          </div>
          <div className="flex-between">
            <span>Time:</span>
            <span>{format(d, 'hh:mm a')}</span>
          </div>

          <div className="divider" />

          {/* Farmer Info */}
          <div className="flex-between">
            <span>Farmer:</span>
            <span className="bold">{collection.farmerName}</span>
          </div>
          <div className="flex-between">
            <span>Farmer ID:</span>
            <span>{collection.farmerId}</span>
          </div>
          <div className="flex-between">
            <span>Animal:</span>
            <span style={{ textTransform: 'capitalize' }}>{collection.animalType}</span>
          </div>
          <div className="flex-between">
            <span>Shift:</span>
            <span style={{ textTransform: 'capitalize' }}>{collection.shift}</span>
          </div>

          <div className="divider" />

          {/* Collection Info */}
          <div className="flex-between">
            <span>Liters:</span>
            <span className="bold">{collection.liters} L</span>
          </div>
          <div className="flex-between">
            <span>FAT:</span>
            <span>{collection.fat.toFixed(1)}</span>
          </div>
          <div className="flex-between">
            <span>SNF:</span>
            <span>{collection.snf.toFixed(1)}</span>
          </div>
          {collection.clr ? (
            <div className="flex-between">
              <span>CLR:</span>
              <span>{collection.clr}</span>
            </div>
          ) : null}
          <div className="flex-between">
            <span>Rate:</span>
            <span>₹{collection.rate.toFixed(2)}/L</span>
          </div>

          <div className="divider" />

          {/* Total */}
          <div className="text-center bold" style={{ fontSize: '14px', margin: '4px 0' }}>
            TOTAL
          </div>
          <div className="text-center bold" style={{ fontSize: '20px' }}>
            ₹{collection.totalAmount.toFixed(2)}
          </div>

          <div className="divider" />

          {/* Account Balance */}
          {farmer && (
            <div className="flex-between" style={{ marginTop: '8px' }}>
              <span>A/C Balance:</span>
              <span className="bold" style={{ color: (farmer.balance || 0) >= 0 ? 'inherit' : 'inherit' }}>
                {(farmer.balance || 0) >= 0 ? '+' : '-'}₹{Math.abs(farmer.balance || 0).toFixed(2)}
              </span>
            </div>
          )}

          <div className="divider" />

          {/* Footer */}
          <div className="text-center" style={{ marginTop: '12px' }}>
            {settings?.footerText ? (
              <div style={{ whiteSpace: 'pre-line' }}>{settings.footerText}</div>
            ) : (
              <>
                <div>Thank You</div>
                <div>Visit Again</div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);
ThermalReceipt.displayName = 'ThermalReceipt';
