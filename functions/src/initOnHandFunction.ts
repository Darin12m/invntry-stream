import * as admin from "firebase-admin";
import { Request, Response } from "firebase-functions";

const db = admin.firestore();

export async function initOnHand(req: Request, res: Response) {
  // Ensure this function is only callable by authenticated users or specific origins if needed
  // For a simple one-time migration, we'll allow it to be called directly, but in production,
  // you might want to add authentication checks (e.g., check context.auth for callable functions,
  // or specific headers/tokens for HTTP functions).
  // For this prompt, we'll assume it's a utility function run by an admin.

  console.log("Starting HTTP-triggered onHand initialization...");

  try {
    const productsRef = db.collection("products");
    const snapshot = await productsRef.get();

    if (snapshot.empty) {
      console.log("No products found to initialize.");
      res.status(200).send("No products found to initialize.");
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
      res.status(200).send(`Successfully initialized 'onHand' for ${updatedCount} products.`);
    } else {
      console.log("All products already have 'onHand' field or no products found without it.");
      res.status(200).send("All products already have 'onHand' field or no products found without it.");
    }
  } catch (error) {
    console.error("Error initializing onHand field:", error);
    res.status(500).send(`Error initializing onHand field: ${error}`);
  } finally {
    console.log("onHand initialization function finished.");
  }
}