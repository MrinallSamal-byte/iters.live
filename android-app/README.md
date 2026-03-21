# Native Android App

This module is a native Android 10+ (`minSdk 29`) client for ITER EduHub. It replaces the prior WebView wrapper with:

- Kotlin + Jetpack Compose UI
- Navigation Compose routing
- Encrypted session storage
- Retrofit + OkHttp API layer
- Role-aware dashboards for student, teacher, and admin flows
- Native upload/download helpers for files, receipts, and admit cards
- Native portal sync flow for live portal connect, backup recovery, demo fallback, and disconnect
- Native form-driven teacher, admin, and file-management actions instead of fixed wrapper payloads

## Architecture

- `app/`
  - `EduHubApplication.kt`: lightweight app graph
  - `IterEduHubApp.kt`: Compose shell, drawer, navigation, snackbar handling
- `core/model/`: serialized DTOs for auth, public content, mobile snapshot, and action payloads
- `core/network/`: Retrofit service definitions and HTTP client
- `core/data/`: repository, encrypted session store, download/open helpers
- `feature/auth/`: login and registration view models/screens
- `feature/main/`: dashboard, shared screens, and native role feature screens
- `ui/theme/`: Material 3 theme

Audit, parity inventory, backend migration notes, and the Android QA checklist live in `android-app/NATIVE_MIGRATION_AUDIT.md`.

## Setup

1. Install Android Studio with an Android 14 SDK.
2. Open `android-app/` as the Gradle project root.
3. Copy `local.properties.example` to `local.properties` and set `sdk.dir` to your Android SDK path if Android Studio does not create it for you.
4. If you need a different backend, change `BuildConfig.DEFAULT_API_BASE_URL` in `app/build.gradle`.
5. Sync Gradle and run the `app` configuration on an Android 10+ emulator or device.

## Native Screen Inventory

- Public: landing, login, register, creator, connect-portal
- Shared: dashboard, notifications, search, profile, file center
- Student: attendance, marks, timetable, notes, admit card, events, clubs, hostel menu, forum, AI assistant, payment history, payment detail, payment create
- Teacher: attendance, marks, assignments, notes/material upload, question bank, rubric creator, students
- Admin: users, approvals, analytics, announcements, departments, settings

## Tests

- Unit:
  - `./gradlew :app:testDebugUnitTest`
- Instrumentation:
  - `./gradlew :app:connectedDebugAndroidTest`

The module includes test scaffolding for:

- auth view model success path
- portal view model snapshot/search/portal-state loading
- login screen rendering
- dashboard metric rendering
- connect-portal screen rendering

## Notes

- The native client expects backend endpoints such as `/api/mobile/public`, `/api/mobile/snapshot`, and the role action endpoints already wired in the repository.
- The Android app does not ship a Firebase client configuration and does not talk to Firestore directly. It uses the same Express backend as the website.
- The website browser Firebase config lives in `client/login.html`, while the shared server-side Firebase Admin wiring used by both web and Android flows lives in `server/database/firebase.js`.
- Backend data is hybrid:
  - SQL-backed: attendance, marks, timetable, assignments, analytics, departments, and admin reporting
  - Firebase-backed: users/auth records, files, forum, payments, AI logs, and stored portal imports on user documents
- Portal sync is native. The Android app talks to `/api/portal/*` directly for status, live sync, backup recovery, demo mode, and disconnect without embedding a browser view.
- Student snapshot data can consume synced portal attendance, marks, and timetable when that backend data exists in the configured Firebase-backed portal store.
- To use the same live Firebase project as the website/backend, configure `server/serviceAccountKey.json` or the `FIREBASE_*` environment variables described in the repo root `.env.example`.
- Protected note, file, and admit-card URLs can be streamed through authenticated backend requests and opened natively from Android cache.
- File downloads can be handled either via direct backend URLs with `DownloadManager` or by caching streamed responses and opening them through `FileProvider`.
