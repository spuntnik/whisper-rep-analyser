import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getFirebaseServiceAccountConfig } from "@/lib/firebase/config";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = getFirebaseServiceAccountConfig();

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  return initializeApp();
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getFirebaseAdminAuth() {
  return getAuth(getAdminApp());
}

export async function verifyFirebaseIdToken(idToken: string) {
  return getFirebaseAdminAuth().verifyIdToken(idToken);
}

export function getFirebaseAdminStorage() {
  return getStorage(getAdminApp());
}

export { FieldValue };
