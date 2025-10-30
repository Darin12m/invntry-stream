import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase"; // Adjusted import
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "sonner"; // Adjusted import
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, RotateCcw, Flame } from "lucide-react";
import { Invoice } from "@/components/InventoryManagement"; // Import Invoice interface

export default function SettingsDeletedInvoices() {
  const [deletedInvoices, setDeletedInvoices] = useState<Invoice[]>([]);

  // Load all deleted invoices
  useEffect(() => {
    const q = query(collection(db, "invoices"), where("deleted", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setDeletedInvoices(list);
    });
    return () => unsub();
  }, []);

  // Restore Invoice
  const handleRestoreInvoice = async (invoice: Invoice) => {
    if (!invoice || !invoice.id) return;

    try {
      await updateDoc(doc(db, "invoices", invoice.id), {
        deleted: false,
        restoredAt: serverTimestamp(),
      });

      // Reapply stock
      for (const item of invoice.items || []) {
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
      }

      toast.success("♻️ Invoice restored and stock re-applied.");
    } catch (error) {
      console.error("Error restoring invoice:", error);
      toast.error("Failed to restore invoice.");
    }
  };

  // Delete Forever
  const handleDeleteForever = async (invoice: Invoice) => {
    if (!invoice || !invoice.id) return;

    const confirmDel = window.confirm(
      `⚠️ Permanently delete invoice #${invoice.number || "Unnamed"}?\nThis action cannot be undone.`
    );
    if (!confirmDel) return;

    try {
      await deleteDoc(doc(db, "invoices", invoice.id));
      toast.success("🔥 Invoice permanently deleted.");
    } catch (error) {
      console.error("Error deleting invoice forever:", error);
      toast.error("Failed to permanently delete invoice.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center">
          <Trash2 className="h-7 w-7 mr-3" /> Deleted Invoices
        </h2>
        <p className="text-muted-foreground mt-1">Manage invoices that have been moved to trash.</p>
      </div>

      {deletedInvoices.length === 0 ? (
        <Card className="p-12 text-center">
          <Trash2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-2xl font-bold mb-2">No deleted invoices found.</h3>
          <p className="text-muted-foreground">Active invoices can be deleted from the Invoices tab.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {deletedInvoices.map((inv) => (
            <Card
              key={inv.id}
              className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-card"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">
                  Invoice #{inv.number || "N/A"}{" "}
                  <span className="text-sm text-muted-foreground">
                    • {inv.invoiceType?.toUpperCase() || 'SALE'}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  Customer: {inv.customer?.name || "Unnamed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Deleted: {inv.date ? new Date(inv.date).toLocaleDateString() : "N/A"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => handleRestoreInvoice(inv)}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </Button>
                <Button
                  onClick={() => handleDeleteForever(inv)}
                  variant="destructive"
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Flame className="h-4 w-4 mr-2" />
                  Delete Forever
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}