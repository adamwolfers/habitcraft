# Reference: iOS and Android Mobile Apps

> **Task Tracking**: Implementation tasks are tracked in Beads. Run `bd list | grep Mobile` to see all related issues.

## Summary

Build native mobile applications for iOS and Android that provide the full HabitCraft experience on mobile devices. Users will be able to track habits, view streaks, mark completions, and manage their habits from their phones with a native, responsive experience.

---

## Technology Decision

### Option A: React Native (Recommended)

**Pros:**
- Share code between iOS and Android (~80-90%)
- Leverage existing React/TypeScript knowledge from Next.js frontend
- Reuse types, API client code, and business logic
- Large ecosystem and community
- Expo for faster development and easier deployment

**Cons:**
- Slightly less native feel than pure native apps
- Some platform-specific code still required

### Option B: Flutter

**Pros:**
- Single codebase for both platforms
- Excellent performance
- Beautiful, customizable widgets

**Cons:**
- Dart language learning curve
- Cannot reuse existing TypeScript code
- Smaller ecosystem than React Native

### Option C: Native (Swift + Kotlin)

**Pros:**
- Best possible native experience
- Full platform API access
- Optimal performance

**Cons:**
- Two separate codebases to maintain
- Longer development time
- Cannot reuse existing code

**Recommendation:** React Native with Expo for maximum code reuse with the existing Next.js frontend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Apps (React Native)               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │     iOS App         │    │      Android App            │ │
│  │  (App Store)        │    │      (Play Store)           │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                              │                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Shared React Native Code               ││
│  │  • Components  • Hooks  • API Client  • Types           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
                 ┌─────────────────────────┐
                 │   Existing Backend API   │
                 │   (Node.js + PostgreSQL) │
                 └─────────────────────────┘
```

### Shared Code Strategy

| Code Type | Approach |
|-----------|----------|
| TypeScript Types | Extract to shared package, import in both web and mobile |
| API Client | Extract core logic to shared package |
| Business Logic | Share utility functions where possible |
| UI Components | Platform-specific (different component libraries) |

---

## Core Features (MVP)

### Must Have
- User authentication (login, register, logout)
- View all habits with streaks and completion status
- Mark habits complete/incomplete for any date
- Add completion notes
- Create new habits
- Edit existing habits
- Archive/unarchive habits
- View habit statistics (current streak, best streak)
- Pull-to-refresh data sync
- Offline support with sync on reconnect

### Nice to Have (Post-MVP)
- Push notifications for habit reminders
- Widget support (iOS/Android home screen widgets)
- Dark mode support
- Biometric authentication (Face ID, fingerprint)
- Haptic feedback on completion
- Confetti animation on completion (match web)

---

## Project Structure

```
frontends/mobile/
├── package.json
├── app.json                    # Expo configuration
├── App.tsx                     # Root component
├── babel.config.js
├── tsconfig.json
├── eas.json                    # EAS Build configuration
│
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── HabitCard.tsx
│   │   ├── HabitCard.test.tsx
│   │   ├── CompletionButton.tsx
│   │   ├── StreakBadge.tsx
│   │   ├── NoteModal.tsx
│   │   └── ...
│   │
│   ├── screens/                # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── HabitDetailScreen.tsx
│   │   ├── CreateHabitScreen.tsx
│   │   ├── EditHabitScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── ...
│   │
│   ├── navigation/             # React Navigation setup
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useHabits.ts
│   │   └── useOfflineSync.ts
│   │
│   ├── lib/                    # Utilities and API
│   │   ├── api.ts              # API client
│   │   ├── storage.ts          # Secure storage wrapper
│   │   └── analytics.ts
│   │
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # Re-export from shared
│   │
│   ├── context/                # React context providers
│   │   ├── AuthContext.tsx
│   │   └── HabitsContext.tsx
│   │
│   └── theme/                  # Styling and theming
│       ├── colors.ts
│       ├── spacing.ts
│       └── typography.ts
│
├── ios/                        # iOS-specific native code
├── android/                    # Android-specific native code
│
└── __tests__/                  # Integration tests
    └── ...
```

---

## Navigation Structure

```
RootNavigator
├── AuthNavigator (when not logged in)
│   ├── LoginScreen
│   └── RegisterScreen
│
└── MainNavigator (when logged in)
    ├── BottomTabNavigator
    │   ├── DashboardScreen (Habits tab)
    │   └── ProfileScreen (Profile tab)
    │
    └── Modal Screens
        ├── CreateHabitScreen
        ├── EditHabitScreen
        └── HabitDetailScreen
```

---

## EAS Build Configuration

**File:** `eas.json`

```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## Security Considerations

1. **Token Storage**
   - Use platform secure storage (Keychain/Keystore)
   - Never store tokens in AsyncStorage or plain text
   - Clear tokens on logout

2. **Certificate Pinning** (Future)
   - Pin SSL certificates for API requests
   - Prevent man-in-the-middle attacks

3. **Biometric Auth** (Future)
   - Optional biometric unlock
   - Still require full auth for sensitive operations

4. **Jailbreak/Root Detection** (Future)
   - Warn users on compromised devices
   - Consider limiting functionality

---

## Success Metrics

- App Store rating > 4.5 stars
- Crash-free sessions > 99%
- API error rate < 1%
- Offline sync success rate > 99%
- User retention comparable to web app

---

## Future Enhancements (Post-Launch)

1. **Push Notifications** - Habit reminders (integrate with email reminders backend)
2. **Widgets** - iOS and Android home screen widgets
3. **Apple Watch / Wear OS** - Quick completion from watch
4. **Shortcuts/Quick Actions** - 3D Touch / long-press shortcuts
5. **Siri / Google Assistant** - Voice commands for completion
6. **Apple Health / Google Fit** - Automatic tracking for fitness habits
