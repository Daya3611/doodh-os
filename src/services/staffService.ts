import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { z } from 'zod';

export const staffSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 chars').optional().or(z.literal('')),
  role: z.enum(['OWNER', 'STAFF']),
  shift: z.enum(['morning', 'evening', 'both']),
  active: z.boolean().default(true),
});

export type StaffFormData = z.infer<typeof staffSchema>;

export interface StaffMember extends StaffFormData {
  id: string;
  createdAt: Timestamp | Date;
}

export const staffService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'staff'),

  getAll: async (centerId: string): Promise<StaffMember[]> => {
    const q = query(staffService.getCollectionRef(centerId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffMember));
  },

  add: async (centerId: string, data: StaffFormData): Promise<void> => {
    if (!data.password) throw new Error("Password is required for new staff");

    // Dynamically import to avoid circular dependencies if any
    const { subscriptionService } = await import('@/services/subscriptionService');
    const usage = await subscriptionService.checkStaffLimit(centerId);
    if (!usage.allowed) {
      throw new Error(`Plan limit reached! You can only add up to ${usage.limit} staff. Please upgrade your plan.`);
    }

    // 1. Create Firebase Auth User using Secondary App to prevent logging out OWNER
    const appConfig = db.app.options;
    const secondaryApp = initializeApp(appConfig, 'SecondaryApp' + Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    
    let uid = '';
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      uid = cred.user.uid;
      await secondaryAuth.signOut();
    } catch (error) {
      throw error;
    }

    // 2. Add to global 'users' collection for login mapping
    await setDoc(doc(db, 'users', uid), {
      email: data.email,
      name: data.name,
      role: data.role,
      centerId: centerId,
      active: data.active
    });

    // 3. Add to center staff subcollection
    const ref = doc(staffService.getCollectionRef(centerId), uid);
    const { password, ...staffData } = data;
    await setDoc(ref, { ...staffData, createdAt: serverTimestamp() });
  },

  update: async (centerId: string, id: string, data: Partial<StaffFormData>): Promise<void> => {
    const { password, ...staffData } = data;
    await setDoc(doc(staffService.getCollectionRef(centerId), id), staffData, { merge: true });
    
    // Also update global users collection
    const userUpdate: any = {};
    if (data.name) userUpdate.name = data.name;
    if (data.email) userUpdate.email = data.email;
    if (data.role) userUpdate.role = data.role;
    if (data.active !== undefined) userUpdate.active = data.active;
    
    if (Object.keys(userUpdate).length > 0) {
      await setDoc(doc(db, 'users', id), userUpdate, { merge: true });
    }
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    await deleteDoc(doc(staffService.getCollectionRef(centerId), id));
  },
};
