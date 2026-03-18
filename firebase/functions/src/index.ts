import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { defineString } from "firebase-functions/params";

const SUPABASE_URL = defineString("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = defineString("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_PROJECT_REF = defineString("SUPABASE_PROJECT_REF");
admin.initializeApp();

const corsHandler = cors({ origin: true });

type AudienceType = "single_user" | "route_parents" | "route_crew";

let _supabaseService: ReturnType<typeof createClient> | null = null;
let _JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getSupabaseService() {
  if (_supabaseService) return _supabaseService;

  const url = SUPABASE_URL.value();
  const serviceKey = SUPABASE_SERVICE_ROLE_KEY.value();

  if (!url) throw new Error("SUPABASE_URL is required.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  _supabaseService = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _supabaseService;
}

function getJWKS() {
  if (_JWKS) return _JWKS;

  const ref = SUPABASE_PROJECT_REF.value();
  if (!ref) throw new Error("SUPABASE_PROJECT_REF is required.");

  const jwksUrl = new URL(`https://${ref}.supabase.co/auth/v1/certs`);
  _JWKS = createRemoteJWKSet(jwksUrl);

  return _JWKS;
}

async function requireSupabaseUser(req: any): Promise<{ uid: string; jwt: string }> {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing Authorization: Bearer <supabase_jwt>");
  }
  const jwt = authHeader.slice("Bearer ".length).trim();
  const { payload } = await jwtVerify(jwt, getJWKS(), { algorithms: ["RS256"] });
  const uid = payload.sub;
  if (!uid || typeof uid !== "string") throw new Error("Invalid JWT: missing sub");
  return { uid, jwt };
}

async function getUserPermissionKeys(userId: string): Promise<Set<string>> {
  // Uses your RBAC tables:
  // user_roles(user_id, role_id, active) -> role_permissions(role_id, permission_id) -> permissions(id, key)
  const { data, error } = await getSupabaseService()
    .from("user_roles")
    .select("role_id, active, role_permissions(permission_id, permissions(key))")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) throw new Error(`RBAC lookup failed: ${error.message}`);

  const keys = new Set<string>();
  for (const ur of data ?? []) {
    const rps = (ur as any).role_permissions ?? [];
    for (const rp of rps) {
      const perm = rp.permissions;
      const key = perm?.key;
      if (key) keys.add(key);
    }
  }
  return keys;
}

function requirePermission(keys: Set<string>, required: string) {
  if (!keys.has(required)) throw new Error(`Forbidden: missing permission ${required}`);
}

function nowTs() {
  return admin.firestore.Timestamp.now();
}

async function getRecipientUserIds(body: any, audienceType: AudienceType): Promise<string[]> {
  if (audienceType === "single_user") {
    const targetUserId = body.targetUserId;
    if (!targetUserId || typeof targetUserId !== "string") throw new Error("targetUserId is required for single_user");
    return [targetUserId];
  }

  const routeId = body.routeId;
  if (routeId === undefined || routeId === null || typeof routeId !== "number") {
    throw new Error("routeId (number) is required for route_parents or route_crew");
  }

  if (audienceType === "route_parents") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await getSupabaseService().rpc("get_route_parent_user_ids", { p_route_id: routeId } as any);
    if (error) throw new Error(`get_route_parent_user_ids failed: ${error.message}`);
    const rows = (data ?? []) as Array<{ user_id?: string }>;
    const ids = rows.map((r) => r.user_id).filter((x): x is string => typeof x === "string");
    return Array.from(new Set(ids));
  }

  if (audienceType === "route_crew") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await getSupabaseService().rpc("get_route_crew_user_ids", { p_route_id: routeId } as any);
    if (error) throw new Error(`get_route_crew_user_ids failed: ${error.message}`);
    const rows = (data ?? []) as Array<{ user_id?: string }>;
    const ids = rows.map((r) => r.user_id).filter((x): x is string => typeof x === "string");
    return Array.from(new Set(ids));
  }

  throw new Error("Invalid audienceType");
}

async function collectTokensForRecipients(recipientIds: string[]) {
  const tokenToDeviceRef: Array<{ token: string; deviceRefPath: string }> = [];

  await Promise.all(
    recipientIds.map(async (uid) => {
      const snap = await admin.firestore().collection("users").doc(uid).collection("devices").get();
      snap.forEach((doc) => {
        const d = doc.data() as any;
        const token = d?.token;
        if (typeof token === "string" && token.length > 10) {
          tokenToDeviceRef.push({ token, deviceRefPath: doc.ref.path });
        }
      });
    })
  );

  return tokenToDeviceRef;
}

async function sendFcmAndCleanupInvalid(
  tokenToDeviceRef: Array<{ token: string; deviceRefPath: string }>,
  payload: admin.messaging.MulticastMessage
) {
  if (tokenToDeviceRef.length === 0) {
    return { sentCount: 0, failedCount: 0, removedInvalidCount: 0 };
  }

  // sendEachForMulticast max 500 tokens
  const chunks: Array<Array<{ token: string; deviceRefPath: string }>> = [];
  for (let i = 0; i < tokenToDeviceRef.length; i += 500) chunks.push(tokenToDeviceRef.slice(i, i + 500));

  let sentCount = 0;
  let failedCount = 0;
  let removedInvalidCount = 0;

  for (const chunk of chunks) {
    const tokens = chunk.map((x) => x.token);
    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: payload.notification,
      data: payload.data,
    });

    sentCount += resp.successCount;
    failedCount += resp.failureCount;

    // Cleanup invalid tokens
    const deletes: Promise<FirebaseFirestore.WriteResult>[] = [];
    resp.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = (r.error as any)?.code as string | undefined;
      // Common invalid token errors:
      // messaging/registration-token-not-registered
      // messaging/invalid-registration-token
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        removedInvalidCount += 1;
        const path = chunk[idx].deviceRefPath;
        deletes.push(admin.firestore().doc(path).delete());
      }
    });

    if (deletes.length) await Promise.allSettled(deletes);
  }

  return { sentCount, failedCount, removedInvalidCount };
}

