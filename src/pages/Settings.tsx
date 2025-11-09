import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Download,
  Trash,
  Clock,
  Loader2,
  BarChart3,
  Sun,
  Moon,
  Settings as SettingsIcon,
  RefreshCw,
  FileText,
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { Product, Invoice } from '@/components/InventoryManagement'; // Re-using interfaces
import { toast } from 'sonner';
import { logActivity } from '@/utils/logActivity';
import ActivityLogModal from '@/components/modals/ActivityLogModal';
import { User } from 'firebase/auth';
import SanityCheckModal from '@/components/modals/SanityCheckModal';
import { useTheme } from 'next-themes';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import ColumnMappingModal from '@/components/modals/ColumnMappingModal'; // Import ColumnMappingModal

// Define SanityCheckResult interface here for use in Settings's onClose handler
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

interface SettingsProps {
  products: Product[];
  invoices: Invoice[];
  currentUser: User | null;
}

// Moved DeletedInvoicesSection here from DataTab
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

const Settings: React.FC<SettingsProps> = ({ products, invoices, currentUser }) => {
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showSanityCheckModal, setShowSanityCheckModal] = useState(false);
  const [isSanityCheckRunning, setIsSanityCheckRunning] = useState(false);
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    sku: '',
    quantity: '',
    price: '',
    category: '',
    purchasePrice: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleRefreshData = () => {
    toast.info('Refreshing data... (This is a dummy function for now)');
    // In a real app, you might re-fetch data or trigger a state update
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

  const handleImportProductsExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error('Excel file is empty');
          return;
        }

        const columns = Object.keys(jsonData[0]);

        setExcelData(jsonData);
        setExcelColumns(columns);
        setColumnMapping({
          name: '',
          sku: '',
          quantity: '',
          price: '',
          category: '',
          purchasePrice: '',
        });
        setShowColumnMappingModal(true);
      } catch (error) {
        toast.error('❌ Error reading Excel file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportInvoices = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const importedInvoices = XLSX.utils.sheet_to_json(sheet);

      for (const inv of importedInvoices) {
        await addDoc(collection(db, 'invoices'), {
          invoiceId: inv.invoiceId,
          number: inv.number || inv.invoiceId, // Use number if available, fallback to invoiceId
          customer: {
            name: inv.customerName || inv.client || 'Unknown Customer',
            email: inv.customerEmail || '',
            address: inv.customerAddress || '',
            phone: inv.customerPhone || '',
          },
          date: inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          invoiceType: inv.type || 'sale',
          items: inv.items ? JSON.parse(inv.items) : [], // Assuming items are stringified JSON
          subtotal: inv.subtotal || 0,
          discount: inv.discount || 0,
          discountPercentage: inv.discountPercentage || 0,
          total: inv.total || 0,
          status: inv.status || 'active',
          createdAt: serverTimestamp(),
        });
      }
      toast.success('✅ Invoices imported successfully!');
      await logActivity('Imported invoices', 'Multiple', `${importedInvoices.length} invoices`);
    } catch (error) {
      console.error('Error importing invoices:', error);
      toast.error('❌ Failed to import invoices. Check file format and data.');
    } finally {
      if (invoiceFileInputRef.current) {
        invoiceFileInputRef.current.value = ''; // Clear the input
      }
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error(`No data to export for ${filename}`);
      return;
    }
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(value => {
        // Handle nested objects/arrays for invoices
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value).replace(/"/g, '""'); // Escape double quotes for CSV
        }
        return String(value).replace(/"/g, '""'); // Escape double quotes for CSV
      }).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`✅ ${filename} exported successfully`);
    logActivity('Exported data', filename, 'CSV format');
  };

  const exportToJSON = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error(`No data to export for ${filename}`);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`✅ ${filename} exported successfully`);
    logActivity('Exported data', filename, 'JSON format');
  };

  const handleClearAllData = async () => {
    if (!currentUser) {
      toast.error('User not authenticated.');
      return;
    }

    const confirmClear = window.confirm(
      '⚠️ WARNING: This will delete ALL products and invoices permanently. This action cannot be undone. Are you absolutely sure?'
    );
    if (!confirmClear) return;

    setIsClearingAll(true);
    try {
      const collectionsToClear = ['products', 'invoices', 'deletedInvoices', 'activityLogs', 'invoices_server_copies'];
      let totalDeletedCount = 0;

      for (const colName of collectionsToClear) {
        const q = query(collection(db, colName));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        totalDeletedCount += snap.docs.length;
      }

      toast.success(`✅ All data (${totalDeletedCount} items) cleared successfully!`);
      await logActivity('Cleared all data', 'All Products, Invoices, Logs, and Server Copies');
    } catch (error) {
      console.error('Error clearing all data:', error);
      toast.error('❌ Failed to clear all data');
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center gap-2">
            <SettingsIcon className="h-7 w-7 text-primary" /> Settings
          </h2>
          <p className="text-muted-foreground mt-1">Manage appearance, data, and system actions.</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={toggleTheme}
            variant="outline"
            className="flex items-center gap-2 px-3 py-2 rounded-md transition"
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
          {/* Removed the "Run Sanity Check" button from here */}
          {/* Removed the "View Activity Log" button from here */}
        </div>
      </div>

      {/* Section: General */}
      <Card className="p-6 shadow-card rounded-lg">
        <h3 className="text-xl font-bold text-purple-600 mb-4">General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-toggle" className="text-base">
                App Theme
              </Label>
              {/* Removed the duplicate theme toggle button here */}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-base">App Version</Label>
              <span className="text-muted-foreground text-sm">1.0.0</span>
            </div>
          </div>
          <div className="space-y-4">
            <Label className="text-base">Data Refresh</Label>
            <Button onClick={handleRefreshData} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh All Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Section: Data Management */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-purple-600 mt-8 mb-4">Data Management</h3>
        <p className="text-muted-foreground mt-1">Import, export, and manage your data.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import Data Card */}
          <Card className="p-6 shadow-card rounded-lg">
            <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Import Data
            </h4>
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Import Products from Excel</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel file (.xlsx/.xls) with columns: name, sku, quantity, price, category, purchasePrice.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportProductsExcel}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-primary shadow-elegant w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Product Excel File
                </Button>
              </div>

              <div>
                <Label className="text-base font-medium">Import Invoices</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload an Excel (.xlsx) or JSON file with invoice data.
                </p>
                <input
                  ref={invoiceFileInputRef}
                  type="file"
                  accept=".xlsx,.json"
                  onChange={handleImportInvoices}
                  className="hidden"
                />
                <Button
                  onClick={() => invoiceFileInputRef.current?.click()}
                  className="bg-gradient-primary shadow-elegant w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Invoice File
                </Button>
              </div>
            </div>
          </Card>

          {/* Export Data Card */}
          <Card className="p-6 shadow-card rounded-lg">
            <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" /> Export Data
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h5 className="font-medium text-sm text-muted-foreground">Inventory Exports</h5>
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
              <div className="space-y-3">
                <h5 className="font-medium text-sm text-muted-foreground">Invoice Exports</h5>
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
          </Card>
        </div>
      </div>

      {/* Section: Tools */}
      <Card className="p-6 shadow-card rounded-lg">
        <h3 className="text-xl font-bold text-purple-600 mb-4">Tools</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={handleRunSanityCheck}
            variant="outline"
            className="flex-1"
            disabled={isSanityCheckRunning}
          >
            {isSanityCheckRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Check...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2 text-orange-600" />
                Run Stock Sanity Check
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowActivityLog(true)}
            variant="outline"
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2 text-indigo-600" />
            View Activity Log
          </Button>
          <Button variant="outline" className="flex-1" disabled>
            <RefreshCw className="h-4 w-4 mr-2" /> Recalculate Stock (Future)
          </Button>
        </div>
      </Card>

      {/* Section: Danger Zone */}
      <Card className="border-destructive/20 shadow-card rounded-lg bg-destructive/5">
        <div className="p-6 border-b border-destructive/20">
          <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Irreversible destructive actions.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/30">
            <h4 className="font-semibold text-destructive mb-2">Clear All Data</h4>
            <p className="text-sm text-destructive-foreground/80 mb-4">
              This will permanently delete all products, invoices, deleted invoices, activity logs, and server copies. This action cannot be undone.
            </p>
            <Button
              onClick={handleClearAllData}
              variant="destructive"
              className="shadow-elegant w-full sm:w-auto"
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

      {/* Trash (Deleted Invoices) Section */}
      <div className="mt-10">
        <h3 className="text-xl font-bold text-purple-600 mb-4 flex items-center gap-2">
          <Trash className="h-5 w-5" /> Trash (Deleted Invoices)
        </h3>
        <DeletedInvoicesSection db={db} toast={toast} currentUser={currentUser} />
      </div>

      {/* Modals */}
      {showActivityLog && (
        <ActivityLogModal onClose={() => setShowActivityLog(false)} />
      )}

      <SanityCheckModal
        showModal={showSanityCheckModal}
        onClose={handleCloseSanityCheckModal}
      />

      <ColumnMappingModal
        showColumnMappingModal={showColumnMappingModal}
        setShowColumnMappingModal={setShowColumnMappingModal}
        excelData={excelData}
        excelColumns={excelColumns}
        columnMapping={columnMapping}
        setColumnMapping={setColumnMapping}
        db={db}
        toast={toast}
      />
    </div>
  );
};

export default Settings;