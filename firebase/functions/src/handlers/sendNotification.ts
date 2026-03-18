/**
 * POST /sendNotification
 * Body: audienceType, targetUserId?, routeId?, title, body, deepLink?, metadata?
 */

import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuthHeader, verifySupabaseJwt } from '../auth';
import { getSupabase } from '../supabase';
import { randomUUID } from 'crypto';

type AudienceType = 'single_user' | 'route_parents' | 'route_crew';

const PERM_MAP: Record<AudienceType, string> = {
  single_user: 'notifications.send.single',
  route_parents: 'notifications.send.route_parents',
  route_crew: 'notifications.send.route_crew',
};

export async function sendNotificationHandler(req: Request, res: Response): Promise<void> {
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

    const { uid: senderUid } = await verifySupabaseJwt(authHeader);

    const body = req.body as {
      audienceType?: AudienceType;
      targetUserId?: string;
      routeId?: number;
      title?: string;
      body?: string;
      deepLink?: string;
      metadata?: Record<string, unknown>;
    };

    const { audienceType, targetUserId, routeId, title, body: bodyText, deepLink, metadata } = body;

    if (!audienceType || !title || !bodyText) {
      res.status(400).json({ error: 'audienceType, title, and body are required' });
      return;
    }

    if (!['single_user', 'route_parents', 'route_crew'].includes(audienceType)) {
      res.status(400).json({ error: 'Invalid audienceType' });
      return;
    }

    if (audienceType === 'single_user' && !targetUserId) {
      res.status(400).json({ error: 'targetUserId is required for single_user' });
      return;
    }

    if ((audienceType === 'route_parents' || audienceType === 'route_crew') && (routeId == null || routeId === undefined)) {
      res.status(400).json({ error: 'routeId is required for route_parents and route_crew' });
      return;
    }

    // Check permissions via Supabase (service role queries RBAC tables)
    const supabase = getSupabase();
    const requiredPerm = PERM_MAP[audienceType];

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', senderUid)
      .eq('active', true);

    const roleIds = (rolesData ?? []).map((r: { role_id: number }) => r.role_id);

    let hasPermission = false;

    // Check if user has Full System Administrator (super admin) - gets all permissions
    const { data: superAdminRoles } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Full System Administrator');
    const superAdminRoleId = superAdminRoles?.[0]?.id;
    if (superAdminRoleId && roleIds.includes(superAdminRoleId)) {
      hasPermission = true;
    }

    if (!hasPermission && roleIds.length > 0) {
      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .in('role_id', roleIds);

      const permIds = Array.from(
        new Set((rpData ?? []).map((r: { permission_id: number }) => r.permission_id))
      );
      if (permIds.length > 0) {
        const { data: pData } = await supabase
          .from('permissions')
          .select('id')
          .eq('key', requiredPerm)
          .in('id', permIds);
        hasPermission = (pData ?? []).length > 0;
      }
    }

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Resolve recipients
    let recipients: string[] = [];
    if (audienceType === 'single_user') {
      recipients = [targetUserId!];
    } else if (audienceType === 'route_parents') {
      const { data: rows } = await supabase.rpc('get_route_parent_user_ids', { p_route_id: routeId });
      recipients = (rows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
    } else {
      const { data: rows } = await supabase.rpc('get_route_crew_user_ids', { p_route_id: routeId });
      recipients = (rows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
    }

    const notificationId = randomUUID();
    const db = getFirestore();

    // Write notifications/{notificationId}
    await db.collection('notifications').doc(notificationId).set({
      title,
      body: bodyText,
      deepLink: deepLink ?? null,
      metadata: metadata ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: senderUid,
      audienceType,
      routeId: routeId ?? null,
    });

    // Write inbox for each recipient
    const now = FieldValue.serverTimestamp();
    for (const recipient of recipients) {
      await db.collection('users').doc(recipient).collection('inbox').doc(notificationId).set({
        notificationId,
        createdAt: now,
        readAt: null,
      });
    }

    // Collect FCM tokens
    const tokenMap = new Map<string, string[]>();
    for (const recipient of recipients) {
      const devicesSnap = await db.collection('users').doc(recipient).collection('devices').get();
      const tokens = devicesSnap.docs.map((d) => d.data().token).filter(Boolean);
      if (tokens.length > 0) {
        tokenMap.set(recipient, tokens);
      }
    }

    const allTokens = Array.from(tokenMap.values()).flat();
    let sentCount = 0;
    let failedCount = 0;
    const invalidTokens: string[] = [];

    if (allTokens.length > 0) {
      const messaging = getMessaging();
      const message = {
        notification: { title, body: bodyText },
        data: {
          notificationId,
          deepLink: deepLink ?? '',
          audienceType,
          routeId: routeId != null ? String(routeId) : '',
        },
        tokens: allTokens,
      };

      try {
        const resp = await messaging.sendEachForMulticast(message);
        sentCount = resp.successCount;
        failedCount = resp.failureCount;
        resp.responses.forEach((r, i) => {
          if (!r.success && r.error?.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(allTokens[i]);
          }
        });
      } catch (e) {
        console.error('FCM send error:', e);
        failedCount = allTokens.length;
      }
    }

    // Remove invalid tokens
    for (const recipient of Array.from(tokenMap.keys())) {
      const tokens = tokenMap.get(recipient) ?? [];
      const toRemove = tokens.filter((t) => invalidTokens.includes(t));
      for (const token of toRemove) {
        const devicesSnap = await db.collection('users').doc(recipient).collection('devices').get();
        for (const doc of devicesSnap.docs) {
          if (doc.data().token === token) {
            await doc.ref.delete();
            break;
          }
        }
      }
    }

    res.status(200).json({
      notificationId,
      recipientCount: recipients.length,
      tokenCount: allTokens.length,
      sentCount,
      failedCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Authorization') || msg.includes('JWT') || msg.includes('Invalid')) {
      res.status(401).json({ error: msg });
      return;
    }
    console.error('sendNotification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
