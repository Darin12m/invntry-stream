const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
let db;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    db = admin.firestore();
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", error);
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON format.");
  }
} else {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  try {
    const { invoiceId, action, newItems, idempotencyKey, userId, reason } = JSON.parse(event.body);

    if (!invoiceId || !action || !newItems || !idempotencyKey || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required parameters: invoiceId, action, newItems, idempotencyKey, userId." }),
      };
    }

    let movedCount = 0;

    await db.runTransaction(async (transaction) => {
      const invoiceServerCopyRef = db.collection("invoices_server_copies").doc(invoiceId);
      const invoiceServerCopySnap = await transaction.get(invoiceServerCopyRef);

      const oldItems = invoiceServerCopySnap.exists
        ? (invoiceServerCopySnap.data()).items || []
        : [];

      // Idempotency check: If a stock movement with this key already exists, skip.
      const idempotencyQuery = db.collection("stock_movements").where("idempotencyKey", "==", idempotencyKey);
      const existingMovementsSnap = await transaction.get(idempotencyQuery);
      if (!existingMovementsSnap.empty) {
        console.log(`Idempotency key ${idempotencyKey} already processed. Skipping.`);
        return; // Exit transaction, no-op
      }

      const productUpdates = {}; // productId -> delta
      const stockMovements = [];

      // Helper to add a movement and update product delta
      const addMovement = (
        productId,
        sku,
        qtyDelta,
        type,
        reason,
        docLineId = productId, // Default to productId if not provided
        locationId = "main_warehouse" // Default location
      ) => {
        stockMovements.push({
          productId,
          sku,
          qtyDelta,
          locationId,
          type,
          docId: invoiceId,
          docLineId,
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
            reason || `Invoice ${invoiceId} created: ${newItem.quantity} units of ${newItem.sku} sold.`
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
              reason || `Invoice ${invoiceId} edited: ${oldItem.quantity} units of ${oldItem.sku} returned.`
            );
          } else {
            // Item quantity changed
            const newItem = newItemsMap.get(oldItem.productId);
            const delta = oldItem.quantity - newItem.quantity;
            if (delta !== 0) {
              addMovement(
                oldItem.productId,
                oldItem.sku,
                delta,
                "invoice_edit",
                reason || `Invoice ${invoiceId} edited: ${newItem.sku} quantity changed by ${delta}.`
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
              reason || `Invoice ${invoiceId} edited: ${newItem.quantity} units of ${newItem.sku} added.`
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
            reason || `Invoice ${invoiceId} deleted: ${oldItem.quantity} units of ${oldItem.sku} returned.`
          );
        }
      } else if (action === "restore") {
        for (const oldItem of oldItems) {
          addMovement(
            oldItem.productId,
            oldItem.sku,
            -oldItem.quantity, // Stock decreases (re-sold)
            "invoice_restore",
            reason || `Invoice ${invoiceId} restored: ${oldItem.quantity} units of ${oldItem.sku} re-sold.`
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
        movedCount++;
      }

      // Save updated invoice copy
      transaction.set(invoiceServerCopyRef, {
        invoiceId,
        items: action === "delete" ? oldItems : newItems, // If deleting, save old items for potential restore
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: action === "delete" ? "deleted" : "active", // Update status based on action
      });
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, moved: movedCount }),
    };
  } catch (error) {
    console.error("Error in apply-invoice-stock function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Failed to apply invoice stock changes." }),
    };
  }
};