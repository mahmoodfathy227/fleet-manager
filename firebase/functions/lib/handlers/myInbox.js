"use strict";
/**
 * GET /myInbox?limit=50
 * Returns user's notification inbox with full notification details
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.myInboxHandler = myInboxHandler;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("../auth");
async function myInboxHandler(req, res) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const authHeader = (0, auth_1.getAuthHeader)(req);
        if (!authHeader) {
            res.status(401).json({ error: 'Missing Authorization header' });
            return;
        }
        const { uid } = await (0, auth_1.verifySupabaseJwt)(authHeader);
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const db = (0, firestore_1.getFirestore)();
        const inboxSnap = await db
            .collection('users')
            .doc(uid)
            .collection('inbox')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        const items = [];
        for (const doc of inboxSnap.docs) {
            const inboxData = doc.data();
            const notificationId = doc.id;
            const notifRef = db.collection('notifications').doc(notificationId);
            const notifSnap = await notifRef.get();
            if (!notifSnap.exists) {
                continue;
            }
            const notif = notifSnap.data();
            items.push({
                notificationId,
                title: (_a = notif.title) !== null && _a !== void 0 ? _a : '',
                body: (_b = notif.body) !== null && _b !== void 0 ? _b : '',
                createdAt: (_f = (_e = (_d = (_c = inboxData.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) === null || _e === void 0 ? void 0 : _e.toISOString()) !== null && _f !== void 0 ? _f : '',
                readAt: inboxData.readAt
                    ? (_k = (_j = (_h = (_g = inboxData.readAt) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) === null || _j === void 0 ? void 0 : _j.toISOString()) !== null && _k !== void 0 ? _k : null
                    : null,
                deepLink: (_l = notif.deepLink) !== null && _l !== void 0 ? _l : null,
                metadata: (_m = notif.metadata) !== null && _m !== void 0 ? _m : null,
                audienceType: (_o = notif.audienceType) !== null && _o !== void 0 ? _o : '',
                routeId: (_p = notif.routeId) !== null && _p !== void 0 ? _p : null,
            });
        }
        res.status(200).json({ items });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
            res.status(401).json({ error: msg });
            return;
        }
        console.error('myInbox error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=myInbox.js.map