'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { printerService } from '@/services/printerService';
import { PrinterSettingsFormData } from '@/types';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function PrinterSettingsPage() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [settings, setSettings] = useState<PrinterSettingsFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.centerId) {
      printerService.getSettings(profile.centerId).then(data => {
        setSettings(data || printerService.getDefaultSettings());
      });
    }
  }, [profile?.centerId]);

  const handleSave = async () => {
    if (!profile?.centerId || !settings) return;
    setIsSaving(true);
    try {
      await printerService.saveSettings(profile.centerId, settings);
      toast.success('Printer settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-8 flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  }

  const update = (key: keyof PrinterSettingsFormData, value: any) => {
    setSettings(s => s ? { ...s, [key]: value } : null);
  };

  const cardStyle = { background: '#FFFFFF', borderRadius: '16px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '24px' };
  const inputClass = `w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all`;
  const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ background: value ? '#FF6B00' : '#DDDDDD' }}>
      <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ left: value ? 'calc(100% - 22px)' : '2px' }} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/settings')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#111]">Printer Settings</h1>
          <p className="text-[13px] text-slate-500">Configure your Thermal & A4 printing layout</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="space-y-6">
          <h2 className="text-[15px] font-bold flex items-center gap-2"><Printer size={16}/> Hardware Settings</h2>
          
          <div>
            <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Printer Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['58mm', '80mm', 'a4'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => update('printerType', type)}
                  className={`py-2 rounded-xl text-[13px] font-medium border ${settings.printerType === type ? 'border-[#FF6B00] bg-[#FFF5EE] text-[#FF6B00]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Printer Profile Name</label>
            <input className={inputClass} style={inputStyle} value={settings.printerName || ''} onChange={e => update('printerName', e.target.value)} placeholder="e.g. Office Thermal" />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F7F7F7' }}>
            <div>
              <div className="text-[14px] font-semibold text-[#111111]">Auto Print</div>
              <div className="text-[12px] text-[#777777]">Automatically print on save</div>
            </div>
            <Toggle value={settings.autoPrint} onChange={() => update('autoPrint', !settings.autoPrint)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F7F7F7' }}>
            <div>
              <div className="text-[14px] font-semibold text-[#111111]">Number of Copies</div>
              <div className="text-[12px] text-[#777777]">Multiple copies (1-5)</div>
            </div>
            <input type="number" min="1" max="5" value={settings.copies} onChange={e => update('copies', parseInt(e.target.value) || 1)} className="w-16 px-3 py-1.5 text-center text-[14px] rounded-lg border border-slate-200 outline-none" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={cardStyle} className="space-y-6">
          <h2 className="text-[15px] font-bold">Layout Configuration</h2>

          <div className="space-y-2">
            {[
              { id: 'printLogo', label: 'Print Logo', desc: 'Include center logo at top' },
              { id: 'printQrCode', label: 'Print QR Code', desc: 'Include verification QR code' },
              { id: 'printBalance', label: 'Print Farmer Balance', desc: 'Show previous and current balance' },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[13px] font-semibold text-[#111111]">{item.label}</div>
                  <div className="text-[11px] text-[#777777]">{item.desc}</div>
                </div>
                <Toggle value={settings[item.id as keyof PrinterSettingsFormData] as boolean} onChange={() => update(item.id as keyof PrinterSettingsFormData, !settings[item.id as keyof PrinterSettingsFormData])} />
              </div>
            ))}
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Footer Message</label>
            <textarea className={`${inputClass} resize-none min-h-[80px]`} style={inputStyle} value={settings.footerMessage || ''} onChange={e => update('footerMessage', e.target.value)} placeholder="Thank You&#10;Visit Again" />
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-10 md:pl-[280px]">
        <div className="max-w-4xl mx-auto flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 text-[14px] font-semibold text-white bg-[#FF6B00] rounded-xl hover:bg-[#E66000] disabled:opacity-50 shadow-lg shadow-orange-500/20"
          >
            {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />} 
            Save Printer Settings
          </motion.button>
        </div>
      </div>
    </div>
  );
}
