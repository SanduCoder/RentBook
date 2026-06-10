# RentBook

**The easiest way to manage rent, tenants, payments, and compound operations.**

RentBook is a mobile-first rental and compound management platform built for small landlords, caretakers, and tenants — starting in The Gambia and expandable across Africa and globally.

## Tech Stack

- **Frontend:** Angular 19 + PWA (offline-capable)
- **Backend:** Firebase Authentication, Firestore, Storage, Cloud Functions (planned)

## Phase 1 Features (Current)

- User authentication (Owner, Caretaker, Tenant roles)
- Dashboard with rent collection overview
- Property & unit management (compounds, apartments, rooms, shops, offices)
- Tenant management with contact details and rent tracking
- Payment recording (Wave, AfriMoney, QMoney, Bank Transfer, Cash)
- Payment status tracking (Paid, Upcoming, Late, Partial)
- Digital receipt numbers
- Mobile bottom navigation

## Phase 2 Features (Current)

- **Maintenance requests** — Submit, filter, and track Open → Assigned → Completed
- **Expense tracking** — Water, electricity, repairs, cleaning, security, and other costs
- **Shared utility billing** — Split compound bills among households with auto per-household calculation
- **Reports** — Monthly income, expenses, and net profit
- **Property tabs** — Expenses and shared bills on each property detail page

## Getting Started

### Prerequisites

- Node.js 18+
- A [Firebase project](https://console.firebase.google.com/)

### 1. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Email/Password sign-in
3. Create a **Firestore Database** (start in test mode, then deploy rules)
4. Copy your Firebase config from Project Settings → General → Your apps

### 2. Configure Environment

Edit `src/environments/environment.development.ts` with your Firebase credentials:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'your-api-key',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
  },
};
```

### 3. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

Rules are in `firestore.rules`.

### 4. Run the App

```bash
cd rentbook
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200)

### 5. Build for Production

```bash
npm run build
```

Deploy the `dist/rentbook` folder to Firebase Hosting, Netlify, or any static host.

## Project Structure

```
src/app/
├── core/           # Models, services, guards, utilities
├── features/     # Feature screens (auth, dashboard, properties, etc.)
├── layout/       # App shell with bottom navigation
└── shared/       # Reusable components and pipes
```

## Roadmap

| Phase | Features |
|-------|----------|
| **Phase 1** ✅ | Auth, Properties, Units, Tenants, Payments, Dashboard |
| **Phase 2** ✅ | Maintenance, Expenses, Shared Bills, Reports |
| **Phase 3** | OCR Payment Verification, WhatsApp Integration, Leases, Deposits, Caretaker Access |
| **Phase 4** | Direct Wave/AfriMoney Integration, AI Assistant |

## Design Principles

- Mobile-first with large, readable text
- Minimal user actions for non-technical landlords
- Offline-capable PWA
- WhatsApp-friendly workflows
- Gambian Dalasi (GMD) as default currency

## License

Private — All rights reserved.
