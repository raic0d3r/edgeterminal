import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  // Preferred for deployment: provide the service account JSON as a server-only env var.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      const serviceAccount = JSON.parse(raw);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (error) {
      console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.", error);
      throw new Error("Firebase Admin credentials are misconfigured. Check FIREBASE_SERVICE_ACCOUNT_KEY.");
    }
  }

  // Alternative for trusted hosting environments.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }

  // Local development convenience only. Never load a service-account file implicitly in production.
  if (process.env.NODE_ENV !== "production") {
    const localCredentialPath = join(process.cwd(), "firebase-service-account.json");
    if (existsSync(localCredentialPath)) {
      try {
        const serviceAccount = JSON.parse(readFileSync(localCredentialPath, "utf8"));
        return initializeApp({ credential: cert(serviceAccount) });
      } catch (error) {
        console.error("Could not read firebase-service-account.json.", error);
        throw new Error("Local Firebase Admin credentials are invalid. Check firebase-service-account.json.");
      }
    }
  }

  throw new Error(
    "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS. " +
    "For local development, firebase-service-account.json may be placed in the project root."
  );
}

export function getAdminServices() {
  const app = getAdminApp();
  return { adminAuth: getAuth(app), adminDb: getFirestore(app) };
}

export function isAllowlistedAdmin(email?: string | null) {
  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowed.includes(email.toLowerCase()));
}
