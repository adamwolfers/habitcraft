# Plan: iOS and Android Mobile Apps

**Status:** Pending
**Branch:** `feature/mobile-apps`
**Created:** 2025-12-27

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
- [ ] User authentication (login, register, logout)
- [ ] View all habits with streaks and completion status
- [ ] Mark habits complete/incomplete for any date
- [ ] Add completion notes
- [ ] Create new habits
- [ ] Edit existing habits
- [ ] Archive/unarchive habits
- [ ] View habit statistics (current streak, best streak)
- [ ] Pull-to-refresh data sync
- [ ] Offline support with sync on reconnect

### Nice to Have (Post-MVP)
- [ ] Push notifications for habit reminders
- [ ] Widget support (iOS/Android home screen widgets)
- [ ] Dark mode support
- [ ] Biometric authentication (Face ID, fingerprint)
- [ ] Haptic feedback on completion
- [ ] Confetti animation on completion (match web)

---

## Project Structure

```
/mobile
├── package.json
├── app.json                    # Expo configuration
├── App.tsx                     # Root component
├── babel.config.js
├── tsconfig.json
├── eas.json                    # EAS Build configuration
│
├── /src
│   ├── /components             # Reusable UI components
│   │   ├── HabitCard.tsx
│   │   ├── HabitCard.test.tsx
│   │   ├── CompletionButton.tsx
│   │   ├── StreakBadge.tsx
│   │   ├── NoteModal.tsx
│   │   └── ...
│   │
│   ├── /screens                # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── HabitDetailScreen.tsx
│   │   ├── CreateHabitScreen.tsx
│   │   ├── EditHabitScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── ...
│   │
│   ├── /navigation             # React Navigation setup
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   │
│   ├── /hooks                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useHabits.ts
│   │   └── useOfflineSync.ts
│   │
│   ├── /lib                    # Utilities and API
│   │   ├── api.ts              # API client
│   │   ├── storage.ts          # Secure storage wrapper
│   │   └── analytics.ts
│   │
│   ├── /types                  # TypeScript types
│   │   └── index.ts            # Re-export from shared
│   │
│   ├── /context                # React context providers
│   │   ├── AuthContext.tsx
│   │   └── HabitsContext.tsx
│   │
│   └── /theme                  # Styling and theming
│       ├── colors.ts
│       ├── spacing.ts
│       └── typography.ts
│
├── /ios                        # iOS-specific native code
├── /android                    # Android-specific native code
│
└── /__tests__                  # Integration tests
    └── ...
```

---

## Part 1: Project Setup

### Step 1: Initialize React Native Project

```bash
# Create new Expo project with TypeScript
npx create-expo-app@latest mobile --template expo-template-blank-typescript

# Install dependencies
cd mobile
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler react-native-reanimated
npm install expo-secure-store expo-splash-screen expo-status-bar
npm install @tanstack/react-query axios date-fns
npm install react-native-toast-message

# Dev dependencies
npm install --save-dev jest @testing-library/react-native
```

### Step 2: Configure TypeScript and ESLint

- [ ] Set up `tsconfig.json` matching web frontend conventions
- [ ] Configure ESLint and Prettier
- [ ] Add path aliases for cleaner imports

### Step 3: Set Up Testing Infrastructure

- [ ] Configure Jest for React Native
- [ ] Set up React Native Testing Library
- [ ] Add test scripts to `package.json`
- [ ] Create test utilities and mocks

---

## Part 2: Authentication

### Step 1: Secure Token Storage

**Files:** `src/lib/storage.ts`, `src/lib/storage.test.ts`

#### Tests
- [ ] Test: `saveTokens()` stores access and refresh tokens securely
- [ ] Test: `getTokens()` retrieves stored tokens
- [ ] Test: `clearTokens()` removes all tokens
- [ ] Test: tokens persist across app restarts

#### Implementation
- [ ] Use `expo-secure-store` for iOS Keychain / Android Keystore
- [ ] Store access token, refresh token, and expiry time
- [ ] Add token expiry checking utilities

### Step 2: API Client with Auth

**Files:** `src/lib/api.ts`, `src/lib/api.test.ts`

#### Tests
- [ ] Test: requests include Authorization header when logged in
- [ ] Test: automatically refreshes token on 401 response
- [ ] Test: clears tokens and redirects on refresh failure
- [ ] Test: queues requests during token refresh

#### Implementation
- [ ] Create axios instance with interceptors
- [ ] Add automatic token refresh logic
- [ ] Handle network errors gracefully

### Step 3: Auth Context and Hooks

**Files:** `src/context/AuthContext.tsx`, `src/hooks/useAuth.ts`

#### Tests
- [ ] Test: `login()` stores tokens and updates state
- [ ] Test: `logout()` clears tokens and updates state
- [ ] Test: `register()` creates account and logs in
- [ ] Test: restores session from secure storage on app start
- [ ] Test: `isAuthenticated` reflects current auth state

