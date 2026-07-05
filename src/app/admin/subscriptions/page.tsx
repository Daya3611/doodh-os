'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/services/adminService';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Activity, CalendarDays, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { subscriptionService, SaaSPlan } from '@/services/subscriptionService';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PLANS, COUPONS

  const [isAddingSub, setIsAddingSub] = useState(false);
  const [centers, setCenters] = useState<any[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [subsData, centersData, plansData] = await Promise.all([
          adminService.getAllSubscriptions(),
          adminService.getAllCenters(),
          subscriptionService.getAvailablePlans()
        ]);
        setSubs(subsData);
        setCenters(centersData);
        setPlans(plansData);
      } catch (error) {
        toast.error('Failed to load subscriptions');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleManualSubscribe = async () => {
    if (!selectedCenter || !selectedPlan) {
      toast.error('Please select both center and plan');
      return;
    }
    try {
      await subscriptionService.upgradePlan(selectedCenter, selectedPlan);
      toast.success('Subscription assigned successfully!');
      setIsAddingSub(false);
      
      // Reload
      const subsData = await adminService.getAllSubscriptions();
      setSubs(subsData);
    } catch (error) {
      toast.error('Failed to assign subscription');
    }
  };

  const formatDate = (dateData: any) => {
    if (!dateData) return '-';
    if (dateData instanceof Timestamp) return dateData.toDate().toLocaleDateString();
    return new Date(dateData).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-[#ECECEC]">
        {['ALL', 'PLANS', 'COUPONS'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-[14px] font-bold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#FF6B00] text-[#111]'
                : 'border-transparent text-[#888] hover:text-[#111]'
            }`}
          >
            {tab === 'ALL' ? 'All Subscriptions' : tab === 'PLANS' ? 'Pricing Plans' : 'Coupons'}
          </button>
        ))}
      </div>

      {activeTab === 'ALL' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-[#111]">Center Subscriptions</h2>
            <button 
              onClick={() => setIsAddingSub(true)}
              className="bg-[#FF6B00] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600"
            >
              <Plus size={16} /> Add Subscription
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Center ID</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Start Date</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Expiry Date</th>
                  <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#F0F0F0]">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-gray-100 rounded-full animate-pulse w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : subs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                          <Wallet size={32} className="text-blue-500" />
                        </div>
                        <div className="text-[16px] font-bold text-[#111]">No active subscriptions</div>
                        <div className="text-[14px] text-[#888]">Centers will appear here when they register.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {subs.map((sub, i) => (
                      <motion.tr
                        key={sub.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="text-[13px] text-[#111] font-mono">{sub.centerId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 text-gray-700`}>
                            {sub.planName}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${
                            sub.status === 'ACTIVE' ? 'text-green-600' :
                            sub.status === 'TRIAL' ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {sub.status === 'ACTIVE' || sub.status === 'TRIAL' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">
                          {formatDate(sub.startDate)}
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">
                          {formatDate(sub.expiryDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => toast.info('Edit subscription functionality coming soon')}
                            className="text-[13px] font-semibold text-[#FF6B00] hover:underline"
                          >
                            Manage
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
        </div>
      )}

      {activeTab === 'PLANS' && (
        <PlansTab />
      )}

      {activeTab === 'COUPONS' && (
        <div className="bg-white p-12 rounded-2xl border border-[#ECECEC] text-center">
          <CalendarDays size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-[20px] font-bold text-[#111]">Coupons</h2>
          <p className="text-[#888] mt-2">Generate discount codes in Phase 2.</p>
        </div>
      )}

      {/* Add Subscription Modal */}
      {isAddingSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-[#ECECEC] shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-bold text-[#111]">Assign Subscription</h3>
              <button onClick={() => setIsAddingSub(false)} className="text-gray-500 hover:text-black">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Center</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]"
                  value={selectedCenter}
                  onChange={e => setSelectedCenter(e.target.value)}
                >
                  <option value="">-- Choose Center --</option>
                  {centers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Select Plan</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]"
                  value={selectedPlan}
                  onChange={e => setSelectedPlan(e.target.value)}
                >
                  <option value="">-- Choose Plan --</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ₹{p.monthlyPrice}/mo</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setIsAddingSub(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleManualSubscribe} className="px-4 py-2 bg-[#FF6B00] text-white rounded-lg flex items-center gap-2 hover:bg-orange-600">
                  <Save size={16} /> Assign Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const p = await subscriptionService.getAvailablePlans();
      // Sort by monthly price
      p.sort((a, b) => a.monthlyPrice - b.monthlyPrice);
      setPlans(p);
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    try {
      await subscriptionService.savePlan(editingPlan);
      toast.success('Plan saved successfully!');
      setEditingPlan(null);
      loadPlans();
    } catch (error) {
      toast.error('Failed to save plan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await subscriptionService.deletePlan(id);
      toast.success('Plan deleted');
      loadPlans();
    } catch (error) {
      toast.error('Failed to delete plan');
    }
  };

  const handleAddNew = () => {
    setEditingPlan({
      id: '',
      name: 'Starter' as any,
      monthlyPrice: 0,
      yearlyPrice: 0,
      limits: { centers: 1, farmers: 100, staff: 2, owners: 1 },
      features: []
    });
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading plans...</div>;
  }

  if (editingPlan) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-[#ECECEC]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">{editingPlan.id ? 'Edit Plan' : 'New Plan'}</h3>
          <button onClick={() => setEditingPlan(null)} className="text-gray-500 hover:text-black">
            <X size={20} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Plan Name</label>
            <input 
              type="text" 
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]" 
              value={editingPlan.name}
              onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value as any })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monthly Price (₹)</label>
            <input 
              type="number" 
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]" 
              value={editingPlan.monthlyPrice}
              onChange={e => setEditingPlan({ ...editingPlan, monthlyPrice: Number(e.target.value) })}
            />
          </div>
          
          <div className="md:col-span-2">
            <h4 className="font-semibold mb-3 border-b pb-2">Limits</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Farmers</label>
                <input type="number" className="w-full border rounded-lg px-3 py-1.5" 
                  value={editingPlan.limits.farmers === Infinity ? 999999 : editingPlan.limits.farmers}
                  onChange={e => setEditingPlan({ 
                    ...editingPlan, 
                    limits: { ...editingPlan.limits, farmers: Number(e.target.value) >= 999999 ? Infinity : Number(e.target.value) } 
                  })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Staff</label>
                <input type="number" className="w-full border rounded-lg px-3 py-1.5" 
                  value={editingPlan.limits.staff === Infinity ? 999999 : editingPlan.limits.staff}
                  onChange={e => setEditingPlan({ 
                    ...editingPlan, 
                    limits: { ...editingPlan.limits, staff: Number(e.target.value) >= 999999 ? Infinity : Number(e.target.value) } 
                  })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Centers</label>
                <input type="number" className="w-full border rounded-lg px-3 py-1.5" 
                  value={editingPlan.limits.centers === Infinity ? 999999 : editingPlan.limits.centers}
                  onChange={e => setEditingPlan({ 
                    ...editingPlan, 
                    limits: { ...editingPlan.limits, centers: Number(e.target.value) >= 999999 ? Infinity : Number(e.target.value) } 
                  })} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Owners</label>
                <input type="number" className="w-full border rounded-lg px-3 py-1.5" 
                  value={editingPlan.limits.owners === Infinity ? 999999 : editingPlan.limits.owners}
                  onChange={e => setEditingPlan({ 
                    ...editingPlan, 
                    limits: { ...editingPlan.limits, owners: Number(e.target.value) >= 999999 ? Infinity : Number(e.target.value) } 
                  })} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Use 999999 for Unlimited</p>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Features (comma separated)</label>
            <input 
              type="text" 
              className="w-full border rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]" 
              value={editingPlan.features.join(', ')}
              onChange={e => setEditingPlan({ 
                ...editingPlan, 
                features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
              })}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setEditingPlan(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-[#FF6B00] text-white rounded-lg flex items-center gap-2 hover:bg-orange-600">
            <Save size={16} /> Save Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Subscription Plans</h2>
        <button onClick={handleAddNew} className="bg-[#FF6B00] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-white rounded-2xl border border-[#ECECEC] p-6 flex flex-col hover:border-[#FF6B00] transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="text-2xl font-black mt-1">₹{plan.monthlyPrice} <span className="text-sm font-normal text-gray-500">/mo</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingPlan(plan)} className="p-1.5 text-gray-500 hover:text-[#FF6B00] bg-gray-50 rounded-lg"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(plan.id)} className="p-1.5 text-gray-500 hover:text-red-500 bg-gray-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="flex-1 space-y-2 mb-6">
              <div className="flex justify-between text-sm border-b pb-1">
                <span className="text-gray-500">Farmers</span>
                <span className="font-semibold">{plan.limits.farmers === Infinity ? 'Unlimited' : plan.limits.farmers}</span>
              </div>
              <div className="flex justify-between text-sm border-b pb-1">
                <span className="text-gray-500">Staff</span>
                <span className="font-semibold">{plan.limits.staff === Infinity ? 'Unlimited' : plan.limits.staff}</span>
              </div>
            </div>

            <div className="space-y-1">
              {plan.features.slice(0, 3).map(f => (
                <div key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-green-500" /> {f}
                </div>
              ))}
              {plan.features.length > 3 && (
                <div className="text-xs text-gray-400 italic">+{plan.features.length - 3} more...</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
