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
- Firebase (Authentication & Firestore)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Deployment

- **Web app:** deployed to GitHub Pages automatically on every push to `main` (`.github/workflows/deploy.yml`). To redeploy without a new commit, run "Deploy to GitHub Pages" from the Actions tab.
- **Firestore rules/indexes and Cloud Functions:** run "Deploy to Firebase" from the Actions tab (`.github/workflows/firebase-deploy.yml`) and pick `firestore`, `functions`, or `all`. It only runs on `main` and needs a `FIREBASE_SERVICE_ACCOUNT` secret (a service account JSON key) on the `firebase` environment.

## Disclaimer

I built this for myself. No guarantees about the security, reliability, or accuracy of the app. Your data may be deleted at any time. Use at your own risk.