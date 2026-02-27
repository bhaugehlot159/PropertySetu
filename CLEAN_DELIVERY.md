# Clean Code Sync (No Conflict Markers)

If your PR shows conflicts or `<<<<<<< ======= >>>>>>>` markers, run:

```bash
bash scripts/sync_clean_code.sh <your-pr-branch> work
```

Example:

```bash
bash scripts/sync_clean_code.sh codex/develop-complete-propertysetu-website-structure-ajuciq work
```

This script will:
1. checkout your target branch
2. sync all files from clean `work` branch
3. verify no conflict markers remain
4. commit and push automatically

After it completes, refresh your PR on GitHub and click **Merge pull request**.
