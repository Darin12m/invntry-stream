import { db } from "@/lib/firebase"; // Corrected import path
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// map emails to names
function mapEmailToName(email?: string | null): string {
  if (!email) return "Unknown user";
  if (email === "darinmiladinovski@gmail.com") return "Darin";
  if (email === "bubespasovska@gmail.com") return "Bube";
  return email; // fallback: show email
}

export async function logActivity(
  action: string,
  target: string,
  details: string = ""
) {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const userEmail = currentUser?.email || null;
    const userDisplay = mapEmailToName(userEmail);

    await addDoc(collection(db, "activityLogs"), {
      action,
      target,
      details,
      userEmail: userEmail,
      user: userDisplay,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}