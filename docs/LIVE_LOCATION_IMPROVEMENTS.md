# Live Location Improvements — Phase 1

**Completed:** 20 April 2026  
**Branch:** `main`  
**Commit:** `47af7ab`

---

## What was done

### 1. Real Samsara API data investigation

Pulled a live snapshot directly from the Samsara EU API to understand the real data shape:

- `GET /fleet/vehicles/stats?types=gps,engineStates` → 81 vehicles with live GPS + engine state
- `GET /fleet/vehicles` → 120 total assets in the Samsara account

**Why 81 vs 120?**  
39 entries are unassigned gateway devices (hardware not yet fitted to a vehicle). Their names are gateway serial numbers (e.g. `GUF6-GKK-RZ8`). The stats endpoint only returns entries that have active GPS data, so those 39 are silently excluded. This is expected behaviour — no action needed.

Raw JSON files saved locally at `out/samsara-live-response.json` and `out/samsara-vehicles-list.json` for reference.

---

### 2. Formatted street address on vehicle profile

**Problem:** The vehicle profile telematics panel was displaying raw `latitude, longitude` coordinates for "Current Location".

**Fix:** The VPS poller already writes a human-readable address (e.g. `"Tinsley Street, Sandwell, England, DY4 7LH"`) into `vehicles_realtime.formatted_location`. The API service and UI just weren't using it.

**Changes:**

| File | Change |
|------|--------|
| `lib/samsara/vehicle-tracking-service.ts` | Added `resolveFormattedLocation()` helper; added `formattedLocation` field to `live`, `lastKnown`, and `locationFallback` response branches |
| `lib/samsara/realtime-table-service.ts` | Already had `formatted_location` mapped — no change needed |
| `app/dashboard/vehicles/[id]/VehicleTelematicsPanel.tsx` | Added `realtimeFormattedLocation` state; updated realtime subscription to capture the field; added display fallback chain; swapped "Current Location" tile to show address |

**Fallback chain (in priority order):**
1. `realtimeFormattedLocation` — live push from Supabase realtime subscription
2. `live.formattedLocation` — from initial API fetch (`vehicles_realtime`)
3. `fallback.formattedLocation` — from `vehicle_locations` table (legacy)
4. `lat, lng` coordinates (5 decimal places)
5. `N/A`

---

### 3. Freshness badge

A small pill badge next to the "Live Telematics & Location" card title indicates data freshness based on `location_time`:

| Badge | Condition | Colour |
|-------|-----------|--------|
| **Live** | Updated within last 60 seconds | Green |
| **Delayed** | 1–5 minutes old | Amber |
| **Offline** | More than 5 minutes old | Grey |

---

### 4. Map marker InfoWindow

Clicking the vehicle arrow on the map now opens a popup showing the formatted street address. The content updates automatically as new realtime positions arrive.

---

## VPS Poller

The poller that writes to `vehicles_realtime` (including `formatted_location`) lives at:

```
/root/samsara_worker/   (on the VPS)
```

- **Repo:** `/root/fleet-poller/poller.js` calls the Samsara EU API every ~5 seconds and upserts into `vehicles_realtime` via a Supabase Edge Function
- **Samsara API region:** EU (`https://api.eu.samsara.com`)
- **Token location on VPS:** `/root/samsara_worker/.env` → `SAMSARA_API_TOKEN`
- **Poller secret:** `POLLER_SECRET` in `/root/fleet-poller/.env` (authenticates calls to the Edge Function)

The `formatted_location` field is populated from `gps.reverseGeo.formattedLocation` in the Samsara API response and written directly to the `formatted_location` column in `vehicles_realtime`.

---

## Next: Fuel & Distance (Phase 2)

The following fields are already available in `vehicle_telematics_latest` and the Samsara API response but not yet surfaced in the UI:

| Field | Samsara source | DB column |
|-------|---------------|-----------|
| Odometer | `obdOdometerMeters` / `gps.headingDegrees` | `odometer_km` |
| Fuel used (lifetime) | `fuelPercents` / `engineSeconds` | `fuel_used_liters` |
| Distance per session | Derived from odometer delta at session start/end | — |

Phase 2 will add per-vehicle fuel consumption and distance graphs to the vehicle profile page.
