/**
 * POST /markRead
 * Body: { notificationId }
 */

import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuthHeader, verifySupabaseJwt } from '../auth';

export async function markReadHandler(req: Request, res: Response): Promise<void> {
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

    const { notificationId } = req.body as { notificationId?: string };

    if (!notificationId) {
      res.status(400).json({ error: 'notificationId is required' });
      return;
    }

    const db = getFirestore();
    const inboxRef = db.collection('users').doc(uid).collection('inbox').doc(notificationId);
    const doc = await inboxRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    await inboxRef.update({
      readAt: FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
      res.status(401).json({ error: msg });
      return;
    }
    console.error('markRead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
