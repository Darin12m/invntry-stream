import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Product, Invoice } from '../InventoryManagement'; // Import Product and Invoice interfaces
import { toast } from "sonner"; // Correct import for sonner toast
import { recalcProductStock } from '@/utils/recalcStock'; // Import the new stock controller

interface DataTabProps {
  products: Product[];
  invoices: Invoice[];
  handleClearAllData: () => Promise<void>;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  exportToJSON: (data: any[], filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  db: any; // NEW PROP
  toast: typeof toast; // NEW PROP
}

// Helper component for deleted invoices
function DeletedInvoicesSection({ db, toast }: { db: any, toast: typeof toast }) { // Accept db and toast as props
  const [trashInvoices, setTrashInvoices] = useState<Invoice[]>([]); // Use Invoice interface

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deletedInvoices"), (snap) => {
      setTrashInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice))); // Cast to Invoice
    });
    return () => unsub();
  }, [db]); // Add db to dependency array

  const handleRestore = async (invoice: Invoice) => { // Use Invoice interface
    if (!invoice) return;
    try {
      await setDoc(doc(db, "invoices", invoice.id), {
        ...invoice,
        deleted: false,
        restoredAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "deletedInvoices", invoice.id));

      // Recalculate stock for all items in the restored invoice
      for (const item of invoice.items || []) {
        await recalcProductStock(item.productId);
      }

      toast.success("♻️ Invoice restored successfully.");
    } catch (error) {
      console.error("Error restoring invoice:", error);
      toast.error("Failed to restore invoice.");
    }
  };

  const handleDeleteForever = async (invoice: Invoice) => { // Use Invoice interface
    if (!invoice) return;
    const confirmDel = window.confirm(
      `⚠️ Permanently delete invoice for ${invoice.customer?.name || "Unnamed"}?` // Use invoice.customer.name
    );
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, "deletedInvoices", invoice.id));
      toast.success("🔥 Invoice permanently deleted.");
    } catch (error) {
      console.error("Error deleting invoice forever:", error);
      toast.error("Failed to permanently delete invoice.");
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
          className="flex justify-between items-center p-3 rounded-lg shadow-card"
        >
          <div>
            <p className="font-semibold">{inv.customer?.name || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">
              {inv.deletedAt?.seconds
                ? new Date(inv.deletedAt.seconds * 1000).toLocaleDateString()
                : "Unknown Date"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleRestore(inv)}
              variant="outline"
              size="sm"
            >
              ♻️ Restore
            </Button>
            <Button
              onClick={() => handleDeleteForever(inv)}
              variant="destructive"
              size="sm"
            >
              🔥 Delete Forever
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
  db, // Accept db prop
  toast, // Accept toast prop
}) => (
  <div className="space-y-6 animate-fade-in">
    {/* Header */}
    <div>
      <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Data Management</h2>
      <p className="text-muted-foreground mt-1">Import, export, and manage your data</p>
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
            onClick={handleClearAllData}
            variant="destructive"
            className="shadow-elegant"
          >
            <Trash className="h-4 w-4 mr-2" />
            Clear All Data
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

    {/* 🗑️ Deleted Invoices Section */}
    <div className="mt-10">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        <Trash className="h-5 w-5" /> <span>Trash (Deleted Invoices)</span>
      </h2>

      <DeletedInvoicesSection db={db} toast={toast} />
    </div>
  </div>
);

export default DataTab;