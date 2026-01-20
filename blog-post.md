# Building Ledgr: A Modern Expense Splitting App with React and Firebase

I recently built **Ledgr**, a web app for tracking shared expenses with friends, roommates, or travel groups. In this post, I'll walk through the tech stack, development process, and how to set up the Firebase infrastructure if you want to build something similar.

## What Ledgr Does

Ledgr solves the age-old problem of "who owes whom" when splitting expenses:

- Create groups to track shared expenses
- Add transactions and split them among group members
- Flexible split types: equal, percentage, exact amounts, or shares
- Invite others to join your groups via secure links
- See who owes whom with automatic balance calculations
- Settle up and track payment history

## The Tech Stack

### Frontend
- **React 19** with **TypeScript** for type-safe UI development
- **Vite** for lightning-fast builds and hot module replacement
- **Material-UI (MUI)** for a polished component library
- **React Router** with hash-based routing (for GitHub Pages compatibility)
- **React Context API** for state management (no Redux needed for this scale)

### Backend
- **Firebase Authentication** for email/password login
- **Cloud Firestore** for real-time NoSQL database
- **Firebase Cloud Functions** for server-side reCAPTCHA verification
- **Firebase App Check** with reCAPTCHA v3 for bot protection

### Testing & Deployment
- **Vitest** with React Testing Library for unit and component tests
- **GitHub Actions** for CI/CD
- **GitHub Pages** for free static hosting

## The Development Process

### Starting with the Data Model

I started by designing the Firestore data model. The core structure is:

```
groups/{groupId}
  - name: string
  - userId: string (owner)
  - memberUserIds: string[] (for access control)
  - members: array of member objects
  - transactions: array of transaction objects
  - payments: array of payment objects
  - createdAt, updatedAt: timestamps

invitations/{invitationId}
  - groupId, memberId, token
  - status: 'pending' | 'accepted' | 'expired'
  - expiresAt: timestamp
```

I chose to nest transactions and payments inside group documents for simplicity. For a larger-scale app, you might normalize these into separate collections, but for a personal project this keeps queries simple.

### Building the Split Calculator

The heart of Ledgr is the split calculator. I implemented four split types:

1. **Equal**: Divide the total equally among selected members
2. **Percentage**: Each member pays a percentage (must total 100%)
3. **Exact**: Specify exact amounts per member (must total the transaction)
4. **Shares**: Members have shares (e.g., 2:1:1 ratio)

Here's a simplified version of the calculation logic:

```typescript
function calculateSplits(
  totalAmount: number,
  splitType: SplitType,
  inputs: SplitInput[]
): Split[] {
  switch (splitType) {
    case 'equal':
      const perPerson = totalAmount / inputs.length;
      return inputs.map(i => ({ memberId: i.memberId, amount: perPerson }));

    case 'percentage':
      return inputs.map(i => ({
        memberId: i.memberId,
        amount: (i.value / 100) * totalAmount
      }));

    // ... exact and shares implementations
  }
}
```

I wrote comprehensive tests for edge cases: zero amounts, single members, fractional percentages, and validation rules.

### Real-Time Sync with Firestore

One of Firebase's killer features is real-time listeners. The app subscribes to group changes:

```typescript
const q = query(
  collection(db, 'groups'),
  where('memberUserIds', 'array-contains', user.uid)
);

onSnapshot(q, (snapshot) => {
  const groups = snapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  }));
  setGroups(groups);
});
```

This means when one user adds a transaction, everyone in the group sees it instantly without refreshing.

### The Invitation System

I wanted users to invite friends who might not have accounts yet. The flow:

1. Group owner creates an invitation for a "placeholder" member
2. System generates a cryptographically secure 48-character token
3. Owner shares the invite link
4. Recipient clicks link, creates account (or signs in), and gets added to the group

```typescript
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
```

Invitations expire after 7 days for security.

### Adding Security Layers

Security was a priority. I implemented multiple layers:

1. **Firebase Auth**: Required for all protected routes
2. **Firestore Security Rules**: Document-level access control
3. **App Check with reCAPTCHA v3**: Bot protection without annoying CAPTCHAs
4. **Cloud Functions**: Server-side token verification

Example Firestore rules:

```javascript
match /groups/{groupId} {
  // Only members can read
  allow read: if request.auth.uid in resource.data.memberUserIds;

  // Only owner can delete
  allow delete: if request.auth.uid == resource.data.userId;

  // Members can update transactions/payments
  allow update: if request.auth.uid in resource.data.memberUserIds;
}
```

