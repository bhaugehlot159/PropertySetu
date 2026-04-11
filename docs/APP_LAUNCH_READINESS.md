# PropertySetu App Launch Readiness (Additive Setup)

This setup prepares the website for future Android/iOS app launch without deleting old features.

## What Is Added
- PWA manifest + service worker for installable web app shell.
- Deep-link association files:
  - `/.well-known/assetlinks.json`
  - `/.well-known/apple-app-site-association`
- Live readiness APIs:
  - `GET /api/system/app-launch-readiness` (legacy server)
  - `GET /api/v3/system/app-launch-readiness` (professional server)
- Runtime widget on homepage (`js/app-launch-readiness.js`) for install + readiness status.

## Required Production Env Variables
- `PUBLIC_WEB_ORIGIN=https://your-domain.com`
- `APP_DEEP_LINK_SCHEME=propertysetu`
- `APP_DEEP_LINK_HOST=open`
- `APP_ANDROID_PACKAGE=com.propertysetu.app`
- `APP_ANDROID_SHA256_FINGERPRINTS=AA:BB:...,...`
- `APP_IOS_BUNDLE_ID=in.propertysetu.app`
- `APP_IOS_TEAM_ID=ABCDE12345`

## Required File Updates Before Mobile Release
- Update `app-association/.well-known/assetlinks.json`
  - Replace package name/fingerprint with production values.
- Update `app-association/.well-known/apple-app-site-association`
  - Replace `TEAMID.in.propertysetu.app` with real Team ID + bundle ID.

## Quick Verification
1. Open `/manifest.webmanifest` and verify JSON loads.
2. Open `/.well-known/assetlinks.json`.
3. Open `/.well-known/apple-app-site-association`.
4. Call readiness API and ensure stage is `launch-ready` after env + IDs are configured.
