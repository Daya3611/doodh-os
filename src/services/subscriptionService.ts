import { db } from '@/firebase/config';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';

export type PlanType = 'Free Trial' | 'Starter' | 'Professional' | 'Business' | 'Enterprise';

export interface PlanLimits {
  centers: number;
  farmers: number;
  staff: number;
  owners: number;
}

export interface SaaSPlan {
  id: string;
  name: PlanType;
  monthlyPrice: number;
  yearlyPrice: number;
  limits: PlanLimits;
  features: string[];
}

export interface CenterSubscription {
  id: string; // Matches centerId
  centerId: string;
  planId: string;
  planName: PlanType;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
  startDate: Timestamp | Date;
  expiryDate: Timestamp | Date;
  autoRenew: boolean;
  limits: PlanLimits;
}

// Hardcoded default plans for now. Ideally, these would be fetched from Firestore 'plans' collection.
export const DEFAULT_PLANS: SaaSPlan[] = [
  {
    id: 'plan_free_trial',
    name: 'Free Trial',
    monthlyPrice: 0,
    yearlyPrice: 0,
    limits: { centers: 1, farmers: 100, staff: 2, owners: 1 },
    features: ['15 Days Access', 'FAT/SNF Entry', 'Basic Rate Charts', 'Basic Reports']
  },
  {
    id: 'plan_starter',
    name: 'Starter',
    monthlyPrice: 499,
    yearlyPrice: 4999,
    limits: { centers: 1, farmers: 500, staff: 5, owners: 1 },
    features: ['Unlimited Collections', 'Advanced Rate Charts', 'Payment Management', '500 SMS/month']
  },
  {
    id: 'plan_professional',
    name: 'Professional',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    limits: { centers: 3, farmers: 2000, staff: 20, owners: 3 },
    features: ['WhatsApp Notifications', 'Full Accounting', 'API Access', '2000 SMS/month']
  }
];

export const subscriptionService = {
  getAvailablePlans: async (): Promise<SaaSPlan[]> => {
    const snap = await getDocs(collection(db, 'plans'));
    if (snap.empty) {
      // Seed default plans if empty
      for (const p of DEFAULT_PLANS) {
        await setDoc(doc(db, 'plans', p.id), p);
      }
      return DEFAULT_PLANS;
    }
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as SaaSPlan));
  },

  savePlan: async (plan: SaaSPlan): Promise<void> => {
    if (!plan.id) {
      plan.id = `plan_${Date.now()}`;
    }
    await setDoc(doc(db, 'plans', plan.id), plan);
  },

  deletePlan: async (planId: string): Promise<void> => {
    await deleteDoc(doc(db, 'plans', planId));
  },

  getSubscription: async (centerId: string): Promise<CenterSubscription | null> => {
    if (!centerId) return null;
    const docRef = doc(db, 'subscriptions', centerId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      // Auto-initialize Free Trial for backward compatibility if a center doesn't have one
      return await subscriptionService.initFreeTrial(centerId);
    }
    const data = { ...snap.data(), id: snap.id } as CenterSubscription;
    
    // Check if expired
    const expiry = data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : new Date(data.expiryDate);
    if (new Date() > expiry && (data.status === 'ACTIVE' || data.status === 'TRIAL')) {
      data.status = 'EXPIRED';
    }
    
    return data;
  },

  initFreeTrial: async (centerId: string): Promise<CenterSubscription> => {
    const trialPlan = DEFAULT_PLANS[0];
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + 15); // 15 Days Trial

    const sub: CenterSubscription = {
      id: centerId,
      centerId,
      planId: trialPlan.id,
      planName: trialPlan.name,
      status: 'TRIAL',
      startDate: Timestamp.fromDate(startDate),
      expiryDate: Timestamp.fromDate(expiryDate),
      autoRenew: false,
      limits: trialPlan.limits
    };

    await setDoc(doc(db, 'subscriptions', centerId), sub);
    return sub;
  },

  upgradePlan: async (centerId: string, planId: string): Promise<void> => {
    const planDoc = await getDoc(doc(db, 'plans', planId));
    if (!planDoc.exists()) throw new Error("Plan not found in database");
    const plan = planDoc.data() as SaaSPlan;

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(startDate.getMonth() + 1); // 1 month by default for mock

    await setDoc(doc(db, 'subscriptions', centerId), {
      id: centerId,
      centerId,
      planId: plan.id,
      planName: plan.name,
      status: 'ACTIVE',
      startDate: Timestamp.fromDate(startDate),
      expiryDate: Timestamp.fromDate(expiryDate),
      limits: plan.limits,
      autoRenew: true
    }, { merge: true });
  },

  // Usage checking
  checkFarmerLimit: async (centerId: string): Promise<{ allowed: boolean, current: number, limit: number }> => {
    const sub = await subscriptionService.getSubscription(centerId);
    if (!sub) return { allowed: false, current: 0, limit: 0 };
    
    // Check if expired
    if (sub.status === 'EXPIRED') return { allowed: false, current: 0, limit: sub.limits.farmers };

    const q = query(collection(db, `centers/${centerId}/farmers`));
    const snap = await getDocs(q);
    const current = snap.size;

    return {
      allowed: current < sub.limits.farmers,
      current,
      limit: sub.limits.farmers
    };
  },

  checkStaffLimit: async (centerId: string): Promise<{ allowed: boolean, current: number, limit: number }> => {
    const sub = await subscriptionService.getSubscription(centerId);
    if (!sub) return { allowed: false, current: 0, limit: 0 };

    if (sub.status === 'EXPIRED') return { allowed: false, current: 0, limit: sub.limits.staff };

    const q = query(collection(db, `centers/${centerId}/staff`));
    const snap = await getDocs(q);
    const current = snap.size;

    return {
      allowed: current < sub.limits.staff,
      current,
      limit: sub.limits.staff
    };
  },

  updateSubscriptionDates: async (centerId: string, startDate: Date, expiryDate: Date): Promise<void> => {
    const docRef = doc(db, 'subscriptions', centerId);
    await updateDoc(docRef, {
      startDate: Timestamp.fromDate(startDate),
      expiryDate: Timestamp.fromDate(expiryDate)
    });
  }
};
