import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, writeBatch, serverTimestamp, FieldValue, setDoc, limit } from 'firebase/firestore';
import { Invoice, Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';
import { debugLog } from '@/utils/debugLog'; // Import debugLog

// Removed formatInvoiceNumber
// Removed _getNextInvoiceNumberLogic
// Removed _getInvoiceNumberPreview

export const invoiceService = {
  list: async (): Promise<Invoice[]> => {
    const invoicesCol = collection(db, 'invoices');
    const q = query(invoicesCol, orderBy('date', 'desc'));
    const invoiceSnapshot = await getDocs(q);
    return invoiceSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date, // date is already a string
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt,
      } as Invoice;
    });
  },
  get: async (id: string): Promise<Invoice> => {
    const invoiceRef = doc(db, 'invoices', id);
    const invoiceSnap = await getDoc(invoiceRef);
    if (!invoiceSnap.exists()) throw new Error('Invoice not found');
    const data = invoiceSnap.data();
    return {
      id: invoiceSnap.id,
      ...data,
      date: data.date,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : data.deletedAt,
    } as Invoice;
  },

  // New helper to get the latest invoice number for pre-filling UI
  _getLatestInvoiceNumber: async (): Promise<string> => {
    debugLog("invoiceService._getLatestInvoiceNumber: Querying for latest invoice number.");
    const invoicesColRef = collection(db, 'invoices');
    const q = query(invoicesColRef, orderBy('createdAt', 'desc'), limit(1));
    const latestInvoiceSnapshot = await getDocs(q);

    if (!latestInvoiceSnapshot.empty) {
      const lastInvoiceData = latestInvoiceSnapshot.docs[0].data();
      debugLog("invoiceService._getLatestInvoiceNumber: Found last invoice number:", lastInvoiceData.number);
      return lastInvoiceData.number;
    }
    debugLog("invoiceService._getLatestInvoiceNumber: No previous invoices found. Returning empty string.");
    return ''; // Return empty if no invoices exist
  },

  create: async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<{ invoiceId: string; invoiceNumber: string }> => {
    const invoicesColRef = collection(db, 'invoices');
    let newInvoiceId: string = '';

    debugLog("invoiceService.create: Starting invoice creation with payload:", invoiceData);

    try {
      // Check for duplicate invoice number before creating
      const q = query(invoicesColRef, where("number", "==", invoiceData.number));
      const existingInvoiceSnapshot = await getDocs(q);
      if (!existingInvoiceSnapshot.empty) {
        throw new Error(`Invoice number "${invoiceData.number}" already exists.`);
      }

      // Create the new invoice document
      const newInvoiceDocRef = doc(invoicesColRef);
      newInvoiceId = newInvoiceDocRef.id;
      debugLog("invoiceService.create: New invoice document reference created with ID:", newInvoiceId);

      const invoiceToSave: Omit<Invoice, 'id'> = {
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      debugLog("invoiceService.create: Setting invoice document with data:", invoiceToSave);
      await setDoc(newInvoiceDocRef, invoiceToSave);
      debugLog("Invoice created with ID:", newInvoiceId, "Number:", invoiceData.number);

      await activityLogService.logAction(`New invoice ${invoiceData.number} created by ${userEmail} (ID: ${newInvoiceId})`, userId, userEmail);
      debugLog("invoiceService.create: Invoice document added and activity logged. Returning ID and number.");
      return { invoiceId: newInvoiceId, invoiceNumber: invoiceData.number };
    } catch (error: any) {
      debugLog("ERROR in invoiceService.create:", error, error?.stack);
      throw new Error(`invoiceService.create: ${error.message || 'Unknown error'}`);
    }
  },
  update: async (id: string, invoice: Partial<Omit<Invoice, 'id' | 'updatedAt'>>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const invoiceRef = doc(db, 'invoices', id);
    await updateDoc(invoiceRef, { ...invoice, updatedAt: new Date() });
    await activityLogService.logAction(`Invoice ${invoice.number || id} updated by ${userEmail}`, userId, userEmail);
  },
  // Hard delete for permanent removal (used in clear all data)
  hardDelete: async (id: string, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const invoiceRef = doc(db, 'invoices', id);
    await deleteDoc(invoiceRef);
    await activityLogService.logAction(`Invoice ${id} permanently deleted by ${userEmail}`, userId, userEmail);
  },

  // Soft delete (move to trash)
  softDelete: async (invoice: Invoice, products: Product[], userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    if (invoice.deletedAt) {
      throw new Error('Invoice is already in trash.');
    }

    const batch = writeBatch(db); // Corrected: use writeBatch
    const invoiceRef = doc(db, 'invoices', invoice.id);

    for (const item of invoice.items) {
      const productRef = doc(db, 'products', item.productId);
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.name} (ID: ${item.productId}) not found. Cannot revert stock.`);
      }

      let newOnHand = product.onHand;
      // Reversing logic - for return invoices qty is negative, so:
      // sale/cash/gifted: we subtracted positive qty, so add it back
      // return: we subtracted negative qty (added stock), so subtract to revert
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand += item.quantity; // Add back stock for sales/cash/gifted
      } else if (invoice.invoiceType === 'return') {
        // Return qty is negative, so adding negative = subtracting
        newOnHand += item.quantity; // This subtracts because qty is negative
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged')) {
        throw new Error(`Cannot delete invoice ${invoice.number}: Reverting stock would cause negative stock for product "${item.name}". Current: ${product.onHand}, Change: +${item.quantity}, New: ${newOnHand}`);
      }
      batch.update(productRef, { onHand: newOnHand });
    }
    batch.update(invoiceRef, { deletedAt: serverTimestamp() });
    await batch.commit();
    await activityLogService.logAction(`Invoice ${invoice.number} moved to trash by ${userEmail}`, userId, userEmail);
  },

  // Restore from trash
  restore: async (invoice: Invoice, products: Product[], userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    if (!invoice.deletedAt) {
      throw new Error('Invoice is not in trash.');
    }

    const batch = writeBatch(db); // Corrected: use writeBatch
    const invoiceRef = doc(db, 'invoices', invoice.id);

    for (const item of invoice.items) {
      const productRef = doc(db, 'products', item.productId);
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.name} (ID: ${item.productId}) not found. Cannot restore stock.`);
      }

      let newOnHand = product.onHand;
      // Apply original effect (same as creating the invoice)
      // For sale/cash/gifted: subtract qty (qty is positive)
      // For return: subtract qty (qty is negative, so it adds stock)
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand -= item.quantity; // Subtract stock for sales/cash/gifted
      } else if (invoice.invoiceType === 'return') {
        newOnHand -= item.quantity; // qty is negative, so this adds stock
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged')) {
        throw new Error(`Cannot restore invoice ${invoice.number}: Insufficient stock for product "${item.name}". Current: ${product.onHand}, Change: -${item.quantity}, New: ${newOnHand}`);
      }
      batch.update(productRef, { onHand: newOnHand });
    }
    batch.update(invoiceRef, { deletedAt: null });
    await batch.commit();
    await activityLogService.logAction(`Invoice ${invoice.number} restored by ${userEmail}`, userId, userEmail);
  },

  // Permanent delete from trash
  permanentDelete: async (invoice: Invoice, products: Product[], userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    if (!invoice.deletedAt) {
      throw new Error('Invoice is not in trash. Please move to trash first.');
    }

    const batch = writeBatch(db); // Corrected: use writeBatch
    const invoiceRef = doc(db, 'invoices', invoice.id);

    // Revert stock changes based on invoice type (same as soft deleting)
    for (const item of invoice.items) {
      const productRef = doc(db, 'products', item.productId);
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.name} (ID: ${item.productId}) not found. Cannot revert stock for permanent delete.`);
      }

      let newOnHand = product.onHand;
      // Revert stock - same as soft delete logic
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand += item.quantity;
      } else if (invoice.invoiceType === 'return') {
        newOnHand += item.quantity; // qty is negative, so this subtracts
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged')) {
        throw new Error(`Cannot permanently delete invoice ${invoice.number}: Reverting stock would cause negative stock for product "${item.name}".`);
      }
      batch.update(productRef, { onHand: newOnHand });
    }
    batch.delete(invoiceRef);
    await batch.commit();
    await activityLogService.logAction(`Invoice ${invoice.number} permanently deleted by ${userEmail}`, userId, userEmail);
  },
};