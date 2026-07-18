'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Receipt, Globe, Bell, Save, Loader2, HardDrive } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { settingsService } from '@/services/settingsService';
import { backupService } from '@/services/backupService';
import { toast } from 'sonner';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '24px' };
const inputClass = `w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all`;
const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };

const sections = [
  { id: 'center', label: 'Center Info', icon: Building2 },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
  { id: 'system', label: 'System', icon: Globe },
];

export default function SettingsPage() {
  const { profile } = useAuthStore();
  const [activeSection, setActiveSection] = useState('center');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [centerName, setCenterName] = useState(profile?.name ? `${profile.name}'s Center` : 'My Dairy Center');
  const [ownerName, setOwnerName] = useState(profile?.name || '');
  const [address, setAddress] = useState('Village Road, District, State');
  const [phone, setPhone] = useState('');
  
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (profile?.centerId) {
      settingsService.getSettings(profile.centerId).then(data => {
        if (data.centerName) setCenterName(data.centerName);
        if (data.ownerName) setOwnerName(data.ownerName);
        if (data.address) setAddress(data.address);
        if (data.phone) setPhone(data.phone);
        if (data.smsEnabled !== undefined) setSmsEnabled(data.smsEnabled);
        if (data.whatsappEnabled !== undefined) setWhatsappEnabled(data.whatsappEnabled);
        if (data.darkMode !== undefined) setDarkMode(data.darkMode);
        if (data.language) setLanguage(data.language);
        setIsLoading(false);
      });
    }
  }, [profile?.centerId]);

  const handleSave = async () => {
    if (!profile?.centerId) return;
    setIsSaving(true);
    try {
      await settingsService.saveSettings(profile.centerId, {
        centerName, ownerName, address, phone,
        smsEnabled, whatsappEnabled, darkMode, language
      });
      toast.success('Settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
      style={{ background: value ? '#FF6B00' : '#DDDDDD' }}>
      <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ left: value ? 'calc(100% - 22px)' : '2px' }} />
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 max-w-5xl">
      {/* Nav */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} style={{ ...cardStyle, padding: '12px', alignSelf: 'start' }}>
        <div className="space-y-1">
          {sections.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={{ background: active ? '#F5F5F5' : 'transparent' }}>
                <Icon size={17} style={{ color: active ? '#FF6B00' : '#999999' }} />
                <span className="text-[14px] font-medium" style={{ color: active ? '#111111' : '#666666' }}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="lg:col-span-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            {activeSection === 'center' && (
          <div className="space-y-5">
            <div className="text-[16px] font-bold text-[#111111] mb-5">Center Information</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Center Name</label>
                <input className={inputClass} style={inputStyle} value={centerName} onChange={e => setCenterName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Owner Name</label>
                <input className={inputClass} style={inputStyle} value={ownerName} onChange={e => setOwnerName(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Address</label>
                <input className={inputClass} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Phone</label>
                <input className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Center contact number" onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'receipt' && (
          <div className="space-y-5">
            <div className="text-[16px] font-bold text-[#111111] mb-5">Receipt & Printer Settings</div>
            <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white">
              <div>
                <div className="text-[15px] font-bold text-[#111111] flex items-center gap-2"><Receipt size={18} className="text-[#FF6B00]" /> Advanced Printer Management</div>
                <div className="text-[13px] text-[#777777] mt-1">Configure Thermal and A4 receipt printers, templates, logos, and auto-print logic.</div>
              </div>
              <button
                onClick={() => window.location.href = '/settings/printer'}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#FFF5EE] text-[#FF6B00] hover:bg-[#FFE8D6] transition-colors whitespace-nowrap"
              >
                Configure Printer
              </button>
            </div>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="space-y-4">
            <div className="text-[16px] font-bold text-[#111111] mb-5">Notification Channels</div>
            {[
              { label: 'SMS Notifications', desc: 'Send payment confirmations via SMS', value: smsEnabled, toggle: () => setSmsEnabled(v => !v) },
              { label: 'WhatsApp Notifications', desc: 'Send receipts and updates via WhatsApp', value: whatsappEnabled, toggle: () => setWhatsappEnabled(v => !v) },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F7F7F7' }}>
                <div>
                  <div className="text-[14px] font-semibold text-[#111111]">{item.label}</div>
                  <div className="text-[12px] text-[#777777]">{item.desc}</div>
                </div>
                <Toggle value={item.value} onChange={item.toggle} />
              </div>
            ))}
          </div>
        )}

        {activeSection === 'backup' && (
          <div className="space-y-5">
            <div className="text-[16px] font-bold text-[#111111] mb-5">Backup & Database Restore</div>
            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-[#111111]">Export Local Database</div>
                  <div className="text-[12px] text-[#777777] mt-1">Download a JSON snapshot of your collections, ledger transactions, rate charts, and farmers list.</div>
                </div>
                <button
                  onClick={() => {
                    if (profile?.centerId) {
                      backupService.exportBackup(profile.centerId);
                    } else {
                      toast.error("Center ID not found");
                    }
                  }}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#FFF5EE] text-[#FF6B00] hover:bg-[#FFE8D6] transition-colors"
                >
                  Export JSON
                </button>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-bold text-[#111111]">Import Database Snapshot</div>
                  <div className="text-[12px] text-[#777777] mt-1">Select a previously exported DoodhOS JSON backup file to overwrite local state and queue for sync.</div>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    id="restore-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && profile?.centerId) {
                        const ok = await backupService.importBackup(file, profile.centerId);
                        if (ok) {
                          window.location.reload();
                        }
                      }
                    }}
                  />
                  <label
                    htmlFor="restore-upload"
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer inline-block"
                  >
                    Select File
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'system' && (
          <div className="space-y-4">
            <div className="text-[16px] font-bold text-[#111111] mb-5">System Preferences</div>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F7F7F7' }}>
              <div>
                <div className="text-[14px] font-semibold text-[#111111]">Dark Mode</div>
                <div className="text-[12px] text-[#777777]">Switch to dark theme</div>
              </div>
              <Toggle value={darkMode} onChange={() => setDarkMode(v => !v)} />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Language</label>
              <select className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle} value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-6 mt-6 border-t border-[#F0F0F0]">
          <motion.button
            whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
            onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
          >
            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
          </motion.button>
        </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
