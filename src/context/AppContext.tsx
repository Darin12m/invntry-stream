import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { Product, Invoice, AppSettings, ActivityLog } from '@/types';
// Removed direct imports of useProducts, useInvoices, useSettings, useActivityLogs to break circular dependency
import { toast } from 'sonner';
import { db } from '@/firebase/config';
import { collection, writeBatch, doc } from 'firebase/firestore';

// Import all services used within AppContext
import { activityLogService } from '@/services/firestore/activityLogService';
import { productService } from '@/services/firestore/productService';
import { invoiceService } from '@/services/firestore/invoiceService';
import { settingsService } from '@/services/firestore/settingsService';
import { defaultSettings } from '@/utils/constants'; // Import defaultSettings

interface AppContextType {
  currentUser: FirebaseAuthUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<FirebaseAuthUser | null>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  activityLogs: ActivityLog[];
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  // Global actions that might affect multiple states
  handleClearAllData: () => Promise<void>;
  fetchAppData: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global data fetching for initial load or refresh
  const fetchAppData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        productsList,
        invoicesList,
        fetchedSettings,
        logsList,
      ] = await Promise.all([
        productService.list(),
        invoiceService.list(),
        settingsService.getSettings(),
        activityLogService.listActions(),
      ]);

      setProducts(productsList);
      setInvoices(invoicesList);
      setActivityLogs(logsList);

      if (fetchedSettings) {
        setSettings({ ...defaultSettings, ...fetchedSettings });
      } else {
        // If no settings exist, save the default ones
        await settingsService.saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }

    } catch (err: any) {
      console.error("Error fetching initial app data:", err);
      setError("Failed to load initial application data.");
      toast.error("Failed to load initial application data.");
    } finally {
      setLoading(false);
    }
  }, [setProducts, setInvoices, setActivityLogs, setSettings, setError]);

  // Only fetch data when user is authenticated
  useEffect(() => {
    if (currentUser) {
      // Clear any previous errors before fetching
      setError(null);
      fetchAppData();
    } else {
      // Reset state when no user
      setLoading(false);
      setProducts([]);
      setInvoices([]);
      setActivityLogs([]);
    }
  }, [currentUser, fetchAppData]);

  const handleClearAllData = useCallback(async () => {
    if (products.length === 0 && invoices.length === 0) {
      toast.error("No data to clear");
      return;
    }
    
    if (window.confirm("⚠️ WARNING: This will delete ALL products and invoices permanently. This action cannot be undone. Are you absolutely sure?")) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;

        // Delete all products
        const productBatch = writeBatch(db);
        products.forEach((product) => {
          const productRef = doc(db, 'products', product.id);
          productBatch.delete(productRef);
        });
        await productBatch.commit();

        // Delete all invoices and revert stock
        const invoiceBatch = writeBatch(db);
        for (const invoice of invoices) {
          // Revert stock changes for each invoice before deleting the invoice document
          const stockUpdateBatch = writeBatch(db);
          for (const item of invoice.items) {
            const productRef = doc(db, "products", item.productId);
            const product = products.find(p => p.id === item.productId);
            if (product) {
              let newOnHand = product.onHand;
              if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged') {
                newOnHand += item.quantity;
              } else if (invoice.invoiceType === 'return') {
                newOnHand -= item.quantity;
              }
              stockUpdateBatch.update(productRef, { onHand: newOnHand });
            }
          }
          await stockUpdateBatch.commit(); // Commit stock updates immediately
          invoiceBatch.delete(doc(db, 'invoices', invoice.id));
        }
        await invoiceBatch.commit();
        
        toast.success("All data cleared successfully");
        await activityLogService.logAction(`All data cleared by ${userEmail}`, userId, userEmail);
        await fetchAppData(); // Re-fetch all data to update UI
      } catch (err: any) {
        console.error('Error clearing all data:', err);
        toast.error(`Failed to clear all data: ${err.message}`);
        setError(`Failed to clear all data: ${err.message}`);
      }
    }
  }, [products, invoices, currentUser, fetchAppData, setError]);

  const contextValue = {
    currentUser,
    setCurrentUser,
    products,
    setProducts,
    invoices,
    setInvoices,
    activityLogs,
    setActivityLogs,
    settings,
    setSettings,
    loading,
    setLoading,
    error,
    setError,
    handleClearAllData,
    fetchAppData,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};