import React, { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Correct Firebase import path
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Correct toast import

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  purchasePrice?: number;
  shortDescription?: string;
  initialStock?: number;
}

interface InvoiceItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  purchasePrice?: number;
  discount?: number;
}

interface Invoice {
  id: string;
  number: string;
  date: string;
  customer: {
    name: string;
    email: string;
    address: string;
    phone?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  total: number;
  status: string;
  invoiceType?: 'sale' | 'refund' | 'writeoff';
}

interface SellHistoryModalProps {
  product: Product | null;
  onClose: () => void;
  db: any; // Firebase Firestore instance
  toast: typeof toast; // Sonner toast instance
}

const SellHistoryModal: React.FC<SellHistoryModalProps> = ({ product, onClose, db, toast }) => {
  const [history, setHistory] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!product) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "invoices"),
      where("itemsIds", "array-contains", product.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Invoice[];
      setHistory(list);
    }, (error) => {
      console.error("Error fetching sell history:", error);
      toast.error("Failed to load sell history.");
    });

    return () => unsub();
  }, [product, db, toast]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in shadow-glow">
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-center border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Sell History — {product.name}
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-sm">No sales history for this product yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-t border-border">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 px-4 font-medium">Date</th>
                    <th className="py-2 px-4 font-medium">Invoice #</th>
                    <th className="py-2 px-4 font-medium">Type</th>
                    <th className="py-2 px-4 font-medium text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((inv) => {
                    const item = (inv.items || []).find(
                      (i) => i.productId === product.id
                    );
                    return (
                      <tr key={inv.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-4">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-2 px-4">{inv.number || inv.id}</td>
                        <td className="py-2 px-4 capitalize">{inv.invoiceType || "sale"}</td>
                        <td className="py-2 px-4 text-right">{item?.quantity || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SellHistoryModal;