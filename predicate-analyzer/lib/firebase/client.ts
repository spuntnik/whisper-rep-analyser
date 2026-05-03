"use client";

import { getApps, getApp, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseWebConfig } from "@/lib/firebase/config";

export function getFirebaseClientApp() {
  const config = getFirebaseWebConfig();
  if (!config) return null;

  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseClientServices() {
  const app = getFirebaseClientApp();
  if (!app) return null;

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}
