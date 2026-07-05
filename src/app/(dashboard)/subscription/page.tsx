'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { subscriptionService, CenterSubscription, SaaSPlan, DEFAULT_PLANS } from '@/services/subscriptionService';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ShieldAlert, Sparkles, CreditCard, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import Script from 'next/script';

export default function SubscriptionPage() {
  const { profile } = useAuthStore();
  const [subscription, setSubscription] = useState<CenterSubscription | null>(null);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Real-time usage state
  const [farmersUsage, setFarmersUsage] = useState({ current: 0, limit: 0 });
  const [staffUsage, setStaffUsage] = useState({ current: 0, limit: 0 });

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile?.centerId) return;
    setIsLoading(true);
    try {
      const sub = await subscriptionService.getSubscription(profile.centerId);
      setSubscription(sub);

      const fUsage = await subscriptionService.checkFarmerLimit(profile.centerId);
      setFarmersUsage(fUsage);

      const sUsage = await subscriptionService.checkStaffLimit(profile.centerId);
      setStaffUsage(sUsage);

      const p = await subscriptionService.getAvailablePlans();
      setPlans(p);
    } catch (error) {
      toast.error('Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.centerId]);

  const handleUpgrade = async (planId: string) => {
    setSelectedPlanId(planId);
    setIsUpgrading(true);
    
    if (!profile?.centerId) {
      toast.error('Center ID missing');
      setIsUpgrading(false);
      return;
    }

    try {
      toast.loading('Initializing payment...', { id: 'upgrade' });
      
      // 1. Create Order on Server
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerId: profile.centerId, planId })
      });
      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      toast.dismiss('upgrade');

      // 2. Open Razorpay Popup
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'DoodhOS SaaS',
        description: 'Upgrade Subscription',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          toast.loading('Verifying payment...', { id: 'verify' });
          try {
            // 3. Verify Payment Signature
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                centerId: profile.centerId,
                planId: planId
              })
            });
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok) {
              toast.success('Subscription upgraded successfully!', { id: 'verify' });
              loadData();
            } else {
              throw new Error(verifyData.error || 'Verification failed');
            }
          } catch (error: any) {
            toast.error(error.message || 'Verification failed', { id: 'verify' });
          }
        },
        prefill: {
          name: profile.name,
          email: profile.email || '',
        },
        theme: {
          color: '#FF6B00'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast.error('Payment Failed. Please try again.');
        console.error(response.error);
      });
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || 'Payment initiation failed', { id: 'upgrade' });
    } finally {
      setIsUpgrading(false);
    }
  };

  const formatDate = (dateData: any) => {
    if (!dateData) return '-';
    if (dateData instanceof Timestamp) return dateData.toDate().toLocaleDateString();
    return new Date(dateData).toLocaleDateString();
  };

  const getDaysRemaining = (expiryDate: any) => {
    if (!expiryDate) return 0;
    const exp = expiryDate instanceof Timestamp ? expiryDate.toDate() : new Date(expiryDate);
    const diffTime = exp.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-40 bg-white rounded-2xl border border-[#ECECEC] animate-pulse"></div>
        <div className="h-64 bg-white rounded-2xl border border-[#ECECEC] animate-pulse"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold">No Subscription Found</h2>
        <p className="text-gray-500 mt-2">Please contact support or register your center again.</p>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(subscription.expiryDate);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      {/* Current Plan Overview */}
      <div className="bg-white rounded-2xl border border-[#ECECEC] overflow-hidden flex flex-col md:flex-row">
        {/* Left side info */}
        <div className="p-8 md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#ECECEC] bg-[#FAFAFA]">
          <div className="text-[12px] font-bold text-[#888] uppercase tracking-wider mb-1">Current Plan</div>
          <h2 className="text-[32px] font-extrabold text-[#111] mb-2">{subscription.planName}</h2>
          
          <div className="flex items-center gap-2 mb-6">
            <span className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1 rounded-full ${
              subscription.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              subscription.status === 'TRIAL' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
            }`}>
              {subscription.status === 'ACTIVE' || subscription.status === 'TRIAL' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
              {subscription.status}
            </span>
            <span className="text-[13px] font-semibold text-[#555] bg-gray-100 px-3 py-1 rounded-full">
              {daysRemaining} Days Left
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-[#888]">Started:</span>
              <span className="font-semibold text-[#111]">{formatDate(subscription.startDate)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-[#888]">Expires:</span>
              <span className="font-semibold text-[#111]">{formatDate(subscription.expiryDate)}</span>
            </div>
          </div>
        </div>

        {/* Right side usage */}
        <div className="p-8 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[14px] font-bold text-[#111]">Farmers Limit</span>
              <span className="text-[12px] font-semibold text-[#888]">{farmersUsage.current} / {farmersUsage.limit}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${farmersUsage.current / farmersUsage.limit > 0.8 ? 'bg-red-500' : 'bg-[#FF6B00]'}`} 
                style={{ width: `${Math.min(100, (farmersUsage.current / farmersUsage.limit) * 100)}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-[14px] font-bold text-[#111]">Staff Limit</span>
              <span className="text-[12px] font-semibold text-[#888]">{staffUsage.current} / {staffUsage.limit}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${staffUsage.current / staffUsage.limit > 0.8 ? 'bg-red-500' : 'bg-[#FF6B00]'}`} 
                style={{ width: `${Math.min(100, (staffUsage.current / staffUsage.limit) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Options */}
      <div className="pt-6">
        <h3 className="text-[20px] font-bold text-[#111] mb-6 flex items-center gap-2">
          <Sparkles className="text-[#FF6B00]" /> Upgrade your plan
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.filter(p => p.id !== 'plan_free_trial').map((plan) => (
            <motion.div 
              key={plan.id}
              whileHover={{ y: -4 }}
              className={`bg-white rounded-2xl border-2 p-6 flex flex-col ${
                subscription.planId === plan.id ? 'border-[#FF6B00] shadow-sm' : 'border-[#ECECEC]'
              }`}
            >
              <div className="mb-4">
                <h4 className="text-[18px] font-bold text-[#111]">{plan.name}</h4>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-[28px] font-black text-[#111]">₹{plan.monthlyPrice}</span>
                  <span className="text-[13px] text-[#888] font-medium mb-1">/ month</span>
                </div>
              </div>

              <div className="space-y-3 flex-1 mb-8">
                <div className="text-[13px] font-medium text-[#111] flex justify-between border-b border-[#F0F0F0] pb-2">
                  <span className="text-[#888]">Farmers</span> <span>{plan.limits.farmers === Infinity ? 'Unlimited' : plan.limits.farmers}</span>
                </div>
                <div className="text-[13px] font-medium text-[#111] flex justify-between border-b border-[#F0F0F0] pb-2">
                  <span className="text-[#888]">Staff</span> <span>{plan.limits.staff === Infinity ? 'Unlimited' : plan.limits.staff}</span>
                </div>
                {plan.features.map(f => (
                  <div key={f} className="text-[13px] font-medium text-[#111] flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500" /> {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isUpgrading || subscription.planId === plan.id}
                className={`w-full py-3 rounded-xl text-[14px] font-bold transition-all flex justify-center items-center gap-2 ${
                  subscription.planId === plan.id
                    ? 'bg-orange-50 text-orange-600 cursor-default'
                    : 'bg-[#FF6B00] text-white hover:bg-orange-600'
                }`}
              >
                {isUpgrading && selectedPlanId === plan.id ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : subscription.planId === plan.id ? (
                  <>Current Plan <CheckCircle2 size={16} /></>
                ) : (
                  <>Choose Plan <ChevronRight size={16} /></>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
