import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, writeBatch, serverTimestamp, FieldValue, runTransaction, limit } from 'firebase/firestore';
import { Invoice, Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';
import { generateNextInvoiceNumber } from '@/utils/invoiceNumbering'; // Import the new utility
import { debugLog } from '@/utils/debugLog'; // Import debugLog

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
  create: async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'number'>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<{ invoiceId: string; invoiceNumber: string }> => {
    const invoicesColRef = collection(db, 'invoices');
    let newInvoiceNumber: string = '';
    let newInvoiceId: string = ''; // To store the generated ID

    debugLog("invoiceService.create: Starting invoice creation with payload:", invoice);

    try {
      await runTransaction(db, async (transaction) => {
        debugLog("invoiceService.create: Inside Firestore transaction.");

        // 1. Get the latest invoice number within the transaction
        // This query needs to be robust to get the highest number for the current fiscal year.
        // Ordering by 'number' desc and limiting to 1 works for the "000/YY" format.
        const latestInvoiceQuery = query(invoicesColRef, orderBy('number', 'desc'), limit(1));
        debugLog("invoiceService.create: Querying for latest invoice number.");
        const latestInvoiceSnapshot = await transaction.get(latestInvoiceQuery);
        debugLog("invoiceService.create: Latest invoice snapshot:", latestInvoiceSnapshot);
        
        let lastInvoiceNumber: string | null = null;
        if (!latestInvoiceSnapshot.empty) {
          const lastInvoiceDoc = latestInvoiceSnapshot.docs[0];
          if (!lastInvoiceDoc) {
            throw new Error("invoiceService.create: latestInvoiceSnapshot.docs[0] is undefined.");
          }
          lastInvoiceNumber = lastInvoiceDoc.data().number;
          debugLog("invoiceService.create: Found last invoice number:", lastInvoiceNumber, "ID:", lastInvoiceDoc.id);
        } else {
          debugLog("invoiceService.create: No previous invoices found.");
        }

        // 2. Generate the next sequential number
        newInvoiceNumber = generateNextInvoiceNumber(lastInvoiceNumber);
        debugLog("invoiceService.create: Generated next invoice number:", newInvoiceNumber);

        // 3. Check for uniqueness (optional, but good for explicit safety within transaction)
        const existingInvoiceQuery = query(invoicesColRef, where('number', '==', newInvoiceNumber));
        debugLog("invoiceService.create: Checking for uniqueness of new invoice number:", newInvoiceNumber);
        const existingInvoiceSnapshot = await transaction.get(existingInvoiceQuery);
        debugLog("invoiceService.create: Existing invoice snapshot for uniqueness check:", existingInvoiceSnapshot);
        if (!existingInvoiceSnapshot.empty) {
          // This indicates a race condition that `generateNextInvoiceNumber` might not have caught
          // or a very rare edge case. Throwing will retry the transaction.
          throw new Error(`Invoice number ${newInvoiceNumber} already exists. Retrying transaction.`);
        }
        debugLog("invoiceService.create: Invoice number is unique.");

        // 4. Create the new invoice document with the generated number
        const newInvoiceDocRef = doc(invoicesColRef);
        if (!newInvoiceDocRef) {
          throw new Error("invoiceService.create: newInvoiceDocRef is undefined after doc(invoicesColRef).");
        }
        newInvoiceId = newInvoiceDocRef.id; // Capture the ID here
        debugLog("invoiceService.create: New invoice document reference created with ID:", newInvoiceId);

        const invoiceWithNumber: Omit<Invoice, 'id'> = {
          ...invoice,
          number: newInvoiceNumber,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        debugLog("invoiceService.create: Setting invoice document with data:", invoiceWithNumber);
        transaction.set(newInvoiceDocRef, invoiceWithNumber);
        debugLog("Invoice created with ID:", newInvoiceId); // Add console log as requested
      });

      await activityLogService.logAction(`New invoice ${newInvoiceNumber} created by ${userEmail} (ID: ${newInvoiceId})`, userId, userEmail);
      debugLog("invoiceService.create: Transaction committed successfully. Returning ID and number.");
      return { invoiceId: newInvoiceId, invoiceNumber: newInvoiceNumber };
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