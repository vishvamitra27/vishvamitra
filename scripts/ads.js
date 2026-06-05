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
 *
 * Merges two groups in display order:
 *   1. Admin-uploaded ads  (active:true, ordered by `order` asc)
 *   2. User-submitted ads  (source:"submission", ordered by `createdAt` desc — newest first)
 *
 * User submissions are displayed as text-card slides inside the same carousel.
 *
 * @param {function(Array): void} callback
 * @param {function(*): void}     [onError]
 * @returns {function} unsubscribe
 */
export function subscribeToActiveAds(callback, onError) {
  // Single query — fetch ALL ads docs, sort/split in JS.
  // Avoids composite-index requirements that cause silent failures.
  const q = query(collection(db, COL));

  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Admin ads: active:true, not a user submission — sorted by order asc
      const adminAds = all
        .filter(ad => ad.active === true && ad.source !== "submission")
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

      // User submissions (advertise.html): active only, newest first
      const submissionAds = all
        .filter(ad => ad.source === "submission" && ad.active === true)
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });

      callback([...adminAds, ...submissionAds]);
    },
    (err) => {
      if (typeof onError === "function") onError(err);
      else console.error("[ads.subscribeToActiveAds]", err);
    }
  );
}
// ─────────────────────────────────────────────────────────────
//  USER-SUBMITTED ADS
// ─────────────────────────────────────────────────────────────

const SUBMISSION_MAX_MB = 5;

/**
 * Upload a user-submitted ad image to Firebase Storage.
 * Stored under ads/submissions/<uuid>_<filename>.
 * @param {File} file
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} public download URL
 */
export async function uploadSubmissionImage(file, onProgress) {
  if (file.size > SUBMISSION_MAX_MB * 1024 * 1024)
    throw new Error(`Image must be under ${SUBMISSION_MAX_MB} MB.`);
  if (!file.type.startsWith("image/"))
    throw new Error("Only image files are accepted.");

  const safeName = String(file.name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const storagePath = `ads/submissions/${uid}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snap) => {
        if (typeof onProgress === "function" && snap.totalBytes > 0)
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      resolve
    );
  });

  const url = await getDownloadURL(storageRef);
  return { url, storagePath };
}

/**
 * Save an advertiser submission to Firestore.
 * Stored in the "ads" collection with source:"submission" and active:true.
 * No admin approval — appears in the carousel immediately.
 *
 * For image ads pass imageFile; the image is uploaded to Storage first
 * and the download URL is stored as url. For text ads leave imageFile null.
 *
 * @param {{fullName:string, phone:string, email:string,
 *          businessName:string, title:string, description:string}} data
 * @param {File|null} [imageFile]
 * @param {(pct:number)=>void} [onProgress]  called during image upload (0-100)
 * @returns {Promise<string>} new document ID
 */
export async function submitAdRequest(data, imageFile = null, onProgress) {
  let imageUrl    = "";
  let storagePath = "";
  let adType      = "text";

  if (imageFile) {
    const uploaded = await uploadSubmissionImage(imageFile, onProgress);
    imageUrl    = uploaded.url;
    storagePath = uploaded.storagePath;
    adType      = "image";
  }

  const docRef = await addDoc(collection(db, COL), {
    fullName:     String(data.fullName     || "").trim(),
    phone:        String(data.phone        || "").trim(),
    email:        String(data.email        || "").trim(),
    businessName: String(data.businessName || "").trim(),
    title:        String(data.title        || "").trim(),
    description:  String(data.description  || "").trim(),
    type:         adType,
    url:          imageUrl,
    link:         "",
    active:       true,
    order:        9999,
    source:       "submission",
    storagePath,
    createdAt:    serverTimestamp(),
  });
  return docRef.id;
}