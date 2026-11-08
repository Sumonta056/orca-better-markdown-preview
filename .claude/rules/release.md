---
paths:
  - "orca-plugin.json"
  - "README.md"
  - "images/**"
---

# Release

1. Set the new `version` in `orca-plugin.json` (semver: patch for fixes, minor for new features).
2. Add a "What's new in X.Y.Z" section to `README.md`.
3. If the view looks different, regenerate the images from the files in `Test/`:

   ```sh
   for f in cover tables diagram; do
     orca plugin shot local.better-markdown-preview --editor "$PWD/Test/$f.md" --width 1600 --height 1000 --out "images/$f.png"
   done
   ```

   The cover must be at least 800×500 and at most 1 MB. Each screenshot must be at least 1280×800 and at most 1.5 MB. Set the zoom to 100% first.
4. Run the checks in `CLAUDE.md`.
5. Commit on `release/vX.Y.Z`.
6. Hand the user these commands:

```
! git switch main && git merge --ff-only release/vX.Y.Z
! git push origin main
! git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
! git branch -d release/vX.Y.Z
```

The community catalog picks up the tag in about 30 minutes. Each version is permanent there: a fix is always a new version, never a moved tag.

Keep `engines.orca` at the lowest version whose fields the manifest uses (now `>=1.4.248`, because the editor sets `frame`). Keep `license` as `MIT`.
