import * as admin from "firebase-admin";

const db = admin.firestore();

interface InvoiceItem {
  productId: string;
  quantity: number;
  sku: string;
}

interface InvoiceServerCopy {
  invoiceId: string;
  items: InvoiceItem[];
  updatedAt: admin.firestore.FieldValue;
  status: 'active' | 'deleted';
}

interface StockMovement {
  productId: string;
  sku: string;
  qtyDelta: number;
  locationId: string;
  type: 'invoice_create' | 'invoice_edit' | 'invoice_delete' | 'invoice_restore';
  docId: string;
  docLineId: string;
  idempotencyKey: string;
  userId: string;
  reason: string;
  ts_utc: admin.firestore.FieldValue;
}

export async function applyInvoiceStock(
  invoiceId: string,
  action: "create" | "edit" | "delete" | "restore",
  newItems: InvoiceItem[],
  idempotencyKey: string,
  userId: string
) {
  return db.runTransaction(async (transaction) => {
    const invoiceServerCopyRef = db.collection("invoices_server_copies").doc(invoiceId);
    const invoiceServerCopySnap = await transaction.get(invoiceServerCopyRef);

    const oldItems: InvoiceItem[] = invoiceServerCopySnap.exists
      ? (invoiceServerCopySnap.data() as InvoiceServerCopy).items
      : [];

    const stockMovements: StockMovement[] = [];
    const productUpdates: { [productId: string]: number } = {}; // productId -> delta

    // Helper to add a movement and update product delta
    const addMovement = (
      productId: string,
      sku: string,
      qtyDelta: number,
      type: StockMovement['type'],
      reason: string
    ) => {
      stockMovements.push({
        productId,
        sku,
        qtyDelta,
        locationId: "main_warehouse", // Default location
        type,
        docId: invoiceId,
        docLineId: productId,
        idempotencyKey,
        userId,
        reason,
        ts_utc: admin.firestore.FieldValue.serverTimestamp(),
      });
      productUpdates[productId] = (productUpdates[productId] || 0) + qtyDelta;
    };

    if (action === "create") {
      for (const newItem of newItems) {
        addMovement(
          newItem.productId,
          newItem.sku,
          -newItem.quantity, // Stock decreases on creation
          "invoice_create",
          `Invoice ${invoiceId} created: ${newItem.quantity} units of ${newItem.sku} sold.`
        );
      }
    } else if (action === "edit") {
      const oldItemsMap = new Map(oldItems.map((item) => [item.productId, item]));
      const newItemsMap = new Map(newItems.map((item) => [item.productId, item]));

      // Items present in old but not in new (removed or quantity reduced)
      for (const oldItem of oldItems) {
        if (!newItemsMap.has(oldItem.productId)) {
          // Item removed
          addMovement(
            oldItem.productId,
            oldItem.sku,
            oldItem.quantity, // Stock increases (returned)
            "invoice_edit",
            `Invoice ${invoiceId} edited: ${oldItem.quantity} units of ${oldItem.sku} returned.`
          );
        } else {
          // Item quantity changed
          const newItem = newItemsMap.get(oldItem.productId)!;
          const delta = oldItem.quantity - newItem.quantity;
          if (delta !== 0) {
            addMovement(
              oldItem.productId,
              oldItem.sku,
              delta,
              "invoice_edit",
              `Invoice ${invoiceId} edited: ${newItem.sku} quantity changed by ${delta}.`
            );
          }
        }
      }

      // Items present in new but not in old (added or quantity increased)
      for (const newItem of newItems) {
        if (!oldItemsMap.has(newItem.productId)) {
          // Item added
          addMovement(
            newItem.productId,
            newItem.sku,
            -newItem.quantity, // Stock decreases
            "invoice_edit",
            `Invoice ${invoiceId} edited: ${newItem.quantity} units of ${newItem.sku} added.`
          );
        }
      }
    } else if (action === "delete") {
      for (const oldItem of oldItems) {
        addMovement(
          oldItem.productId,
          oldItem.sku,
          oldItem.quantity, // Stock increases (returned)
          "invoice_delete",
          `Invoice ${invoiceId} deleted: ${oldItem.quantity} units of ${oldItem.sku} returned.`
        );
      }
    } else if (action === "restore") {
      for (const oldItem of oldItems) {
        addMovement(
          oldItem.productId,
          oldItem.sku,
          -oldItem.quantity, // Stock decreases (re-sold)
          "invoice_restore",
          `Invoice ${invoiceId} restored: ${oldItem.quantity} units of ${oldItem.sku} re-sold.`
        );
      }
    }

    // Apply product updates and log movements
    for (const productId in productUpdates) {
      const productRef = db.collection("products").doc(productId);
      transaction.update(productRef, {
        onHand: admin.firestore.FieldValue.increment(productUpdates[productId]),
      });
    }

    for (const movement of stockMovements) {
      const movementRef = db.collection("stock_movements").doc(); // Auto-generate ID
      transaction.set(movementRef, movement);
    }

    // Save updated invoice copy
    transaction.set(invoiceServerCopyRef, {
      invoiceId,
      items: newItems,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: action === "delete" ? "deleted" : "active", // Update status based on action
    } as InvoiceServerCopy);
  });
}