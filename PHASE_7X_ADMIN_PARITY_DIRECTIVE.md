# OPERATION PANTHEON · PHASE 7.x HOTFIX · ADMIN FEATURE PARITY

**Drop-in directive for a fresh Claude session. Self-contained. Read top-to-bottom before touching code.**

---

## EXECUTIVE STATUS · WHAT YOU INHERIT

| Field | Value |
|---|---|
| **Repo** | `buildbelievefitllc/Buildbelievefit` |
| **Branch (live)** | `main` |
| **HEAD commit** | `12b35b9` |
| **Phase 7 status** | shipped + deployed · chokepoint live · 13/13 edge fns at Phase 7 routing · all four Gemini Live agents loosened · token recovery utility installed |
| **SW cache version** | `bbf-v217` |
| **Supabase project** | `ihclbceghxpuawymlvgi` (bbf-lab · ACTIVE_HEALTHY) |
| **Render proxy** | `https://buildbelievefit.onrender.com` (auto-redeploys on `main` push) |

**Recent commit chain (don't unwind these):**
- `12b35b9` · recoverable token prompt + bbfResetAdminToken() global utility
- `042b1b1` · loosened scope on all four Gemini Live agents (Phantom Eye, Virtual Coach, Food Frame, Chef on Call)
- `0d27cba` · durable BBF_COACH_AGENT_TOKEN resolution chain (env.js → sessionStorage → prompt)
- `ad828c1` · browser drone directive (PHASE_7_BROWSER_DRONE_DIRECTIVE.md in repo root)
- `b6d8649` · Phase 7 The Chokepoint · Model Router · Magnitude-Binned Pattern Hash
- `c908cde` · PHASE_7_PASSOVER.md (Phase 6 → 7 handoff · still authoritative for contracts)

**Read both passover docs before writing code:**
- `PHASE_7_PASSOVER.md` (Phase 6 → 7 contracts · 6 architectural contracts + 10 inviolable rules)
- `PHASE_7_BROWSER_DRONE_DIRECTIVE.md` (Phase 7 finishing-touches playbook · production state map)

---

## THE PROBLEM · ADMIN FEATURE PARITY

**Founder report (verbatim):**
> "Somatic readiness is not on the admin side. It does show on my client's side, but honestly, my entire profile side — as far as when I'm doing my own program — should look exactly how the clients look in the sense of all the features and tools."

**Translation:** the admin account (`CU === 'akeem'`) is missing client-side features when the founder is using the app as a *client*. Currently `if (CU === 'akeem') { SETUP_TRAINER(); ... }` (`bbf-app.html` around line 8626+) hijacks the experience and routes the founder into the trainer dashboard, hiding (or never wiring up) several client-grade features.

**Specifically broken:**
- **Somatic Matrix input UI** — clients see the Somatic Readiness submit interface; admin does not. This blocks the founder from testing the prehab "Readiness Needed" flow (Live Intelligence pill) because they can't log readiness for themselves.

**Likely broken (audit needed):**
- Any other tab where the trainer dashboard branch overrides the client UI (Program tab, Nutrition tab, Prehab tab, Athlete Portal). Audit and confirm.

---

## THE DIRECTIVE

### Task 1 · Audit the admin/client split

Search `bbf-app.html` for every place where the founder identity (`CU === 'akeem'`, `role === 'admin'`, `isTrainer`, `SETUP_TRAINER`, or anything that branches behavior based on the admin role). Document each gate:
- What it hides/changes
- Whether it's necessary for trainer functionality (managing other clients)
- Whether it's an OVERREACH that also hides client features the founder needs when training themselves

The Somatic Matrix is the known case. There may be others.

**Grep starters (run these first):**
```
grep -n "CU === 'akeem'\\|isTrainer\\|SETUP_TRAINER\\|role.*admin\\|isAdmin" bbf-app.html
grep -n "Somatic Matrix\\|somatic-matrix\\|showSomaticMatrix\\|somatic_readiness" bbf-app.html
grep -n "renderTrainerDashboard\\|trainer-dashboard\\|admin-dashboard" bbf-app.html
```

### Task 2 · Restore client-feature parity for the founder

For each gate that overreaches, restore the client experience for the founder. **Two reasonable patterns:**

**Pattern A · Hybrid layout (RECOMMENDED):** the founder sees BOTH the trainer admin surface (for managing clients) AND the client-side surfaces (so they can use the app as an athlete). This is the founder's stated desire. Likely means:
- Keep `SETUP_TRAINER()` running (admin features still wired up)
- ALSO render the client-side features on the founder's profile pages (Home, Program, Prehab, Nutrition)
- The Somatic Matrix submit UI must render when the founder is viewing their own profile (`VC === 'akeem'` or whatever the "currently viewing" identifier is)

**Pattern B · Toggle:** add a "View as client" toggle on the admin dashboard. Toggle on → app behaves like a regular client account for the founder. Toggle off → trainer dashboard. Slower to ship but cleaner architecturally.

**The founder asked for Pattern A.** Confirm with them only if Pattern A turns out to be invasive (lots of admin code assumes "no client features rendered for akeem"). Default to Pattern A.

### Task 3 · Smoke test

After the parity restoration:
1. Founder hard-refreshes BBF app (`bbf-v218` or whatever your bump lands on).
2. Navigates to their own Prehab tab.
3. Confirms the **Somatic Matrix submit UI** is present and functional.
4. Submits a readiness score.
5. Confirms the **Live Intelligence pill** flips from "READINESS NEEDED" (red) to "Readiness X/100" (green).
6. Confirms the **Recovery Matrix** can fire (Generate button works · no 401 · returns a 3-movement matrix).
7. Spot-check Program tab, Nutrition tab for any other parity gaps.

---

## INVIOLABLE CONTRACTS · DO NOT BREAK

1. **Single-writer CNS.** `cns_friction_score` / `biomechanical_redline` / `somatic_cognitive_load` are mutated ONLY through `BBF_CNS_AGENT.propose*Update()`. Even on the admin side. The Somatic Matrix submit UI must call into the agent, not write directly.
2. **ACWR canonicalized.** Use `BBF_DATA.computeACWR()` only.
3. **Founder approves structural changes.** No agent writes directly to `bbf_users` / `bbf_active_clients` / `bbf_athlete_progression`. Route through `/api/proposal-submit`. (The founder's OWN profile is no exception — even self-mutations must flow through the chokepoint, audit, and approve queue.)
4. **OT vocab injection + sanitization** on every LLM call.
5. **`.select()` zero-row confirmation** on the proposal executor stays intact.
6. **Audit everything** to `bbf_audit_logs` via `/api/audit-log`.
7. **Chokepoint is load-bearing.** `/api/proposal-submit` runs the full Phase 6 pipeline (idempotency · conflict arbitration · CNS snapshot · Sentinel · memory). Don't bypass it. Don't undo Phase 7.
8. **`BBF_COACH_AGENT_TOKEN` is the auth secret** for the 13 agentic edge functions. Frontend resolution chain (env.js → sessionStorage → prompt) lives in 15 `_adminToken()` helpers. **Don't add a 16th admin-only helper that bypasses the chain** — extend the existing pattern.
9. **PAR-Q+ is the only cardiac-clearance path.** AI never infers cardiac risk.
10. **Bump SW cache** on any HTML/JS/CSS-touching commit. Current is `bbf-v217`; next bump should be `bbf-v218`.

---

## EXECUTION POSTURE

- **Commit directly to `main`.** No PR flow this cycle (prior phases established the pattern).
- **Investigation first, code second.** Don't rush to patches. Find every gate, decide which are overreach vs legitimate trainer-only, then patch.
- **Treat the trainer dashboard as load-bearing.** It's how the founder manages clients (Ana, Wayne, Jordan, Jacky, Jacquelyn). Don't delete its features — augment with the client-side ones.
- **Watch for `VC` vs `CU`.** `CU` = currently-logged-in user (the founder, always `akeem`). `VC` = currently-viewing-client (changes when the founder selects a client to manage). When the founder is viewing their OWN profile, `VC === CU === 'akeem'`. The client-feature parity should activate when `VC === CU` (founder viewing self), not all the time.
- **Test before you commit.** UI changes are subtle. If you can't smoke-test in the browser (you can't — you're a backend agent), at least static-check that the wiring is sane and explain to the founder exactly what to verify.

---

## SESSION HYGIENE

When you start, do these in order:
1. `git log -1 --oneline` → confirm HEAD is `12b35b9` (or newer if the founder has merged more in)
2. `git status --short` → confirm clean working tree
3. Read `PHASE_7_PASSOVER.md` (Phase 6→7 contract bible)
4. Read this directive (you're already doing that)
5. Run the grep starters above to map the admin gates
6. Reply to the founder with your audit findings BEFORE you start patching · let them confirm scope

When you finish:
1. Bump SW cache · `bbf-v217` → `bbf-v218`
2. Commit directly to `main`
3. Push
4. Tell the founder which surfaces now have parity and what they should smoke-test
5. Tell them if you found any additional parity gaps that are NOT addressed (future hotfix)

---

## WHAT I (CLAUDE @ Phase 7) WILL NOT DO IN THIS CURRENT SESSION

The current session is at ~80% context. The work above could touch many files (admin gates can be scattered) and needs careful audit + multiple iterations. I'm handing off cleanly rather than running out of context mid-patch and leaving a half-applied gate removal that breaks the trainer dashboard.

**Everything I shipped in Phase 7 is stable on `main` at `12b35b9`. Your job is to extend it cleanly · not to redo it.**

---

— Phase 7 hand-off · `12b35b9` · 2026-05-22
