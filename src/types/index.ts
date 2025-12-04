import { FieldValue } from 'firebase/firestore';

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number; // Total quantity in stock (might be redundant with onHand, but kept for existing logic)
  onHand: number; // Actual stock available
  price: number;
  category: string;
  purchasePrice?: number;
  shortDescription?: string;
  initialStock?: number;
  createdAt?: Date | FieldValue;
  updatedAt?: Date | FieldValue;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  purchasePrice?: number;
  discount?: number; // Per-item discount percentage
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  customer: {
    name: string;
    email: string;
    address: string;
    phone?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // Total discount amount
  discountPercentage: number; // Global discount percentage
  total: number;
  status: string;
  invoiceType: 'sale' | 'return' | 'gifted-damaged';
  itemsIds: string[];
  deletedAt?: Date | FieldValue | null;
  createdAt?: Date | FieldValue;
  updatedAt?: Date | FieldValue;
  buyerName?: string;
  buyerEmail?: string;
  buyerAddress?: string;
}

export interface ActivityLog {
  id: string;
  message: string;
  userId: string | null;
  userEmail: string;
  timestamp: Date | FieldValue;
}

export interface AppSettings {
  businessName: string;
  currency: string;
  lowStockWarning: number;
  dateFormat: string;
  invoicePrefix: string;
  autoNumbering: boolean;
  defaultTaxRate: number;
  preventNegativeStock: boolean;
  autoStockUpdate: boolean;
  trackStockHistory: boolean;
  defaultCategory: string;
}

export interface DashboardMetrics {
  totalSales: number;
  totalCosts: number;
  totalProfit: number;
  numberOfInvoices: number;
  totalNegativeQuantity: number;
  totalNegativeValue: number;
  filteredInvoices: Invoice[];
}

export type SortDirection = 'asc' | 'desc';