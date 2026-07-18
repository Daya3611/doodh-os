'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { settingsService } from '@/services/settingsService';

type Language = 'en' | 'hi' | 'mr';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav Items
    'nav.dashboard': 'Dashboard',
    'nav.farmers': 'Farmers',
    'nav.collections': 'Collections',
    'nav.rate_chart': 'Rate Chart',
    'nav.dispatch': 'Dispatch',
    'nav.accounts': 'Accounts',
    'nav.udhar_khata': 'Udhar Khata',
    'nav.payments': 'Payments',
    'nav.purchases': 'Purchases',
    'nav.inventory': 'Inventory',
    'nav.reports': 'Reports',
    'nav.staff': 'Staff',
    'nav.subscription': 'Subscription',
    'nav.settings': 'Settings',

    // Dashboard
    'dashboard.total_collections': 'Total Collections',
    'dashboard.active_farmers': 'Active Farmers',
    'dashboard.pending_payments': 'Pending Payments',
    'dashboard.fat_average': 'FAT Average',
    'dashboard.snf_average': 'SNF Average',
    'dashboard.today_summary': 'Today\'s Summary',
    'dashboard.recent_collections': 'Recent Collections',
    'dashboard.cow_vs_buffalo': 'Cow vs Buffalo',
    'dashboard.daily_trends': 'Daily Milk Intake Trends',

    // Collections
    'col.new_entry': 'New Milk Collection',
    'col.farmer_id': 'Farmer ID',
    'col.shift': 'Shift',
    'col.morning': 'Morning',
    'col.evening': 'Evening',
    'col.animal_type': 'Animal Type',
    'col.cow': 'Cow',
    'col.buffalo': 'Buffalo',
    'col.liters': 'Liters (L)',
    'col.fat': 'FAT (%)',
    'col.snf': 'SNF (%)',
    'col.clr': 'CLR (optional)',
    'col.rate': 'Rate (₹/L)',
    'col.total_amount': 'Total Amount (₹)',
    'col.save': 'Save Collection',
    'col.duplicate_alert': 'Duplicate entry detected! A collection for this farmer already exists in this shift.',
    'col.animal_alert': 'Warning: Chosen animal type does not match farmer\'s primary registered animal!',

    // Payments & Deductions
    'pay.record_payment': 'Record Payment',
    'pay.record_deduction': 'Record Deduction',
    'pay.payments_list': 'Payments List',
    'pay.deductions_list': 'Deductions List',
    'pay.total_paid': 'Total Paid',
    'pay.total_deducted': 'Total Deducted',
    'pay.payment_method': 'Payment Method',
    'pay.cash': 'Cash',
    'pay.upi': 'UPI',
    'pay.bank': 'Bank Transfer',
    'pay.notes': 'Notes / Remarks',
    'pay.amount': 'Amount (₹)',

    // Backup
    'backup.title': 'Backup & Restore',
    'backup.export': 'Export JSON Backup',
    'backup.import': 'Restore JSON Backup'
  },
  hi: {
    // Nav Items
    'nav.dashboard': 'डैशबोर्ड',
    'nav.farmers': 'किसान सूची',
    'nav.collections': 'दूध संकलन',
    'nav.rate_chart': 'दर पत्रक',
    'nav.dispatch': 'डेयरी प्रेषण',
    'nav.accounts': 'खाता बही',
    'nav.udhar_khata': 'उधार खाता',
    'nav.payments': 'भुगतान',
    'nav.purchases': 'खरीदारी',
    'nav.inventory': 'इन्वेंटरी',
    'nav.reports': 'रिपोर्ट',
    'nav.staff': 'कर्मचारी',
    'nav.subscription': 'सदस्यता',
    'nav.settings': 'सेटिंग्स',

    // Dashboard
    'dashboard.total_collections': 'कुल संकलन',
    'dashboard.active_farmers': 'सक्रिय किसान',
    'dashboard.pending_payments': 'लंबित भुगतान',
    'dashboard.fat_average': 'औसत फैट',
    'dashboard.snf_average': 'औसत एसएनएफ',
    'dashboard.today_summary': 'आज का विवरण',
    'dashboard.recent_collections': 'हाल के संकलन',
    'dashboard.cow_vs_buffalo': 'गाय बनाम भैंस',
    'dashboard.daily_trends': 'दैनिक दूध मात्रा का चलन',

    // Collections
    'col.new_entry': 'नया दूध संकलन',
    'col.farmer_id': 'किसान आईडी',
    'col.shift': 'पाली (शिफ्ट)',
    'col.morning': 'सुबह',
    'col.evening': 'शाम',
    'col.animal_type': 'पशु का प्रकार',
    'col.cow': 'गाय',
    'col.buffalo': 'भैंस',
    'col.liters': 'लीटर (L)',
    'col.fat': 'फैट (%)',
    'col.snf': 'एसएनएफ (%)',
    'col.clr': 'सीएलआर (वैकल्पिक)',
    'col.rate': 'दर (₹/लीटर)',
    'col.total_amount': 'कुल राशि (₹)',
    'col.save': 'संकलन सहेजें',
    'col.duplicate_alert': 'समान प्रविष्टि मिली! इस किसान की प्रविष्टि इस पाली में पहले से दर्ज है।',
    'col.animal_alert': 'चेतावनी: चुना गया पशु प्रकार किसान के पंजीकृत पशु से भिन्न है!',

    // Payments & Deductions
    'pay.record_payment': 'भुगतान दर्ज करें',
    'pay.record_deduction': 'कटौती दर्ज करें',
    'pay.payments_list': 'भुगतान सूची',
    'pay.deductions_list': 'कटौती सूची',
    'pay.total_paid': 'कुल भुगतान',
    'pay.total_deducted': 'कुल कटौती',
    'pay.payment_method': 'भुगतान का तरीका',
    'pay.cash': 'नकद',
    'pay.upi': 'यूपीआई',
    'pay.bank': 'बैंक ट्रांसफर',
    'pay.notes': 'टिप्पणी / विवरण',
    'pay.amount': 'राशि (₹)',

    // Backup
    'backup.title': 'बैकअप और रिस्टोर',
    'backup.export': 'बैकअप निर्यात करें',
    'backup.import': 'बैकअप पुनर्स्थापित करें'
  },
  mr: {
    // Nav Items
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.farmers': 'शेतकरी यादी',
    'nav.collections': 'दूध संकलन',
    'nav.rate_chart': 'दर पत्रक',
    'nav.dispatch': 'डेअरी प्रेषण',
    'nav.accounts': 'खातेवही',
    'nav.udhar_khata': 'उधार खाते',
    'nav.payments': 'देयके / पेमेंट्स',
    'nav.purchases': 'खरेदी',
    'nav.inventory': 'इन्वेंटरी',
    'nav.reports': 'अहवाल',
    'nav.staff': 'कर्मचारी',
    'nav.subscription': 'सदस्यता',
    'nav.settings': 'सेटिंग्ज',

    // Dashboard
    'dashboard.total_collections': 'एकूण दूध संकलन',
    'dashboard.active_farmers': 'सक्रिय शेतकरी',
    'dashboard.pending_payments': 'प्रलंबित देयके',
    'dashboard.fat_average': 'सरासरी फॅट',
    'dashboard.snf_average': 'सरासरी एसएनएफ',
    'dashboard.today_summary': 'आजचा सारांश',
    'dashboard.recent_collections': 'अलीकडील संकलन',
    'dashboard.cow_vs_buffalo': 'गाय विरुद्ध म्हैस',
    'dashboard.daily_trends': 'दैनिक दूध प्रमाण प्रवाह',

    // Collections
    'col.new_entry': 'नवीन दूध संकलन नोंद',
    'col.farmer_id': 'शेतकरी आयडी',
    'col.shift': 'सत्र (शिफ्ट)',
    'col.morning': 'सकाळ',
    'col.evening': 'संध्याकाळ',
    'col.animal_type': 'प्राणी प्रकार',
    'col.cow': 'गाय',
    'col.buffalo': 'म्हैस',
    'col.liters': 'लीटर (L)',
    'col.fat': 'फॅट (%)',
    'col.snf': 'एसएनएफ (%)',
    'col.clr': 'सीएलआर (पर्यायी)',
    'col.rate': 'दर (₹/लीटर)',
    'col.total_amount': 'एकूण रक्कम (₹)',
    'col.save': 'संकलन जतन करा',
    'col.duplicate_alert': 'ड्युप्लिकेट नोंद आढळली! या शेतकऱ्याची नोंद या सत्रात आधीच केलेली आहे.',
    'col.animal_alert': 'चेतावणी: निवडलेला प्राणी प्रकार शेतकऱ्याच्या मुख्य नोंदणीकृत प्राण्याशी जुळत नाही!',

    // Payments & Deductions
    'pay.record_payment': 'पेमेंट नोंदवा',
    'pay.record_deduction': 'कटौती नोंदवा',
    'pay.payments_list': 'देयके यादी',
    'pay.deductions_list': 'कटौती यादी',
    'pay.total_paid': 'एकूण पेड',
    'pay.total_deducted': 'एकूण वजावट',
    'pay.payment_method': 'पेमेंट पद्धत',
    'pay.cash': 'रोख',
    'pay.upi': 'युपीआय',
    'pay.bank': 'बँक ट्रान्सफर',
    'pay.notes': 'नोंद / टिपणी',
    'pay.amount': 'रक्कम (₹)',

    // Backup
    'backup.title': 'बैकअप आणि रिस्टोर',
    'backup.export': 'बॅकअप एक्सपोर्ट करा',
    'backup.import': 'बॅकअप रिस्टोर करा'
  }
};

interface TranslationContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextProps | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuthStore();
  const [language, setLanguageState] = useState<Language>('en');

  // Load language settings on mount or profile load
  useEffect(() => {
    if (profile?.centerId) {
      settingsService.getSettings(profile.centerId).then(sett => {
        if (sett?.language && ['en', 'hi', 'mr'].includes(sett.language)) {
          setLanguageState(sett.language as Language);
        }
      });
    } else {
      const stored = localStorage.getItem('doodhos_preferred_lang');
      if (stored && ['en', 'hi', 'mr'].includes(stored)) {
        setLanguageState(stored as Language);
      }
    }
  }, [profile?.centerId]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('doodhos_preferred_lang', lang);
    // If center ID exists, trigger backend settings update in background
    if (profile?.centerId) {
      settingsService.saveSettings(profile.centerId, { language: lang }).catch(err => {
        console.error('Failed to sync language setting to cloud:', err);
      });
    }
  };

  const t = (key: string): string => {
    const langDict = translations[language] || translations.en;
    return langDict[key] || translations.en[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
