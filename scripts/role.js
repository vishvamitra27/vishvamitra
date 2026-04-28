// ============================================================
//  scripts/role.js  (v4 — Firestore-only role management)
//
//  Single source of truth for:
//    - getUserRole(uid)      → "admin"|"vendor"|"user"|null
//    - getUserProfile(uid)   → full Firestore user doc
//    - isOperatorAdmin(user) → checks Firestore role field only
//
//  Admin role is stored in Firestore: users/{uid}.role = "admin"
//  Set this in Firebase Console or via the admin panel.
//  No hardcoded email lists — Firestore is the single source of truth.
// ============================================================

import { db } from "./firebase-core.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

export { ROLE_DASHBOARD, DASHBOARD_BY_ROLE } from "./core/routes.js";

/**
 * True if this Firebase user has role "admin" in Firestore.
 * @param {import("firebase/auth").User|null} user
 */
export async function isOperatorAdmin(user) {
  if (!user) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() && snap.data().role === "admin";
}

/**
 * Fetch just the role for a uid from Firestore.
 * @param {string} uid
 * @returns {Promise<"admin"|"vendor"|"user"|null>}
 */
export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().role || null) : null;
}

/**
 * Fetch the complete user profile document.
 * Returns null if the document doesn't exist.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Partially update a user's Firestore profile.
 * @param {string} uid
 * @param {Object} fields
 */
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}