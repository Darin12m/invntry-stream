import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { Invoice, Product, SortDirection } from '@/types';
import { invoiceService } from '@/services/firestore/invoiceService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { activityLogService } from '@/services/firestore/activityLogService';
import { db } from '@/firebase/config';
import { doc, writeBatch, collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';

export const useInvoices = () => {
  const { invoices, setInvoices, products, currentUser, setError } = useContext(AppContext);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [errorInvoices, setErrorInvoices] = useState<string | null>(null);
  const [invoiceSortBy, setInvoiceSortBy] = useState<'number' | 'date' | 'customer' | 'total' | 'invoiceType'>('number');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<SortDirection>('asc');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set<string>());

  // Track if we've received the first snapshot
  const hasInitialSnapshot = useRef(false);

  // Real-time listener for invoices
  useEffect(() => {
    if (!currentUser) {
      setLoadingInvoices(false);
      return;
    }

    setLoadingInvoices(true);
    setErrorInvoices(null);
    hasInitialSnapshot.current = false;

    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invoicesList: Invoice[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Handle Firestore Timestamp conversion safely
          let dateStr = '';
          if (data.date) {
            if (data.date instanceof Timestamp) {
              dateStr = data.date.toDate().toISOString().split('T')[0];
            } else if (typeof data.date === 'string') {
              dateStr = data.date;
            }
          }

          return {
            id: doc.id,
            number: data.number || '',
            date: dateStr,
            customer: {
              name: data.customer?.name || data.buyerName || '',
              email: data.customer?.email || data.buyerEmail || '',
              address: data.customer?.address || data.buyerAddress || '',
              phone: data.customer?.phone || '',
            },
            items: (data.items || []).map((item: any) => ({
              productId: item.productId || '',
              name: item.name || '',
              sku: item.sku || '',
              price: item.price ?? 0,
              quantity: item.quantity ?? 0,
              purchasePrice: item.purchasePrice ?? 0,
              discount: item.discount ?? 0,
            })),
            subtotal: data.subtotal ?? 0,
            discount: data.discount ?? 0,
            discountPercentage: data.discountPercentage ?? 0,
            total: data.total ?? 0,
            status: data.status || 'pending',
            invoiceType: data.invoiceType || 'sale',
            itemsIds: data.itemsIds || [],
            deletedAt: data.deletedAt || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            buyerName: data.buyerName,
            buyerEmail: data.buyerEmail,
            buyerAddress: data.buyerAddress,
          } as Invoice;
        });
        
        setInvoices(invoicesList);
        
        if (!hasInitialSnapshot.current) {
          hasInitialSnapshot.current = true;
          setLoadingInvoices(false);
        }
      },
      (error) => {
        console.error('Error in invoices real-time listener:', error);
        setErrorInvoices('Failed to load invoices');
        setError('Failed to load invoices');
        toast.error('Failed to load invoices');
        setLoadingInvoices(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [currentUser, setInvoices, setError]);

  const createInvoice = useCallback(async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => { // Updated type to include 'number'
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      const { invoiceId, invoiceNumber } = await invoiceService.create(invoice, userEmail, userId); // Destructure the new return type
      toast.success(`Invoice ${invoiceNumber} created successfully!`);
      // No need to fetch - real-time listener will update
      return { invoiceId, invoiceNumber }; // Return for potential downstream use
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(`Failed to create invoice: ${error.message}`);
      setError(`Failed to create invoice: ${error.message}`);
      throw error;
    }
  }, [currentUser, setError]);

  const updateInvoice = useCallback(async (id: string, invoice: Partial<Omit<Invoice, 'id' | 'updatedAt'>>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await invoiceService.update(id, invoice, userEmail, userId);
      toast.success('Invoice updated successfully!');
      // No need to fetch - real-time listener will update
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast.error(`Failed to update invoice: ${error.message}`);
      setError(`Failed to update invoice: ${error.message}`);
      throw error;
    }
  }, [currentUser, setError]);

  const softDeleteInvoice = useCallback(async (invoiceId: string) => {
    const invoiceToDelete = invoices.find(inv => inv.id === invoiceId);
    if (!invoiceToDelete) {
      toast.error('Invoice not found for deletion.');
      return;
    }
    if (invoiceToDelete.deletedAt) {
      toast.error('Invoice is already in trash.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this invoice? It will be moved to the trash.')) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        await invoiceService.softDelete(invoiceToDelete, products, userEmail, userId);
        toast.success("Invoice moved to trash and stock reverted.");
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error soft deleting invoice:', error);
        toast.error(`Failed to move invoice to trash: ${error.message}`);
        setError(`Failed to move invoice to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, setError]);

  const bulkSoftDeleteInvoices = useCallback(async (invoiceIds: Set<string>) => {
    if (invoiceIds.size === 0) {
      toast.error("Please select invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to move ${invoiceIds.size} selected invoice(s) to trash? This will also revert their stock changes.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db);
        let successCount = 0;

        for (const invoiceId of Array.from(invoiceIds)) {
          const invoiceToDelete = invoices.find(inv => inv.id === invoiceId);
          if (!invoiceToDelete) {
            console.warn(`Invoice ${invoiceId} not found for bulk deletion.`);
            continue;
          }
          if (invoiceToDelete.deletedAt) {
            console.warn(`Invoice ${invoiceId} is already in trash, skipping.`);
            continue;
          }

          // Revert stock changes based on invoice type
          for (const item of invoiceToDelete.items) {
            const productRef = doc(db, 'products', item.productId);
            const product = products.find(p => p.id === item.productId);
            
            // Gracefully handle missing products
            if (!product) {
              console.warn(`Product ${item.name} (ID: ${item.productId}) not found. Skipping stock revert.`);
              continue;
            }

            let newOnHand = product.onHand ?? 0;
            // Revert stock: for sale/cash/gifted add back, for return subtract back
            // Return qty is negative, so adding it back reverts the stock addition
            if (invoiceToDelete.invoiceType === 'sale' || invoiceToDelete.invoiceType === 'cash' || invoiceToDelete.invoiceType === 'gifted-damaged') {
              newOnHand += item.quantity ?? 0;
            } else if (invoiceToDelete.invoiceType === 'return') {
              newOnHand += item.quantity ?? 0; // qty is negative, so this subtracts
            }

            batch.update(productRef, { onHand: newOnHand });
          }
          batch.update(doc(db, 'invoices', invoiceId), { deletedAt: new Date() });
          successCount++;
        }
        await batch.commit();
        setSelectedInvoices(new Set());
        toast.success(`${successCount} invoices moved to trash and stock reverted.`);
        await activityLogService.logAction(`Bulk invoices moved to trash by ${userEmail}`, userId, userEmail);
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error bulk soft deleting invoices:', error);
        toast.error(`Failed to move invoices to trash: ${error.message}`);
        setError(`Failed to move invoices to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, setError]);

  const deleteAllInvoices = useCallback(async () => {
    if (invoices.length === 0) {
      toast.error("No invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to move ALL ${invoices.length} invoices to trash? This will also revert their stock changes. This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db);
        let successCount = 0;

        for (const invoice of invoices) {
          if (invoice.deletedAt) {
            console.warn(`Invoice ${invoice.id} is already in trash, skipping for delete all.`);
            continue;
          }
          // Revert stock changes based on invoice type
          for (const item of invoice.items) {
            const productRef = doc(db, 'products', item.productId);
            const product = products.find(p => p.id === item.productId);
            
            // Gracefully handle missing products
            if (!product) {
              console.warn(`Product ${item.name} (ID: ${item.productId}) not found. Skipping stock revert.`);
              continue;
            }

            let newOnHand = product.onHand ?? 0;
            // Revert stock: for sale/cash/gifted add back, for return subtract back
            if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'cash' || invoice.invoiceType === 'gifted-damaged') {
              newOnHand += item.quantity ?? 0;
            } else if (invoice.invoiceType === 'return') {
              newOnHand += item.quantity ?? 0; // qty is negative, so this subtracts
            }

            batch.update(productRef, { onHand: newOnHand });
          }
          batch.update(doc(db, 'invoices', invoice.id), { deletedAt: new Date() });
          successCount++;
        }
        await batch.commit();
        setSelectedInvoices(new Set());
        toast.success(`${successCount} invoices moved to trash and stock reverted.`);
        await activityLogService.logAction(`All invoices moved to trash by ${userEmail}`, userId, userEmail);
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error soft deleting all invoices:', error);
        toast.error(`Failed to move all invoices to trash: ${error.message}`);
        setError(`Failed to move all invoices to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, setError]);

  const restoreInvoice = useCallback(async (invoiceId: string) => {
    const invoiceToRestore = invoices.find(inv => inv.id === invoiceId);
    if (!invoiceToRestore) {
      toast.error('Invoice not found for restoration.');
      return;
    }
    if (!invoiceToRestore.deletedAt) {
      toast.error('Invoice is not in trash.');
      return;
    }

    if (window.confirm('Are you sure you want to restore this invoice?')) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        await invoiceService.restore(invoiceToRestore, products, userEmail, userId);
        toast.success("Invoice restored successfully and stock updated.");
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error restoring invoice:', error);
        toast.error(`Failed to restore invoice: ${error.message}`);
        setError(`Failed to restore invoice: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, setError]);

  const permanentDeleteInvoice = useCallback(async (invoiceId: string) => {
    const invoiceToDelete = invoices.find(inv => inv.id === invoiceId);
    if (!invoiceToDelete) {
      toast.error('Invoice not found for permanent deletion.');
      return;
    }
    if (!invoiceToDelete.deletedAt) {
      toast.error('Invoice is not in trash. Please move to trash first.');
      return;
    }

    if (window.confirm('Are you sure you want to permanently delete this invoice? This action cannot be undone.')) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        await invoiceService.permanentDelete(invoiceToDelete, products, userEmail, userId);
        toast.success("Invoice permanently deleted and stock reverted.");
        // No need to fetch - real-time listener will update
      } catch (error: any) {
        console.error('Error permanently deleting invoice or restoring stock:', error);
        toast.error(`Failed to permanently delete invoice: ${error.message}`);
        setError(`Failed to permanently delete invoice: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, setError]);

  const handleInvoiceSort = useCallback((column: typeof invoiceSortBy) => {
    if (invoiceSortBy === column) {
      setInvoiceSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setInvoiceSortBy(column);
      setInvoiceSortDirection('asc');
    }
  }, [invoiceSortBy]);

  const toggleInvoiceSelection = useCallback((invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(invoiceId)) {
        newSelected.delete(invoiceId);
      } else {
        newSelected.add(invoiceId);
      }
      return newSelected;
    });
  }, []);

  const selectAllInvoices = useCallback((filteredInvoiceIds: string[]) => {
    setSelectedInvoices(prev => {
      if (prev.size === filteredInvoiceIds.length && filteredInvoiceIds.length > 0) {
        return new Set();
      } else {
        return new Set(filteredInvoiceIds);
      }
    });
  }, []);

  const handleViewInvoice = useCallback((invoice: Invoice) => {
    console.log('Viewing invoice:', invoice.number);
  }, []);

  // Manual refresh function (still available if needed)
  const fetchInvoices = useCallback(async () => {
    try {
      const invoicesList = await invoiceService.list();
      setInvoices(invoicesList);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      setErrorInvoices('Failed to load invoices');
      toast.error('Failed to load invoices');
    }
  }, [setInvoices]);

  return {
    invoices,
    loadingInvoices,
    errorInvoices,
    fetchInvoices,
    createInvoice,
    updateInvoice,
    softDeleteInvoice,
    bulkSoftDeleteInvoices,
    deleteAllInvoices,
    restoreInvoice,
    permanentDeleteInvoice,
    handleViewInvoice,
    invoiceSortBy,
    invoiceSortDirection,
    handleInvoiceSort,
    selectedInvoices,
    toggleInvoiceSelection,
    selectAllInvoices,
  };
};