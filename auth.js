import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";





const firebaseConfig = {
  apiKey: "AIzaSyD4pVmGDasFAADaiYctht55jE2NvIpHSto",
  authDomain: "vishvamitra-79627.firebaseapp.com",
  projectId: "vishvamitra-79627",
  storageBucket: "vishvamitra-79627.firebasestorage.app",
  messagingSenderId: "436224322843",
  appId: "1:436224322843:web:a4d074a5eb8ad99866f7be"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


async function updateNavbar(user) {
 const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const dashboardLink = document.getElementById("dashboardLink");
  const adminLink = document.getElementById("adminLink");

  if (user) {

    loginLink && (loginLink.style.display = "none");
    logoutLink && (logoutLink.style.display = "inline-block");
    dashboardLink && (dashboardLink.style.display = "inline-block");

    // 🔥 Check role
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (userDoc.exists() && userDoc.data().role === "admin") {
      adminLink && (adminLink.style.display = "inline-block");
    } else {
      adminLink && (adminLink.style.display = "none");
    }

  } else {

    loginLink && (loginLink.style.display = "inline-block");
    logoutLink && (logoutLink.style.display = "none");
    dashboardLink && (dashboardLink.style.display = "none");
    adminLink && (adminLink.style.display = "none");
  }
}

// 🔐 Wait until auth state is READY
onAuthStateChanged(auth, (user) => {
  updateNavbar(user);
  const page = location.pathname.split("/").pop();
  const restricted = ["dashboard.html", "add-listing.html"];

  if (!user && restricted.includes(page)) {
    location.replace("login.html");
  }
});

// 🔁 Fix browser back/forward cache issue (CORRECT WAY)
window.addEventListener("pageshow", () => {
  onAuthStateChanged(auth, (user) => {
    updateNavbar(user);
  });
});


// 🚪 Logout
document.addEventListener("click", (e) => {
  if (e.target.id === "logoutLink") {
    e.preventDefault();
    signOut(auth).then(() => location.replace("index.html"));
  }
});



