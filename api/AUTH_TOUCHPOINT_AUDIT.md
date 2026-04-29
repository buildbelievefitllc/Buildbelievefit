# AUTH TOUCHPOINT AUDIT

## 1. RPC Call Sites
The following are the verified RPC call sites for PIN authentication in the codebase:
- `bbf-sync.js:285` — `function verifyAdminPin(pinAttempt)` calls `return supa('POST', 'rpc/bbf_verify_admin_pin', { pin_attempt: pinAttempt })`
- `admin.html:112` — Invokes `var isValid = await BBF_SYNC.verifyAdminPin(pin);` inside `authAdmin()`
- `coach-lab.html:184` — Direct fetch: `var res = await fetch(window.ENV_SUPABASE_URL + '/rest/v1/rpc/bbf_verify_admin_pin', { ... body: JSON.stringify({ pin_attempt: pin }) })` inside `authAdmin()`
- `bbf-app.html:4236` — Direct fetch: `var res = await fetch(window.ENV_SUPABASE_URL + '/rest/v1/rpc/bbf_verify_user_pin', { ... body: JSON.stringify({ uid: user, pin_attempt: pin }) })` inside `async function LOGIN()`

## 2. PIN Entry Surfaces
The following are the real DOM elements corresponding to the PIN entry surfaces:
- **Admin PIN Surface:**
  - `admin.html:67` — `<input type="password" class="gate-input" id="gate-pin" placeholder="FOUNDER PIN" maxlength="6">`
  - `coach-lab.html:86` — `<input type="password" class="gate-input" id="gate-pin" placeholder="FOUNDER PIN" maxlength="6">`
  - Handlers: The `authAdmin()` function is triggered by a keydown event listener listening for the `Enter` key on `#gate-pin` (`admin.html:124`, `coach-lab.html:205`) and by clicking the authenticate button.
- **User PIN Surface:**
  - `bbf-app.html:4344` — `<input type="password" id="p" placeholder="enter PIN" maxlength="4" inputmode="numeric"/>`
  - Handler: `async function LOGIN()` (`bbf-app.html:4221`) is triggered by a keydown event listener for the `Enter` key on `#p` (`bbf-app.html:4294`) and by clicking the sign-in button.

## 3. Failure-State UI
When authentication fails, the error is rendered via plain text updates without CSS class toggling:
- **Error Element:** `<div class="gate-err" id="gate-err"></div>` (`admin.html:69`, `coach-lab.html:88`)
- **Failure Text:**
  - `admin.html:120` — `document.getElementById('gate-err').textContent='Invalid PIN. Access denied.';`
  - `coach-lab.html:198` — `document.getElementById('gate-err').textContent='Invalid PIN. Access denied.';`
- **Mutation Pattern:** It strictly relies on mutating `.textContent`. There is no CSS class toggle (like `.auth-error`) on failure.
- **Lockout Implementation Needs ("3 attempts → 15 min lockout"):**
  1. Introduce a state variable (e.g., `let failedAttempts = 0`) tracked in `localStorage` alongside a `lockoutTimestamp`.
  2. Before running `authAdmin()`, check if `Date.now() < lockoutTimestamp`. If so, disable the input and button, and show the countdown.
  3. On failure, increment `failedAttempts`. If it reaches 3, set the `lockoutTimestamp` to `Date.now() + 15 * 60000`, disable the `#gate-pin` input (`disabled = true`) and submit button, and update `#gate-err` to display the 15-minute countdown.

## 4. Auth-State Propagation
- **DOM Toggle Mechanism:** Upon successful verification, the login gate is hidden and the dashboard is activated:
  - `admin.html:113-114` — `document.getElementById('gate').style.display='none'; document.getElementById('dash').classList.add('on');`
  - `coach-lab.html:195-196` — `document.getElementById('gate').style.display='none'; document.getElementById('dash').classList.add('on');`
- **Persistence:** There is **no** `localStorage` or `sessionStorage` persistence for the admin authentication state. A page refresh will clear the state, requiring re-authentication.

## 5. Client-Side Hashing Audit
- `bbf-data.js:15` defines `async function SHA256(m) { ... }` utilizing `crypto.subtle.digest`.
- The **only** caller of `SHA256(` in the entire repository is `bbf-data.js:304` (`var hash = await SHA256(pin);`) which resides in the local `REGISTER()` function for caching user profiles locally.
- In the active PIN verification flows (both user and admin), the raw PIN values are sent **directly in plaintext** to the Supabase RPC functions:
  - `coach-lab.html:191`: `body: JSON.stringify({ pin_attempt: pin })`
  - `bbf-app.html:4243`: `body: JSON.stringify({ uid: user, pin_attempt: pin })`
  - `bbf-sync.js:285`: `{ pin_attempt: pinAttempt }`
- Therefore, client-side hashing in the PIN verification pathway is **dead code**.

## 6. bcrypt Migration Risk Assessment
Based on the completion of Section 5, we have determined that client-side hashing is not active in the PIN flow.
- **Plaintext Surfaces:** `admin.html` (via `bbf-sync.js`), `coach-lab.html`, and `bbf-app.html` all send the PIN in plaintext natively.
- **Hashing Surfaces:** Zero. No client surfaces send a hashed PIN for verification.
- **Conclusion:** **Total Transparency.** Since zero live callers apply hashing in the PIN verification requests, the server-side migration from plaintext-matching to `bcrypt(p_pin_attempt)` is fully isolated. No client-side modifications to the hashing logic or payload structure are required.
