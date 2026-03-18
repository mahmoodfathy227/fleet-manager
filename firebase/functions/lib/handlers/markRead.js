"use strict";
/**
 * POST /markRead
 * Body: { notificationId }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.markReadHandler = markReadHandler;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("../auth");
async function markReadHandler(req, res) {
    if (req.method !== 'POST') {
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
        const { notificationId } = req.body;
        if (!notificationId) {
            res.status(400).json({ error: 'notificationId is required' });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        const inboxRef = db.collection('users').doc(uid).collection('inbox').doc(notificationId);
        const doc = await inboxRef.get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        await inboxRef.update({
            readAt: firestore_1.FieldValue.serverTimestamp(),
        });
        res.status(200).json({ ok: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
            res.status(401).json({ error: msg });
            return;
        }
        console.error('markRead error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=markRead.js.map