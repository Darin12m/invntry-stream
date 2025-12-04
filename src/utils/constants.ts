import { AppSettings } from '@/types';

export const defaultSettings: AppSettings = {
  businessName: 'WeParty Inventory',
  currency: 'ден.',
  lowStockWarning: 10,
  dateFormat: 'DD.MM.YYYY',
  invoicePrefix: 'INV-',
  autoNumbering: true,
  defaultTaxRate: 0,
  preventNegativeStock: true,
  autoStockUpdate: true,
  trackStockHistory: false,
  defaultCategory: 'General',
};