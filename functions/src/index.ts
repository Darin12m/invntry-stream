import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyInvoiceStock } from "./stockEngine";

admin.initializeApp();

export const applyInvoiceStockCallable = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { invoiceId, action, newItems, idempotencyKey } = data;
  const userId = context.auth.uid;

  if (!invoiceId || !action || !newItems || !idempotencyKey || !userId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required parameters: invoiceId, action, newItems, idempotencyKey, userId."
    );
  }

  try {
    await applyInvoiceStock(invoiceId, action, newItems, idempotencyKey, userId);
    return { success: true };
  } catch (error: any) {
    console.error("Error in applyInvoiceStockCallable:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to apply invoice stock changes."
    );
  }
});