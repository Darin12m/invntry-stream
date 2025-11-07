import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (ensure your GOOGLE_APPLICATION_CREDENTIALS env var is set)
// For local testing, you might need to set this:
// export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
admin.initializeApp();

const db = admin.firestore();

async function initOnHandField() {
  console.log("Starting onHand initialization script...");

  try {
    const productsRef = db.collection("products");
    const snapshot = await productsRef.get();

    if (snapshot.empty) {
      console.log("No products found to initialize.");
      return;
    }

    const batch = db.batch();
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
      const productData = doc.data();
      // Only update if 'onHand' field does not exist
      if (productData.onHand === undefined) {
        const initialQuantity = productData.quantity || 0; // Use existing 'quantity' as initial 'onHand'
        batch.update(doc.ref, { onHand: initialQuantity });
        updatedCount++;
        console.log(`Initialized product ${doc.id} with onHand: ${initialQuantity}`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Successfully initialized 'onHand' for ${updatedCount} products.`);
    } else {
      console.log("All products already have 'onHand' field or no products found without it.");
    }
  } catch (error) {
    console.error("Error initializing onHand field:", error);
  } finally {
    console.log("onHand initialization script finished.");
  }
}

// Execute the script
initOnHandField();