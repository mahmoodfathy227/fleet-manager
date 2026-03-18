/**
 * POST /registerDevice
 * Body: { deviceId, token, platform }
 */

import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuthHeader, verifySupabaseJwt } from '../auth';

export async function registerDeviceHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = getAuthHeader(req);
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    const { uid } = await verifySupabaseJwt(authHeader);

    const { deviceId, token, platform } = req.body as {
      deviceId?: string;
      token?: string;
      platform?: 'android' | 'ios' | 'web';
    };

    if (!deviceId || !token || !platform) {
      res.status(400).json({ error: 'deviceId, token, and platform are required' });
      return;
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      res.status(400).json({ error: 'platform must be android, ios, or web' });
      return;
    }

    const db = getFirestore();
    const docRef = db.collection('users').doc(uid).collection('devices').doc(deviceId);

    await docRef.set({
      token,
      platform,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
      res.status(401).json({ error: msg });
      return;
    }
    console.error('registerDevice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
