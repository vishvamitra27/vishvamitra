// ============================================================
//  scripts/firebase.js  — backward-compatibility shim only
//
//  DO NOT initialize Firebase here.
//  All initialization lives in firebase-core.js (one place, always).
//
//  This file exists so older imports like:
//    import { auth, db } from "./firebase.js"
//  continue to work without touching every file.
//
//  For new code, import directly from firebase-core.js instead.
// ============================================================

export { auth, db, storage, projectId } from "./firebase-core.js";