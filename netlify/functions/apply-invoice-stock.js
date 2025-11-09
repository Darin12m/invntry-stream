// netlify/functions/apply-invoice-stock.js
// FINAL BULLETPROOF VERSION — handles all math scenarios safely and consistently

const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID environment variables");
  }
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

/** Safe number conversion */
const toNum = (val) => {
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? 0 : n;
};

/** Normalize items into a map of { productId: totalQty } */
function normalizeItems(items = []) {
  const map = {};
  for (const it of items) {
    const pid = it.productId;
    if (!pid) continue;
    const qty = toNum(it.qty);
    map[pid] = (map[pid] || 0) + qty;
  }
  return map;
}

/** Compute per-product quantity deltas for stock movement */
function computeDeltas(oldItems = [], newItems = [], action) {
  const oldMap = normalizeItems(oldItems);
  const newMap = normalizeItems(newItems);
  const deltas = {};

  // CREATE → subtract new qty
  if (action === "create") {
    for (const pid of Object.keys(newMap)) {
      const q = -toNum(newMap[pid]);
      if (q !== 0) deltas[pid] = q;
    }
  }

  // EDIT → restore old, subtract new
  if (action === "edit") {
    const all = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    for (const pid of all) {
      const diff = toNum(oldMap[pid]) - toNum(newMap[pid]);
      if (diff !== 0) deltas[pid] = diff;
    }
  }

  // DELETE → restore old qty
  if (action === "delete") {
    for (const pid of Object.keys(oldMap)) {
      const q = toNum(oldMap[pid]);
      if (q !== 0) deltas[pid] = q;
    }
  }

  // RESTORE → reapply old qty (subtract it again)
  if (action === "restore") {
    for (const pid of Object.keys(oldMap)) {
      const q = -toNum(oldMap[pid]);
      if (q !== 0) deltas[pid] = q;
    }
  }

  return deltas;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const { invoiceId, action, newItems = [], idempotencyKey, userId, reason } = body;

    if (!invoiceId || !action || !idempotencyKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing invoiceId, action, or idempotencyKey" }),
      };
    }

    const invoiceRef = db.collection("invoices_server_copies").doc(invoiceId);
    const movementsRef = db.collection("stock_movements");

    let moved = 0;

    await db.runTransaction(async (txn) => {
      // ✅ Idempotency check
      const idemSnap = await txn.get(
        movementsRef.where("idempotencyKey", "==", idempotencyKey).limit(1)
      );
      if (!idemSnap.empty) {
        console.log("Duplicate idempotent call:", idempotencyKey);
        throw { code: "IDEMPOTENT", message: "Already processed" };
      }

      // ✅ Load old invoice copy
      const invoiceSnap = await txn.get(invoiceRef);
      const oldData = invoiceSnap.exists ? invoiceSnap.data() : {};
      const oldItems = oldData.items || [];

      // ✅ Compute deltas
      const deltas = computeDeltas(oldItems, newItems, action);

      // ✅ For each product, record movement and update onHand
      for (const [pid, qtyDeltaRaw] of Object.entries(deltas)) {
        const qtyDelta = toNum(qtyDeltaRaw);
        if (!qtyDelta || isNaN(qtyDelta)) continue;
        const prodRef = db.collection("products").doc(pid);

        txn.set(
          movementsRef.doc(),
          {
            productId: pid,
            qtyDelta,
            type: `invoice_${action}`,
            docId: invoiceId,
            idempotencyKey,
            userId: userId || "system",
            reason: reason || "",
            ts_utc: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        txn.update(prodRef, {
          onHand: admin.firestore.FieldValue.increment(qtyDelta),
        });
        moved++;
      }

      // ✅ Save new invoice server copy
      const now = admin.firestore.FieldValue.serverTimestamp();
      if (action === "delete") {
        txn.set(invoiceRef, { ...oldData, status: "deleted", updatedAt: now }, { merge: true });
      } else {
        txn.set(
          invoiceRef,
          { items: newItems, status: "active", updatedAt: now },
          { merge: true }
        );
      }
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, moved }),
    };
  } catch (e) {
    // ✅ Handle idempotency gracefully
    if (e && e.code === "IDEMPOTENT") {
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, idempotent: true, moved: 0 }),
      };
    }

    console.error("apply-invoice-stock error", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, message: e.message || String(e) }),
    };
  }
};
