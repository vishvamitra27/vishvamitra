/**
 * Lightweight global toasts — no dependency on a framework.
 * Host element is created on first use.
 */

const HOST_ID = "vm-toast-host";

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.className = "vm-toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  return host;
}

/**
 * @param {string} message
 * @param {{ kind?: 'info'|'success'|'error'|'warning', duration?: number }} [opts]
 */
export function showToast(message, opts = {}) {
  const { kind = "info", duration = 4800 } = opts;
  const host = ensureHost();
  const el = document.createElement("div");
  el.className = `vm-toast vm-toast--${kind}`;
  el.setAttribute("role", "status");
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("vm-toast--visible"));

  const remove = () => {
    el.classList.remove("vm-toast--visible");
    setTimeout(() => el.remove(), 280);
  };
  const t = window.setTimeout(remove, duration);

  el.addEventListener("click", () => {
    window.clearTimeout(t);
    remove();
  });
}
