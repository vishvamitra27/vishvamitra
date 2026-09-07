import { auth } from "./firebase-core.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { isOperatorAdmin } from "./role.js";
import { P } from "./core/routes.js";
import { navigate } from "./core/router.js";

/** Require any signed-in user; reveal vendor/user dashboard shell when present. */
export function protectPage() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigate(P.LOGIN, { replace: true });
      return;
    }
    const el = document.getElementById("dashMain");
    if (el) el.style.visibility = "visible";
  });
}

/** Require an admin account; reveal #adminWrap when present. */
export function protectAdminPage() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navigate(P.LOGIN, { replace: true });
      return;
    }

    if (!(await isOperatorAdmin(user))) {
      navigate(P.HOME, { replace: true });
      return;
    }

    const el = document.getElementById("adminWrap");
    if (el) el.style.visibility = "visible";
  });
}