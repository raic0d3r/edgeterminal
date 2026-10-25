import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices, isAllowlistedAdmin } from "@/lib/firebase-admin";
import { defaultFeatureRules, normalizeFeatureRules } from "@/lib/feature-access";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  try {
    const { adminAuth } = getAdminServices();
    const decoded = await adminAuth.verifyIdToken(token);
    return isAllowlistedAdmin(decoded.email) ? decoded : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const { adminDb } = getAdminServices();
    const doc = await adminDb.collection("platformSettings").doc("featureAccess").get();
    return NextResponse.json({ rules: normalizeFeatureRules(doc.data()?.rules || defaultFeatureRules()) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load feature access settings." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requireAdmin(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const body = await request.json();
    if (!Array.isArray(body.rules)) return NextResponse.json({ error: "A rules array is required." }, { status: 400 });
    const rules = normalizeFeatureRules(body.rules);
    for (const rule of rules) {
      if (rule.subscriptionUrl && !/^https:\/\//i.test(rule.subscriptionUrl)) {
        return NextResponse.json({ error: `Subscription links must use HTTPS (${rule.title}).` }, { status: 400 });
      }
    }
    const { adminDb } = getAdminServices();
    await adminDb.collection("platformSettings").doc("featureAccess").set({ rules, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    console.error("Feature access settings update failed", error);
    return NextResponse.json({ error: "Could not save feature access settings. Check Firebase Admin configuration." }, { status: 500 });
  }
}
