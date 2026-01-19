import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDoc, writeBatch, serverTimestamp, FieldValue, setDoc, limit } from 'firebase/firestore';
import { Invoice, Product } from '@/types';
import { activityLogService } from '@/services/firestore/activityLogService';
import { getInvoicePrefix, parseInvoiceNumber, regularInvoiceNumberRegex, cashInvoiceNumberExtendedRegex, returnInvoiceNumberRegex, giftedDamagedInvoiceNumberRegex } from '@/utils/invoiceNumbering';

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

  /**
   * Retrieves the latest invoice number for a specific invoice type and year.
   * @param invoiceType The specific type of invoice ('sale', 'cash', 'return', 'gifted-damaged').
   * @param yearShort The two-digit year (e.g., '25' for 2025)
   * @returns The latest invoice number string, or an empty string if none found.
   */
  _getLatestInvoiceNumber: async (invoiceType: Invoice['invoiceType'], yearShort: string): Promise<string> => {
    const invoicesColRef = collection(db, 'invoices');
    let q;
    const prefix = getInvoicePrefix(invoiceType);
    let regex;

    switch (invoiceType) {
      case 'cash':
        regex = cashInvoiceNumberExtendedRegex;
        q = query(
          invoicesColRef,
          where('invoiceType', '==', 'cash'),
          where('number', '>=', `${prefix}001/${yearShort}`),
          where('number', '<=', `${prefix}999/${yearShort}~`), // '~' allows for suffixes
          orderBy('number', 'desc'),
          limit(1)
        );
        break;
      case 'return':
        regex = returnInvoiceNumberRegex;
        q = query(
          invoicesColRef,
          where('invoiceType', '==', 'return'),
          where('number', '>=', `${prefix}001/${yearShort}`),
          where('number', '<=', `${prefix}999/${yearShort}`),
          orderBy('number', 'desc'),
          limit(1)
        );
        break;
      case 'gifted-damaged':
        regex = giftedDamagedInvoiceNumberRegex;
        q = query(
          invoicesColRef,
          where('invoiceType', '==', 'gifted-damaged'),
          where('number', '>=', `${prefix}001/${yearShort}`),
          where('number', '<=', `${prefix}999/${yearShort}`),
          orderBy('number', 'desc'),
          limit(1)
        );
        break;
      case 'sale': // Regular sale
        regex = regularInvoiceNumberRegex;
        q = query(
          invoicesColRef,
          where('invoiceType', '==', 'sale'),
          where('number', '>=', `001/${yearShort}`),
          where('number', '<=', `999/${yearShort}`),
          orderBy('number', 'desc'),
          limit(1)
        );
        break;
      case 'online-sale':
        // Online-sale does not have an auto-generated sequence, so no latest number to fetch
        return '';
      default:
        return '';
    }
    
    const latestInvoiceSnapshot = await getDocs(q);

    if (!latestInvoiceSnapshot.empty) {
      const lastInvoiceData = latestInvoiceSnapshot.docs[0].data() as Invoice;
      // Double-check the format and type to be safe
      if (regex.test(lastInvoiceData.number)) {
        return lastInvoiceData.number;
      }
    }
    return ''; // Return empty if no invoices of that type/year exist or format is incorrect
  },

  create: async (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<{ invoiceId: string; invoiceNumber: string }> => {
    const invoicesColRef = collection(db, 'invoices');
    let newInvoiceId: string = '';

    try {
      // Determine the numbering type for the new invoice
      const currentYearShort = String(new Date().getFullYear()).slice(-2); // Get current year for uniqueness scope

      // Check for duplicate invoice number within the same invoiceType and year
      const q = query(
        invoicesColRef,
        where("number", "==", invoiceData.number),
        where("invoiceType", "==", invoiceData.invoiceType) // Ensure uniqueness is type-specific
      );
      const existingInvoiceSnapshot = await getDocs(q);
      if (!existingInvoiceSnapshot.empty) {
        // Further check if the duplicate is of the same numbering type and year
        const duplicateInvoice = existingInvoiceSnapshot.docs[0].data() as Invoice;
        const parsedDuplicate = parseInvoiceNumber(duplicateInvoice.number, duplicateInvoice.invoiceType);
        const parsedNew = parseInvoiceNumber(invoiceData.number, invoiceData.invoiceType);
        
        // Check if the year part matches for structured numbers
        const isSameYear = (parsedDuplicate.isValid && parsedNew.isValid && parsedDuplicate.year === parsedNew.year) ||
                           (invoiceData.invoiceType === 'online-sale' && parsedDuplicate.year === currentYearShort); // For online-sale, just check current year

        if (isSameYear) {
          throw new Error(`Invoice number "${invoiceData.number}" already exists for this invoice type and year.`);
        }
      }

      // Create the new invoice document
      const newInvoiceDocRef = doc(invoicesColRef);
      newInvoiceId = newInvoiceDocRef.id;

      const invoiceToSave: Omit<Invoice, 'id'> = {
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDoc(newInvoiceDocRef, invoiceToSave);

      await activityLogService.logAction(`New invoice ${invoiceData.number} created by ${userEmail} (ID: ${newInvoiceId})`, userId, userEmail);
      return { invoiceId: newInvoiceId, invoiceNumber: invoiceData.number };
    } catch (error: any) {
      throw new Error(`invoiceService.create: ${error.message || 'Unknown error'}`);
    }
  },
  update: async (id: string, invoice: Partial<Omit<Invoice, 'id' | 'updatedAt'>>, userEmail: string = 'Unknown User', userId: string | null = null): Promise<void> => {
    const invoiceRef = doc(db, 'invoices', id);

    // If the invoice number is being updated, perform a duplicate check
    if (invoice.number) {
      const existingInvoiceSnap = await getDoc(invoiceRef);
      if (!existingInvoiceSnap.exists()) {
        throw new Error('Invoice not found for update.');
      }
      const currentInvoiceData = existingInvoiceSnap.data() as Invoice;

      // Only check for duplicates if the number has actually changed
      if (invoice.number !== currentInvoiceData.number) {
        const currentYearShort = String(new Date().getFullYear()).slice(-2); // Get current year for uniqueness scope

        const q = query(
          collection(db, 'invoices'),
          where("number", "==", invoice.number),
          where("invoiceType", "==", invoice.invoiceType || currentInvoiceData.invoiceType) // Ensure uniqueness is type-specific
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const duplicateInvoice = querySnapshot.docs[0].data() as Invoice;
          const parsedDuplicate = parseInvoiceNumber(duplicateInvoice.number, duplicateInvoice.invoiceType);
          const parsedNew = parseInvoiceNumber(invoice.number, invoice.invoiceType || currentInvoiceData.invoiceType);

          // Check if the year part matches for structured numbers
          const isSameYear = (parsedDuplicate.isValid && parsedNew.isValid && parsedDuplicate.year === parsedNew.year) ||
                             ((invoice.invoiceType || currentInvoiceData.invoiceType) === 'online-sale' && parsedDuplicate.year === currentYearShort);

          if (duplicateInvoice.id !== id && isSameYear) {
            throw new Error(`Invoice number "${invoice.number}" already exists for this invoice type and year.`);
          }
        }
      }
    }

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
      // sale/cash/gifted/online-sale: we subtracted positive qty, so add it back
      // return: we subtracted negative qty (added stock), so subtract to revert
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale') {
        newOnHand += item.quantity; // Add back stock for sales/cash/gifted/online-sale
      } else if (invoice.invoiceType === 'return') {
        // Return qty is negative, so adding negative = subtracting
        newOnHand += item.quantity; // This subtracts because qty is negative
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale')) {
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
      // For sale/cash/gifted/online-sale: subtract qty (qty is positive)
      // For return: subtract qty (qty is negative, so it adds stock)
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale') {
        newOnHand -= item.quantity; // Subtract stock for sales/cash/gifted/online-sale
      } else if (invoice.invoiceType === 'return') {
        newOnHand -= item.quantity; // qty is negative, so this adds stock
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale')) {
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
      if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale') {
        newOnHand += item.quantity;
      } else if (invoice.invoiceType === 'return') {
        newOnHand += item.quantity; // qty is negative, so this subtracts
      }

      if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged' || invoice.invoiceType === 'online-sale')) {
        throw new Error(`Cannot permanently delete invoice ${invoice.number}: Reverting stock would cause negative stock for product "${item.name}".`);
      }
      batch.update(productRef, { onHand: newOnHand });
    }
    batch.delete(invoiceRef);
    await batch.commit();
    await activityLogService.logAction(`Invoice ${invoice.number} permanently deleted by ${userEmail}`, userId, userEmail);
  },
};