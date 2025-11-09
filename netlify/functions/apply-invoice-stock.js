await fetch("/.netlify/functions/apply-invoice-stock", {
  method: "POST",
  body: JSON.stringify({
    invoiceId: "INV123",
    action: "create",
    newItems: [...],
    idempotencyKey: "some-uuid",
    userId: currentUser?.uid,
    reason: "New sale invoice",
    invoiceType: "sale",
  }),
});
