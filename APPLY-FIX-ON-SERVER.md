# Fix TypeScript build on server (FleetManager)

The build fails in `app/dashboard/employees/create/page.tsx` because `(driverForm as Record<string, unknown>)[completed]` is `unknown` and not valid as `ReactNode`, and `Record<string, string>` is wrong for the form type.

## Option 1: Apply patch on server

From the project root on the server:

```bash
cd ~/FleetManager
# Copy patch-employees-create-only.patch to the server (e.g. scp), then:
patch -p1 < patch-employees-create-only.patch
```

If the patch reports "offset" or "fuzz", it may still have applied; run `npm run build` to confirm. If patch fails (line numbers differ), use Option 2.

## Option 2: Manual edit on server

Edit `app/dashboard/employees/create/page.tsx` and make **two** replacements.

**1) Driver training block** — find:

```tsx
                        {(driverForm as Record<string, unknown>)[completed] && (
                          <Input type="date" name={date} value={(driverForm as Record<string, string>)[date]} onChange={handleDriverInput} className="w-40" />
                        )}
```

Replace with:

```tsx
                        {(() => {
                          const done = (driverForm as Record<string, unknown>)[completed] === true;
                          if (!done) return null as React.ReactNode;
                          const val = (driverForm as Record<string, unknown>)[date];
                          return <Input type="date" name={date} value={String(val ?? '')} onChange={handleDriverInput} className="w-40" />;
                        })()}
```

**2) PA training block** — find:

```tsx
                        {(paForm as Record<string, unknown>)[completed] && (
                          <Input type="date" name={date} value={(paForm as Record<string, string>)[date]} onChange={handlePAInput} className="w-40" />
                        )}
```

Replace with:

```tsx
                        {(() => {
                          const done = (paForm as Record<string, unknown>)[completed] === true;
                          if (!done) return null as React.ReactNode;
                          const val = (paForm as Record<string, unknown>)[date];
                          return <Input type="date" name={date} value={String(val ?? '')} onChange={handlePAInput} className="w-40" />;
                        })()}
```

Then run `npm run build`.

## Option 3: Push from this repo (D:\Fleet)

If this folder is (or is synced with) the same repo as `github.com:ali-abouelaish/FleetManager`, commit and push the fixed files so the server gets them on `git pull`:

- `app/dashboard/employees/create/page.tsx` (already fixed here)
- Optionally `app/dashboard/passengers/[id]/PassengerDetailClientFull.tsx` and `components/ui/Button.tsx` if you use the full `fix-ts-errors.patch`

Then on the server: `git pull` and `npm run build`.
