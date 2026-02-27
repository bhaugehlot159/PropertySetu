# Clean Conflict-Free Delivery (Hindi + Easy)

Agar PR page me `<<<<<<<`, `=======`, `>>>>>>>` marker issues aa rahe hain, to manually edit mat karo.

## One Command (Recommended)

```bash
bash scripts/fix_conflicts_safe.sh <your-pr-branch> work
```

Example:

```bash
bash scripts/fix_conflicts_safe.sh codex/develop-complete-propertysetu-website-structure-ajuciq work
```

## Script kya karta hai?
1. Target branch checkout karta hai.
2. Half-merge state clean karta hai (`git merge --abort` if needed).
3. PR me conflict wali important files ko `work` branch se restore karta hai.
4. `<<<<<<< ======= >>>>>>>` markers scan karta hai.
5. Commit + push karta hai.

## Agar push reject aaye

```bash
git pull --rebase origin <your-pr-branch>
bash scripts/fix_conflicts_safe.sh <your-pr-branch> work
```

## Direct backup command (manual)

```bash
git checkout work -- add-property.html css/style.css index.html js/add-property.js js/location.js js/script.js server/server.js server/routes/propertyRoutes.js server/package.json client/pages/admin-portal.html client/pages/customer-portal.html client/js/admin-portal.js client/js/customer-portal.js legal/terms.html legal/privacy.html legal/refund.html legal/disclaimer.html legal/service-agreement.html
```
