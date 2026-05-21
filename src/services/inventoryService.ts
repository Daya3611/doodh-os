import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { InventoryItem, InventoryFormData } from '@/types';

export const inventoryService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'inventory'),

  getAll: async (centerId: string): Promise<InventoryItem[]> => {
    const q = query(
      inventoryService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
  },

  add: async (centerId: string, data: InventoryFormData): Promise<string> => {
    const ref = doc(inventoryService.getCollectionRef(centerId));
    await setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  update: async (centerId: string, itemId: string, data: Partial<InventoryFormData>): Promise<void> => {
    const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
    await setDoc(ref, data, { merge: true });
  },

  delete: async (centerId: string, itemId: string): Promise<void> => {
    await deleteDoc(doc(inventoryService.getCollectionRef(centerId), itemId));
  },
};
