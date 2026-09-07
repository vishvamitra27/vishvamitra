// ============================================================
//  scripts/role.js  (v5 — dynamic admins/{uid} authorization)
//
//  Single source of truth for:
//    - getUserRole(uid)      → "admin"|"vendor"|"user"|null
//    - getUserProfile(uid)   → full Firestore user doc
//    - isOperatorAdmin(user) → checks the admins/{uid} collection
//
//  Real admin privileges are dynamic and live in Firestore:
//  admins/{uid} = { email, name, role: "admin", active, createdAt }.
//  This is also what firestore.rules → isAdmin() checks, so this
//  client-side gate stays in sync with what the server will allow.
//  No hardcoded email lists — Firestore is the single source of truth.
//
//  users/{uid}.role stays around too (kept in sync by the admin
//  panel) purely for UI purposes — nav visibility, badges, filters.
//  It is NOT used for authorization; see admins/{uid} for that.
// ============================================================

import { db } from "./firebase-core.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

export { ROLE_DASHBOARD, DASHBOARD_BY_ROLE } from "./core/routes.js";

/**
 * True if this Firebase user has an active document in the
 * admins/{uid} collection — the same check firestore.rules enforces.
 * @param {import("firebase/auth").User|null} user
 */
export async function isOperatorAdmin(user) {
  if (!user) return false;
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists() && snap.data().active === true;
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