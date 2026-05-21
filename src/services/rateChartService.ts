import { db } from '@/firebase/config';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { RateChart, RateChartFormData, AnimalType } from '@/types';

export const rateChartService = {
  // Get the subcollection reference scoped by centerId
  getCollectionRef: (centerId: string) => collection(db, 'centers', centerId, 'rateCharts'),
  
  getAll: async (centerId: string): Promise<RateChart[]> => {
    const q = query(rateChartService.getCollectionRef(centerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
  },

  getRate: async (centerId: string, animalType: AnimalType, fat: number, snf: number): Promise<number> => {
    // Note: Due to Firestore limits on multiple inequality filters, it's often easier
    // to query by animalType and then filter locally for the exact FAT and SNF matches.
    const q = query(
      rateChartService.getCollectionRef(centerId),
      where('animalType', '==', animalType),
      where('fat', '==', fat),
      where('snf', '==', snf)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    return snapshot.docs[0].data().rate;
  },

  add: async (centerId: string, data: RateChartFormData): Promise<void> => {
    const newDocRef = doc(rateChartService.getCollectionRef(centerId));
    await setDoc(newDocRef, {
      ...data,
      effectiveFrom: serverTimestamp(),
    });
  },

  update: async (centerId: string, id: string, data: RateChartFormData): Promise<void> => {
    const docRef = doc(rateChartService.getCollectionRef(centerId), id);
    await setDoc(docRef, data, { merge: true });
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const docRef = doc(rateChartService.getCollectionRef(centerId), id);
    await deleteDoc(docRef);
  }
};
