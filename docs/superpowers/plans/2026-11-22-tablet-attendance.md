# Absen Tablet Cabang (PWA offline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crew clock in/out and take breaks on one paired tablet per outlet, with on-device face recognition, an offline queue that syncs exactly once, and HR review of anything doubtful.

**Architecture:** The backend gets a `kiosk` module (device pairing, bootstrap, event ingest, identify) guarded by a device token, plus a pure rules file that decides how each event changes a crew member's day. Events land in a new `AttendanceEvent` log and are applied to the existing `Attendance`/`AttendanceBreak` tables so payroll, KPI and corrections keep working. The tablet is a client-only PWA at `/absen` in web-admin that runs `@vladmandic/human` in the browser, keeps roster and queue in IndexedDB, and syncs every 5 minutes.

**Tech Stack:** NestJS 10, Prisma 5 (`db push`), PostgreSQL; Next.js 14 app router, Tailwind; `@vladmandic/human` 3.3.6 (browser + server); IndexedDB; Flutter (crew app).

**Spec:** `docs/superpowers/specs/2026-11-22-tablet-attendance-design.md`

## Global Constraints

- Zero Mock Policy: every screen reads real API data; no placeholder numbers.
- All copy in Indonesian, plain, matching existing web-admin tone and design classes (`btn`, `card`, `input`, `badge-*`, `alert-error`, `empty-state`).
- Schema changes are additive only and applied with `prisma db push`; existing rows must stay valid (new columns nullable or defaulted).
- Face match threshold: same value as server, `FACE_MATCH_THRESHOLD` (default 0.5); the tablet receives it in bootstrap.
- Pairing code: 8 characters, valid 15 minutes, single use. Device token: ≥ 32 random bytes, stored server-side as SHA-256 hash.
- Bootstrap interval 5 minutes and on reconnect. Guest roster window: today through today+3.
- Queue limit: 7 days or 2000 events; warn before the limit.
- Clock-change tolerance: 2 minutes. Open-attendance window for break/clock-out after midnight: 16 hours.
- Photos: JPEG, longest side 480 px, stored privately like existing attendance photos (`saveAttendancePhoto`).
- PIN: 6 digits, bcrypt hash on `EmployeeProfile`; never sent to or stored on the tablet except inside a queued PIN event, deleted once sent.
- Rate limit `POST /kiosk/identify` and PIN events: max 10 failed attempts per device per 10 minutes.
- The tablet never shows another crew member's monthly recap.
- Push and deploy only when the owner says so.

## Review Focus

1. **The same queued batch sent twice** (tablet loses the response and retries): expect identical responses and no duplicate `Attendance`/break rows. Test in Task 4.
2. **Events arriving out of order or days late** (tablet offline over a weekend): expect each applied to the right date and lateness from the event time, not receive time. Test in Task 4.
3. **Clock-out after midnight** for a shift that started the evening before: expect it attaches to the open attendance, not a new date. Test in Task 1 and Task 4.
4. **Tablet revoked while it still has unsent events**: expect the tablet to wipe local data on 401 and the admin to see when it was last online. Test in Task 2 (server) and Task 9 (client).
5. **A crew member whose face is not enrolled** using PIN: expect the event applied provisionally with `NO_FACE` and listed for review, never blocked. Test in Task 4.

---

## File Structure

Backend (`backend/`):
- `prisma/schema.prisma` — new models/enums/columns (Task 1).
- `src/modules/kiosk/kiosk.rules.ts` — pure decision functions, no Prisma (Task 1).
- `src/modules/kiosk/device-auth.guard.ts` — device token guard, puts `{ deviceId, outletId }` on the request (Task 2).
- `src/modules/kiosk/devices.service.ts` / `devices.controller.ts` — admin: pairing codes, list, revoke; tablet: pair (Task 2).
- `src/modules/kiosk/bootstrap.service.ts` — roster/recap payload (Task 3).
- `src/modules/kiosk/events.service.ts` — ingest + apply (Task 4).
- `src/modules/kiosk/review.service.ts` / `review.controller.ts` — review list, accept/reject (Task 5).
- `src/modules/kiosk/kiosk.controller.ts`, `kiosk.dto.ts`, `kiosk.module.ts`.
- `src/modules/attendance/attendance.service.ts` — `punctuality` signature change, phone block (Tasks 4, 6).
- `src/modules/employees/*` — PIN endpoints (Task 6).
- `src/modules/schedules/*` — `outletId` on entries (Task 3).
- `test/kiosk.rules.test.js` — node:test for rules (Task 1).
- `scripts/e2e-kiosk.mjs` — API test against a scratch database (Tasks 2–6).

