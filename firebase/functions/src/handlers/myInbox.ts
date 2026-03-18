/**
 * GET /myInbox?limit=50
 * Returns user's notification inbox with full notification details
 */

import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuthHeader, verifySupabaseJwt } from '../auth';

export async function myInboxHandler(req: Request, res: Response): Promise<void> {
  if (req.method !== 'GET') {
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

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const db = getFirestore();
    const inboxSnap = await db
      .collection('users')
      .doc(uid)
      .collection('inbox')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const items: Array<{
      notificationId: string;
      title: string;
      body: string;
      createdAt: string;
      readAt: string | null;
      deepLink: string | null;
      metadata: Record<string, unknown> | null;
      audienceType: string;
      routeId: number | null;
    }> = [];

    for (const doc of inboxSnap.docs) {
      const inboxData = doc.data();
      const notificationId = doc.id;
      const notifRef = db.collection('notifications').doc(notificationId);
      const notifSnap = await notifRef.get();

      if (!notifSnap.exists) {
        continue;
      }

      const notif = notifSnap.data()!;
      items.push({
        notificationId,
        title: notif.title ?? '',
        body: notif.body ?? '',
        createdAt: (inboxData.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
        readAt: inboxData.readAt
          ? (inboxData.readAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null
          : null,
        deepLink: notif.deepLink ?? null,
        metadata: notif.metadata ?? null,
        audienceType: notif.audienceType ?? '',
        routeId: notif.routeId ?? null,
      });
    }

    res.status(200).json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
      res.status(401).json({ error: msg });
      return;
    }
    console.error('myInbox error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
