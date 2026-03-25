# GitHub Copilot Instructions

## Pre-Implementation Checklist

Before writing, editing, or deleting **any** line of code in this codebase:

1. **Verify the Supabase table schema** — confirm every column referenced in a query or insert actually exists in the live database (`information_schema.columns`). Never assume a migration has been applied.
2. **Verify API endpoints** — confirm the route handler exists and accepts the expected method/params before calling it from the frontend.
3. **Check RLS policies** — confirm the authenticated user's permissions allow the intended operation (SELECT / INSERT / UPDATE / DELETE) on the affected table.
4. **Check storage buckets** — if a file upload is involved, confirm the target bucket exists and is accessible.

> Skipping these checks is the primary cause of runtime errors in this project (e.g. `PGRST204 column not found`, `400 Bad Request`, `Bucket not found`).

---

## Date Formatting

All dates displayed to users **must** use the format `21 March 2025` (day-month-year, full month name, no ordinal suffix).

### Use the centralised utility functions from `@/lib/utils`

| Need | Function | Output example |
|------|----------|----------------|
| Date only | `formatDate(value)` | `21 March 2025` |
| Date + time | `formatDateTime(value)` | `21 March 2025, 14:30` |
| HTML `<input type="date">` value | `formatDateForInput(value)` | `2025-03-21` (internal only) |
| HTML `<input type="datetime-local">` value | `formatDateTimeForInput(value)` | `2025-03-21T14:30` (internal only) |

### Rules

- **Always** import `formatDate` or `formatDateTime` from `@/lib/utils` for any user-visible date.
- **Never** use `.toLocaleDateString()` or `.toLocaleString()` without explicit locale and options.
- **Never** use `'en-US'` locale for displayed dates.
- **Never** use `month: 'short'` (e.g. `Mar`) for displayed dates — use `month: 'long'` (e.g. `March`).
- **Never** define a local `formatDate` or `formatDateTime` function inside a component — always use the shared utility.
- date-fns `format()` patterns must use `'d MMMM yyyy'` (not `'d MMM yyyy'`) for displayed dates.
- `YYYY-MM-DD` strings (e.g. from `toISOString().split('T')[0]`) are acceptable for **database writes and input values only** — never render them directly to the user.

### Exceptions

- TR5 / TR6 / TR7 official incident report form fields use `dd/MM/yyyy` as required by the form template — do not change these.