Web admin (`web-admin/`):
- `src/components/AuthGuard.tsx` — skip `/absen` (Task 8).
- `src/components/OutletDevicesPanel.tsx`, edits in `OutletMasterModule.tsx`, `WorkScheduleModule.tsx`, `DailyAttendanceModule.tsx`, `EmployeeDialog.tsx` (Task 7).
- `src/components/AttendanceReviewModule.tsx` (Task 7).
- `src/app/absen/page.tsx`, `src/app/absen/manifest.webmanifest`, `public/absen-sw.js`, `public/models/human/*` (Task 8).
- `src/lib/kiosk/db.ts` (IndexedDB), `sync.ts`, `status.ts`, `face.ts`, `api.ts` (Tasks 8–9).
- `src/components/kiosk/*` — screens (Task 9).

Crew app (`mobile_user/`): `lib/screens/home_screen.dart`, `lib/services/api_service.dart`, new `lib/screens/attendance_pin_dialog.dart` (Task 10).

---

### Task 1: Schema and the rules that decide each event

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/modules/kiosk/kiosk.rules.ts`
- Test: `backend/test/kiosk.rules.test.js`

**Interfaces:**
- Produces (schema):
  - `enum AttendanceMode { MOBILE TABLET }`; `Outlet.attendanceMode AttendanceMode @default(MOBILE)`.
  - `enum AttendanceSource { MOBILE TABLET }`; `Attendance.source AttendanceSource @default(MOBILE)`, `Attendance.deviceId String?` (relation to `AttendanceDevice`, onDelete SetNull), `Attendance.isGuest Boolean @default(false)`, `Attendance.flags String[] @default([])`.
  - `ShiftSchedule.outletId String?` + relation `Outlet` (onDelete SetNull).
  - `EmployeeProfile.attendancePinHash String?`.
  - `model AttendanceDevice { id, outletId, name, tokenHash @unique, pairedAt, lastSeenAt?, revokedAt?, createdById→User }`.
  - `model AttendanceDevicePairing { code @id, outletId, deviceName, expiresAt, usedAt?, createdById→User }`.
  - `enum KioskEventType { CLOCK_IN BREAK_START BREAK_END CLOCK_OUT }`, `enum KioskMethod { FACE_LOCAL FACE_SERVER PIN }`, `enum AttendanceEventStatus { APPLIED NEEDS_REVIEW REJECTED }`.
  - `model AttendanceEvent { id String @id (UUID from tablet), deviceId, employeeId, outletId, type, method, deviceTime, offsetAtEventMs Int, effectiveTime, localScore Float?, serverScore Float?, photoPath String?, status, applied Boolean, reason String?, flags String[], attendanceId String?, reviewedById String?, reviewedAt DateTime?, receivedAt @default(now()) }` with `@@index([status, outletId])`, `@@index([employeeId, effectiveTime])`.
  - Flag values (string constants exported from rules): `OFFLINE`, `PIN`, `GUEST`, `UNSCHEDULED`, `CLOCK_CHANGED`, `FACE_REVIEW`, `NO_FACE`, `PENDING_REVIEW`.
- Produces (rules, all pure):
  - `effectiveTime(deviceTime: Date, offsetAtEventMs: number): Date` — `deviceTime + offset` (offset = server − device).
  - `clockChanged(offsetAtEventMs: number, offsetNowMs: number, toleranceMs = 120_000): boolean`.
  - `wasOffline(effective: Date, receivedAt: Date): boolean` — received more than 2 minutes after effective.
  - `interface DayState { attendanceId: string; clockIn: Date; clockOut: Date | null; openBreakStart: Date | null }`
  - `OPEN_ATTENDANCE_MAX_MS = 16 * 3600_000`
  - `isOpen(state: DayState | null, at: Date): boolean` — clocked in, not out, `at − clockIn ≤ 16h`.
  - `checkTransition(state: DayState | null, type: KioskEventType, at: Date): { ok: true; closeBreakAt?: Date } | { ok: false; reason: string }`
    - CLOCK_IN: ok when no open state and no attendance already clocked in on that calendar date (caller passes the state of that date's row or the open row); else `'Sudah absen masuk'`.
    - BREAK_START: needs open state and no open break; else `'Belum absen masuk'` / `'Masih istirahat'`.
    - BREAK_END: needs open break; else `'Tidak sedang istirahat'`.
    - CLOCK_OUT: needs open state; with open break → `{ ok: true, closeBreakAt: at }`.
    - `at` earlier than `state.clockIn` → `'Waktu sebelum absen masuk'`.

- [ ] **Step 1: Add the schema changes above**, run `npx prisma format && npx prisma validate`. Expected: valid.
- [ ] **Step 2: Write failing tests** in `test/kiosk.rules.test.js` (require from `../dist/modules/kiosk/kiosk.rules`):
  - `effectiveTime(new Date('2026-11-22T01:00:00Z'), 90_000)` equals `2026-11-22T01:01:30Z`.
  - `clockChanged(5_000, 100_000) === false`; `clockChanged(5_000, 200_000) === true`.
  - CLOCK_IN with `null` state → ok; with state clocked in today → `{ ok:false, reason:'Sudah absen masuk' }`.
  - CLOCK_OUT at 01:30 for clockIn 18:00 previous day → ok (open within 16h); at 11:00 next day → `'Belum absen masuk'`.
  - CLOCK_OUT with open break → `{ ok:true, closeBreakAt: at }`.
  - BREAK_END without open break → `'Tidak sedang istirahat'`.
  - Any event with `at < clockIn` → `'Waktu sebelum absen masuk'`.
- [ ] **Step 3: Run** `npm test`. Expected: new tests FAIL (module missing), payroll tests still pass.
- [ ] **Step 4: Implement `kiosk.rules.ts`** with the signatures above.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit** `feat(kiosk): schema and event rules for tablet attendance`.

### Task 2: Tablet pairing, device guard, outlet mode

**Files:**
- Create: `backend/src/modules/kiosk/{kiosk.module.ts,kiosk.dto.ts,device-auth.guard.ts,devices.service.ts,devices.controller.ts}`, `backend/scripts/e2e-kiosk.mjs`
- Modify: `backend/src/app.module.ts`, `backend/src/modules/outlets/{outlets.dto.ts,outlets.service.ts}`

**Interfaces:**
- Produces HTTP (admin, JWT, roles Super Admin/HR; Store Manager read-only for own outlet):
  - `POST /outlets/:id/devices/pairing` body `{ deviceName: string (1–40) }` → `{ code, expiresAt }`.
  - `GET /outlets/:id/devices` → `[{ id, name, pairedAt, lastSeenAt, revokedAt }]`.
  - `POST /outlets/:id/devices/:deviceId/revoke` → `{ ok: true }`.
  - `attendanceMode` accepted in the existing outlet update DTO (`IsEnum(AttendanceMode)`).
- Produces HTTP (tablet, no auth): `POST /kiosk/pair` body `{ code }` → `{ token, device: { id, name }, outlet: { id, name } }`. Wrong/expired/used code → 400 `'Kode tidak berlaku'`; counts toward rate limit by IP.
- Produces: `DeviceAuthGuard` reads `Authorization: Bearer <token>`, hashes, finds a non-revoked device, updates `lastSeenAt` (at most once a minute), sets `req.device = { deviceId: string; outletId: string }`; else 401. Decorator `@CurrentDevice()`.

- [ ] **Step 1: Write `scripts/e2e-kiosk.mjs`** (plain `fetch`, base URL from `E2E_API`, admin login from `E2E_ADMIN_USER`/`E2E_ADMIN_PASS`) with checks: create pairing → pair → token works on `GET /kiosk/bootstrap` stub (200) → second pair with same code 400 → revoke → token 401; expired code (set `expiresAt` in the past via psql in the script) 400.
- [ ] **Step 2: Run it** against the scratch stack (backend on 3100 with database `hris_barokah_e2e`, see `deploy` notes). Expected: FAIL (routes missing).
- [ ] **Step 3: Implement** module, guard, services, controller; `kiosk.controller.ts` gets a temporary `GET /kiosk/bootstrap` returning `{ outletId }` (filled in Task 3). Codes from an alphabet without look-alikes (no 0/O/1/I).
- [ ] **Step 4: Run** the script. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(kiosk): pair tablets to an outlet`.

