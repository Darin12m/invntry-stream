import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Corrected import path for firebase instance

/**
 * Recalculate product stock from all invoices.
 * Stock = initialStock - (sales + writeoffs) + refunds
 */
export async function recalcProductStock(productId: string) {
  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) return;

  const initialStock = Number(productSnap.data().initialStock || 0);
  let totalSold = 0;
  let totalWriteOff = 0;
  let totalRefund = 0;

  const q = query(
    collection(db, "invoices"),
    where("itemsIds", "array-contains", productId)
  );

  const invoicesSnap = await getDocs(q);
  invoicesSnap.forEach((inv) => {
    const data = inv.data();
    const type = data.invoiceType || "sale";
    const item = (data.items || []).find((i: any) => i.productId === productId);
    if (!item) return;

    const qty = Number(item.quantity) || 0;
    if (type === "sale") totalSold += qty;
    else if (type === "writeoff") totalWriteOff += qty;
    else if (type === "refund") totalRefund += qty;
  });

  const finalStock = Math.max(0, initialStock - totalSold - totalWriteOff + totalRefund);
  await updateDoc(productRef, { quantity: finalStock });
}