# BBF Android TWA — Bubblewrap Build Runbook

This runbook builds the **Android App Bundle (.aab)** for `Build Believe Fit`
using the official Google `@bubblewrap/cli`. It runs **non-interactively** —
all keystore values are pre-generated and live in `KEYSTORE_PASSWORDS.txt`.

The runbook itself was generated in a sandbox without Android SDK + network
access, so the actual `bubblewrap build` step has to run on **your machine**
(or a CI runner) where both are available.

---

## 0. Prerequisites (one-time)

You need:

- **Node.js** 18 or newer (`node -v`)
- **Java JDK** 17 or newer with `keytool` on PATH (`java -version`, `keytool -help`)
- **Android Studio** OR `cmdline-tools` ≥ 9.0 with `ANDROID_HOME` set. Bubblewrap
  will auto-install the rest of the SDK on first run.
- ~10 GB free disk for the SDK + Gradle caches

If you don't have Android Studio installed:
```bash
# macOS (Homebrew)
brew install --cask android-studio

# Linux: download from https://developer.android.com/studio
# Windows: same — installer handles PATH + ANDROID_HOME

# After install, set ANDROID_HOME (macOS/Linux)
export ANDROID_HOME=$HOME/Library/Android/sdk    # macOS
export ANDROID_HOME=$HOME/Android/Sdk            # Linux
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
```

Add those last two lines to your shell rc file so they persist.

## 1. Unzip this build kit

You should already have done this if you're reading the file. The `bbf-android/`
working directory should contain:

```
bbf-android/
├── BUILD_RUNBOOK.md        ← this file
├── KEYSTORE_PASSWORDS.txt  ← keystore + cert password
├── assetlinks.json         ← deploy this to /.well-known/assetlinks.json
├── bbf-twa-key.jks         ← signing key (BACK THIS UP IMMEDIATELY)
└── twa-manifest.json       ← Bubblewrap config
```

Open `KEYSTORE_PASSWORDS.txt` and copy the password to your clipboard. You'll
need it once at build time, then never again unless you're updating the app.

## 2. Install Bubblewrap CLI globally

```bash
npm install -g @bubblewrap/cli
bubblewrap --version    # confirm install
bubblewrap doctor       # confirm Java + Android SDK detection
```

If `bubblewrap doctor` reports a missing dependency, follow its on-screen
prompt — it'll auto-install the missing Android SDK component into
`$ANDROID_HOME`.

## 3. Open the working directory

```bash
cd <wherever-you-unzipped-this>/bbf-android
ls -la                  # confirm bbf-twa-key.jks + twa-manifest.json present
```

## 4. Build the AAB (non-interactive)

The `twa-manifest.json` is already populated with every field Bubblewrap
needs. The only runtime input is the keystore password. Pass it via env vars
to keep it off the command line:

```bash
# macOS/Linux — paste the password from KEYSTORE_PASSWORDS.txt
export BBF_KEYSTORE_PASSWORD='<paste-the-24-char-password-here>'

bubblewrap build \
  --skipPwaValidation \
  --signingKeyPath ./bbf-twa-key.jks \
  --signingKeyAlias bbf-twa-key
# When Bubblewrap prompts for store password + key password, paste the same
# value (Android convention: store password == key password). The
# twa-manifest.json fingerprints field already has the correct SHA-256 so
# Bubblewrap won't re-prompt for that.
```

For **fully** non-interactive (CI), pipe the password twice with `printf`:
```bash
printf '%s\n%s\n' "$BBF_KEYSTORE_PASSWORD" "$BBF_KEYSTORE_PASSWORD" | \
  bubblewrap build --skipPwaValidation \
                   --signingKeyPath ./bbf-twa-key.jks \
                   --signingKeyAlias bbf-twa-key
```

The build takes 2–6 minutes depending on Gradle cache state. Output:

```
bbf-android/
├── app-release-bundle.aab    ← THIS is what you upload to Play Console
└── app-release-signed.apk    ← side-loadable APK for sanity testing
```

## 5. Deploy the Digital Asset Links file

Copy `assetlinks.json` to your **production frontend host** so it serves at:

```
https://buildbelievefit.fitness/.well-known/assetlinks.json
```

This is **not optional** — without it, Android will show the Chrome custom
tabs URL bar even after install (the TWA contract isn't verified, app falls
back to Custom Tabs mode). On Render or whatever serves the marketing site,
either:

- Drop `assetlinks.json` into the repo at `.well-known/assetlinks.json` and
  ensure the static handler serves the `.well-known` prefix, OR
- Configure a route that returns the file with `Content-Type: application/json`

Verify:
```bash
curl https://buildbelievefit.fitness/.well-known/assetlinks.json
# Should return the JSON array containing the SHA-256 fingerprint.
```

Google's verifier:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?\
  source.web.site=https://buildbelievefit.fitness&\
  relation=delegate_permission/common.handle_all_urls
```

## 6. Upload to Play Console

1. Go to https://play.google.com/console → Create app.
2. Set package name: `com.buildbelievefit.bbf` (must match `twa-manifest.json`).
3. **Internal testing** → Releases → Create new release.
4. Upload `app-release-bundle.aab` from step 4.
5. Bump version + add release notes → Save → Review.
6. Roll out to internal testing (instant; only your test account gets it).
7. After verifying the TWA opens without the URL bar (Digital Asset Links
   working), promote to closed/open testing → production.

## 7. Updating the app later

When you ship a new version of the PWA on `buildbelievefit.fitness`, the
TWA picks up the new web content automatically — **no Play Store update
needed for content changes**. You only rebuild + re-upload the AAB if:

- You change `twa-manifest.json` (theme color, package id, shortcuts, etc.)
- You bump targetSdkVersion (Play forces this every year)
- You add native Android permissions

For those:
```bash
# Bump appVersion + appVersionCode in twa-manifest.json
bubblewrap update          # syncs twa-manifest with the current Bubblewrap
bubblewrap build           # rebuilds AAB (use the SAME keystore — never replace it)
```

## CRITICAL — keystore handling

The `bbf-twa-key.jks` file is the **cryptographic identity** of the BBF
Android app on the Play Store. If you lose it:

- You **cannot push updates** to the same listing — Google enforces strict
  identity-key matching on every upload.
- The recovery path is "create a new app under a new package name" — i.e.
  ship a different app, lose all reviews/installs/ratings.

Mitigations (do at least two):

1. **Save to a password manager** (1Password / Bitwarden / Apple Passwords)
   as a secure note with the password and the `.jks` file attached.
2. **Encrypted cloud backup** (iCloud Advanced Data Protection, ProtonDrive,
   Tresorit). Not Google Drive / Dropbox unencrypted.
3. **Hardware copy** — write the password on paper, store the `.jks` on a
   USB drive in a fireproof safe.
4. **Play App Signing enrollment** — when you upload the first AAB, Play
   Console offers "Use Play App Signing" — accept it. Google then holds the
   master signing key and your `.jks` becomes the *upload* key, which is
   recoverable via Play Console support if you ever lose it. **Do this on
   the first upload.**

---

Generated by Claude session 01CKLETh7GMdjRJGaqQXsjZQ.
Phase 15 Slice 19 — Bubblewrap Build Kit.