### Task 3: Bootstrap payload and "bertugas di cabang" on schedules

**Files:**
- Create: `backend/src/modules/kiosk/bootstrap.service.ts`
- Modify: `backend/src/modules/kiosk/kiosk.controller.ts`, `backend/src/modules/schedules/{schedules.dto.ts,schedules.service.ts}`, `backend/scripts/e2e-kiosk.mjs`

**Interfaces:**
- `ScheduleEntryDto.outletId?: string` (IsUUID, optional; must be an active outlet; HR/Super Admin may pick any outlet, Store Manager only their own for crew of their outlet). `findRange` returns `outletId` per entry.
- `GET /kiosk/bootstrap` (DeviceAuthGuard) →
```ts
{
  serverTime: string;                 // ISO
  matchThreshold: number;
  outlet: { id; name; hours: OutletHours; breakLimitMins: number };
  holidays: string[];                 // YYYY-MM-DD, today..+7
  roster: { employeeId; fullName; positionTitle; homeOutletName; isGuest: boolean;
            guestDates: string[];     // dates scheduled here (guests only)
            embeddings: number[][];   // [] when no face enrolled
            hasPin: boolean }[];
  directory: { employeeId; fullName; homeOutletName }[];   // all active crew, no embeddings
  today: { employeeId; clockIn: string|null; clockOut: string|null; openBreakStart: string|null; lateMinutes: number }[];
  recap: { employeeId; days: { date; clockIn; clockOut; lateMinutes; breakMinutes; workMinutes }[] }[]; // home crew, current month
}
```
  - Roster = active crew whose home outlet is this outlet, plus crew with a `ShiftSchedule` row where `outletId` = this outlet and date in today..today+3. Admin roles excluded.
  - `today` covers attendances at this outlet with date = today, plus open attendances from yesterday (16h rule).

