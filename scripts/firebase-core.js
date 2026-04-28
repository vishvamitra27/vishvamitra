// ============================================================
//  scripts/firebase-core.js
//
//  THE only place Firebase is initialized. Period.
//
//  Architecture:
//    firebase-core.js  ← initializes app, exports raw services
//    firebase.js       ← re-exports from firebase-core (backward compat)
//    All modules       ← import from firebase-core.js directly
//
//  Why a separate core file?
//    - firebase.js existed in v1 and is referenced everywhere.
//    - firebase-core.js is the new canonical source. It lets us
//      swap SDK versions, add emulator support, or add analytics
//      in ONE place with zero ripple to other modules.
//    - getApps() guard ensures no double-init even if both files
//      are somehow imported in the same module graph.
// ============================================================

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getStorage }
  from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

// ── Config ───────────────────────────────────────────────────
// To use Firebase Emulator Suite locally, add:
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectFirestoreEmulator(db, "localhost", 8080);
// after the service exports below.
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD4pVmGDasFAADaiYctht55jE2NvIpHSto",
  authDomain:        "vishvamitra-79627.firebaseapp.com",
  projectId:         "vishvamitra-79627",
  storageBucket:     "vishvamitra-79627.firebasestorage.app",
  messagingSenderId: "436224322843",
  appId:             "1:436224322843:web:a4d074a5eb8ad99866f7be"
};

// ── Singleton init ───────────────────────────────────────────
const _app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

// ── Service exports ──────────────────────────────────────────
export const auth    = getAuth(_app);
export const db      = getFirestore(_app);
export const storage = getStorage(_app);

// Named export so any module can check which project is active
export const projectId = FIREBASE_CONFIG.projectId;
