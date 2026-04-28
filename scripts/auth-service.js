// ============================================================
//  scripts/auth-service.js  (NEW in v3.1)
//
//  All Firebase Auth operations: login, signup, Google auth,
//  role assignment, vendor setup.
//
//  Pages NEVER import Firebase SDK directly.
//  They import from this module instead.
//
//  Exports:
//    loginWithEmail(email, password)
//    loginWithGoogle()
//    signupWithEmail(name, email, password)
//    signupWithGoogle()   ← signs out after; caller sends user to login
//    setUserRole(role)
//    saveVendorProfile(businessName, phone, category)
//    logoutUser()
//    onAuthReady(callback)   ← thin wrapper for onAuthStateChanged
//    currentUser()           ← sync getter for auth.currentUser
// ============================================================

import { auth, db }                          from "./firebase-core.js";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { clearProfileCache } from "./utils.js";
import { cacheClearAll }     from "./service-layer.js";

// ── Read ──────────────────────────────────────────────────────

/** Sync getter — returns Firebase auth.currentUser or null */
export function currentUser() {
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes.
 * @param {function(import("firebase/auth").User|null)} callback
 * @returns {function} unsubscribe
 */
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Login ─────────────────────────────────────────────────────

/**
 * Sign in with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in / register with Google popup.
 * Creates a Firestore user doc (merge: true) on first sign-in.
 * @returns {Promise<import("firebase/auth").UserCredential>}
 */
export async function loginWithGoogle() {
  const result  = await signInWithPopup(auth, new GoogleAuthProvider());
  const userRef  = doc(db, "users", result.user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    // Brand new Google user — create stub (no role yet → will go to role-select)
    await setDoc(userRef, {
      email:     result.user.email,
      name:      result.user.displayName || "",
      createdAt: new Date()
    });
  } else {
    // Returning user — only update email/name, preserve role and all other fields
    await updateDoc(userRef, {
      email: result.user.email,
      name:  result.user.displayName || ""
    });
  }

  return result;
}

// ── Signup ────────────────────────────────────────────────────

/**
 * Create a new account with email + password.
 * Creates a Firestore user doc (no role yet), clears profile cache,
 * then signs out so onboarding always starts from a clean session
 * (aligned with Google signup: sign-out after write avoids auth observer races.)
 */
export async function signupWithEmail(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", user.uid), {
    name,
    email: user.email,
    createdAt: new Date()
  });
  clearProfileCache();
  await signOut(auth);
}

/**
 * Sign up via Google popup.
 * Same end state as email signup: Firestore stub, cache cleared, signed out.
 * Caller should send the user to login (then they sign in again to pick a role).
 * @returns {Promise<void>} (credential is discarded after sign-out)
 */
export async function signupWithGoogle() {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  await setDoc(doc(db, "users", result.user.uid), {
    name:      result.user.displayName || "",
    email:     result.user.email,
    createdAt: new Date()
  }, { merge: true });
  clearProfileCache();
  await signOut(auth);
}

// ── Onboarding ────────────────────────────────────────────────

/**
 * Save the role chosen on role-select.html.
 * @param {"user"|"vendor"} role
 */
export async function setUserRole(role) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");
  await setDoc(doc(db, "users", user.uid), {
    role,
    email:     user.email,
    createdAt: new Date()
  }, { merge: true });
  clearProfileCache(); // force fresh Firestore read on next page
}

/**
 * Save vendor profile fields (vendor-setup.html).
 * @param {string} businessName
 * @param {string} phone
 * @param {string} category
 */
export async function saveVendorProfile(businessName, phone, category) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated.");

  // Check if setup already complete
  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists() && snap.data().businessName) return; // idempotent

  await setDoc(doc(db, "users", user.uid), {
    businessName, phone, category
  }, { merge: true });

  clearProfileCache();
}

// ── Logout ────────────────────────────────────────────────────

/**
 * Sign out and clear all caches.
 */
export async function logoutUser() {
  clearProfileCache();
  cacheClearAll();
  await signOut(auth);
}