import { db } from '@/firebase/config';
import { collection, addDoc, getDocs, query, orderBy, FieldValue } from 'firebase/firestore';
import { ActivityLog } from '@/types';

export const activityLogService = {
  logAction: async (message: string, userId: string | null = null, userEmail: string = 'Unknown User'): Promise<string> => {
    const docRef = await addDoc(collection(db, 'logs'), {
      message,
      userId,
      userEmail,
      timestamp: new Date(),
    });
    return docRef.id;
  },
  listActions: async (): Promise<ActivityLog[]> => {
    const logsCol = collection(db, 'logs');
    const q = query(logsCol, orderBy('timestamp', 'desc'));
    const logSnapshot = await getDocs(q);
    return logSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
      } as ActivityLog;
    });
  },
};