- [ ] **Step 1: Extend the e2e script**: schedule crew B (home outlet 2) at outlet 1 for tomorrow → bootstrap of outlet 1 includes B with `isGuest: true`; schedule for today+5 → not included; crew of outlet 2 without schedule → only in `directory`; response has no `embeddings` key inside `directory`; `recap` contains only home crew.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** schedule `outletId` and `BootstrapService.build(outletId: string): Promise<BootstrapPayload>`.
- [ ] **Step 4: Run.** Expected: PASS. Also run the web-admin typecheck (schedule type gained a field).
- [ ] **Step 5: Commit** `feat(kiosk): bootstrap roster with scheduled guest crew`.

### Task 4: Event ingest, server face re-check, identify

**Files:**
- Create: `backend/src/modules/kiosk/events.service.ts`
- Modify: `backend/src/modules/kiosk/{kiosk.controller.ts,kiosk.dto.ts}`, `backend/src/modules/attendance/attendance.service.ts`, `backend/src/modules/face/face-enrollment.service.ts`, `backend/scripts/e2e-kiosk.mjs`

**Interfaces:**
- Consumes: Task 1 rules, Task 2 guard.
- `AttendanceService.punctuality(employeeId: string, outlet: OutletHours, date: Date, at: Date)` — same body, `today/now` renamed; existing callers pass `today, now`. Schedule lookup unchanged.
- `FaceEnrollmentService.scoreAgainst(employeeId: string, photo: Buffer): Promise<{ score: number | null; enrolled: boolean; reason: string | null }>` — no throw, no `FaceCheckLog` write; `verifyForAttendance` reuses it.
- `FaceEnrollmentService.identify(photo: Buffer, excludeOutletId?: string): Promise<{ employeeId: string; score: number } | null>` — best match ≥ threshold across active crew.
- `POST /kiosk/events` body `{ deviceNow: string; events: KioskEventDto[] (1–200) }`, `KioskEventDto = { id: UUID; employeeId: UUID; type; method; deviceTime: ISO; offsetAtEventMs: int; localScore?: number; photoBase64: string; pin?: string /^\d{6}$/ }` → `{ results: { id; status: AttendanceEventStatus; reason: string | null }[] }`.
- `POST /kiosk/identify` body `{ photoBase64 }` → `{ employeeId, fullName, homeOutletName, score } | 404 'Wajah tidak dikenali'`.
- Apply algorithm per event, in `effectiveTime` order within the batch, each in its own transaction:
  1. Existing `AttendanceEvent` with same id → return its stored status/reason (no other work).
  2. `effective = effectiveTime(...)`; `offsetNow = receivedAt − deviceNow`; flags: `CLOCK_CHANGED` if `clockChanged`, `OFFLINE` if `wasOffline`, `GUEST` if home outlet ≠ device outlet, `UNSCHEDULED` if guest and no schedule here that date, `PIN` for PIN method.
  3. PIN method: no PIN set or wrong → REJECTED `'PIN salah'` (not applied). 
  4. Save photo; `scoreAgainst`: not enrolled → `NO_FACE`; score < threshold → `FACE_REVIEW`.
  5. Load state: CLOCK_IN → row for `employeeId` + calendar date of `effective`; others → open row via `isOpen`. `checkTransition`. Not ok → store NEEDS_REVIEW, `applied=false`, reason from rules.
  6. Ok → write `Attendance` (create on CLOCK_IN with `outletId` = device outlet, `source=TABLET`, `deviceId`, `isGuest`, `punctuality(...)` with device outlet hours) or update/insert break. Merge flags into `Attendance.flags`; add `PENDING_REVIEW` when any of `CLOCK_CHANGED, FACE_REVIEW, NO_FACE, UNSCHEDULED, PIN` is present → event NEEDS_REVIEW `applied=true`; else APPLIED.
