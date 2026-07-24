import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { offlineDb } from '@/lib/offlineDb';

export interface AuditEntry {
  id?: string;
  action: 'CREATE_COLLECTION' | 'EDIT_COLLECTION' | 'OVERRIDE_COLLECTION' | 'MERGE_COLLECTION' | 'DELETE_COLLECTION';
  collectionId: string;
  farmerId: string;
  farmerName: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId: string;
  userName: string;
  userRole: string;
  reason?: string;
  createdAt?: any;
}

export const auditService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'audit_logs'),

  log: async (centerId: string, data: AuditEntry): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const entryData = {
      ...data,
      createdAt: isOnline ? serverTimestamp() : new Date(),
    };

    if (isOnline) {
      try {
        await addDoc(auditService.getCollectionRef(centerId), entryData);
      } catch (err) {
        console.warn('Failed to log audit entry online:', err);
      }
    }
  }
};
