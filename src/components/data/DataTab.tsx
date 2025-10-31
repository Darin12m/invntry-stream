import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash, Clock } from 'lucide-react'; // Added Clock icon
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Import Timestamp
import { Product, Invoice } from '../InventoryManagement'; // Import Product and Invoice interfaces
import { toast } from "sonner"; // Correct import for sonner toast
import { recalcProductStock } from '@/utils/recalcStock'; // Import the new stock controller
import { logActivity } from '@/utils/logActivity'; // NEW: Import logActivity
import ActivityLogModal from '../modals/ActivityLogModal'; // NEW: Import ActivityLogModal

interface DataTabProps {
  products: Product[];
  invoices: Invoice[];
  handleClearAllData: () => Promise<void>;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  exportToCSV: (data: any[], filename: string) => void;
  exportToJSON: (data: any[], filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  db: any; // NEW PROP
  toast: any; // Changed from typeof toast to any to resolve circular reference
}

// Helper component for deleted invoices
function DeletedInvoicesSection({ db, toast }: { db: any, toast: any }) { // Accept db and toast as props
  const [trashInvoices, setTrashInvoices] = useState<Invoice[]>([]); // Use Invoice interface

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "deletedInvoices"), (snap) => {
      setTrashInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice))); // Cast to Invoice
    });
    return () => unsub();
  }, [db]); // Add db to dependency array

  const handleRestore = async (invoice: Invoice) => {
    if (!invoice) return;

    try {
      // 1️⃣ Restore invoice to main collection
      await setDoc(doc(db, "invoices", invoice.id), {
        ...invoice,
        restoredAt: serverTimestamp(),
      });

      // 2️⃣ Adjust stock again (reapply original effect)
      for (const item of invoice.items || []) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) continue;

        const product = productSnap.data();
        const currentQty = Number(product.quantity || 0);
        const qty = Number(item.quantity) || 0;
        const type = invoice.invoiceType || "sale";

        let newQty = currentQty;
        if (type === "sale" || type === "writeoff") {
          // Reduce stock again
          newQty = Math.max(0, currentQty - qty);
        } else if (type === "refund") {
          // Refund increases stock again
          newQty = currentQty + qty;
        }

        await updateDoc(productRef, { quantity: newQty });
      }

      // 3️⃣ Remove from deletedInvoices
      await deleteDoc(doc(db, "deletedInvoices", invoice.id));

      toast.success("♻️ Invoice restored and stock adjusted.");
      await logActivity("Restored invoice", invoice.number || invoice.id); // Log activity
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("❌ Failed to restore invoice.");
    }
  };

  const handleDeleteForever = async (invoice: Invoice) => {
    if (!invoice) return;
    const confirmDel = window.confirm(
      `Permanently delete invoice for ${invoice.customer?.name || "Unnamed"}?`
    );
    if (!confirmDel) return;

    await deleteDoc(doc(db, "deletedInvoices", invoice.id));
    toast.success("🔥 Invoice permanently deleted (stock unchanged).");
    await logActivity("Deleted invoice permanently", invoice.number || invoice.id); // Log activity
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">Data Management</h2>
          <p className="text-muted-foreground mt-1">Import, export, and manage your data</p>
        </div>
        {/* NEW: Activity Log Button */}
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

      {/* 🗑️ Trash (Deleted Invoices) Section */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Trash className="h-5 w-5" /> <span>Trash (Deleted Invoices)</span>
        </h2>

        <DeletedInvoicesSection db={db} toast={toast} />
      </div>

      {/* Activity Log Modal */}
      {showActivityLog && (
        <ActivityLogModal onClose={() => setShowActivityLog(false)} />
      )}
    </div>
  );
}

export default DataTab;