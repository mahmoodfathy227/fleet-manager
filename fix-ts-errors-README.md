# Fix TypeScript errors on server (FleetManager)

Your server has older code. Apply the patch **on the server**:

```bash
cd ~/FleetManager
patch -p1 < fix-ts-errors.patch
```

If you don't have the patch file on the server, either:
1. Copy `fix-ts-errors.patch` from your local Fleet project to the server, then run the command above, or
2. Ensure your server pulls from the same git remote as your local Fleet project (where the fixes are already in the source), then run `git pull` on the server.

After applying, run:
```bash
npx tsc --noEmit
npm run build
```