#### Implementation
- [ ] Create AuthContext with login, logout, register methods
- [ ] Add `useAuth()` hook for easy access
- [ ] Check for existing session on app startup

### Step 4: Auth Screens

**Files:** `src/screens/LoginScreen.tsx`, `src/screens/RegisterScreen.tsx`

#### Tests
- [ ] Test: login form validates email and password
- [ ] Test: login form shows error on invalid credentials
- [ ] Test: successful login navigates to dashboard
- [ ] Test: register form validates all fields
- [ ] Test: register form shows password requirements
- [ ] Test: successful registration navigates to dashboard

#### Implementation
- [ ] Create LoginScreen with email/password form
- [ ] Create RegisterScreen with full registration form
- [ ] Add loading states and error handling
- [ ] Match visual style to web app

---

## Part 3: Navigation

### Step 1: Navigation Structure

**Files:** `src/navigation/*.tsx`

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

#### Implementation
- [ ] Set up React Navigation with TypeScript
- [ ] Create auth-aware root navigator
- [ ] Create bottom tab navigator for main screens
- [ ] Add modal presentation for create/edit screens
- [ ] Configure deep linking (for future push notifications)

---

## Part 4: Core Features

### Step 1: Habits Hook

**Files:** `src/hooks/useHabits.ts`, `src/hooks/useHabits.test.ts`

#### Tests
- [ ] Test: fetches habits on mount
- [ ] Test: `toggleCompletion()` updates local state optimistically
- [ ] Test: `toggleCompletion()` syncs with server
- [ ] Test: `createHabit()` adds habit and refetches
- [ ] Test: `updateHabit()` modifies habit data
- [ ] Test: `archiveHabit()` moves habit to archived
- [ ] Test: `saveNote()` adds/updates completion note
- [ ] Test: handles offline mode with queue

#### Implementation
- [ ] Use React Query for data fetching and caching
- [ ] Implement optimistic updates for completion toggle
- [ ] Add mutation functions for all habit operations
- [ ] Queue operations when offline

### Step 2: Dashboard Screen

**Files:** `src/screens/DashboardScreen.tsx`, `src/screens/DashboardScreen.test.tsx`

#### Tests
- [ ] Test: displays loading state while fetching
- [ ] Test: displays list of habits with streaks
- [ ] Test: shows last 7 days completion buttons
- [ ] Test: tapping completion button toggles completion
- [ ] Test: pull-to-refresh reloads habits
- [ ] Test: empty state when no habits
- [ ] Test: FAB navigates to create habit screen
- [ ] Test: long-press on day opens note modal

#### Implementation
- [ ] Create scrollable list with HabitCard components
- [ ] Add pull-to-refresh with RefreshControl
- [ ] Add floating action button for creating habits
- [ ] Handle loading, error, and empty states

### Step 3: HabitCard Component

**Files:** `src/components/HabitCard.tsx`, `src/components/HabitCard.test.tsx`

#### Tests
- [ ] Test: displays habit icon and name
- [ ] Test: displays current streak
- [ ] Test: shows 7 day completion buttons
- [ ] Test: completed days show filled circle
- [ ] Test: incomplete days show empty circle
- [ ] Test: today is visually highlighted
- [ ] Test: tapping card navigates to detail screen
- [ ] Test: note indicator shows for days with notes

#### Implementation
- [ ] Create card layout matching web design
- [ ] Add touchable day buttons with haptic feedback
- [ ] Show note indicators
- [ ] Add swipe actions for quick archive (optional)

### Step 4: Create/Edit Habit Screens

**Files:** `src/screens/CreateHabitScreen.tsx`, `src/screens/EditHabitScreen.tsx`

#### Tests
- [ ] Test: form includes all habit fields
- [ ] Test: emoji picker for icon selection
- [ ] Test: color picker for habit color
- [ ] Test: frequency selector (daily, weekly, custom)
- [ ] Test: validates required fields
- [ ] Test: save button creates/updates habit
- [ ] Test: navigates back on success

#### Implementation
- [ ] Create form with all habit fields
- [ ] Add emoji picker component
- [ ] Add color picker component
- [ ] Reuse form logic between create and edit

### Step 5: Profile Screen

**Files:** `src/screens/ProfileScreen.tsx`, `src/screens/ProfileScreen.test.tsx`

#### Tests
- [ ] Test: displays user email
- [ ] Test: displays overall stats (total habits, completions)
- [ ] Test: logout button clears session and navigates to login
- [ ] Test: change password option (navigates to web for now)

#### Implementation
- [ ] Display user information
- [ ] Show aggregate statistics
- [ ] Add logout functionality
- [ ] Link to web app for advanced settings

---

## Part 5: Offline Support

### Step 1: Offline Detection

**Files:** `src/hooks/useNetworkStatus.ts`

- [ ] Use `@react-native-community/netinfo`
- [ ] Provide `isOnline` status throughout app
- [ ] Show offline banner when disconnected

### Step 2: Offline Queue

**Files:** `src/lib/offlineQueue.ts`, `src/lib/offlineQueue.test.ts`

