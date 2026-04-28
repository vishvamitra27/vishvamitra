/**
 * Central route registry — all in-app HTML targets and auth groupings.
 * Pages live under /pages/; navigation uses filenames (relative URLs).
 */

export const P = Object.freeze({
  HOME: "index.html",
  SERVICES: "services.html",
  CONTACT: "contact.html",
  LOGIN: "login.html",
  SIGNUP: "signup.html",
  ROLE_SELECT: "role-select.html",
  VENDOR_SETUP: "vendor-setup.html",
  USER_DASHBOARD: "user-dashboard.html",
  VENDOR_DASHBOARD: "dashboard.html",
  ADMIN: "admin.html",
  ADD_LISTING: "add-listing.html",
  LISTING_DETAILS: "listing-details.html",
  PAID_SERVICES: "paid-services.html",
  FREE_SERVICES: "free-services.html",
});

/** Role → default landing page after login / onboarding */
export const DASHBOARD_BY_ROLE = Object.freeze({
  admin: P.ADMIN,
  vendor: P.VENDOR_DASHBOARD,
  user: P.USER_DASHBOARD,
});

/** @deprecated Use DASHBOARD_BY_ROLE — kept for older imports */
export const ROLE_DASHBOARD = DASHBOARD_BY_ROLE;

export const ROUTE_GROUPS = Object.freeze({
  /** Must be signed in */
  restricted: new Set([
    P.VENDOR_DASHBOARD,
    P.ADD_LISTING,
    P.USER_DASHBOARD,
    P.ADMIN,
  ]),
  /** Role-specific home pages */
  dashboards: new Set([
    P.VENDOR_DASHBOARD,
    P.USER_DASHBOARD,
    P.ADMIN,
  ]),
  /** Flow before role / vendor profile is complete */
  onboarding: new Set([
    P.ROLE_SELECT,
    P.SIGNUP,
    P.VENDOR_SETUP,
  ]),
});

/**
 * Primary nav model — drives navbar HTML (single source of truth).
 * `kind` controls default visibility before auth.js runs.
 */
export const NAV_ITEMS = Object.freeze([
  { label: "Home", path: P.HOME, kind: "public" },
  { label: "Services", path: P.SERVICES, kind: "public" },
  { label: "Contact", path: P.CONTACT, kind: "public" },
  { label: "Dashboard", path: P.VENDOR_DASHBOARD, kind: "dashboard", id: "dashboardLink" },
  { label: "Admin", path: P.ADMIN, kind: "admin", id: "adminLink" },
  { label: "Login", path: P.LOGIN, kind: "login", id: "loginLink" },
  { label: "Logout", path: "#", kind: "logout", id: "logoutLink" },
]);
