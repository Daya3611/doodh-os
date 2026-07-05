import { db } from '@/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, Timestamp, where } from 'firebase/firestore';

export interface AdminCenter {
  id: string;
  name: string;
  ownerId: string;
  phone?: string;
  city?: string;
  state?: string;
  plan?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt?: Timestamp | Date;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'MASTER_ADMIN' | 'OWNER' | 'STAFF';
  centerId?: string;
  active: boolean;
  createdAt?: Timestamp | Date;
}

export const adminService = {
  // Get all centers across the platform
  getAllCenters: async (): Promise<AdminCenter[]> => {
    const q = query(collection(db, 'centers'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || 'Unnamed Center',
        ownerId: data.ownerId || '',
        phone: data.phone || '',
        city: data.city || '',
        state: data.state || '',
        plan: data.plan || 'Free',
        status: data.status || 'ACTIVE',
        createdAt: data.createdAt
      } as AdminCenter;
    });
  },

  // Update center status (e.g., SUSPEND)
  updateCenterStatus: async (centerId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> => {
    await setDoc(doc(db, 'centers', centerId), { status }, { merge: true });
  },

  // Get all users from the global users collection
  getAllUsers: async (): Promise<AdminUser[]> => {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminUser));
  },

  // Basic stats for the admin dashboard
  getPlatformStats: async () => {
    try {
      const [centersSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'centers')),
        getDocs(collection(db, 'users'))
      ]);

      let totalCenters = centersSnap.size;
      let totalOwners = 0;
      let totalStaff = 0;

      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'OWNER') totalOwners++;
        if (data.role === 'STAFF') totalStaff++;
      });

      return {
        totalCenters,
        totalOwners,
        totalStaff,
        totalFarmers: 'N/A', // Collection group query required
        revenueToday: 0,
        revenueMonthly: 0
      };
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      return { totalCenters: 0, totalOwners: 0, totalStaff: 0, totalFarmers: 0, revenueToday: 0, revenueMonthly: 0 };
    }
  },

  getAllSubscriptions: async () => {
    const snap = await getDocs(collection(db, 'subscriptions'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};
