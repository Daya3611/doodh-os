'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Receipt, Globe, Bell, Save } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '24px' };
const inputClass = `w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all`;
const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };

const sections = [
  { id: 'center', label: 'Center Info', icon: Building2 },
  { id: 'receipt', label: 'Receipt', icon: Receipt },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'system', label: 'System', icon: Globe },
];

export default function SettingsPage() {
  const { profile } = useAuthStore();
  const [activeSection, setActiveSection] = useState('center');
  const [centerName, setCenterName] = useState(profile?.name ? `${profile.name}'s Center` : 'My Dairy Center');
  const [address, setAddress] = useState('Village Road, District, State');
  const [footerText, setFooterText] = useState('Thank you for your business!');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const handleSave = () => { toast.success('Settings saved successfully'); };

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
                <input className={inputClass} style={inputStyle} defaultValue={profile?.name || ''} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Address</label>
                <input className={inputClass} style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} onFocus={focusStyle} onBlur={blurStyle} />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Phone</label>
                <input className={inputClass} style={inputStyle} placeholder="Center contact number" onFocus={focusStyle} onBlur={blurStyle} />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'receipt' && (
          <div className="space-y-5">
            <div className="text-[16px] font-bold text-[#111111] mb-5">Receipt Settings</div>
            <div>
              <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Receipt Width</label>
              <select className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle}>
                <option value="80mm">80mm (Default Thermal)</option>
                <option value="58mm">58mm (Small Thermal)</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Receipt Footer Text</label>
              <textarea
                className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all resize-none"
                style={{ ...inputStyle, minHeight: '80px' }}
                value={footerText} onChange={e => setFooterText(e.target.value)}
                onFocus={focusStyle as any} onBlur={blurStyle as any}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#F7F7F7' }}>
              <div>
                <div className="text-[14px] font-semibold text-[#111111]">Auto Print</div>
                <div className="text-[12px] text-[#777777]">Automatically open print dialog after saving a collection</div>
              </div>
              <Toggle value={false} onChange={() => {}} />
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
              <select className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all" style={inputStyle}>
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
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
          >
            <Save size={16} /> Save Changes
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
