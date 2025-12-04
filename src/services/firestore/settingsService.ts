import { db } from '@/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AppSettings } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';

export const settingsService = {
  getSettings: async (): Promise<AppSettings | null> => {
    const settingsRef = doc(db, 'settings', 'userSettings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      return settingsSnap.data() as AppSettings;
    }
    return null;
  },
  saveSettings: async (settings: AppSettings, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const settingsRef = doc(db, 'settings', 'userSettings');
    await setDoc(settingsRef, settings, { merge: true });
    await activityLogService.logAction(`Settings updated by ${userEmail}`, userId, userEmail);
  },
};