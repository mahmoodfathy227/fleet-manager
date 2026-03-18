"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.myInbox = exports.markRead = exports.sendNotification = exports.registerDevice = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const supabase_js_1 = require("@supabase/supabase-js");
const jose_1 = require("jose");
const params_1 = require("firebase-functions/params");
const SUPABASE_URL = (0, params_1.defineString)("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = (0, params_1.defineString)("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_PROJECT_REF = (0, params_1.defineString)("SUPABASE_PROJECT_REF");
admin.initializeApp();
const corsHandler = (0, cors_1.default)({ origin: true });
let _supabaseService = null;
let _JWKS = null;
function getSupabaseService() {
    if (_supabaseService)
        return _supabaseService;
    const url = SUPABASE_URL.value();
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY.value();
    if (!url)
        throw new Error("SUPABASE_URL is required.");
    if (!serviceKey)
        throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
    _supabaseService = (0, supabase_js_1.createClient)(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return _supabaseService;
}
function getJWKS() {
    if (_JWKS)
        return _JWKS;
    const ref = SUPABASE_PROJECT_REF.value();
    if (!ref)
        throw new Error("SUPABASE_PROJECT_REF is required.");
    const jwksUrl = new URL(`https://${ref}.supabase.co/auth/v1/certs`);
    _JWKS = (0, jose_1.createRemoteJWKSet)(jwksUrl);
    return _JWKS;
}
async function requireSupabaseUser(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        throw new Error("Missing Authorization: Bearer <supabase_jwt>");
    }
    const jwt = authHeader.slice("Bearer ".length).trim();
    const { payload } = await (0, jose_1.jwtVerify)(jwt, getJWKS(), { algorithms: ["RS256"] });
    const uid = payload.sub;
    if (!uid || typeof uid !== "string")
        throw new Error("Invalid JWT: missing sub");
    return { uid, jwt };
}
async function getUserPermissionKeys(userId) {
    var _a;
    // Uses your RBAC tables:
    // user_roles(user_id, role_id, active) -> role_permissions(role_id, permission_id) -> permissions(id, key)
    const { data, error } = await getSupabaseService()
        .from("user_roles")
        .select("role_id, active, role_permissions(permission_id, permissions(key))")
        .eq("user_id", userId)
        .eq("active", true);
    if (error)
        throw new Error(`RBAC lookup failed: ${error.message}`);
    const keys = new Set();
    for (const ur of data !== null && data !== void 0 ? data : []) {
        const rps = (_a = ur.role_permissions) !== null && _a !== void 0 ? _a : [];
        for (const rp of rps) {
            const perm = rp.permissions;
            const key = perm === null || perm === void 0 ? void 0 : perm.key;
            if (key)
                keys.add(key);
        }
    }
    return keys;
}
function requirePermission(keys, required) {
    if (!keys.has(required))
        throw new Error(`Forbidden: missing permission ${required}`);
}
function nowTs() {
    return admin.firestore.Timestamp.now();
}
async function getRecipientUserIds(body, audienceType) {
    if (audienceType === "single_user") {
        const targetUserId = body.targetUserId;
        if (!targetUserId || typeof targetUserId !== "string")
            throw new Error("targetUserId is required for single_user");
        return [targetUserId];
    }
    const routeId = body.routeId;
    if (routeId === undefined || routeId === null || typeof routeId !== "number") {
        throw new Error("routeId (number) is required for route_parents or route_crew");
    }
    if (audienceType === "route_parents") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await getSupabaseService().rpc("get_route_parent_user_ids", { p_route_id: routeId });
        if (error)
            throw new Error(`get_route_parent_user_ids failed: ${error.message}`);
        const rows = (data !== null && data !== void 0 ? data : []);
        const ids = rows.map((r) => r.user_id).filter((x) => typeof x === "string");
        return Array.from(new Set(ids));
    }
    if (audienceType === "route_crew") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await getSupabaseService().rpc("get_route_crew_user_ids", { p_route_id: routeId });
        if (error)
            throw new Error(`get_route_crew_user_ids failed: ${error.message}`);
        const rows = (data !== null && data !== void 0 ? data : []);
        const ids = rows.map((r) => r.user_id).filter((x) => typeof x === "string");
        return Array.from(new Set(ids));
    }
    throw new Error("Invalid audienceType");
}
async function collectTokensForRecipients(recipientIds) {
    const tokenToDeviceRef = [];
    await Promise.all(recipientIds.map(async (uid) => {
        const snap = await admin.firestore().collection("users").doc(uid).collection("devices").get();
        snap.forEach((doc) => {
            const d = doc.data();
            const token = d === null || d === void 0 ? void 0 : d.token;
            if (typeof token === "string" && token.length > 10) {
                tokenToDeviceRef.push({ token, deviceRefPath: doc.ref.path });
            }
        });
    }));
    return tokenToDeviceRef;
}
async function sendFcmAndCleanupInvalid(tokenToDeviceRef, payload) {
    if (tokenToDeviceRef.length === 0) {
        return { sentCount: 0, failedCount: 0, removedInvalidCount: 0 };
    }
    // sendEachForMulticast max 500 tokens
    const chunks = [];
    for (let i = 0; i < tokenToDeviceRef.length; i += 500)
        chunks.push(tokenToDeviceRef.slice(i, i + 500));
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
        const deletes = [];
        resp.responses.forEach((r, idx) => {
            var _a;
            if (r.success)
                return;
            const code = (_a = r.error) === null || _a === void 0 ? void 0 : _a.code;
            // Common invalid token errors:
            // messaging/registration-token-not-registered
            // messaging/invalid-registration-token
            if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
                removedInvalidCount += 1;
                const path = chunk[idx].deviceRefPath;
                deletes.push(admin.firestore().doc(path).delete());
            }
        });
        if (deletes.length)
            await Promise.allSettled(deletes);
    }
    return { sentCount, failedCount, removedInvalidCount };
}
exports.registerDevice = (0, https_1.onRequest)({ region: "us-central1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b;
        try {
            if (req.method !== "POST")
                return res.status(405).json({ error: "Method not allowed" });
            const { uid } = await requireSupabaseUser(req);
            const { deviceId, token, platform } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            if (!deviceId || typeof deviceId !== "string")
                throw new Error("deviceId is required");
            if (!token || typeof token !== "string")
                throw new Error("token is required");
            if (!platform || typeof platform !== "string")
                throw new Error("platform is required");
            await admin
                .firestore()
                .collection("users")
                .doc(uid)
                .collection("devices")
                .doc(deviceId)
                .set({
                token,
                platform,
                updatedAt: nowTs(),
            }, { merge: true });
            return res.json({ ok: true });
        }
        catch (e) {
            logger.error(e);
            return res.status(400).json({ error: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : "Unknown error" });
        }
    });
});
exports.sendNotification = (0, https_1.onRequest)({ region: "us-central1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d;
        try {
            if (req.method !== "POST")
                return res.status(405).json({ error: "Method not allowed" });
            const { uid: senderUid } = await requireSupabaseUser(req);
            const perms = await getUserPermissionKeys(senderUid);
            const body = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            const audienceType = body.audienceType;
            const title = body.title;
            const messageBody = body.body;
            const deepLink = (_b = body.deepLink) !== null && _b !== void 0 ? _b : null;
            const metadata = (_c = body.metadata) !== null && _c !== void 0 ? _c : null;
            if (!audienceType || !["single_user", "route_parents", "route_crew"].includes(audienceType)) {
                throw new Error("audienceType must be one of: single_user, route_parents, route_crew");
            }
            if (!title || typeof title !== "string")
                throw new Error("title is required");
            if (!messageBody || typeof messageBody !== "string")
                throw new Error("body is required");
            // Permission gates (separate as requested)
            if (audienceType === "single_user")
                requirePermission(perms, "notifications.send.single");
            if (audienceType === "route_parents")
                requirePermission(perms, "notifications.send.route_parents");
            if (audienceType === "route_crew")
                requirePermission(perms, "notifications.send.route_crew");
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
            const payload = {
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
        }
        catch (e) {
            logger.error(e);
            return res.status(400).json({ error: (_d = e === null || e === void 0 ? void 0 : e.message) !== null && _d !== void 0 ? _d : "Unknown error" });
        }
    });
});
exports.markRead = (0, https_1.onRequest)({ region: "us-central1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b;
        try {
            if (req.method !== "POST")
                return res.status(405).json({ error: "Method not allowed" });
            const { uid } = await requireSupabaseUser(req);
            const { notificationId } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
            if (!notificationId || typeof notificationId !== "string")
                throw new Error("notificationId is required");
            const ref = admin.firestore().collection("users").doc(uid).collection("inbox").doc(notificationId);
            await ref.set({ readAt: nowTs() }, { merge: true });
            return res.json({ ok: true });
        }
        catch (e) {
            logger.error(e);
            return res.status(400).json({ error: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : "Unknown error" });
        }
    });
});
exports.myInbox = (0, https_1.onRequest)({ region: "us-central1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b;
        try {
            if (req.method !== "GET")
                return res.status(405).json({ error: "Method not allowed" });
            const { uid } = await requireSupabaseUser(req);
            const limit = Math.min(Number((_a = req.query.limit) !== null && _a !== void 0 ? _a : 50), 200);
            const inboxSnap = await admin
                .firestore()
                .collection("users")
                .doc(uid)
                .collection("inbox")
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();
            const ids = inboxSnap.docs.map((d) => d.id);
            if (ids.length === 0)
                return res.json({ items: [] });
            const notifRefs = ids.map((id) => admin.firestore().collection("notifications").doc(id));
            const notifSnaps = await admin.firestore().getAll(...notifRefs);
            const notifMap = new Map();
            notifSnaps.forEach((s) => {
                if (s.exists)
                    notifMap.set(s.id, s.data());
            });
            const items = inboxSnap.docs.map((d) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const inbox = d.data();
                const notif = (_a = notifMap.get(d.id)) !== null && _a !== void 0 ? _a : {};
                return {
                    notificationId: d.id,
                    createdAt: inbox.createdAt,
                    readAt: (_b = inbox.readAt) !== null && _b !== void 0 ? _b : null,
                    title: (_c = notif.title) !== null && _c !== void 0 ? _c : "",
                    body: (_d = notif.body) !== null && _d !== void 0 ? _d : "",
                    deepLink: (_e = notif.deepLink) !== null && _e !== void 0 ? _e : null,
                    metadata: (_f = notif.metadata) !== null && _f !== void 0 ? _f : null,
                    audienceType: (_g = notif.audienceType) !== null && _g !== void 0 ? _g : null,
                    routeId: (_h = notif.routeId) !== null && _h !== void 0 ? _h : null,
                };
            });
            return res.json({ items });
        }
        catch (e) {
            logger.error(e);
            return res.status(400).json({ error: (_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : "Unknown error" });
        }
    });
});
//# sourceMappingURL=index.js.map