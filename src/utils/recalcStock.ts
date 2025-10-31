import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

/**
 * Calculates stock based on all invoices referencing a product.
 * Formula: stock = initialStock - totalSales - totalWriteOff + totalRefund
 */
export async function recalcProductStock(productId: string) {
  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);
  if (!productSnap.exists()) return;

  const data = productSnap.data();
  const initialStock = Number(data.initialStock ?? data.quantity ?? 0);

  let totalSales = 0;
  let totalWriteOff = 0;
  let totalRefund = 0;

  const invoicesSnap = await getDocs(
    query(collection(db, "invoices"), where("itemsIds", "array-contains", productId))
  );

  invoicesSnap.forEach((docSnap) => {
    const inv = docSnap.data();
    const type = inv.invoiceType || "sale";
    const item = (inv.items || []).find((i: any) => i.productId === productId);
    if (!item) return;
    const qty = Number(item.quantity) || 0;
    if (type === "sale") totalSales += qty;
    else if (type === "writeoff") totalWriteOff += qty;
    else if (type === "refund") totalRefund += qty;
  });

  const finalStock = Math.max(0, initialStock - totalSales - totalWriteOff + totalRefund);
  await updateDoc(productRef, { quantity: finalStock });
}