export const registerDevice = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { uid } = await requireSupabaseUser(req);
      const { deviceId, token, platform } = req.body ?? {};

      if (!deviceId || typeof deviceId !== "string") throw new Error("deviceId is required");
      if (!token || typeof token !== "string") throw new Error("token is required");
      if (!platform || typeof platform !== "string") throw new Error("platform is required");

      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("devices")
        .doc(deviceId)
        .set(
          {
            token,
            platform,
            updatedAt: nowTs(),
          },
          { merge: true }
        );

      return res.json({ ok: true });
    } catch (e: any) {
      logger.error(e);
      return res.status(400).json({ error: e?.message ?? "Unknown error" });
    }
  });
});

export const sendNotification = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { uid: senderUid } = await requireSupabaseUser(req);
      const perms = await getUserPermissionKeys(senderUid);

      const body = req.body ?? {};
      const audienceType = body.audienceType as AudienceType;
      const title = body.title;
      const messageBody = body.body;
      const deepLink = body.deepLink ?? null;
      const metadata = body.metadata ?? null;

      if (!audienceType || !["single_user", "route_parents", "route_crew"].includes(audienceType)) {
        throw new Error("audienceType must be one of: single_user, route_parents, route_crew");
      }
      if (!title || typeof title !== "string") throw new Error("title is required");
      if (!messageBody || typeof messageBody !== "string") throw new Error("body is required");

      // Permission gates (separate as requested)
      if (audienceType === "single_user") requirePermission(perms, "notifications.send.single");
      if (audienceType === "route_parents") requirePermission(perms, "notifications.send.route_parents");
      if (audienceType === "route_crew") requirePermission(perms, "notifications.send.route_crew");

      const recipients = await getRecipientUserIds(body, audienceType);
      if (recipients.length === 0) {
        return res.json({ notificationId: null, recipientCount: 0, tokenCount: 0, sentCount: 0, failedCount: 0 });
      }

      const notificationId = admin.firestore().collection("notifications").doc().id;
      const routeId = typeof body.routeId === "number" ? body.routeId : null;

      // Write notification doc
      await admin.firestore().collection("notifications").doc(notificationId).set({
        title,
        body: messageBody,
        deepLink,
        metadata,
        createdAt: nowTs(),
        createdBy: senderUid,
        audienceType,
        routeId,
      });

      // Write inbox docs
      const batch = admin.firestore().batch();
      for (const rid of recipients) {
        const inboxRef = admin.firestore().collection("users").doc(rid).collection("inbox").doc(notificationId);
        batch.set(inboxRef, { notificationId, createdAt: nowTs(), readAt: null }, { merge: true });
      }
      await batch.commit();

      // Send FCM
      const tokenToDeviceRef = await collectTokensForRecipients(recipients);

      const payload: admin.messaging.MulticastMessage = {
        tokens: [], // we set tokens separately when calling sendEachForMulticast
        notification: { title, body: messageBody },
        data: {
          notificationId,
          deepLink: deepLink ? String(deepLink) : "",
          audienceType: String(audienceType),
          routeId: routeId !== null ? String(routeId) : "",
        },
      };

      const { sentCount, failedCount, removedInvalidCount } = await sendFcmAndCleanupInvalid(tokenToDeviceRef, payload);

      return res.json({
        notificationId,
        recipientCount: recipients.length,
        tokenCount: tokenToDeviceRef.length,
        sentCount,
        failedCount,
        removedInvalidCount,
      });
    } catch (e: any) {
      logger.error(e);
      return res.status(400).json({ error: e?.message ?? "Unknown error" });
    }
  });
});

export const markRead = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

      const { uid } = await requireSupabaseUser(req);
      const { notificationId } = req.body ?? {};
      if (!notificationId || typeof notificationId !== "string") throw new Error("notificationId is required");

      const ref = admin.firestore().collection("users").doc(uid).collection("inbox").doc(notificationId);
      await ref.set({ readAt: nowTs() }, { merge: true });

      return res.json({ ok: true });
    } catch (e: any) {
      logger.error(e);
      return res.status(400).json({ error: e?.message ?? "Unknown error" });
    }
  });
});

export const myInbox = onRequest({ region: "us-central1" }, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

      const { uid } = await requireSupabaseUser(req);
      const limit = Math.min(Number(req.query.limit ?? 50), 200);

      const inboxSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("inbox")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const ids = inboxSnap.docs.map((d) => d.id);
      if (ids.length === 0) return res.json({ items: [] });

      const notifRefs = ids.map((id) => admin.firestore().collection("notifications").doc(id));
      const notifSnaps = await admin.firestore().getAll(...notifRefs);

      const notifMap = new Map<string, any>();
      notifSnaps.forEach((s) => {
        if (s.exists) notifMap.set(s.id, s.data());
      });

      const items = inboxSnap.docs.map((d) => {
        const inbox = d.data();
        const notif = notifMap.get(d.id) ?? {};
        return {
          notificationId: d.id,
          createdAt: inbox.createdAt,
          readAt: inbox.readAt ?? null,
          title: notif.title ?? "",
          body: notif.body ?? "",
          deepLink: notif.deepLink ?? null,
          metadata: notif.metadata ?? null,
          audienceType: notif.audienceType ?? null,
          routeId: notif.routeId ?? null,
        };
      });

      return res.json({ items });
    } catch (e: any) {
      logger.error(e);
      return res.status(400).json({ error: e?.message ?? "Unknown error" });
    }
  });
});