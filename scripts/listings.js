// ============================================================
//  scripts/listings.js  (v3 — service-layer cache integrated)
//
//  All Firestore CRUD for the "listings" collection.
//  Read operations go through service-layer.js (sessionStorage
//  cache with 2-min TTL). Write operations invalidate the
//  relevant cache keys so reads stay consistent.
//
//  Real-time subscriptions (subscribe*) bypass the cache —
//  Firestore's SDK already manages their local snapshots.
// ============================================================

import { db, storage }      from "./firebase-core.js";
import {
  collection, doc,
  addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-storage.js";
import {
  getOrFetch, cacheInvalidate,
  cacheInvalidatePrefix, CacheKey
} from "./service-layer.js";

// Note: paginated getListings() is not cached — DocumentSnapshot cursors
// cannot be serialized to sessionStorage; caching the first page broke
// "Load more" on services.html after a tab refresh.

const COL = "listings";

// ─────────────────────────────────────────────────────────────
//  READ
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a single listing by Firestore doc ID.
 * Result is cached per listing (TTL 2 min).
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getListingById(id) {
  return getOrFetch(
    CacheKey.listing(id),
    async () => {
      const snap = await getDoc(doc(db, COL, id));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
  );
}

/**
 * Paginated fetch of active listings.
 *
 * @param {Object}  opts
 * @param {string}  opts.category  - category filter (empty = all)
 * @param {number}  opts.pageSize  - results per page (default 10)
 * @param {*}       opts.after     - Firestore DocumentSnapshot cursor (next page)
 * @returns {Promise<{listings:Array, lastDoc:*}>}
 */
export async function getListings({
  category  = "",
  type      = "",
  pageSize  = 10,
  after     = null
} = {}) {
  return _fetchPage(category, type, pageSize, after);
}

async function _fetchPage(category, type, pageSize, after) {
  const constraints = [
    where("status", "==", "active"),
    orderBy("name"),
    limit(pageSize)
  ];
  if (type)     constraints.splice(1, 0, where("type",     "==", type));
  if (category) constraints.splice(1, 0, where("category", "==", category));
  if (after)    constraints.push(startAfter(after));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return {
    listings: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc:  snap.docs[snap.docs.length - 1] ?? null
  };
}

/**
 * Real-time subscription for a vendor's own listings.
 * @param {string}   vendorId
 * @param {Function} callback  - receives Array of listing objects
 * @returns {Function} unsubscribe
 */
export function subscribeToVendorListings(vendorId, callback) {
  const q = query(collection(db, COL), where("vendorId", "==", vendorId));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

/**
 * Real-time subscription for all listings (admin).
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToAllListings(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
}

/**
 * Real-time subscription for featured active listings (homepage).
 * @param {Function} callback
 * @param {number}   max
 * @returns {Function} unsubscribe
 */
/**
 * @param {function(Array): void} callback
 * @param {number} [max]
 * @param {function(*): void} [onError] - Firestore listener errors (rules, network)
 */
export function subscribeToFeaturedListings(callback, max = 6, onError) {
  const q = query(
    collection(db, COL),
    where("status", "==", "active"),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      if (typeof onError === "function") onError(err);
      else if (typeof console !== "undefined" && console.error) console.error("[listings.featured]", err);
    }
  );
}

// ─────────────────────────────────────────────────────────────
//  WRITE (all writes invalidate cache)
// ─────────────────────────────────────────────────────────────

/**
 * Upload a listing image to Firebase Storage.
 * @param {File} file
 * @param {string} ownerId
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<string>} download URL
 */
export async function uploadListingImage(file, ownerId = "anonymous", onProgress) {
  if (file.size > 2 * 1024 * 1024) throw new Error("Image must be under 2 MB.");
  const safeName = String(file.name || "image")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
  const uniqueSuffix =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const r = ref(storage, `listings/${ownerId}/${uniqueSuffix}_${safeName}`);
  const uploadTask = uploadBytesResumable(r, file);
  await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (typeof onProgress === "function" && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      resolve
    );
  });
  return getDownloadURL(r);
}

/**
 * Create a new listing (status = "pending").
 * @param {Object}  data
 * @param {string}  vendorId
 * @param {File}    [imageFile]
 * @param {(pct:number)=>void} [onUploadProgress]
 * @returns {Promise<string>} new document ID
 */
export async function addListing(data, vendorId, imageFile = null, onUploadProgress) {
  let imageUrl = "";
  if (imageFile) imageUrl = await uploadListingImage(imageFile, vendorId, onUploadProgress);

  const payload = {
    name:        data.name,
    category:    data.category,
    description: data.description,
    location:    data.location,
    phone:       data.phone,
    type:        data.type,
    price:       data.type === "paid" ? 100 : 0,
    vendorId,
    status:      "pending",
    createdAt:   serverTimestamp(),
    ...(imageUrl && { image: imageUrl })
  };

  const ref2 = await addDoc(collection(db, COL), payload);

  // Invalidate all page caches — new listing should appear eventually
  cacheInvalidatePrefix("page:");
  cacheInvalidatePrefix("featured:");

  return ref2.id;
}

/**
 * Update an existing listing (does NOT touch status).
 * @param {string}  listingId
 * @param {Object}  data
 * @param {File}    [imageFile]
 * @param {(pct:number)=>void} [onUploadProgress]
 */
export async function updateListing(listingId, data, imageFile = null, onUploadProgress) {
  let imageUrl = "";
  if (imageFile) {
    const listing = await getListingById(listingId);
    const ownerId = listing?.vendorId || "anonymous";
    imageUrl = await uploadListingImage(imageFile, ownerId, onUploadProgress);
  }

  const payload = {
    name:        data.name,
    category:    data.category,
    description: data.description,
    location:    data.location,
    phone:       data.phone,
    type:        data.type,
    price:       data.type === "paid" ? 100 : 0,
    ...(imageUrl && { image: imageUrl })
  };

  await updateDoc(doc(db, COL, listingId), payload);

  // Invalidate this listing and any page that might show it
  cacheInvalidate(CacheKey.listing(listingId));
  cacheInvalidatePrefix("page:");
}

/**
 * Permanently delete a listing.
 * @param {string} listingId
 */
export async function deleteListing(listingId) {
  await deleteDoc(doc(db, COL, listingId));
  cacheInvalidate(CacheKey.listing(listingId));
  cacheInvalidatePrefix("page:");
  cacheInvalidatePrefix("featured:");
}

/**
 * Change listing status (admin action).
 * @param {string} listingId
 * @param {"active"|"inactive"|"pending"} status
 */
export async function setListingStatus(listingId, status) {
  await updateDoc(doc(db, COL, listingId), { status });
  cacheInvalidate(CacheKey.listing(listingId));
  cacheInvalidatePrefix("page:");
  cacheInvalidatePrefix("featured:");
}