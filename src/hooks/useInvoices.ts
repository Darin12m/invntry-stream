import { useState, useEffect, useCallback, useContext } from 'react';
import { Invoice, Product, SortDirection } from '@/types';
import { invoiceService } from '@/services/firestore/invoiceService';
import { toast } from 'sonner';
import { AppContext } from '@/context/AppContext';
import { activityLogService } from '@/services/firestore/activityLogService';
import { db } from '@/firebase/config'; // Import db
import { doc, writeBatch } from 'firebase/firestore'; // Import doc and writeBatch

export const useInvoices = () => {
  const { invoices, setInvoices, products, currentUser, setLoading, setError } = useContext(AppContext);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [errorInvoices, setErrorInvoices] = useState<string | null>(null);
  const [invoiceSortBy, setInvoiceSortBy] = useState<'number' | 'date' | 'customer' | 'total' | 'invoiceType'>('number');
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<SortDirection>('asc');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    setErrorInvoices(null);
    try {
      const invoicesList = await invoiceService.list();
      setInvoices(invoicesList);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      setErrorInvoices('Failed to load invoices');
      setError('Failed to load invoices');
      toast.error('Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  }, [setInvoices, setError]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const createInvoice = useCallback(async (invoice: Omit<Invoice, 'id'>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await invoiceService.create(invoice, userEmail, userId);
      toast.success('Invoice created successfully!');
      await fetchInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast.error(`Failed to create invoice: ${error.message}`);
      setError(`Failed to create invoice: ${error.message}`);
      throw error;
    }
  }, [currentUser, fetchInvoices, setError]);

  const updateInvoice = useCallback(async (id: string, invoice: Partial<Invoice>) => {
    try {
      const userEmail = currentUser?.email || 'Unknown User';
      const userId = currentUser?.uid || null;
      await invoiceService.update(id, invoice, userEmail, userId);
      toast.success('Invoice updated successfully!');
      await fetchInvoices();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      toast.error(`Failed to update invoice: ${error.message}`);
      setError(`Failed to update invoice: ${error.message}`);
      throw error;
    }
  }, [currentUser, fetchInvoices, setError]);

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
        await fetchInvoices();
        // No need to fetch products here, as the context will handle it if product updates are observed.
      } catch (error: any) {
        console.error('Error soft deleting invoice:', error);
        toast.error(`Failed to move invoice to trash: ${error.message}`);
        setError(`Failed to move invoice to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, fetchInvoices, setError]);

  const bulkSoftDeleteInvoices = useCallback(async (invoiceIds: Set<string>) => {
    if (invoiceIds.size === 0) {
      toast.error("Please select invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to move ${invoiceIds.size} selected invoice(s) to trash? This will also revert their stock changes.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db); // Corrected: use writeBatch
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
            const productRef = doc(db, 'products', item.productId); // Corrected: import doc
            const product = products.find(p => p.id === item.productId);
            if (!product) {
              throw new Error(`Product ${item.name} (ID: ${item.productId}) not found. Cannot revert stock for bulk delete.`);
            }

            let newOnHand = product.onHand;
            if (invoiceToDelete.invoiceType === 'sale' || invoiceToDelete.invoiceType === 'gifted-damaged') {
              newOnHand += item.quantity;
            } else if (invoiceToDelete.invoiceType === 'return') {
              newOnHand -= item.quantity;
            }

            if (newOnHand < 0 && (invoiceToDelete.invoiceType === 'sale' || invoiceToDelete.invoiceType === 'gifted-damaged')) {
              throw new Error(`Cannot bulk delete invoice ${invoiceToDelete.number}: Reverting stock would cause negative stock for product "${item.name}".`);
            }
            batch.update(productRef, { onHand: newOnHand });
          }
          batch.update(doc(db, 'invoices', invoiceId), { deletedAt: new Date() }); // Use new Date() for consistency // Corrected: import doc
          successCount++;
        }
        await batch.commit();
        setSelectedInvoices(new Set());
        toast.success(`${successCount} invoices moved to trash and stock reverted.`);
        await activityLogService.logAction(`Bulk invoices moved to trash by ${userEmail}`, userId, userEmail);
        await fetchInvoices();
      } catch (error: any) {
        console.error('Error bulk soft deleting invoices:', error);
        toast.error(`Failed to move invoices to trash: ${error.message}`);
        setError(`Failed to move invoices to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, fetchInvoices, setError]);

  const deleteAllInvoices = useCallback(async () => {
    if (invoices.length === 0) {
      toast.error("No invoices to delete");
      return;
    }
    
    if (window.confirm(`Are you sure you want to move ALL ${invoices.length} invoices to trash? This will also revert their stock changes. This action cannot be undone.`)) {
      try {
        const userEmail = currentUser?.email || 'Unknown User';
        const userId = currentUser?.uid || null;
        const batch = writeBatch(db); // Corrected: use writeBatch
        let successCount = 0;

        for (const invoice of invoices) {
          if (invoice.deletedAt) {
            console.warn(`Invoice ${invoice.id} is already in trash, skipping for delete all.`);
            continue;
          }
          // Revert stock changes based on invoice type
          for (const item of invoice.items) {
            const productRef = doc(db, 'products', item.productId); // Corrected: import doc
            const product = products.find(p => p.id === item.productId);
            if (!product) {
              throw new Error(`Product ${item.name} (ID: ${item.productId}) not found. Cannot revert stock for delete all.`);
            }

            let newOnHand = product.onHand;
            if (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged') {
              newOnHand += item.quantity;
            } else if (invoice.invoiceType === 'return') {
              newOnHand -= item.quantity;
            }

            if (newOnHand < 0 && (invoice.invoiceType === 'sale' || invoice.invoiceType === 'gifted-damaged')) {
              throw new Error(`Cannot delete all invoices: Reverting stock would cause negative stock for product "${item.name}" from invoice ${invoice.number}.`);
            }
            batch.update(productRef, { onHand: newOnHand });
          }
          batch.update(doc(db, 'invoices', invoice.id), { deletedAt: new Date() }); // Use new Date() for consistency // Corrected: import doc
          successCount++;
        }
        await batch.commit();
        setSelectedInvoices(new Set());
        toast.success(`${successCount} invoices moved to trash and stock reverted.`);
        await activityLogService.logAction(`All invoices moved to trash by ${userEmail}`, userId, userEmail);
        await fetchInvoices();
      } catch (error: any) {
        console.error('Error soft deleting all invoices:', error);
        toast.error(`Failed to move all invoices to trash: ${error.message}`);
        setError(`Failed to move all invoices to trash: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, fetchInvoices, setError]);

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
        await fetchInvoices();
      } catch (error: any) {
        console.error('Error restoring invoice:', error);
        toast.error(`Failed to restore invoice: ${error.message}`);
        setError(`Failed to restore invoice: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, fetchInvoices, setError]);

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
        await fetchInvoices();
      } catch (error: any) {
        console.error('Error permanently deleting invoice or restoring stock:', error);
        toast.error(`Failed to permanently delete invoice: ${error.message}`);
        setError(`Failed to permanently delete invoice: ${error.message}`);
      }
    }
  }, [invoices, products, currentUser, fetchInvoices, setError]);

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

  // Define handleViewInvoice here to be returned by the hook
  const handleViewInvoice = useCallback((invoice: Invoice) => {
    // This function is passed down to components that need to view an invoice
    // It's defined here to be part of the useInvoices hook's public API
    // and can be used by components like DashboardTab or InvoicesTab
    // For now, it just logs, but in a real app, it would trigger a modal or navigation.
    console.log('Viewing invoice:', invoice.number);
    // In a real scenario, you'd likely have a state setter here to open a viewer modal
    // e.g., setShowInvoiceViewer(true); setViewingInvoice(invoice);
  }, []);

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
    handleViewInvoice, // Export handleViewInvoice
    invoiceSortBy,
    invoiceSortDirection,
    handleInvoiceSort,
    selectedInvoices,
    toggleInvoiceSelection,
    selectAllInvoices,
  };
};