import { db } from '@/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { PrinterSettings, PrinterSettingsFormData } from '@/types';

export const printerService = {
  getSettingsRef: (centerId: string) => doc(db, 'centers', centerId, 'settings', 'printerSettings'),
  
  getSettings: async (centerId: string): Promise<PrinterSettings | null> => {
    const docSnap = await getDoc(printerService.getSettingsRef(centerId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as PrinterSettings;
    }
    return null;
  },

  saveSettings: async (centerId: string, settings: PrinterSettingsFormData): Promise<void> => {
    await setDoc(printerService.getSettingsRef(centerId), {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  getDefaultSettings: (): PrinterSettingsFormData => ({
    printerType: '58mm',
    printerName: 'Default Printer',
    autoPrint: false,
    copies: 1,
    printLogo: false,
    printQrCode: false,
    printBalance: true,
    footerMessage: 'Thank You\nVisit Again',
  })
};
