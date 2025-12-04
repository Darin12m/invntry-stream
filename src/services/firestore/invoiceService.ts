import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, writeBatch, serverTimestamp, FieldValue } from 'firebase/firestore';
import { Invoice, Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';

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
  create: async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<string> => {
    const newInvoice: Omit<Invoice, 'id'> = {
      ...invoice,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const docRef = await addDoc(collection(db, 'invoices'), newInvoice);
    await activityLogService.logAction(`New invoice ${invoice.number} created by ${userEmail}`, userId, userEmail);
    return docRef.id;
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
      // Reversing logic
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand += item.quantity; // Add back stock for sales/gifted
      } else if (invoice.invoiceType === 'return') {
        newOnHand -= item.quantity; // Subtract stock for returns
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged')) {
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
      // Apply original effect
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand -= item.quantity; // Subtract stock for sales/gifted
      } else if (invoice.invoiceType === 'return') {
        newOnHand += item.quantity; // Add stock for returns
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged')) {
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
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged') {
        newOnHand += item.quantity;
      } else if (invoice.invoiceType === 'return') {
        newOnHand -= item.quantity;
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged')) {
        throw new Error(`Cannot permanently delete invoice ${invoice.number}: Reverting stock would cause negative stock for product "${item.name}".`);
      }
      batch.update(productRef, { onHand: newOnHand });
    }
    batch.delete(invoiceRef);
    await batch.commit();
    await activityLogService.logAction(`Invoice ${invoice.number} permanently deleted by ${userEmail}`, userId, userEmail);
  },
};