import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Plus, Eye, Edit, Trash, CheckSquare, Square, ChevronUp, ChevronDown, User as UserIcon, Calendar, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Invoice } from '../InventoryManagement'; // Import Invoice interface
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions

interface InvoicesTabProps {
  invoices: Invoice[];
  selectedInvoices: Set<string>;
  toggleInvoiceSelection: (invoiceId: string) => void;
  selectAllInvoices: () => void;
  handleBulkDeleteInvoices: () => Promise<void>; // Now soft delete
  handleDeleteAllInvoices: () => Promise<void>; // Now soft delete
  handleCreateInvoice: () => void;
  handleViewInvoice: (invoice: Invoice) => void;
  handleEditInvoice: (invoice: Invoice) => void;
  handleDeleteInvoice: (invoice: Invoice) => Promise<void>; // Now soft delete
  invoiceSortBy: 'number' | 'date' | 'customer' | 'total';
  invoiceSortDirection: 'asc' | 'desc';
  handleInvoiceSort: (column: 'number' | 'date' | 'customer' | 'total') => void;
  db: any; // Firebase Firestore instance
  toast: any; // Sonner toast instance
  recalcProductStock: (productId: string) => Promise<void>; // For restoring stock
}

const InvoicesTab: React.FC<InvoicesTabProps> = ({
  invoices,
  selectedInvoices,
  toggleInvoiceSelection,
  selectAllInvoices,
  handleBulkDeleteInvoices,
  handleDeleteAllInvoices,
  handleCreateInvoice,
  handleViewInvoice,
  handleEditInvoice,
  handleDeleteInvoice,
  invoiceSortBy,
  invoiceSortDirection,
  handleInvoiceSort,
  db, // Destructure db
  toast, // Destructure toast
  recalcProductStock, // Destructure recalcProductStock
}) => {
  const [showTrash, setShowTrash] = useState(false);
  const [deletedInvoices, setDeletedInvoices] = useState<Invoice[]>([]);

  // Fetch deleted invoices in real-time
  useEffect(() => {
    const q = query(collection(db, "invoices"), where("deleted", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setDeletedInvoices(list);
    });
    return () => unsub();
  }, [db]); // Add db to dependency array

  // Sort invoices
  const sortedInvoices = [...invoices].sort((a, b) => {
    // First, sort by whether they have invoice numbers
    const aHasNumber = a.number && a.number.trim() !== '';
    const bHasNumber = b.number && b.number.trim() !== '';
    
    if (!aHasNumber && bHasNumber) return -1;
    if (aHasNumber && !bHasNumber) return 1;
    
    let aValue, bValue;
    
    switch (invoiceSortBy) {
      case 'number':
        aValue = a.number || '';
        bValue = b.number || '';
        break;
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'customer':
        aValue = a.customer?.name?.toLowerCase() || '';
        bValue = b.customer?.name?.toLowerCase() || '';
        break;
      case 'total':
        aValue = a.total || 0;
        bValue = b.total || 0;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return invoiceSortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return invoiceSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Restore Logic
  async function handleRestoreInvoice(invoice: Invoice) {
    if (!invoice || !invoice.id) return;

    try {
      await updateDoc(doc(db, "invoices", invoice.id), {
        deleted: false,
        deletedAt: null, // Clear deletedAt timestamp
        restoredAt: serverTimestamp(),
      });

      // Re-apply stock change
      for (const item of invoice.items) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) continue;

        const product = productSnap.data();
        const currentQty = Number(product.quantity || 0);
        const qty = Math.abs(Number(item.quantity) || 0);
        const type = invoice.invoiceType || "sale";

        let newQty = currentQty;
        if (type === "sale" || type === "writeoff") newQty = Math.max(0, currentQty - qty);
        else if (type === "refund") newQty = currentQty + qty;

        await updateDoc(productRef, { quantity: newQty });
        await recalcProductStock(item.productId); // Ensure full recalculation for robustness
      }
      toast.success("♻️ Invoice restored and stock re-applied.");
    } catch (error) {
      console.error('Error restoring invoice:', error);
      toast.error('Failed to restore invoice');
    }
  }

  // Delete Forever Logic
  async function handleDeleteForever(invoice: Invoice) {
    if (!invoice || !invoice.id) return;

    const confirmDel = window.confirm(
      `⚠️ Permanently delete invoice for ${invoice.customer?.name || "Unnamed"}?\nThis action cannot be undone.`
    );
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, "invoices", invoice.id));
      toast.success("🔥 Invoice permanently deleted.");
    } catch (error) {
      console.error('Error permanently deleting invoice:', error);
      toast.error('Failed to permanently delete invoice');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Invoices</h2>
        <div className="flex gap-2 items-center">
          <Button
            variant="destructive"
            onClick={handleDeleteAllInvoices} // This now soft-deletes all active invoices
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Delete All
          </Button>

          <button
            onClick={() => setShowTrash(true)}
            title="View Deleted Invoices"
            className="p-2 rounded-full hover:bg-gray-100 transition"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Sort Controls */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium">Sort by:</span>
          {[
            { key: 'number' as const, label: 'Invoice #' },
            { key: 'date' as const, label: 'Date' },
            { key: 'customer' as const, label: 'Customer' },
            { key: 'total' as const, label: 'Amount' }
          ].map(({ key, label }) => (
            <Button
              key={key}
              onClick={() => handleInvoiceSort(key)}
              variant={invoiceSortBy === key ? 'default' : 'outline'}
              size="sm"
              className="gap-1"
            >
              {label}
              {invoiceSortBy === key && (
                invoiceSortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Invoice Actions */}
      <Card className="p-4 shadow-card">
        <div className="flex gap-2 justify-end">
          <Button
            onClick={selectAllInvoices}
            variant="outline"
            size="sm"
            disabled={invoices.length === 0}
          >
            {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </>
            )}
          </Button>
          {selectedInvoices.size > 0 && (
            <Button
              onClick={handleBulkDeleteInvoices} // This now soft-deletes selected active invoices
              variant="destructive"
              size="sm"
            >
              <Trash className="h-4 w-4 mr-2" />
              Move Selected to Trash ({selectedInvoices.size})
            </Button>
          )}
          <Button
            onClick={handleCreateInvoice}
            className="bg-success hover:shadow-glow transition-all duration-300"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </Card>

      {/* Invoice History */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Invoice History</h3>
        </div>
        <div className="p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No invoices created yet</h3>
              <p className="text-muted-foreground mb-4">Create your first invoice to get started</p>
              <Button onClick={handleCreateInvoice}>
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedInvoices.map(invoice => (
                <Card key={invoice.id} className="p-6 hover:shadow-elegant transition-all duration-300 bg-card border-border">
                  <div className="flex items-start gap-3 mb-4">
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg truncate">{invoice.number || 'No Number'}</h4>
                        {/* NEW: Invoice Type Badge */}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.invoiceType === 'refund'
                              ? 'bg-red-100 text-red-700'
                              : invoice.invoiceType === 'writeoff'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {invoice.invoiceType === 'refund'
                            ? 'Refund'
                            : invoice.invoiceType === 'writeoff'
                            ? 'Write-off'
                            : 'Sale'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">{invoice.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{new Date(invoice.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold text-primary">{invoice.total.toFixed(2)} ден.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t">
                    <Button
                      onClick={() => handleViewInvoice(invoice)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      onClick={() => handleEditInvoice(invoice)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDeleteInvoice(invoice)} // Now soft delete
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showTrash && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[90%] max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">🗑️ Deleted Invoices</h3>
              <button
                onClick={() => setShowTrash(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {deletedInvoices.length === 0 && (
                <p className="text-gray-500 text-center">No deleted invoices.</p>
              )}

              {deletedInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between items-center border p-3 rounded-md"
                >
                  <div>
                    <p className="font-semibold">
                      {inv.customer?.name || "Unnamed"}{" "}
                      <span className="text-xs text-gray-500">
                        • {inv.invoiceType?.toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {inv.deletedAt?.seconds
                        ? new Date(inv.deletedAt.seconds * 1000).toLocaleDateString()
                        : inv.createdAt?.seconds
                        ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString()
                        : ""}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRestoreInvoice(inv)}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      ♻️ Restore
                    </button>
                    <button
                      onClick={() => handleDeleteForever(inv)}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      🔥 Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesTab;