# Play Store + App Store Deep Link Checklist

## Android (Play Store)
1. Confirm package name in config:
   - `APP_ANDROID_PACKAGE`
2. Add release SHA256 certificate fingerprint:
   - `APP_ANDROID_SHA256_FINGERPRINTS`
3. Verify endpoint:
   - `https://<domain>/.well-known/assetlinks.json`
4. Android test:
   - `adb shell am start -a android.intent.action.VIEW -d "https://<domain>/property-details?pid=test123"`
5. Confirm app opens directly (not browser fallback) after app install.

## iOS (App Store)
1. Confirm Team ID + Bundle ID:
   - `APP_IOS_TEAM_ID`
   - `APP_IOS_BUNDLE_ID`
2. Verify endpoint:
   - `https://<domain>/.well-known/apple-app-site-association`
3. Xcode entitlement:
   - `applinks:<domain>`
4. iOS test on device:
   - Open `https://<domain>/property-details?pid=test123`
5. Confirm app opens directly after app install.

## PropertySetu API Verification
1. Legacy readiness:
   - `GET /api/system/app-launch-readiness`
2. Pro readiness:
   - `GET /api/v3/system/app-launch-readiness`
3. Expect:
   - `stage = launch-ready`
   - `deepLinking.ready = true`
   - `webToAppReadiness.ready = true`

## Live Automation Check
Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-deeplink-live-check.ps1 -AutoStart
```
