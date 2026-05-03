// ============================================================
//  scripts/ads.js  (v1)
//
//  All Firestore + Storage operations for the "ads" collection.
//
//  Ad document shape:
//    title      : string
//    type       : "image" | "video"
//    url        : string  (Firebase Storage download URL)
//    link       : string  (optional click-through URL)
//    active     : boolean
//    order      : number  (lower = shown first)
//    createdAt  : Timestamp
//    uploadedBy : string  (admin uid)
// ============================================================

import { db, storage }      from "./firebase-core.js";
import {
  collection, doc,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";

const COL = "ads";
const MAX_SIZE_MB = 20;

// ─────────────────────────────────────────────────────────────
//  UPLOAD
// ─────────────────────────────────────────────────────────────

/**
 * Upload an ad media file (image or video) to Firebase Storage.
 * @param {File}   file
 * @param {string} adminId
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} download URL
 */
export async function uploadAdMedia(file, adminId = "admin", onProgress) {
  if (file.size > MAX_SIZE_MB * 1024 * 1024)
    throw new Error(`File must be under ${MAX_SIZE_MB} MB.`);

  const safeName = String(file.name || "media")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const storageRef = ref(storage, `ads/${adminId}/${uid}_${safeName}`);
  const uploadTask = uploadBytesResumable(storageRef, file);

  await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snap) => {
        if (typeof onProgress === "function" && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      resolve
    );
  });

  return getDownloadURL(storageRef);
}

// ─────────────────────────────────────────────────────────────
//  WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Create a new ad. File is uploaded first, then the doc is written.
 * @param {Object} data  - { title, link, active, order }
 * @param {string} adminId
 * @param {File}   file
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} new doc ID
 */
export async function addAd(data, adminId, file, onProgress) {
  const url  = await uploadAdMedia(file, adminId, onProgress);
  const type = file.type.startsWith("video/") ? "video" : "image";

  const docRef = await addDoc(collection(db, COL), {
    title:      data.title      || "",
    link:       data.link       || "",
    active:     data.active     ?? true,
    order:      Number(data.order) || 0,
    type,
    url,
    uploadedBy: adminId,
    createdAt:  serverTimestamp(),
    // store the storage path so we can delete it later
    storagePath: `ads/${adminId}/${url.split(`ads%2F${adminId}%2F`)[1]?.split("?")[0] || ""}`,
  });

  return docRef.id;
}

/**
 * Update ad metadata (does NOT re-upload media).
 * @param {string} adId
 * @param {Object} data - { title, link, active, order }
 */
export async function updateAd(adId, data) {
  const payload = {};
  if (data.title  !== undefined) payload.title  = data.title;
  if (data.link   !== undefined) payload.link   = data.link;
  if (data.active !== undefined) payload.active = data.active;
  if (data.order  !== undefined) payload.order  = Number(data.order);
  await updateDoc(doc(db, COL, adId), payload);
}

/**
 * Toggle ad active/inactive.
 * @param {string}  adId
 * @param {boolean} active
 */
export async function setAdActive(adId, active) {
  await updateDoc(doc(db, COL, adId), { active });
}

/**
 * Delete an ad and its Storage file.
 * @param {string} adId
 * @param {string} [storagePath]
 */
export async function deleteAd(adId, storagePath) {
  await deleteDoc(doc(db, COL, adId));
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Storage file missing — not fatal
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  READ / SUBSCRIBE
// ─────────────────────────────────────────────────────────────

/**
 * Real-time subscription to ALL ads (for admin panel).
 * @param {function(Array): void} callback
 * @param {function(*): void}     [onError]
 * @returns {function} unsubscribe
 */
export function subscribeToAllAds(callback, onError) {
  const q = query(collection(db, COL), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err)  => {
      if (typeof onError === "function") onError(err);
      else console.error("[ads.subscribeToAllAds]", err);
    }
  );
}

/**
 * Real-time subscription to ACTIVE ads only (for homepage).
 * @param {function(Array): void} callback
 * @param {function(*): void}     [onError]
 * @returns {function} unsubscribe
 */
export function subscribeToActiveAds(callback, onError) {
  const q = query(
    collection(db, COL),
    where("active", "==", true),
    orderBy("order", "asc")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err)  => {
      if (typeof onError === "function") onError(err);
      else console.error("[ads.subscribeToActiveAds]", err);
    }
  );
}