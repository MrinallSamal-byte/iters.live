# Native Android Migration Audit

## Previous Android State

The pre-migration Android implementation was not a standalone app.

- `android-app/app/src/main/java/edu/iter/eduhub/MainActivity.java` loaded `https://iter-college-management.vercel.app` inside a `WebView`.
- `android-app/app/src/main/java/edu/iter/eduhub/SplashActivity.java` was a splash-only shell around that wrapper path.
- `android-app/app/build.gradle` previously targeted `minSdk 28`, so it did not satisfy the Android 10+ requirement.
- `scripts/build-android.js` previously generated Bubblewrap/TWA-style output under `releases/android`.
- `README.md` and the older Android notes described an Android wrapper path more mature than the actual implementation.

Classification of the old Android delivery:

- Native: `No`
- WebView-based: `Yes`
- TWA/Bubblewrap-based: `Yes`, via separate scripts
- Independent from website frontend: `No`

Migration path taken:

1. Remove the WebView wrapper entrypoints and old layout shell.
2. Consolidate on one Kotlin + Jetpack Compose Android app in `android-app/`.
3. Raise Android baseline to `minSdk 29`.
4. Normalize backend contracts for native consumption.
5. Document parity, setup, and QA in the repository.

## Native Android Architecture

- Language: Kotlin
- UI: Jetpack Compose
- Navigation: Navigation Compose
- State: `AuthViewModel` + `PortalViewModel` with unidirectional `UiState`
- Networking: Retrofit + OkHttp
- Session storage: `EncryptedSharedPreferences`
- File handling: native document picker, streamed downloads, `DownloadManager`, and `FileProvider`
- App entry: single-activity Compose shell in `MainActivity.kt`

## Parity Matrix

| Website route | Native Android screen/route | Status | Backend contract |
| --- | --- | --- | --- |
| `/` | `landing` | Implemented | `/api/mobile/public` |
| `/login.html` | `login` | Implemented | `/api/auth/login` |
| `/register.html` | `register` | Implemented | `/api/auth/register-student` |
| `/creator.html` | `creator` | Implemented | `/api/mobile/public` |
| `/connect-portal.html` | `connectPortal` | Implemented with native live-sync, backup, demo, and disconnect actions | `/api/mobile/public`, `/api/portal/*` |
| `/dashboard/student.html` | `dashboard` with student session | Implemented | `/api/mobile/snapshot` |
| `/dashboard/student-attendance.html` | `studentAttendance` | Implemented | `/api/mobile/snapshot`, `/api/attendance/mark` for teacher-side updates |
| `/dashboard/student-marks.html` | `studentMarks` | Implemented | `/api/mobile/snapshot` |
| `/dashboard/student-timetable.html` | `studentTimetable` | Implemented | `/api/mobile/snapshot` |
| `/dashboard/student-notes.html` | `studentNotes` | Implemented | `/api/mobile/snapshot`, `/api/notes/*` |
| `/dashboard/student-admit-card.html` | `studentAdmit` | Implemented | `/api/mobile/snapshot`, `/api/admitcard/:id/download` |
| `/dashboard/student-events.html` | `studentEvents` | Implemented | `/api/mobile/snapshot`, `/api/events/:id/register` |
| `/dashboard/student-clubs.html` | `studentClubs` | Implemented | `/api/mobile/snapshot`, `/api/clubs/*` |
| `/dashboard/student-hostel-menu.html` | `studentHostel` | Implemented | `/api/mobile/snapshot` |
| `/dashboard/student-forum.html` | `studentForum` | Implemented | `/api/mobile/snapshot`, `/api/forum/questions*` |
| `/dashboard/student-ai-assistant.html` | `studentAi` | Implemented | `/api/ai/chat`, `/api/mobile/snapshot` |
| `/dashboard/student-payment-history.html` | `studentPaymentHistory` | Implemented | `/api/mobile/snapshot`, `/api/payments` |
| `/dashboard/student-payment-details.html` | `studentPaymentDetail/{paymentId}` | Implemented | `/api/mobile/snapshot`, `/api/payments/:paymentId/receipt` |
| `/dashboard/student-payment-make.html` | `studentPaymentMake` | Implemented | `/api/payments` |
| `/dashboard/teacher.html` | `dashboard` with teacher session | Implemented | `/api/mobile/snapshot` |
| `/dashboard/teacher-attendance.html` | `teacherAttendance` | Implemented | `/api/attendance/mark`, `/api/mobile/snapshot` |
| `/dashboard/teacher-marks.html` | `teacherMarks` | Implemented | `/api/marks/upload`, `/api/mobile/snapshot` |
| `/dashboard/teacher-assignments.html` | `teacherAssignments` | Implemented | `/api/assignments`, `/api/mobile/snapshot` |
| `/dashboard/teacher-notes.html` | `teacherNotes` | Implemented | `/api/notes/upload`, `/api/mobile/snapshot` |
| `/dashboard/teacher-question-bank.html` | `teacherQuestionBank` | Implemented | `/api/question-bank` |
| `/dashboard/teacher-rubric-creator.html` | `teacherRubrics` | Implemented | `/api/rubrics` |
| `/dashboard/teacher-students.html` | `teacherStudents` | Implemented | `/api/mobile/teacher/students`, `/api/mobile/snapshot` |
| `/dashboard/admin.html` | `dashboard` with admin session | Implemented | `/api/mobile/snapshot` |
| `/dashboard/admin-users.html` | `adminUsers` | Implemented | `/api/admin/users`, `/api/mobile/snapshot` |
| `/dashboard/admin-approvals.html` | `adminApprovals` | Implemented | `/api/admin/approvals`, `/api/mobile/snapshot` |
| `/dashboard/admin-analytics.html` | `adminAnalytics` | Implemented | `/api/admin/stats`, `/api/mobile/snapshot` |
| `/dashboard/admin-announcements.html` | `adminAnnouncements` | Implemented | `/api/admin/announcements`, `/api/mobile/snapshot` |
| `/dashboard/admin-departments.html` | `adminDepartments` | Implemented | `/api/admin/departments`, `/api/mobile/snapshot` |
| `/dashboard/admin-settings.html` | `adminSettings` | Implemented | `/api/admin/settings`, `/api/mobile/snapshot` |

