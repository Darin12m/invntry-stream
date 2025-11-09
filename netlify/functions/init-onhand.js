const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let db;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
    db = admin.firestore();
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON format.');
  }
} else {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  console.log('Starting Netlify-triggered onHand initialization...');

  try {
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();

    if (snapshot.empty) {
      console.log('No products found to initialize.');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, updated: 0, message: 'No products found to initialize.' }),
      };
    }

    const batch = db.batch();
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
      const productData = doc.data();
      // Only update if 'onHand' field does not exist or is not a number
      if (typeof productData.onHand !== 'number') {
        const initialQuantity = typeof productData.quantity === 'number'
          ? productData.quantity
          : (typeof productData.stock === 'number' ? productData.stock : 0); // Fallback to 'stock' then 0

        batch.update(doc.ref, { onHand: initialQuantity });
        updatedCount++;
        console.log(`Initialized product ${doc.id} with onHand: ${initialQuantity}`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Successfully initialized 'onHand' for ${updatedCount} products.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, updated: updatedCount, message: `Successfully initialized 'onHand' for ${updatedCount} products.` }),
      };
    } else {
      console.log("All products already have 'onHand' field or no products found without it.");
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, updated: 0, message: "All products already have 'onHand' field or no products found without it." }),
      };
    }
  } catch (error) {
    console.error('Error initializing onHand field:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'Error initializing onHand field.' }),
    };
  } finally {
    console.log('onHand initialization function finished.');
  }
};