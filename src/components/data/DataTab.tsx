import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash, Clock, Loader2, BarChart3, Sun, Moon } from 'lucide-react'; // Added Sun, Moon icons
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Product, Invoice } from '../InventoryManagement';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logActivity';
import ActivityLogModal from '../modals/ActivityLogModal';
import { User } from 'firebase/auth';
import SanityCheckModal from '../modals/SanityCheckModal';
import { useTheme } from 'next-themes'; // NEW: Import useTheme

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

// Define SanityCheckResult interface here for use in DataTab's onClose handler
interface SanityCheckResult {
  ok: boolean;
  checked: number;
  mismatched: number;
  issues: Array<{
    productId: string;
    productName: string;
    onHand: number;
    sumOfMovements: number;
    difference: number;
  }>;
  message?: string;
}

function DeletedInvoicesSection({ db, toast, currentUser }: { db: any, toast: any, currentUser: User | null }) {
  const [trashInvoices, setTrashInvoices] = useState<Invoice[]>([]);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isDeletingForever, setIsDeletingForever] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deletedInvoices'), (snap) => {
      setTrashInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)));
    });
    return () => unsub();
  }, [db]);

  const handleRestore = async (invoice: Invoice) => {
    if (!invoice || !currentUser) return;
    setIsRestoring(invoice.id);

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

      toast.success('♻️ Invoice restored and stock adjusted.');
      await logActivity('Restored invoice', invoice.number || invoice.id);
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('❌ Failed to restore invoice.');
    } finally {
      setIsRestoring(null);
    }
  };

  const handleDeleteForever = async (invoice: Invoice) => {
    if (!invoice || !currentUser) return;
    const confirmDel = window.confirm(
      `Permanently delete invoice for ${invoice.customer?.name || 'Unnamed'}? This will NOT affect stock.`
    );
    if (!confirmDel) return;

    setIsDeletingForever(invoice.id);

    try {
      await deleteDoc(doc(db, 'deletedInvoices', invoice.id));
      toast.success('🔥 Invoice permanently deleted (stock unchanged).');
      await logActivity('Deleted invoice permanently', invoice.number || invoice.id);
    } catch (error) {
      console.error('Delete forever error:', error);
      toast.error('❌ Failed to permanently delete invoice.');
    } finally {
      setIsDeletingForever(null);
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
              disabled={isRestoring === inv.id || isDeletingForever === inv.id}
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
              disabled={isRestoring === inv.id || isDeletingForever === inv.id}
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
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showSanityCheckModal, setShowSanityCheckModal] = useState(false);
  const [isSanityCheckRunning, setIsSanityCheckRunning] = useState(false);

  const { theme, setTheme } = useTheme(); // NEW: Get theme and setTheme

  const handleClearAllDataWithLoading = async () => {
    setIsClearingAll(true);
    try {
      await handleClearAllData();
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleRunSanityCheck = () => {
    setShowSanityCheckModal(true);
    setIsSanityCheckRunning(true);
  };

  const handleCloseSanityCheckModal = (result?: SanityCheckResult | null) => {
    setShowSanityCheckModal(false);
    setIsSanityCheckRunning(false);

    if (result) {
      if (result.ok) {
        toast.success('✅ Sanity check completed — all good!');
      } else {
        toast.warning('⚠️ Sanity check completed — review results.');
      }
    } else {
      toast.error('❌ Sanity check closed without result.');
    }
  };

  const toggleTheme = () => { // NEW: Theme toggle function
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Data Management</h2>
          <p className="text-muted-foreground mt-1">Import, export, and manage your data</p>
        </div>
        <div className="flex gap-3">
          {/* NEW: Theme Toggle Button */}
          <Button
            onClick={toggleTheme}
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Dark Mode</span>
              </>
            )}
          </Button>
          <Button
            onClick={handleRunSanityCheck}
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-orange-100 hover:bg-orange-200 transition text-orange-700"
            disabled={isSanityCheckRunning}
          >
            {isSanityCheckRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Check...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">Run Sanity Check</span>
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowActivityLog(true)}
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-100 hover:bg-indigo-200 transition"
          >
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="text-indigo-700 text-sm font-medium">View Activity Log</span>
          </Button>
        </div>
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
              onClick={handleClearAllDataWithLoading}
              variant="destructive"
              className="shadow-elegant"
              disabled={isClearingAll}
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

      {/* Sanity Check Modal */}
      <SanityCheckModal
        showModal={showSanityCheckModal}
        onClose={handleCloseSanityCheckModal}
      />
    </div>
  );
};

export default DataTab;