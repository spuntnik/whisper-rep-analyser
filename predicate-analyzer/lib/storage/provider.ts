import type { StorageProvider } from "@/lib/storage/contracts";

export function getStorageProvider(): StorageProvider {
  const value = process.env.NEXT_PUBLIC_STORAGE_PROVIDER ?? process.env.STORAGE_PROVIDER ?? "firebase";
  return value === "firebase" ? "firebase" : "supabase";
}
