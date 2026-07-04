import { db } from '@/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface GeneralSettings {
  centerName: string;
  ownerName: string;
  address: string;
  phone: string;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  darkMode: boolean;
  language: string;
}

export const settingsService = {
  getSettingsRef: (centerId: string) => doc(db, 'centers', centerId, 'settings', 'general'),
  
  getSettings: async (centerId: string): Promise<Partial<GeneralSettings>> => {
    const docSnap = await getDoc(settingsService.getSettingsRef(centerId));
    if (docSnap.exists()) {
      return docSnap.data() as Partial<GeneralSettings>;
    }
    return {};
  },

  saveSettings: async (centerId: string, settings: Partial<GeneralSettings>): Promise<void> => {
    await setDoc(settingsService.getSettingsRef(centerId), {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
};
