import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices, isAllowlistedAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  try {
    const { adminAuth } = getAdminServices();
    const decoded = await adminAuth.verifyIdToken(token);
    if (!isAllowlistedAdmin(decoded.email)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const actor = await requireAdmin(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const { adminAuth, adminDb } = getAdminServices();
    const [authResult, profiles] = await Promise.all([
      adminAuth.listUsers(1000),
      adminDb.collection("users").get()
    ]);
    const profileMap = new Map(profiles.docs.map(doc => [doc.id, doc.data()]));
    const users = authResult.users.map(user => {
      const profile = profileMap.get(user.uid) || {};
      return {
        uid: user.uid,
        email: user.email || "",
        displayName: profile.displayName || user.displayName || user.email?.split("@")[0] || "Member",
        role: profile.role || "member",
        status: profile.status || (user.disabled ? "disabled" : "active"),
        disabled: user.disabled,
        createdAt: user.metadata.creationTime || "",
        access: {
          generalSilver: profile.access?.generalSilver !== false,
          generalGold: profile.access?.generalGold === true,
          vipLounge: profile.access?.vipLounge === true,
          importantVip: profile.access?.importantVip === true
        }
      };
    });
    return NextResponse.json({ users, nextPageToken: authResult.pageToken || null });
  } catch (error) {
    console.error("Admin user list failed", error);
    return NextResponse.json({ error: "Could not load users. Check Firebase Admin configuration." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requireAdmin(request);
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const body = await request.json();
    const uid = String(body.uid || "");
    if (!uid || uid === actor.uid) {
      return NextResponse.json({ error: "A valid target user is required. You cannot change your own access here." }, { status: 400 });
    }
    const { adminAuth, adminDb } = getAdminServices();
    const userRef = adminDb.collection("users").doc(uid);
    const userRecord = await adminAuth.getUser(uid);
    const current = (await userRef.get()).data() || {};

    if (body.role !== undefined) {
      if (!["member", "pro", "vip", "admin"].includes(body.role)) {
        return NextResponse.json({ error: "Role must be member, pro, vip, or admin." }, { status: 400 });
      }
      // Admin elevation is reserved for the server allowlist; the UI does not grant it.
      if (body.role === "admin") {
        return NextResponse.json({ error: "Admin promotion must be performed by a trusted operator." }, { status: 403 });
      }
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid };
    if (body.role !== undefined) update.role = body.role;
    if (body.status !== undefined) {
      if (!["active", "disabled"].includes(body.status)) return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
      await adminAuth.updateUser(uid, { disabled: body.status === "disabled" });
      update.status = body.status;
    }
    if (body.access !== undefined) {
      const access = body.access || {};
      const previous = current.access || {};
      const nextAccess = {
        generalSilver: typeof access.generalSilver === "boolean" ? access.generalSilver : previous.generalSilver !== false,
        generalGold: typeof access.generalGold === "boolean" ? access.generalGold : previous.generalGold === true,
        vipLounge: typeof access.vipLounge === "boolean" ? access.vipLounge : previous.vipLounge === true,
        importantVip: typeof access.importantVip === "boolean" ? access.importantVip : previous.importantVip === true
      };
      update.access = nextAccess;
    }
    await userRef.set({
      ...update,
      email: userRecord.email || current.email || "",
      displayName: current.displayName || userRecord.displayName || userRecord.email?.split("@")[0] || "Member",
      role: body.role ?? current.role ?? "member",
      status: body.status ?? current.status ?? (userRecord.disabled ? "disabled" : "active")
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin user update failed", error);
    return NextResponse.json({ error: "Could not update this account." }, { status: 500 });
  }
}