### The Retro Banker Theme

I wanted the app to feel like a classic ledger book. The theme includes:

- **Banker's green** (#1a472a) as the primary color
- **Serif fonts** (Merriweather, Crimson Pro) for that old-school feel
- **Ruled paper background** with a 28px grid
- **Red margin lines** like a real accounting ledger
- **Custom pen cursor** for that writing-in-a-book feel

## Setting Up Firebase Infrastructure

Here's a detailed walkthrough of setting up Firebase for a similar project.

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"** or **"Add project"**
3. Enter a project name (e.g., "split-transactions")
4. You can disable Google Analytics for now if you prefer
5. Click **"Create project"** and wait for it to provision

### 2. Enable Authentication

1. In the Firebase Console, click **"Authentication"** in the left sidebar
2. Click **"Get Started"**
3. Click the **"Sign-in method"** tab
4. Click on **"Email/Password"** in the provider list
5. Toggle the **"Enable"** switch
6. Click **"Save"**

That's it for basic auth! Firebase now handles user registration, login, password resets, and session management for you.

### 3. Create Firestore Database

1. In the Firebase Console, click **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll set up proper security rules next)
4. Choose a location closest to your users (e.g., `us-central1` for North America, `europe-west1` for Europe)
5. Click **"Enable"**

The database will take a moment to provision. Once ready, you'll see an empty database console where you can manually add collections and documents for testing.

### 4. Get Your Configuration Object

Now you need to connect your app to Firebase:

1. In the Firebase Console, click the **gear icon (⚙️)** next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to the **"Your apps"** section
4. Click the **web icon (`</>`)**
5. Register your app with a nickname (e.g., "split-transactions-web")
6. You'll see a configuration object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

**Important:** Keep these values handy—you'll need them for your environment variables.

### 5. Set Up Environment Variables

Create a `.env` file in your project root (and add it to `.gitignore`!):

```env
VITE_FIREBASE_API_KEY=AIzaSyB...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

The `VITE_` prefix is required for Vite to expose these variables to your frontend code via `import.meta.env`.

### 6. Add Secrets to GitHub (for CI/CD)

For automated deployments, you need to add these values as GitHub secrets:

1. Go to your GitHub repository
2. Click **"Settings"** > **"Secrets and variables"** > **"Actions"**
3. Click **"New repository secret"**
4. Add each Firebase configuration value as a separate secret:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

Your GitHub Actions workflow can then reference these as `${{ secrets.VITE_FIREBASE_API_KEY }}`, etc.

### 7. Set Up Firestore Security Rules

**What are Firestore Security Rules?**

Firestore Security Rules are server-side access controls that determine who can read, write, update, and delete data in your database. They're written in a declarative language and evaluated by Firebase's servers—not your client code—so they can't be bypassed by malicious users.

Without rules (or with overly permissive rules), anyone could:
- Read all your users' data
- Modify or delete any document
- Create spam or malicious content

Rules are essential for any production app.

**Managing Rules via CLI**

While you *can* edit rules in the Firebase Console, I recommend managing them as code in your repository. This gives you version control, code review, and automated deployments.

1. **Create a `firestore.rules` file** in your project root:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user is the owner of a group
    function isGroupOwner(groupId) {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/groups/$(groupId)).data.userId == request.auth.uid;
    }

    // Helper function to check if user is a member of a group
    function isGroupMember(groupId) {
      return isAuthenticated() &&
             request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.memberUserIds;
    }

    // Groups collection rules
    match /groups/{groupId} {
      // Members can read. Also allow single-doc get for authenticated users (needed for invitation acceptance)
      allow get: if isAuthenticated();
      allow list: if isAuthenticated() &&
                  request.auth.uid in resource.data.memberUserIds;

      // Allow create if user is authenticated, sets themselves as owner, and includes themselves in memberUserIds
      allow create: if isAuthenticated() &&
                   request.resource.data.userId == request.auth.uid &&
                   request.auth.uid in request.resource.data.memberUserIds;

      // Owner can do anything; members can only modify transactions/payments (not ownership/members)
      allow update: if isAuthenticated() &&
                   (resource.data.userId == request.auth.uid ||
                   (request.auth.uid in resource.data.memberUserIds &&
                    request.resource.data.userId == resource.data.userId &&
                    request.resource.data.memberUserIds == resource.data.memberUserIds &&
                    request.resource.data.members == resource.data.members));

      // Only owner can delete
      allow delete: if isAuthenticated() &&
                   resource.data.userId == request.auth.uid;
    }

    // Invitations collection rules
    match /invitations/{invitationId} {
      // Anyone can read invitations (token provides security for invite links)
      allow read: if true;

      // Only group owner can create invitations
      allow create: if isAuthenticated() &&
                   isGroupOwner(request.resource.data.groupId);

      // Owner can cancel; anyone can update status to accepted
      allow update: if isAuthenticated() &&
                   (resource.data.invitedBy == request.auth.uid ||
                    resource.data.status == 'pending');

      // Only the owner who created it can delete
      allow delete: if isAuthenticated() &&
                   resource.data.invitedBy == request.auth.uid;
    }
  }
}
```

