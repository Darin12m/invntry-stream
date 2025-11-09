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
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  console.log("Starting Netlify-triggered stock sanity check...");

  const issues = [];
  let checkedCount = 0;

  try {
    const productsSnapshot = await db.collection("products").get();
    console.log(`Found ${productsSnapshot.docs.length} products to check.`);

    for (const productDoc of productsSnapshot.docs) {
      checkedCount++;
      const productId = productDoc.id;
      const productData = productDoc.data();
      const onHand = productData.onHand || 0;

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
          sumOfMovements: sumQtyDelta,
          difference: onHand - sumQtyDelta,
        });
      }
    }

    console.log(`Stock sanity check finished. Checked ${checkedCount} products, found ${issues.length} mismatches.`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: issues.length === 0,
        checked: checkedCount,
        mismatched: issues.length,
        issues,
      }),
    };
  } catch (error) {
    console.error("Error during stock sanity check:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || "Failed to perform stock sanity check." }),
    };
  }
};