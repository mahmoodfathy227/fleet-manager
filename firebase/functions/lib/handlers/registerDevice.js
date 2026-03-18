"use strict";
/**
 * POST /registerDevice
 * Body: { deviceId, token, platform }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeviceHandler = registerDeviceHandler;
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("../auth");
async function registerDeviceHandler(req, res) {
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
        const { deviceId, token, platform } = req.body;
        if (!deviceId || !token || !platform) {
            res.status(400).json({ error: 'deviceId, token, and platform are required' });
            return;
        }
        if (!['android', 'ios', 'web'].includes(platform)) {
            res.status(400).json({ error: 'platform must be android, ios, or web' });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        const docRef = db.collection('users').doc(uid).collection('devices').doc(deviceId);
        await docRef.set({
            token,
            platform,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        res.status(200).json({ ok: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
            res.status(401).json({ error: msg });
            return;
        }
        console.error('registerDevice error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=registerDevice.js.map