# PropertySetu Frontend Root

This folder is the professional frontend root for live serving.

## Included

- `index.html` and all top-level UI pages
- `css/`, `js/`, `pages/`, `legal/`, `folders/`
- `live-route-map.json` for route-to-feature mapping

## Live behavior

Backend serves this root first:

1. `frontend/` (professional live root)
2. fallback to legacy root (for backward compatibility)

No legacy file is deleted.

