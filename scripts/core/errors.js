/**
 * Maps Firebase Auth / Firestore / Storage errors to safe user-facing copy.
 */

const AUTH_MESSAGES = Object.freeze({
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/invalid-login-credentials": "Invalid email or password.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/operation-not-allowed": "This sign-in method is not enabled for this project.",
  "auth/requires-recent-login": "Please sign in again to complete this action.",
});

const FIRESTORE_MESSAGES = Object.freeze({
  "permission-denied":
    "You do not have permission to do that. If the problem continues, contact support.",
  unavailable: "Our servers are busy. Please try again in a moment.",
  "failed-precondition": "This action cannot be completed right now. Try again later.",
  aborted: "The request was cancelled. Please try again.",
  "resource-exhausted": "Too many requests. Please wait and try again.",
  "deadline-exceeded": "The request took too long. Check your connection and try again.",
});

const STORAGE_MESSAGES = Object.freeze({
  "storage/unauthorized": "You do not have permission to upload this file.",
  "storage/canceled": "Upload was cancelled.",
  "storage/retry-limit-exceeded": "Upload failed after several attempts. Try again later.",
  "storage/quota-exceeded": "Storage limit reached. Contact support.",
});

/**
 * @param {string} code - Firebase `error.code`
 * @returns {string}
 */
export function authCodeToMessage(code) {
  if (!code) return "Something went wrong. Please try again.";
  return AUTH_MESSAGES[code] || "Something went wrong. Please try again.";
}

/**
 * Any thrown Firebase or generic Error → user-safe string.
 * @param {*} err
 * @returns {string}
 */
export function toUserMessage(err) {
  if (err == null) return "Something went wrong. Please try again.";
  if (typeof err === "string") return err;
  const code = err.code;
  if (typeof code === "string" && code.startsWith("auth/")) return authCodeToMessage(code);
  if (typeof code === "string" && code.startsWith("storage/")) {
    return STORAGE_MESSAGES[code] || "File upload failed. Please try again.";
  }
  if (typeof code === "string" && FIRESTORE_MESSAGES[code]) {
    return FIRESTORE_MESSAGES[code];
  }
  if (err.message && typeof err.message === "string" && err.message.length < 200) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Log for debugging / future error reporting (e.g. Sentry).
 * @param {string} context
 * @param {*} err
 */
export function reportError(context, err) {
  if (typeof console !== "undefined" && console.error) {
    console.error(`[Vishvamitra:${context}]`, err);
  }
}