- Unique-id insert must be the idempotency gate: a concurrent duplicate hits the primary key and returns the stored row.

- [ ] **Step 1: Extend e2e script** (photos: enrolled test face JPEG from `backend/test/fixtures/` — add one enrolled and one different face): 
  - CLOCK_IN with matching face → APPLIED, `Attendance.source = TABLET`.
  - Same batch posted twice → identical results, one `Attendance`, one event row.
  - BREAK_START, CLOCK_OUT while on break → break closed at clock-out time.
  - CLOCK_IN at 18:00 day D, CLOCK_OUT at 01:30 D+1 sent in one batch 3 days later → one attendance dated D, `lateMinutes` computed from 18:00 vs D's start, flag `OFFLINE`.
  - Second CLOCK_IN same day → NEEDS_REVIEW `applied=false`, reason `'Sudah absen masuk'`.
  - Wrong face → NEEDS_REVIEW `applied=true`, flags include `FACE_REVIEW`, `PENDING_REVIEW`.
  - PIN for crew without face enrolled → NEEDS_REVIEW applied with `NO_FACE`; wrong PIN → REJECTED.
  - `offsetAtEventMs` differing from current offset by 5 minutes → `CLOCK_CHANGED`.
  - Identify with the enrolled face → that employee; with unknown face → 404; 11 failures in a row → 429.
  - 11 wrong-PIN events from one device within 10 minutes → the 11th and later come back REJECTED `'Terlalu banyak PIN salah, coba lagi nanti'`.
  - Existing mobile clock-in path still works (regression).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** as specified.
