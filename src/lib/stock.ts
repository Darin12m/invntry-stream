import { getFunctions, httpsCallable } from "firebase/functions";
import app from "@/lib/firebase"; // Assuming firebase.ts exports the initialized app
import { toast } from "sonner";

const functions = getFunctions(app);
const applyInvoiceStockCallable = httpsCallable(functions, "applyInvoiceStockCallable");

interface InvoiceItemForStock {
  productId: string;
  quantity: number;
  sku: string;
}

export async function applyInvoiceStock(
  action: "create" | "edit" | "delete" | "restore",
  invoiceId: string,
  items: InvoiceItemForStock[],
  userId: string
) {
  const idempotencyKey = `${invoiceId}-${action}-${Date.now()}`; // Simple idempotency key

  try {
    await applyInvoiceStockCallable({
      invoiceId,
      action,
      newItems: items,
      idempotencyKey,
      userId,
    });
    console.log(`Stock updated via Cloud Function for invoice ${invoiceId}, action: ${action}`);
  } catch (error: any) {
    console.error("Error calling applyInvoiceStock Cloud Function:", error);
    toast.error(`Failed to update stock via Cloud Function: ${error.message}`);
    throw error; // Re-throw to allow calling component to handle
  }
}