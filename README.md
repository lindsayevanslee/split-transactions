# Ledgr

A silly lil web app for tracking shared expenses among friends and family. Free. Just does math.

## Features

- Create groups to track shared expenses
- Add transactions and split them among group members
- Flexible split types: equal, percentage, or custom amounts
- Invite others to join your groups
- See who owes whom with automatic balance calculations
- Settle up and track payment history

## Tech Stack

- React + TypeScript
- Vite
- Material UI
- Firebase (Authentication, Firestore, Cloud Functions, App Check)

## Development

Requires Node.js 22 (the version CI, deploys, and Cloud Functions use).

Copy `.env.example` to `.env` and fill in your Firebase project's web config. The app refuses to start if any `VITE_FIREBASE_*` value is missing. `VITE_RECAPTCHA_SITE_KEY` is optional; when set, App Check is turned on with reCAPTCHA v3.

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests (watch mode; use `npm run test:run` for a single run)
npm test

# Lint
npm run lint
```

Cloud Functions live in `functions/` with their own `package.json`. Currently there is one, `acceptInvitation`, which lets a user join a group they can't read yet. Build them with:

```bash
cd functions
npm install
npm run build
```

## Deployment

- **Web app:** deployed to GitHub Pages automatically on every push to `main` (`.github/workflows/deploy.yml`). To redeploy without a new commit, run "Deploy to GitHub Pages" from the Actions tab.
- **Firestore rules/indexes and Cloud Functions:** run "Deploy to Firebase" from the Actions tab (`.github/workflows/firebase-deploy.yml`) and pick `firestore`, `functions`, or `all`. It only runs on `main` and needs a `FIREBASE_SERVICE_ACCOUNT` secret (a service account JSON key) on the `firebase` environment.

## CI and maintenance

- **CI** (`.github/workflows/ci.yml`) runs lint, build, and tests for the app and builds the functions on every pull request and every push to `main`. It also lints the workflow files.
- **Security audit** (`.github/workflows/security-audit.yml`) scans npm dependencies every 12 hours and opens a pull request when it finds fixes.

## Disclaimer

I built this for myself. No guarantees about the security, reliability, or accuracy of the app. Your data may be deleted at any time. Use at your own risk.