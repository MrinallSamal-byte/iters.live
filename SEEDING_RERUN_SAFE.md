# 🔁 Rerun-Safe Comprehensive Seeding

The comprehensive seeder (`server/seed/comprehensive-seed.js`) is designed to be idempotent so you can run it multiple times without duplicate key errors or broken references.

## What "rerun-safe" means

- Users (admins, teachers, students) are upserted using `INSERT ... ON DUPLICATE KEY UPDATE` with `LAST_INSERT_ID(id)` so existing rows are reused and updated.
- High-volume tables (attendance, marks, timetable, announcements, achievements, event registrations, hostel menu, assignments, submissions, fees) use `INSERT IGNORE` where appropriate to avoid duplicates.
- System settings and some file records are upserted to keep values consistent.
- Generated filenames are sanitized (e.g., `CAD/CAM` becomes `CAD_CAM`) to avoid path issues on Windows/Linux.

## How to run

```powershell
npm run seed:comprehensive
```

Optional: ensure uploads directory exists (if needed):

```powershell
npm run setup:uploads
```

## Notes

- You don’t need to drop the database to rerun the seeder.
- If you change counts (e.g., number of students/teachers), rerunning will create new users for new registration ranges and update existing ones for overlapping ranges.
- If you see any constraint errors, verify the database has proper unique keys on `users.registration_number` and `users.email`.