Shared Android-native capabilities wired into the app:

- Notifications center
- Search
- Profile and session restore
- Native portal sync screen with live connect, backup recovery, demo fallback, and disconnect
- File center with upload/download/open
- Role-aware drawer navigation
- Deep link path mapping from the website information architecture to native routes
- Error, empty, loading, and retry states

## Backend Work Added or Updated For Android Parity

- Added app-session JWT support for native clients in `server/utils/app-session.js`.
- Added local demo auth helpers and local-mode registration fallback in `server/services/demo-auth.service.js`.
- Updated `server/routes/auth.routes.js` so native clients receive app-safe auth payloads, including registration responses without leaked password hashes.
- Updated `server/middleware/auth.js` to accept native app-session JWTs and local demo tokens.
- Replaced `server/database/db.js` with a compatibility bridge to the active SQL adapter while preserving Firebase exports.
- Added `server/routes/mobile.routes.js` and `server/services/mobile-parity.service.js` to expose native-friendly public content, snapshots, clubs, teacher roster data, announcements, and settings.
- Added `server/routes/clubs.routes.js` for join/leave/list club flows outside the web-only page layer.
- Updated `server/routes/admin.routes.js` with missing aliases and Android-facing announcements/settings responses.
- Reworked `server/controllers/admitcard.controller.js` for preview/download fallback behavior that the native app can consume.
- Extended `server/services/mobile-parity.service.js` so synced portal attendance, marks, and timetable data can feed the native student snapshot when present.
- Reworked `server/controllers/portal.controller.js` and `server/services/mobile-parity.service.js` to read/write portal imports through `server/services/soa-data.service.js`, so the website and Android app use the same normalized Firebase-backed portal store.
- Fixed broken SQL parameter wiring in `server/routes/question-bank.routes.js` so question-bank list/detail/import flows remain usable from the same backend contract.

Backend data-source split that Android now relies on:

- SQL-backed: attendance, marks, timetable, assignments, analytics, departments, announcements/settings metadata, and admin reporting
- Firebase-backed: auth/user records, files, forum, payments, AI logs/study plans, and stored portal imports under user documents
- Native app access path: always through `/api/*` routes on the Express backend, never through embedded website pages or a direct Android Firebase client

## Manual QA Checklist

- Fresh install on Android 10 / API 29 emulator or device
- Login as student, teacher, and admin
- As a student, open native portal sync and verify:
  - live connect path
  - backup recovery path
  - demo fallback path
  - disconnect path
- Logout and relaunch to verify session restore/clear behavior
- Open every role-specific screen from the drawer
- Deep-link into at least `/login.html`, `/dashboard/student-attendance.html`, and `/dashboard/admin-users.html`
- Upload a file from the native picker
- Download and open a shared file
- Open or download an admit card / receipt PDF
- Trigger search and verify results render
- Submit at least one teacher action:
  - mark attendance
  - upload marks
  - create assignment
- Submit at least one admin action:
  - create announcement
  - edit settings
  - toggle user active state
- Turn off network and verify loading/error/retry states
- Background/resume the app and confirm state/session continuity

## Remaining Limits

- Live parity still depends on the existing backend/data sources being populated. Where the current repository has missing live data, the mobile snapshot falls back to normalized demo/sample data instead of leaving native screens empty.
- Portal credential management is a real native workflow backed by `/api/portal/*`; it does not embed the website’s portal page.
- Full Gradle compile/test execution still requires local Android SDK + Gradle distribution access. The module includes unit and instrumentation tests, but this environment cannot download Gradle or Android artifacts.
