'use client';

import { useEffect, useState } from 'react';
import { adminService, AdminCenter } from '@/services/adminService';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, MoreVertical, ShieldAlert, CheckCircle2, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { subscriptionService, SaaSPlan, CenterSubscription } from '@/services/subscriptionService';
import { Timestamp } from 'firebase/firestore';

export default function MasterCentersPage() {
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedCenter, setSelectedCenter] = useState<AdminCenter | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<CenterSubscription | null>(null);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [expiryDateStr, setExpiryDateStr] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const loadCenters = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAllCenters();
      setCenters(data);
    } catch (error) {
      toast.error('Failed to load centers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCenters();
    subscriptionService.getAvailablePlans().then(setPlans);
  }, []);

  useEffect(() => {
    if (selectedCenter) {
      subscriptionService.getSubscription(selectedCenter.id).then(sub => {
        setSelectedSubscription(sub);
        if (sub) {
          setNewPlanId(sub.planId);
          setStartDateStr(sub.startDate instanceof Timestamp ? sub.startDate.toDate().toISOString().split('T')[0] : new Date(sub.startDate).toISOString().split('T')[0]);
          setExpiryDateStr(sub.expiryDate instanceof Timestamp ? sub.expiryDate.toDate().toISOString().split('T')[0] : new Date(sub.expiryDate).toISOString().split('T')[0]);
        }
      });
    } else {
      setSelectedSubscription(null);
      setNewPlanId('');
      setStartDateStr('');
      setExpiryDateStr('');
    }
  }, [selectedCenter]);

  const handleUpdatePlan = async () => {
    if (!selectedCenter) return;
    setIsSavingPlan(true);
    try {
      if (newPlanId && (!selectedSubscription || newPlanId !== selectedSubscription.planId)) {
        await subscriptionService.upgradePlan(selectedCenter.id, newPlanId);
      }
      
      if (startDateStr && expiryDateStr) {
        await subscriptionService.updateSubscriptionDates(
          selectedCenter.id, 
          new Date(startDateStr), 
          new Date(expiryDateStr)
        );
      }

      toast.success('Subscription plan updated!');
      setSelectedCenter(null);
      loadCenters();
    } catch (error) {
      toast.error('Failed to update plan');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleToggleStatus = async (center: AdminCenter) => {
    const newStatus = center.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this center?`)) return;
    
    try {
      await adminService.updateCenterStatus(center.id, newStatus);
      toast.success(`Center is now ${newStatus}`);
      loadCenters();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search centers by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#ECECEC] rounded-xl text-[14px] outline-none focus:border-[#FF6B00] transition-colors"
          />
        </div>
      </div>

      {/* Centers Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Center Name</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-semibold text-[#888] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F0F0F0]">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredCenters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                        <Building2 size={32} className="text-blue-500" />
                      </div>
                      <div className="text-[16px] font-bold text-[#111]">No centers found</div>
                      <div className="text-[14px] text-[#888]">No milk collection centers match your search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filteredCenters.map((center, i) => (
                    <motion.tr
                      key={center.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedCenter(center);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111]">{center.name}</div>
                        <div className="text-[12px] text-[#888]">ID: {center.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] text-[#444]">{center.city || '-'}</div>
                        <div className="text-[12px] text-[#888]">{center.state || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[12px] font-semibold">
                          {center.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${center.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                          {center.status === 'ACTIVE' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                          {center.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(center);
                          }}
                          className="text-[13px] font-semibold text-[#FF6B00] hover:underline"
                        >
                          {center.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
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

      {/* Center Details Modal */}
      {selectedCenter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCenter(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[20px] font-bold text-[#111]">{selectedCenter.name}</h3>
                <p className="text-sm text-gray-500">ID: {selectedCenter.id}</p>
              </div>
              <button onClick={() => setSelectedCenter(null)} className="text-gray-400 hover:text-black">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Current Plan</p>
                  <p className="font-bold text-blue-600 mt-0.5">{selectedCenter.plan || 'Free Trial'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase">Status</p>
                  <p className={`font-bold mt-0.5 ${selectedCenter.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedCenter.status}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Change Subscription Plan</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]"
                    value={newPlanId}
                    onChange={e => setNewPlanId(e.target.value)}
                  >
                    <option value="">-- Keep Current Plan --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - ₹{p.monthlyPrice}/mo (₹{p.yearlyPrice}/yr)</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5">Note: Master Admins can bypass payment gateways and directly assign plans here.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]"
                      value={startDateStr}
                      onChange={e => setStartDateStr(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Expiry Date</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#FF6B00]"
                      value={expiryDateStr}
                      onChange={e => setExpiryDateStr(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100">
                <button 
                  onClick={() => setSelectedCenter(null)} 
                  className="px-4 py-2 border rounded-xl font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdatePlan} 
                  disabled={!newPlanId || isSavingPlan}
                  className="px-4 py-2 bg-[#FF6B00] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSavingPlan ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
