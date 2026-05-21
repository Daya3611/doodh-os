import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { z } from 'zod';

export const staffSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email('Valid email required'),
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
    const ref = doc(staffService.getCollectionRef(centerId));
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  update: async (centerId: string, id: string, data: Partial<StaffFormData>): Promise<void> => {
    await setDoc(doc(staffService.getCollectionRef(centerId), id), data, { merge: true });
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    await deleteDoc(doc(staffService.getCollectionRef(centerId), id));
  },
};
