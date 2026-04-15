# Bug: Dashboard Makes Direct Samsara API Calls Per User Per Refresh

## Summary

Every dashboard user triggers a live Samsara API call on every 30-second refresh. This means **N open tabs = N independent Samsara API calls every 30 seconds**, bypassing any backend caching or rate limiting.

---

## Call Chain

```text
LiveOperationsPanel.tsx
  setInterval(..., 30000)                          — browser timer, one per open tab
    → GET /api/dashboard/live-ops                  — Next.js route
      → getLiveOpsDashboardData()                  — lib/samsara/dashboard-query-service.ts
        → getDirectSamsaraTelemetryByVehicleId()   — makes live Samsara REST call
          → SamsaraApiClient.listVehicles()        — GET /fleet/vehicles
          → SamsaraApiClient.listVehicleStats()    — GET /fleet/vehicles/stats
```

---

## Affected Files

| File | Role in the bug |
| ---- | --------------- |
| `app/dashboard/LiveOperationsPanel.tsx` line 119 | `setInterval` fires every 30s per browser tab |
| `app/api/dashboard/live-ops/route.ts` line 21 | Calls `getLiveOpsDashboardData()` on every GET |
| `lib/samsara/dashboard-query-service.ts` line 35 | `getDirectSamsaraTelemetryByVehicleId()` — the direct Samsara call |
| `lib/samsara/dashboard-query-service.ts` line 215 | Call site where the function is invoked |

---

## Why It Exists

The two backend pg_cron jobs (`samsara-poll-on-minute`, `samsara-poll-half-minute`) that were meant to be the single source of Samsara data are currently **inactive** (`active = false` in `cron.job`). Because `vehicles_realtime` has 0 rows, the dashboard fell back to calling Samsara directly to show any data at all.

---

## Impact

- **Samsara rate limits:** `GET /fleet/vehicles/stats` allows 50 req/s. With multiple staff members on the dashboard this is not an immediate risk, but it is unnecessary and uncontrolled consumption.
- **No shared cache:** Each tab fetches independently. 5 open tabs = 5 identical Samsara calls every 30s.
- **Latency:** The direct Samsara call adds ~300–800ms to every dashboard refresh, blocking the API response.
- **Mobile app cannot use this path:** The Next.js route uses cookie-based auth — inaccessible to the Flutter app.

---

## Planned Fix (Live Tracking Overhaul)

See `docs/LIVE_TRACKING_CONTEXT.md` for the full plan. In summary:

1. A single backend poller (cron job → Edge Function, **or** Kafka consumer on VPS) writes to `vehicles_realtime` — one Samsara call for all users.
2. All dashboard clients subscribe to **Supabase Realtime** on `vehicles_realtime` — zero Samsara calls from the browser.
3. `getDirectSamsaraTelemetryByVehicleId()` is removed from `dashboard-query-service.ts` entirely.

---

## Temporary Workaround

None in place. The direct call is the only reason vehicle positions show on the dashboard today (since `vehicles_realtime` is empty). Removing it before the replacement is live would break the map.
