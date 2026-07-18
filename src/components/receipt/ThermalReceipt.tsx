import React from 'react';
import { Collection, Farmer, PrinterSettingsFormData } from '@/types';
import { format } from 'date-fns';

interface ThermalReceiptProps {
  collection: Collection;
  farmer: Farmer | null;
  settings: PrinterSettingsFormData;
  centerName?: string;
  centerVillage?: string;
  centerPhone?: string;
}

export const ThermalReceipt = React.forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ collection, farmer, settings, centerName, centerVillage, centerPhone }, ref) => {
    const width = settings.printerType === '58mm' ? '58mm' : '80mm';
    const d = (collection.createdAt as any)?.toDate ? (collection.createdAt as any).toDate() : new Date(collection.createdAt as any);
    
    return (
      <div ref={ref} className="receipt-container" style={{ width, boxSizing: 'border-box', background: 'white' }}>
        <style type="text/css">
          {`
            @media print {
              @page { margin: 0; size: ${width} auto; }
              body { margin: 0; padding: 0; }
              html { background: white; }
              
              .receipt-container {
                font-family: monospace;
                font-size: ${settings.fontSize || '12px'};
                color: #000;
                line-height: 1.4;
                width: ${width};
                max-width: ${width};
                margin: 0;
                padding: ${settings.topMargin || 0}px 10px 10px ${settings.leftMargin || 10}px;
                box-sizing: border-box;
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
        
        <div className="receipt-content">
          {/* Header */}
          <div className="text-center">
            {settings.printLogo && (
              <div className="mb-2">
                {/* Placeholder for Logo */}
                <div style={{ width: '40px', height: '40px', margin: '0 auto', background: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' }}>LOGO</div>
              </div>
            )}
            <div className="title">{centerName || 'DOODHOS'}</div>
            <div>Milk Collection Center</div>
            {centerVillage && <div>Village: {centerVillage}</div>}
            {centerPhone && <div>Phone: {centerPhone}</div>}
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
            <span className="bold text-right pl-2" style={{ wordBreak: 'break-word' }}>{collection.farmerName}</span>
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
          <div className="flex-between bold" style={{ fontSize: '14px', margin: '4px 0' }}>
            <span>TOTAL AMOUNT</span>
            <span>₹{collection.totalAmount.toFixed(2)}</span>
          </div>

          {settings.printBalance && farmer && (
            <>
              <div className="divider" />
              <div className="flex-between" style={{ marginTop: '4px', fontSize: '11px' }}>
                <span>A/C Balance:</span>
                <span className="bold">
                  {(farmer.balance || 0) >= 0 ? '+' : '-'}₹{Math.abs(farmer.balance || 0).toFixed(2)}
                </span>
              </div>
            </>
          )}

          <div className="divider" />

          {settings.printQrCode && (
            <div className="text-center my-3">
               {/* Placeholder for QR Code */}
               <div style={{ width: '80px', height: '80px', margin: '0 auto', border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ fontSize: '10px' }}>QR CODE</span>
               </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center" style={{ marginTop: '12px' }}>
            {settings.footerMessage ? (
              <div style={{ whiteSpace: 'pre-line', fontSize: '11px' }}>{settings.footerMessage}</div>
            ) : (
              <div style={{ fontSize: '11px' }}>
                <div>Thank You</div>
                <div>Visit Again</div>
              </div>
            )}
            <div style={{ fontSize: '9px', marginTop: '6px', color: '#555' }}>
              Printed on {format(new Date(), 'dd/MM/yyyy hh:mm a')}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
ThermalReceipt.displayName = 'ThermalReceipt';
