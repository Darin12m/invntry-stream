import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// local cache so we don’t query repeatedly
let cachedUser: any = null;

// map email → display name
function mapEmailToName(email?: string | null): string {
  if (!email) return "Unknown user";
  if (email === "darinmiladinovski@gmail.com") return "Darin";
  if (email === "bubespasovska@gmail.com") return "Bube";
  return email;
}

// keep track of current user in real time
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  cachedUser = user || null;
});

export async function logActivity(action: string, target: string, details = "") {
  try {
    const userEmail = cachedUser?.email || null;
    const userName = mapEmailToName(userEmail);

    await addDoc(collection(db, "activityLogs"), {
      action,
      target,
      details,
      user: userName,
      userEmail,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}