#### Tests
- [ ] Test: operations queue when offline
- [ ] Test: queue persists across app restarts
- [ ] Test: queue processes in order when back online
- [ ] Test: failed operations retry with exponential backoff
- [ ] Test: conflicting operations are resolved correctly

#### Implementation
- [ ] Store pending operations in AsyncStorage
- [ ] Process queue when connectivity restored
- [ ] Handle conflicts (e.g., habit deleted on server)
- [ ] Show sync status indicator

### Step 3: Local Data Cache

**Files:** `src/lib/cache.ts`

- [ ] Cache habits data locally with AsyncStorage
- [ ] Show cached data immediately on app start
- [ ] Update cache when fresh data arrives
- [ ] Clear cache on logout

---

## Part 6: Polish and UX

### Step 1: Loading and Error States

- [ ] Skeleton loading screens
- [ ] Error boundaries with retry options
- [ ] Toast notifications for actions
- [ ] Pull-to-refresh everywhere

### Step 2: Animations

- [ ] Completion button press animation
- [ ] Confetti on habit completion (match web)
- [ ] Smooth list animations
- [ ] Screen transition animations

### Step 3: Accessibility

- [ ] VoiceOver (iOS) and TalkBack (Android) support
- [ ] Adequate touch target sizes
- [ ] High contrast text
- [ ] Screen reader labels on all interactive elements

### Step 4: Splash Screen and App Icon

- [ ] Design app icon (iOS and Android variants)
- [ ] Create splash screen with logo
- [ ] Configure `expo-splash-screen`

---

## Part 7: Testing

### Unit Tests
- Component rendering and interaction
- Hook logic and state management
- Utility functions
- API client methods

### Integration Tests
- Screen flows (login -> dashboard -> create habit)
- Offline mode behavior
- Data synchronization

### E2E Tests (Detox)

**Files:** `e2e/*.test.ts`

- [ ] Test: user can register new account
- [ ] Test: user can login with existing account
- [ ] Test: user can create a new habit
- [ ] Test: user can mark habit complete
- [ ] Test: user can add note to completion
- [ ] Test: user can edit habit
- [ ] Test: user can archive habit
- [ ] Test: app works offline and syncs when online
- [ ] Test: user can logout

---

## Part 8: Build and Deployment

### Step 1: Configure EAS Build

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

### Step 2: iOS Configuration

- [ ] Create Apple Developer account
- [ ] Register App ID in Apple Developer Portal
- [ ] Create provisioning profiles
- [ ] Configure app signing in EAS
- [ ] Create App Store Connect listing

### Step 3: Android Configuration

- [ ] Create Google Play Developer account
- [ ] Generate upload key
- [ ] Configure app signing in EAS
- [ ] Create Play Store listing

### Step 4: CI/CD Pipeline

- [ ] Build on every PR (preview builds)
- [ ] Automated testing before build
- [ ] Deploy to TestFlight / Internal Testing on merge to main
- [ ] Manual promotion to production

---

## Files to Create

| File | Purpose |
|------|---------|
| `mobile/package.json` | Project dependencies |
| `mobile/app.json` | Expo configuration |
| `mobile/App.tsx` | Root component |
| `mobile/tsconfig.json` | TypeScript configuration |
| `mobile/eas.json` | EAS Build configuration |
| `mobile/src/lib/api.ts` | API client |
| `mobile/src/lib/storage.ts` | Secure storage wrapper |
| `mobile/src/lib/offlineQueue.ts` | Offline operation queue |
| `mobile/src/context/AuthContext.tsx` | Authentication context |
| `mobile/src/hooks/useAuth.ts` | Auth hook |
| `mobile/src/hooks/useHabits.ts` | Habits data hook |
| `mobile/src/hooks/useNetworkStatus.ts` | Network status hook |
| `mobile/src/navigation/*.tsx` | Navigation setup |
| `mobile/src/screens/*.tsx` | Screen components |
| `mobile/src/components/*.tsx` | UI components |
| `mobile/src/theme/*.ts` | Theme constants |

---

## Files to Modify

| File | Changes |
|------|---------|
| `PROJECT_PLAN.md` | Add mobile apps to roadmap |
| `package.json` (root) | Add workspace configuration if using monorepo |

---

## Backend Considerations

### API Compatibility

The existing backend API should work without changes. Verify:

- [ ] All endpoints support token-based auth (not just cookies)
- [ ] CORS configured to allow mobile app requests
- [ ] Rate limiting appropriate for mobile usage patterns

### Potential Backend Enhancements

- [ ] Add push notification registration endpoint
- [ ] Add device token management
- [ ] Consider WebSocket for real-time sync (future)

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

## Timeline Estimate

| Phase | Description |
|-------|-------------|
| Phase 1 | Project setup, auth, navigation |
| Phase 2 | Core features (habits, completions) |
| Phase 3 | Offline support and sync |
| Phase 4 | Polish, testing, accessibility |
| Phase 5 | Build configuration and beta testing |
| Phase 6 | App store submission and launch |

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