- [ ] **Step 4: Run** script and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(kiosk): ingest tablet events exactly once`.

### Task 5: Review list, accept and reject

**Files:**
- Create: `backend/src/modules/kiosk/{review.service.ts,review.controller.ts}`
- Modify: `backend/scripts/e2e-kiosk.mjs`

**Interfaces:**
- `GET /attendance-review?status=NEEDS_REVIEW|REJECTED&outletId=&from=&to=` (Super Admin, HR: all; Store Manager: events whose `outletId` is their outlet) → `[{ id, type, method, effectiveTime, status, applied, reason, flags, employee: { id, fullName, homeOutletName }, outlet: { id, name }, photoUrl, enrolledPhotoUrl, localScore, serverScore }]`.
- `POST /attendance-review/:id/accept` → event APPLIED (keeps `applied` value); when no other NEEDS_REVIEW applied event remains on that attendance, remove `PENDING_REVIEW` from `Attendance.flags`.
- `POST /attendance-review/:id/reject` (only for `applied=true`): CLOCK_IN → delete that attendance's breaks and row (only if `source=TABLET`), mark the event and every other event linked to it REJECTED reason `'Absen masuk ditolak'`; BREAK_START/BREAK_END → remove/clear that break; CLOCK_OUT → clear `clockOut*` fields. For `applied=false` reject only marks it REJECTED.
- Both record `reviewedById`, `reviewedAt`; already-reviewed event → 400 `'Sudah ditinjau'`.

- [ ] **Step 1: Extend e2e**: Store Manager of outlet 2 cannot see/accept outlet 1 events (403/empty); accept clears `PENDING_REVIEW`; reject CLOCK_IN removes the attendance and marks the day's other events REJECTED; double accept → 400.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(kiosk): review doubtful tablet attendance`.

### Task 6: Phone block and attendance PIN

**Files:**
- Modify: `backend/src/modules/attendance/{attendance.service.ts,attendance.controller.ts}`, `backend/src/modules/employees/{employees.controller.ts,employees.service.ts,employees.dto.ts}`, `backend/scripts/e2e-kiosk.mjs`

**Interfaces:**
- `AttendanceService.workingOutletToday(employeeId: string): Promise<Outlet>` — today's `ShiftSchedule.outletId` outlet, else home outlet. `clockIn/clockOut/startBreak/endBreak` throw 400 `'Absen di tablet cabang'` when that outlet's mode is TABLET.
- `GET /attendance/today` adds `attendanceMode: 'MOBILE' | 'TABLET'` and `workingOutletName`.
- `PUT /me/attendance-pin` body `{ pin: /^\d{6}$/, password }` (crew; wrong password 400).
- `PUT /employees/:id/attendance-pin` body `{ pin }` (Super Admin, HR); `GET /employees/:id` returns `hasAttendancePin: boolean`, never the hash.