2. **Configure `firebase.json`** to reference your rules file:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

3. **Deploy rules** using the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

**Understanding the Rules**

Let me break down what these rules accomplish:

- **Helper functions**: `isAuthenticated()`, `isGroupOwner()`, and `isGroupMember()` keep the rules DRY and readable
- **Groups**:
  - Any authenticated user can create a group (as long as they set themselves as owner)
  - Only members can list groups they belong to
  - Only the owner can delete a group
  - Members can update transactions and payments, but can't change ownership or member lists
- **Invitations**:
  - Publicly readable (the secure token provides protection—you need the token to accept)
  - Only group owners can create invitations
  - Only the invitation creator can delete it

**Testing Rules Locally**

The Firebase Emulator Suite lets you test rules without affecting production:

```bash
firebase emulators:start --only firestore
```

You can also use the Rules Playground in the Firebase Console to test specific operations against your rules before deploying.

### 8. Set Up App Check (Optional but Recommended)

1. Go to **App Check** in Firebase Console
2. Register your web app
3. Choose **reCAPTCHA v3** as the provider
4. Register at [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
5. Add your domain(s)
6. Copy the **site key** to your app, **secret key** to Firebase Console

In your code:

```typescript
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});
```

### 6. Set Up Cloud Functions (Optional)

For server-side reCAPTCHA verification:

```bash
firebase init functions
cd functions
npm install
```

Create your function:

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const recaptchaSecret = defineSecret('RECAPTCHA_SECRET_KEY');

export const verifyRecaptcha = onCall(
  { secrets: [recaptchaSecret] },
  async (request) => {
    const { token } = request.data;

    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${recaptchaSecret.value()}&response=${token}`,
      }
    );

    const result = await response.json();

    if (!result.success || result.score < 0.5) {
      throw new HttpsError('permission-denied', 'Verification failed');
    }

    return { success: true };
  }
);
```

Set the secret and deploy:

```bash
firebase functions:secrets:set RECAPTCHA_SECRET_KEY
firebase deploy --only functions
```

### 7. Environment Variables

Create a `.env` file (don't commit this!):

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

For GitHub Actions, add these as repository secrets.

## CI/CD with GitHub Actions

The deployment pipeline:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm test -- --run
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          # ... other env vars

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

Tests run before build, so broken code never gets deployed.

## Lessons Learned

### What Worked Well

1. **React Context over Redux**: For this app's scale, Context API is simpler and sufficient
2. **Firestore real-time sync**: Perfect for collaborative apps
3. **Vite**: Incredibly fast dev server and builds
4. **TypeScript everywhere**: Caught countless bugs at compile time
5. **Testing business logic first**: The split calculator tests gave me confidence to refactor

### What I'd Do Differently

1. **Start with security rules earlier**: I retrofitted them, which was harder
2. **Use Firestore subcollections**: Nesting arrays works but doesn't scale
3. **Add offline support**: Firebase has this built-in, I just didn't implement it
4. **E2E tests**: Unit tests are great, but Playwright tests would catch more integration issues

## Conclusion

Building Ledgr taught me a lot about Firebase's ecosystem. The combination of Authentication, Firestore, Cloud Functions, and App Check provides a robust backend without managing servers. The real-time sync makes collaborative features almost trivial to implement.

If you're building a similar app, start with your data model and security rules. Get those right, and the rest flows naturally.

The full source code is available on GitHub. Feel free to use it as a starting point for your own projects!

---

*Built with React, TypeScript, Firebase, and lots of coffee.*
