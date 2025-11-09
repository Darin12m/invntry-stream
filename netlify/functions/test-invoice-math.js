// netlify/functions/test-invoice-math.js
// Runs a comprehensive battery of invoice math tests against your live apply-invoice-stock function.
// It creates temporary TEST_ products, runs many invoice flows, checks onHand and stock_movements,
// and returns a structured JSON report. Safe to run multiple times.

const admin = require("firebase-admin");

function initAdmin() {
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_PROJECT_ID) {
            throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID env vars");
        }
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            projectId: process.env.FIREBASE_PROJECT_ID,
        });
    }
    return admin.firestore();
}

const ts = () => new Date().toISOString().replace(/[:.]/g, "-");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Build the absolute origin for this site (so we can call sibling function) */
function getOrigin(event) {
    const host = event.headers["x-forwarded-host"] || event.headers["host"];
    const proto = (event.headers["x-forwarded-proto"] || "https");
    return `${proto}://${host}`;
}

/** Call the deployed apply-invoice-stock function via HTTP */
async function callApplyStock(origin, payload) {
    const res = await fetch(`${origin}/.netlify/functions/apply-invoice-stock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    if (!res.ok) {
        return { ok: false, status: res.status, body: json };
    }
    return json;
}

/** Firestore helpers */
async function getOnHand(db, productId) {
    const snap = await db.collection("products").doc(productId).get();
    const d = snap.data() || {};
    const val = (typeof d.onHand === "number") ? d.onHand :
        (typeof d.quantity === "number") ? d.quantity :
            (typeof d.stock === "number") ? d.stock : 0;
    return Number(val) || 0;
}

async function setProduct(db, productId, fields) {
    await db.collection("products").doc(productId).set(fields, { merge: true });
}

async function deleteProduct(db, productId) {
    await db.collection("products").doc(productId).delete();
}

/** Sum movements for a product since a timestamp */
async function sumMovementsSince(db, productId, sinceMillis) {
    const since = admin.firestore.Timestamp.fromMillis(sinceMillis);
    const qs = await db.collection("stock_movements")
        .where("productId", "==", productId)
        .where("ts_utc", ">=", since)
        .get();
    let sum = 0;
    qs.forEach(doc => {
        const d = doc.data() || {};
        sum += Number(d.qtyDelta || 0);
    });
    return sum;
}

function result(pass, details) {
    return { pass, details };
}

/** Build an idempotency key */
function idem(invoiceId, action, tag = "") {
    return `${invoiceId}:${action}:${tag}:${Date.now()}`;
}

exports.handler = async (event) => {
    try {
        const startedAt = Date.now();
        const origin = getOrigin(event);
        const db = initAdmin();

        // Create temporary test products with clear starting stock
        const P1 = `TEST_P1_${ts()}`;
        const P2 = `TEST_P2_${ts()}`;
        const P3 = `TEST_P3_${ts()}`;
        const start1 = 100, start2 = 50, start3 = 20;

        await setProduct(db, P1, { name: P1, onHand: start1, quantity: start1 });
        await setProduct(db, P2, { name: P2, onHand: start2, quantity: start2 });
        await setProduct(db, P3, { name: P3, onHand: start3, quantity: start3 });

        // Give Firestore a tick
        await sleep(200);

        const results = {};
        const t0 = Date.now();

        // ========== SCENARIO 1: Basic create → edit → delete → restore (single product) ==========
        {
            const invoiceId = `TEST_INV_S1_${ts()}`;

            // CREATE: P1 qty 10 => onHand 100 -> 90
            let payload = {
                invoiceId,
                action: "create",
                newItems: [{ productId: P1, sku: P1, qty: 10 }],
                idempotencyKey: idem(invoiceId, "create", "A"),
                userId: "tester",
                reason: "S1-create"
            };
            let r1 = await callApplyStock(origin, payload);
            const afterCreate = await getOnHand(db, P1);

            // EDIT: 10 -> 7 => +3 back => onHand 93
            payload = {
                invoiceId,
                action: "edit",
                newItems: [{ productId: P1, sku: P1, qty: 7 }],
                idempotencyKey: idem(invoiceId, "edit", "A"),
                userId: "tester",
                reason: "S1-edit"
            };
            let r2 = await callApplyStock(origin, payload);
            const afterEdit = await getOnHand(db, P1);

            // DELETE: restore +7 => back to 100
            payload = {
                invoiceId,
                action: "delete",
                newItems: [], // ignored by backend; server copy is used
                idempotencyKey: idem(invoiceId, "delete", "A"),
                userId: "tester",
                reason: "S1-delete"
            };
            let r3 = await callApplyStock(origin, payload);
            const afterDelete = await getOnHand(db, P1);

            // RESTORE: -7 again => 93
            payload = {
                invoiceId,
                action: "restore",
                newItems: [], // ignored
                idempotencyKey: idem(invoiceId, "restore", "A"),
                userId: "tester",
                reason: "S1-restore"
            };
            let r4 = await callApplyStock(origin, payload);
            const afterRestore = await getOnHand(db, P1);

            const pass = (afterCreate === start1 - 10) &&
                (afterEdit === start1 - 7) &&
                (afterDelete === start1) &&
                (afterRestore === start1 - 7);

            results.S1_basic = result(pass, {
                afterCreate, afterEdit, afterDelete, afterRestore,
                expect: { afterCreate: start1 - 10, afterEdit: start1 - 7, afterDelete: start1, afterRestore: start1 - 7 },
                api: { r1, r2, r3, r4 }
            });
        }

        // ========== SCENARIO 2: Multi-line invoice, duplicates in lines should merge ==========
        {
            const invoiceId = `TEST_INV_S2_${ts()}`;
            // CREATE P1:4, P2:5, P1:6 (duplicate product lines => total P1:10, P2:5)
            const createItems = [
                { productId: P1, sku: P1, qty: 4 },
                { productId: P2, sku: P2, qty: 5 },
                { productId: P1, sku: P1, qty: 6 }
            ];
            await callApplyStock(origin, {
                invoiceId, action: "create", newItems: createItems,
                idempotencyKey: idem(invoiceId, "create", "B"), userId: "tester", reason: "S2-create"
            });
            const a1 = await getOnHand(db, P1);
            const a2 = await getOnHand(db, P2);

            // EDIT: change P1 total to 7 (so +3 back), add P3:2, remove P2 (set qty 0)
            const editItems = [
                { productId: P1, sku: P1, qty: 7 },
                { productId: P2, sku: P2, qty: 0 },
                { productId: P3, sku: P3, qty: 2 }
            ];
            await callApplyStock(origin, {
                invoiceId, action: "edit", newItems: editItems,
                idempotencyKey: idem(invoiceId, "edit", "B"), userId: "tester", reason: "S2-edit"
            });
            const b1 = await getOnHand(db, P1);
            const b2 = await getOnHand(db, P2);
            const b3 = await getOnHand(db, P3);

            // DELETE: restore everything in latest server copy (P1:7, P3:2)
            await callApplyStock(origin, {
                invoiceId, action: "delete", newItems: [],
                idempotencyKey: idem(invoiceId, "delete", "B"), userId: "tester", reason: "S2-delete"
            });
            const c1 = await getOnHand(db, P1);
            const c2 = await getOnHand(db, P2);
            const c3 = await getOnHand(db, P3);

            const expect = {
                afterCreate: { P1: (start1 - 7 /*from S1 restore*/) - 10, P2: start2 - 5 },
                afterEdit: { P1: (start1 - 7) - 7, P2: start2, P3: start3 - 2 },
                afterDelete: { P1: (start1 - 7), P2: start2, P3: start3 }
            };
            const pass = (a1 === expect.afterCreate.P1) && (a2 === expect.afterCreate.P2) &&
                (b1 === expect.afterEdit.P1) && (b2 === expect.afterEdit.P2) && (b3 === expect.afterEdit.P3) &&
                (c1 === expect.afterDelete.P1) && (c2 === expect.afterDelete.P2) && (c3 === expect.afterDelete.P3);

            results.S2_multiline = result(pass, { a1, a2, b1, b2, b3, c1, c2, c3, expect });
        }

        // ========== SCENARIO 3: Overlapping invoices on same product + reversal order ==========
        {
            // Start point right now:
            const p1Start = await getOnHand(db, P1);

            const invA = `TEST_INV_S3A_${ts()}`;
            const invB = `TEST_INV_S3B_${ts()}`;

            // A: create P1:9
            await callApplyStock(origin, {
                invoiceId: invA, action: "create", newItems: [{ productId: P1, qty: 9, sku: P1 }],
                idempotencyKey: idem(invA, "create", "C"), userId: "tester", reason: "S3A-create"
            });
            const afterA = await getOnHand(db, P1); // p1Start - 9

            // B: create P1:4
            await callApplyStock(origin, {
                invoiceId: invB, action: "create", newItems: [{ productId: P1, qty: 4, sku: P1 }],
                idempotencyKey: idem(invB, "create", "C"), userId: "tester", reason: "S3B-create"
            });
            const afterB = await getOnHand(db, P1); // p1Start - 13

            // Delete A (older) → +9
            await callApplyStock(origin, {
                invoiceId: invA, action: "delete", newItems: [],
                idempotencyKey: idem(invA, "delete", "C"), userId: "tester", reason: "S3A-delete"
            });
            const afterDelA = await getOnHand(db, P1); // p1Start - 4

            // Restore A → -9 again
            await callApplyStock(origin, {
                invoiceId: invA, action: "restore", newItems: [],
                idempotencyKey: idem(invA, "restore", "C"), userId: "tester", reason: "S3A-restore"
            });
            const afterResA = await getOnHand(db, P1); // p1Start - 13

            const pass = (afterA === p1Start - 9) &&
                (afterB === p1Start - 13) &&
                (afterDelA === p1Start - 4) &&
                (afterResA === p1Start - 13);

            results.S3_overlap = result(pass, { p1Start, afterA, afterB, afterDelA, afterResA });
        }

        // ========== SCENARIO 4: Idempotency (repeat same request) ==========
        {
            const invoiceId = `TEST_INV_S4_${ts()}`;
            const key = idem(invoiceId, "create", "D");

            const before = await getOnHand(db, P2);

            const payload = {
                invoiceId, action: "create",
                newItems: [{ productId: P2, qty: 8, sku: P2 }],
                idempotencyKey: key, userId: "tester", reason: "S4-create"
            };
            const r1 = await callApplyStock(origin, payload);
            const mid = await getOnHand(db, P2);

            // Repeat with SAME idempotencyKey → should NO-OP
            const r2 = await callApplyStock(origin, payload);
            const after = await getOnHand(db, P2);

            const pass = (mid === before - 8) && (after === mid) && (r2.idempotent === true || r2.ok === true);
            results.S4_idempotency = result(pass, { before, mid, after, r1, r2 });
        }

        // ========== SCENARIO 5: Zero-qty and line removal in edit ==========
        {
            const invoiceId = `TEST_INV_S5_${ts()}`;
            const startP3 = await getOnHand(db, P3);

            // Create P3: 6
            await callApplyStock(origin, {
                invoiceId, action: "create", newItems: [{ productId: P3, qty: 6, sku: P3 }],
                idempotencyKey: idem(invoiceId, "create", "E"), userId: "tester", reason: "S5-create"
            });
            const a = await getOnHand(db, P3); // startP3 - 6

            // Edit: set qty 0 (effectively removing line)
            await callApplyStock(origin, {
                invoiceId, action: "edit", newItems: [{ productId: P3, qty: 0, sku: P3 }],
                idempotencyKey: idem(invoiceId, "edit", "E"), userId: "tester", reason: "S5-edit"
            });
            const b = await getOnHand(db, P3); // back +6

            const pass = (a === startP3 - 6) && (b === startP3);
            results.S5_zero_qty = result(pass, { startP3, afterCreate: a, afterEdit: b });
        }

        // ========== Optional informational: negative qty (not recommended) ==========
        // We don't fail the suite on this; just observe behavior.
        let S6_info;
        {
            const invoiceId = `TEST_INV_S6_${ts()}`;
            const start = await getOnHand(db, P1);
            await callApplyStock(origin, {
                invoiceId, action: "create",
                newItems: [{ productId: P1, qty: -3, sku: P1 }],
                idempotencyKey: idem(invoiceId, "create", "F"), userId: "tester", reason: "S6-negative-create"
            });
            const after = await getOnHand(db, P1);
            S6_info = { note: "Negative qty is not recommended; shows system behavior.", start, after, delta: after - start };
            // Clean up by deleting invoice to restore
            await callApplyStock(origin, {
                invoiceId, action: "delete", newItems: [],
                idempotencyKey: idem(invoiceId, "delete", "F"), userId: "tester", reason: "S6-cleanup"
            });
        }
        results.S6_negative_qty_info = result(true, S6_info);

        // ========== Verify movements sum equals onHand delta (sanity) ==========
        const sanitySince = t0;
        const oh1 = await getOnHand(db, P1);
        const oh2 = await getOnHand(db, P2);
        const oh3 = await getOnHand(db, P3);
        const mv1 = await sumMovementsSince(db, P1, sanitySince);
        const mv2 = await sumMovementsSince(db, P2, sanitySince);
        const mv3 = await sumMovementsSince(db, P3, sanitySince);

        const exp1 = (oh1 - start1);
        const exp2 = (oh2 - start2);
        const exp3 = (oh3 - start3);

        results.S7_movement_sanity = result(
            (mv1 === exp1) && (mv2 === exp2) && (mv3 === exp3),
            {
                P1: { onHandDelta: exp1, movementsSum: mv1 },
                P2: { onHandDelta: exp2, movementsSum: mv2 },
                P3: { onHandDelta: exp3, movementsSum: mv3 }
            }
        );

        // ========== Cleanup test products ==========
        await deleteProduct(db, P1);
        await deleteProduct(db, P2);
        await deleteProduct(db, P3);

        const finishedAt = Date.now();
        const passAll = Object.values(results).every(r => r.pass);

        return {
            statusCode: passAll ? 200 : 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ok: passAll,
                message: passAll ? "ALL MATH TESTS PASSED" : "Some tests failed. See details.",
                startedAt, finishedAt, durationMs: finishedAt - startedAt,
                results
            }, null, 2)
        };
    } catch (e) {
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
        };
    }
};