- [ ] **Step 1: e2e**: outlet 1 set TABLET → crew of outlet 1 phone clock-in 400 with that message; same crew scheduled today at MOBILE outlet 2 → phone clock-in allowed; crew sets PIN with wrong password 400, right password 200; HR sets PIN → PIN event in Task 4 flow accepted.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(attendance): close phone attendance at tablet outlets; attendance PIN`.

### Task 7: Web admin screens

**Files:**
- Create: `web-admin/src/components/OutletDevicesPanel.tsx`, `web-admin/src/components/AttendanceReviewModule.tsx`
- Modify: `OutletMasterModule.tsx`, `WorkScheduleModule.tsx`, `DailyAttendanceModule.tsx`, `EmployeeDialog.tsx`, `src/app/page.tsx` (menu entry "Perlu ditinjau" under Presensi with a count badge)

**Interfaces:** consumes Tasks 2, 3, 5, 6 endpoints exactly as defined there.

- Outlet edit: "Mode absen" segmented (HP / Tablet) with a one-line explanation; devices panel: list (name, terakhir online relative, "Tidak online > 24 jam" badge, Cabut with inline confirm), "Pasangkan tablet" → device name → shows the code large with countdown and the instruction "Buka hris.barokahgroupindonesia.tech/absen di tablet, masukkan kode ini".
- Schedule grid: per working cell, optional "Bertugas di" outlet select (default cabang asal); guest cells show the outlet short name.
- Presensi Harian: column Sumber (HP/Tablet) and badges for flags (Indonesian labels: Offline, PIN, Kru tamu, Tidak terjadwal, Jam tablet berubah, Wajah perlu dicek, Belum daftar wajah, Menunggu tinjauan).
- Perlu ditinjau: tabs Menunggu / Ditolak; rows with absen photo next to enrolled photo, reason, time, outlet; Terima / Tolak with inline confirm describing the effect (for CLOCK_IN reject: "Absen hari ini dibatalkan").
- Employee dialog: "PIN absen: sudah/belum diatur" + "Atur PIN" (6 digit input).

- [ ] **Step 1: Implement**, run `npx tsc --noEmit -p .` → no errors.
- [ ] **Step 2: Browser check** on the scratch stack at 1280 px and 768 px: pair code shows and expires, mode switch saves, schedule guest cell saves and reloads, review accept/reject updates the list and Presensi Harian.
- [ ] **Step 3: Commit** `feat(web): tablet devices, attendance review, guest schedules, PIN`.

### Task 8: `/absen` PWA shell, pairing and sync

**Files:**
- Modify: `web-admin/src/components/AuthGuard.tsx` (pass-through for paths starting `/absen`), `web-admin/package.json` (`@vladmandic/human` exact `3.3.6`, same as backend lockfile)
- Create: `web-admin/src/app/absen/{page.tsx,layout.tsx}`, `web-admin/public/absen.webmanifest`, `web-admin/public/absen-sw.js`, `web-admin/public/models/human/` (copy of the model files the backend config uses: face detector, mesh, description, plus antispoof and liveness), `web-admin/src/lib/kiosk/{db.ts,api.ts,sync.ts,status.ts}`

**Interfaces:**
- `db.ts` (IndexedDB "hris-absen", stores `config`, `bootstrap`, `queue`):
  `getConfig(): Promise<{ token; deviceId; deviceName; outletName; offsetMs: number } | null>`, `saveConfig(c)`, `saveBootstrap(b: BootstrapPayload)`, `getBootstrap()`, `enqueue(e: QueuedEvent)`, `pendingEvents(limit: number): Promise<QueuedEvent[]>`, `removeEvents(ids: string[])`, `queueStats(): Promise<{ count: number; oldest: string | null }>`, `wipeAll()`.
- `api.ts`: `kioskFetch(path, init)` with device token; 401 → `wipeAll()` then `location.replace('/absen')`.
- `sync.ts`: `startSync(onState: (s: { online: boolean; pending: number; lastSync: string | null }) => void): () => void` — on start, every 5 min and on `online` event: upload queue in batches of 50 (`deviceNow` = now), remove answered events, then bootstrap and store `offsetMs = serverTime − deviceNow` (midpoint of request).
- `status.ts`: `dayStatus(bootstrapToday, queued, employeeId, now): 'OUT' | 'IN' | 'ON_BREAK' | 'DONE'` mirroring `checkTransition` (same 16h rule); `allowedActions(status): KioskEventType[]`.
- Service worker: cache-first for `/absen` shell assets, `_next/static`, `/models/human/*`, manifest and icons; network-only for API.
- Page: unpaired → code entry screen; paired → board (Task 9). Fullscreen request on first tap; screen wake lock while visible.

- [ ] **Step 1: Implement**; `npx tsc --noEmit -p .` → clean; production build succeeds.
- [ ] **Step 2: Browser check** (scratch stack): pair with a code → reload with network disabled in DevTools → page still opens on the board from cache; revoke in admin → next sync returns to the code screen with IndexedDB empty.
- [ ] **Step 3: Commit** `feat(absen): installable tablet page with pairing and sync`.

### Task 9: Tablet screens: face, actions, guest, PIN, board, recap

**Files:**
- Create: `web-admin/src/lib/kiosk/face.ts`, `web-admin/src/components/kiosk/{Board.tsx,Capture.tsx,Greeting.tsx,GuestPicker.tsx,PinPad.tsx,MyRecap.tsx}`
- Modify: `web-admin/src/app/absen/page.tsx`

**Interfaces:**
- `face.ts`: `loadFace(): Promise<void>` (human, `modelBasePath: '/models/human/'`, webgl → wasm fallback, same face config as backend plus antispoof/liveness enabled); `captureAndDescribe(video: HTMLVideoElement): Promise<{ embedding: number[]; jpegBase64: string; live: boolean } | { error: string }>` (JPEG longest side 480); `bestMatch(embedding, roster): { employeeId: string; score: number } | null` using human's `match.similarity` and `bootstrap.matchThreshold`.
- Flow per spec §4: Board → "Tekan untuk absen" → Capture (live check fails → "Ulangi, hadapkan wajah ke kamera") → local match → Greeting with only `allowedActions` buttons + "Bukan saya" → enqueue `QueuedEvent { id: crypto.randomUUID(), employeeId, type, method, deviceTime: now ISO, offsetAtEventMs: config.offsetMs, localScore, photoBase64 }` → "Tercatat ✓ HH:mm" (+ "terlambat N menit" when CLOCK_IN after start, computed locally from outlet hours) → optional "Rekap saya" 30 s → Board.
  - No local match: online → `/kiosk/identify` → Greeting labelled "Kru tamu dari {homeOutletName}", method FACE_SERVER; offline or 404 → offer "Pilih nama + PIN".
  - "Saya dari cabang lain" and "Pilih nama + PIN": GuestPicker (search over `directory` for guests, roster for own crew) → PinPad 6 digits → Capture (photo still required) → Greeting, method PIN.
- Board: counts and lists for Sudah masuk / Istirahat / Pulang / Belum datang (scheduled today, not in) / Terlambat, from bootstrap `today` + queue; header shows outlet, clock, Online/Offline and "N menunggu terkirim"; queue ≥ 1500 events or oldest > 5 days → red banner "Sambungkan tablet ke internet".
- MyRecap: current month rows from `recap` (home crew) or today only (guests); auto-close 30 s; never reachable without a fresh match.

- [ ] **Step 1: Implement**; typecheck and production build clean.
- [ ] **Step 2: Browser check** with webcam on the scratch stack: own crew clock-in online; DevTools offline → clock-in second crew, break, clock-out → board updates immediately, counter shows pending → back online → counter 0, events visible in Presensi Harian with flag Offline; unknown face online → identify path; offline guest via PIN; recap shows only the matched person.
- [ ] **Step 3: Real tablet check** (Android Chrome over the production-like HTTPS host or local `https` tunnel): install to home screen, camera permission, lighting, liveness threshold tuned so a phone photo held up is refused and a real face passes in ≥ 9 of 10 tries. Record the chosen thresholds in `face.ts` comments.
- [ ] **Step 4: Commit** `feat(absen): face attendance screens with offline queue`.

### Task 10: Crew app

**Files:**
- Modify: `mobile_user/lib/screens/home_screen.dart`, `mobile_user/lib/services/api_service.dart`
- Create: `mobile_user/lib/screens/attendance_pin_dialog.dart`

**Interfaces:** consumes `GET /attendance/today` (`attendanceMode`, `workingOutletName`) and `PUT /me/attendance-pin` from Task 6.

- When `attendanceMode == 'TABLET'`: replace the clock-in/out and break buttons with a card "Absen di tablet cabang {workingOutletName}"; history stays.
- Account menu: "PIN absen tablet" → dialog (PIN 6 digit, ulangi PIN, password akun) → success snackbar.

- [ ] **Step 1: Implement**, `flutter analyze` → no new issues.
- [ ] **Step 2: Check** in the web build (`mobile_user/tool/build-web-preview.sh`) against the scratch stack for both modes.
- [ ] **Step 3: Commit** `feat(crew-app): tablet attendance notice and PIN setting`.

### Task 11: Full verification and rollout prep

- [ ] **Step 1:** `npm test` (backend), e2e script, web-admin production build, `flutter analyze` — all pass.
- [ ] **Step 2:** Push schema to local `hris_db`, restart local LaunchAgents, confirm all outlets still in mode HP and phone attendance unchanged.
- [ ] **Step 3:** Clean up scratch database and servers.
- [ ] **Step 4:** Report to the owner with the rollout steps from the spec; commit/push/deploy only when asked. After deploy, rebuild the crew APK/web preview so crew see the tablet notice.
