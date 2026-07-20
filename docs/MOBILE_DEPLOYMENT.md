# Mobile Build & Deployment

The HabitCraft mobile app uses [EAS Build](https://docs.expo.dev/build/introduction/) and [EAS Submit](https://docs.expo.dev/submit/introduction/) for building and deploying to iOS and Android app stores.

## Build Profiles

| Profile | Purpose | Distribution | Channel |
|---------|---------|-------------|---------|
| `development` | Local dev builds with dev client | Internal (iOS simulator) | — |
| `preview` | Internal testing builds | Internal | `preview` |
| `production` | App store releases | Store | `production` |

## CI/CD Workflows

### Preview Builds (Automatic)

Triggers on push to `master` when `mobile/` or `shared/` changes. Requires `mobile-unit-tests` to pass first.

- Runs `eas build --profile preview --platform android --non-interactive --no-wait` (Android-only until iOS credentials are configured)
- Uses `--no-wait` so CI doesn't block on EAS cloud build completion
- Builds are available in the Expo dashboard for internal testing

### Production Builds (Manual)

Triggered via:
- **Manual dispatch**: Use GitHub Actions "Run workflow" button and check the `build_mobile_production` option
- **Tag push**: Push a tag matching `mobile-v*` (e.g., `git tag mobile-v1.0.0 && git push --tags`)

This job:
1. Builds production binaries (waits for completion)
2. Submits to TestFlight (iOS) and Google Play internal track (Android)

## Local Commands

Run from `mobile/`:

```bash
npm run eas:build:dev       # Development build (both platforms)
npm run eas:build:preview   # Preview build (both platforms)
npm run eas:build:prod      # Production build (both platforms)
npm run eas:submit:prod     # Submit latest production build to stores
```

## GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `EXPO_TOKEN` | EAS CLI authentication (generate at [expo.dev](https://expo.dev/accounts/[account]/settings/access-tokens)) |

## One-Time Setup Checklist

These steps must be completed once before CI builds will work:

### 1. Expo Account & EAS Project

- [ ] Create an Expo account at [expo.dev](https://expo.dev)
- [ ] Run `npx eas-cli init` in `mobile/` to generate the EAS project ID
- [ ] Update `app.json` → `expo.extra.eas.projectId` with the generated ID
- [ ] Generate an access token at expo.dev and add it as the `EXPO_TOKEN` GitHub secret

### 2. Apple Developer Account (iOS)

- [ ] Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
- [ ] Create an App ID with bundle identifier `org.habitcraft.app`
- [ ] Update `eas.json` → `submit.production.ios` with your Apple ID, ASC App ID, and Team ID
- [ ] Run `npx eas-cli credentials --platform ios` to configure signing (EAS manages certificates in the cloud)

### 3. Google Play Console (Android)

- [ ] Create an app in [Google Play Console](https://play.google.com/console) with package `org.habitcraft.app`
- [ ] Create a service account with API access for automated uploads
- [ ] Download the service account JSON key and place it at `mobile/google-play-service-account.json`
- [ ] Add `google-play-service-account.json` to `.gitignore` (already done)

### 4. EAS Credentials

- [ ] Run `npx eas-cli credentials --platform ios` to set up iOS signing
- [ ] Run `npx eas-cli credentials --platform android` to upload the Google Play service account key

## App Identifiers

| Platform | Identifier |
|----------|-----------|
| iOS | `org.habitcraft.app` (bundle identifier) |
| Android | `org.habitcraft.app` (package name) |

## Configuration Files

| File | Purpose |
|------|---------|
| `mobile/eas.json` | EAS build profiles and submit configuration |
| `mobile/app.json` | Expo app config (identifiers, EAS project ID) |
| `.github/workflows/ci.yml` | CI jobs for preview and production builds |
