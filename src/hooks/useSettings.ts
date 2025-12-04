import { useState, useEffect, useCallback, useContext } from 'react';
import { AppSettings } from '@/types';
import { settingsService } from '@/services/firestore/settingsService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { defaultSettings } from '@/utils/constants'; // Import defaultSettings

export const useSettings = () => {
  const { settings, setSettings, currentUser, setLoading, setError } = useContext(AppContext);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [errorSettings, setErrorSettings] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    setErrorSettings(null);
    try {
      const fetchedSettings = await settingsService.getSettings();
      if (fetchedSettings) {
        setSettings({ ...defaultSettings, ...fetchedSettings });
      } else {
        // If no settings exist, save the default ones
        await settingsService.saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setErrorSettings('Failed to load settings.');
      setError('Failed to load settings.'); // Global error
      toast.error('Failed to load settings.');
      setSettings(defaultSettings); // Fallback to defaults on error
    } finally {
      setLoadingSettings(false);
    }
  }, [setSettings, setError]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await settingsService.saveSettings(newSettings, userEmail, userId);
      setSettings(newSettings); // Update context state immediately
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
      setError('Failed to save settings.'); // Global error
      throw error;
    }
  }, [currentUser, setSettings, setError]);

  return {
    settings,
    loadingSettings,
    errorSettings,
    fetchSettings,
    saveSettings,
    defaultSettings, // Export default settings for initial state or reset
  };
};