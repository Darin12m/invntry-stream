import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { AppSettings } from '@/types';
import { settingsService } from '@/services/firestore/settingsService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { defaultSettings } from '@/utils/constants';
import { db } from '@/firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

export const useSettings = () => {
  const { settings, setSettings, currentUser, setError } = useContext(AppContext);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [errorSettings, setErrorSettings] = useState<string | null>(null);

  // Track if we've received the first snapshot
  const hasInitialSnapshot = useRef(false);

  // Real-time listener for settings
  useEffect(() => {
    if (!currentUser) {
      setLoadingSettings(false);
      return;
    }

    setLoadingSettings(true);
    setErrorSettings(null);
    hasInitialSnapshot.current = false;

    // Settings are stored in a single document
    const settingsRef = doc(db, 'settings', 'app');

    const unsubscribe = onSnapshot(
      settingsRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const fetchedSettings: AppSettings = {
            businessName: data.businessName ?? defaultSettings.businessName,
            currency: data.currency ?? defaultSettings.currency,
            lowStockWarning: data.lowStockWarning ?? defaultSettings.lowStockWarning,
            dateFormat: data.dateFormat ?? defaultSettings.dateFormat,
            invoicePrefix: data.invoicePrefix ?? defaultSettings.invoicePrefix,
            autoNumbering: data.autoNumbering ?? defaultSettings.autoNumbering,
            defaultTaxRate: data.defaultTaxRate ?? defaultSettings.defaultTaxRate,
            preventNegativeStock: data.preventNegativeStock ?? defaultSettings.preventNegativeStock,
            autoStockUpdate: data.autoStockUpdate ?? defaultSettings.autoStockUpdate,
            trackStockHistory: data.trackStockHistory ?? defaultSettings.trackStockHistory,
            defaultCategory: data.defaultCategory ?? defaultSettings.defaultCategory,
          };
          setSettings(fetchedSettings);
        } else {
          // If no settings exist, save the default ones
          try {
            await settingsService.saveSettings(defaultSettings);
            setSettings(defaultSettings);
          } catch (error) {
            console.error('Error creating default settings:', error);
            setSettings(defaultSettings);
          }
        }

        if (!hasInitialSnapshot.current) {
          hasInitialSnapshot.current = true;
          setLoadingSettings(false);
        }
      },
      (error) => {
        console.error('Error in settings real-time listener:', error);
        setErrorSettings('Failed to load settings.');
        setError('Failed to load settings.');
        toast.error('Failed to load settings.');
        setSettings(defaultSettings); // Fallback to defaults on error
        setLoadingSettings(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [currentUser, setSettings, setError]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await settingsService.saveSettings(newSettings, userEmail, userId);
      // No need to update context - real-time listener will handle it
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
      setError('Failed to save settings.');
      throw error;
    }
  }, [currentUser, setError]);

  // Manual refresh function (still available if needed)
  const fetchSettings = useCallback(async () => {
    try {
      const fetchedSettings = await settingsService.getSettings();
      if (fetchedSettings) {
        setSettings({ ...defaultSettings, ...fetchedSettings });
      } else {
        await settingsService.saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setErrorSettings('Failed to load settings.');
      toast.error('Failed to load settings.');
      setSettings(defaultSettings);
    }
  }, [setSettings]);

  return {
    settings,
    loadingSettings,
    errorSettings,
    fetchSettings,
    saveSettings,
    defaultSettings,
  };
};
