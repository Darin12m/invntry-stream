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
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Invalid FIREBASE_SERVICE_ACCOUNT_JSON format." }),
    };
  }
} else {
  return {
    statusCode: 500,
    body: JSON.stringify({ message: "Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable." }),
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  console.log("Starting Netlify-triggered stock sanity check...");

  const issues = [];
  let totalProducts = 0;

  try {
    const productsSnapshot = await db.collection("products").get();
    totalProducts = productsSnapshot.docs.length;
    console.log(`Found ${totalProducts} products to check.`);

    for (const productDoc of productsSnapshot.docs) {
      const productId = productDoc.id;
      const productData = productDoc.data();
      const onHand = productData.onHand || 0; // Current onHand from product document

      const movementsSnapshot = await db.collection("stock_movements")
        .where("productId", "==", productId)
        .get();

      let sumQtyDelta = 0;
      movementsSnapshot.docs.forEach(movementDoc => {
        sumQtyDelta += movementDoc.data().qtyDelta || 0;
      });

      if (onHand !== sumQtyDelta) {
        issues.push({
          productId,
          productName: productData.name || 'Unnamed Product',
          onHand,
          expected: sumQtyDelta, // Expected based on movements
        });
      }
    }

    const mismatchedCount = issues.length;
    const ok = mismatchedCount === 0;
    const message = ok
      ? `✅ All ${totalProducts} products verified successfully.`
      : `⚠️ ${mismatchedCount} products out of sync with stock movements.`;

    console.log(`Stock sanity check finished. Checked ${totalProducts} products, found ${mismatchedCount} mismatches.`);

    const responseBody = {
      ok,
      timestamp: new Date().toISOString(),
      totalProducts,
      mismatched: mismatchedCount,
      message,
      ...(mismatchedCount > 0 && { details: issues }),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error("Error during stock sanity check:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Failed to perform stock sanity check." }),
    };
  }
};