import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { WaterLogEntry } from '../types/nutrition';

function clampWaterMl(value: unknown): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 250;
  return Math.round(Math.min(5000, Math.max(10, num)));
}

export function subscribeToUserWaterLogs(
  userId: string,
  onLogs: (logs: WaterLogEntry[]) => void
): Unsubscribe {
  const path = `users/${userId}/waterLogs`;
  const q = query(
    collection(db, 'users', userId, 'waterLogs'),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: WaterLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d || typeof d.dateKey !== 'string' || typeof d.amountMl !== 'number') return;
        entries.push({
          id: String(d.id || docSnap.id),
          dateKey: d.dateKey,
          loggedAtIso: String(d.loggedAtIso || new Date().toISOString()),
          amountMl: clampWaterMl(d.amountMl),
        });
      });

      entries.sort((a, b) => b.loggedAtIso.localeCompare(a.loggedAtIso));
      onLogs(entries);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addWaterLogForUser(
  userId: string,
  entry: WaterLogEntry
): Promise<string> {
  const safeId =
    entry.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) ||
    `water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/waterLogs/${safeId}`;
  const ref = doc(db, 'users', userId, 'waterLogs', safeId);

  try {
    await setDoc(ref, {
      id: safeId,
      userId,
      dateKey: entry.dateKey.slice(0, 10),
      loggedAtIso: entry.loggedAtIso.slice(0, 40),
      amountMl: clampWaterMl(entry.amountMl),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteWaterLogForUser(
  userId: string,
  entryId: string
): Promise<void> {
  const path = `users/${userId}/waterLogs/${entryId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'waterLogs', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
