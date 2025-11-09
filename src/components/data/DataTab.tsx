import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash, Clock, Loader2 } from 'lucide-react'; // Added Loader2 icon
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Product, Invoice } from '../InventoryManagement';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logActivity';
import ActivityLogModal from '../modals/ActivityLogModal';
import { User } from 'firebase/auth';

interface DataTabProps {
  products: Product[];
  invoices: Invoice[];
  handleClearAllData: () => Promise<void>;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  exportToJSON: (data: any[], filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  db: any;
  toast: any;
  currentUser: User | null;
}

function DeletedInvoicesSection({ db, toast, currentUser }: { db: any, toast: any, currentUser: User | null }) {
  const [trashInvoices, setTrashInvoices] = useState<Invoice[]>([]);
  const [isRestoring, setIsRestoring] = useState<string | null>(null); // NEW: State for restoring specific invoice
  const [isDeletingForever, setIsDeletingForever] = useState<string | null>(null); // NEW: State for deleting forever specific invoice

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deletedInvoices'), (snap) => {
      setTrashInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)));
    });
    return () => unsub();
  }, [db]);

  const handleRestore = async (invoice: Invoice) => {
    if (!invoice || !currentUser) return;
    setIsRestoring(invoice.id); // NEW: Set restoring state

    try {
      const response = await fetch('/.netlify/functions/apply-invoice-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          action: 'restore',
          newItems: invoice.items.map(item => ({ productId: item.productId, quantity: item.quantity, sku: item.sku })),
          idempotencyKey: `${invoice.id}:restore:${Date.now()}`,
          userId: currentUser.uid,
          reason: `Invoice ${invoice.number || invoice.id} restored.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply stock changes via Netlify function.');
      }

      await setDoc(doc(db, 'invoices', invoice.id), {
        ...invoice,
        restoredAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, 'deletedInvoices', invoice.id));

      toast.success('♻️ Invoice restored and stock adjusted.'); // NEW: Success toast
      await logActivity('Restored invoice', invoice.number || invoice.id);
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('❌ Failed to restore invoice.'); // NEW: Error toast
    } finally {
      setIsRestoring(null); // NEW: Reset restoring state
    }
  };

  const handleDeleteForever = async (invoice: Invoice) => {
    if (!invoice || !currentUser) return;
    const confirmDel = window.confirm(
      `Permanently delete invoice for ${invoice.customer?.name || 'Unnamed'}? This will NOT affect stock.`
    );
    if (!confirmDel) return;

    setIsDeletingForever(invoice.id); // NEW: Set deleting state

    try {
      await deleteDoc(doc(db, 'deletedInvoices', invoice.id));
      toast.success('🔥 Invoice permanently deleted (stock unchanged).'); // NEW: Success toast
      await logActivity('Deleted invoice permanently', invoice.number || invoice.id);
    } catch (error) {
      console.error('Delete forever error:', error);
      toast.error('❌ Failed to permanently delete invoice.'); // NEW: Error toast
    } finally {
      setIsDeletingForever(null); // NEW: Reset deleting state
    }
  };

  return (
    <div className="space-y-3">
      {trashInvoices.length === 0 && (
        <p className="text-muted-foreground text-sm">No deleted invoices.</p>
      )}
      {trashInvoices.map((inv) => (
        <Card
          key={inv.id}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-lg shadow-card gap-2 sm:gap-4"
        >
          <div>
            <p className="font-semibold">{inv.customer?.name || 'Unnamed'}</p>
            <p className="text-xs text-muted-foreground">
              Deleted:{' '}
              {inv.deletedAt?.seconds
                ? new Date(inv.deletedAt.seconds * 1000).toLocaleDateString()
                : 'Unknown Date'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleRestore(inv)}
              variant="outline"
              size="sm"
              disabled={isRestoring === inv.id || isDeletingForever === inv.id} // NEW: Disable while processing
            >
              {isRestoring === inv.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                '♻️ Restore'
              )}
            </Button>
            <Button
              onClick={() => handleDeleteForever(inv)}
              variant="destructive"
              size="sm"
              disabled={isRestoring === inv.id || isDeletingForever === inv.id} // NEW: Disable while processing
            >
              {isDeletingForever === inv.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                '🔥 Delete Forever'
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

const DataTab: React.FC<DataTabProps> = ({
  products,
  invoices,
  handleClearAllData,
  handleImportExcel,
  exportToCSV,
  exportToJSON,
  fileInputRef,
  db,
  toast,
  currentUser,
}) => {
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false); // NEW: State for clearing all data

  const handleClearAllDataWithLoading = async () => {
    setIsClearingAll(true); // NEW: Set loading state
    try {
      await handleClearAllData();
    } finally {
      setIsClearingAll(false); // NEW: Reset loading state
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Data Management</h2>
          <p className="text-muted-foreground mt-1">Import, export, and manage your data</p>
        </div>
        <Button
          onClick={() => setShowActivityLog(true)}
          variant="outline"
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-100 hover:bg-indigo-200 transition"
        >
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="text-indigo-700 text-sm font-medium">View Activity Log</span>
        </Button>
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive/20 shadow-card">
        <div className="p-6 border-b border-destructive/20">
          <h3 className="text-lg font-semibold text-destructive flex items-center">
            <Trash className="h-5 w-5 mr-2" />
            Danger Zone
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-destructive/5 p-4 rounded-lg">
            <h4 className="font-semibold text-destructive mb-2">Clear All Data</h4>
            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete all products and invoices. This action cannot be undone.
            </p>
            <Button
              onClick={handleClearAllDataWithLoading} // NEW: Use loading wrapper
              variant="destructive"
              className="shadow-elegant"
              disabled={isClearingAll} // NEW: Disable while clearing
            >
              {isClearingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Clear All Data
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Import Section */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Import Data</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-base font-medium">
              Import Products from Excel (.xlsx/.xls)
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload an Excel file with columns: name, sku, quantity, price, category
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="shadow-elegant"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Excel File
            </Button>
          </div>
        </div>
      </Card>

      {/* Export Section */}
      <Card className="shadow-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Export Data</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Inventory Exports</h4>
              <div className="space-y-3">
                <Button
                  onClick={() => exportToCSV(products, 'inventory-backup.csv')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Inventory (CSV)
                </Button>
                <Button
                  onClick={() => exportToJSON(products, 'inventory-backup.json')}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={products.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Inventory (JSON)
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium">Invoice Exports</h4>
            <div className="space-y-3">
              <Button
                onClick={() => exportToCSV(invoices, 'invoice-log.csv')}
                variant="outline"
                className="w-full justify-start"
                disabled={invoices.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Invoice Log (CSV)
              </Button>
              <Button
                onClick={() => exportToJSON(invoices, 'invoice-log.json')}
                variant="outline"
                className="w-full justify-start"
                disabled={invoices.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Invoice Log (JSON)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>

      {/* 🗑️ Trash (Deleted Invoices) Section */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Trash className="h-5 w-5" /> <span>Trash (Deleted Invoices)</span>
        </h2>

        <DeletedInvoicesSection db={db} toast={toast} currentUser={currentUser} />
      </div>

      {/* Activity Log Modal */}
      {showActivityLog && (
        <ActivityLogModal onClose={() => setShowActivityLog(false)} />
      )}
    </div>
  );
};

export default DataTab;