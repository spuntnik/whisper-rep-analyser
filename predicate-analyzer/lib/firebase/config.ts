export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

  if (!apiKey || !authDomain || !projectId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? undefined,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? undefined,
  };
}

export function getFirebaseServiceAccountConfig(): FirebaseServiceAccountConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  let privateKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  // Handle potential surrounding quotes and escaped newlines
  privateKey = privateKey.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket: storageBucket || undefined,
  };
}
