<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyC33cP0PgxrlMBVm1xfnF_wpYTkfl3_iCQ",
    authDomain: "gift-attendance-tracker.firebaseapp.com",
    projectId: "gift-attendance-tracker",
    storageBucket: "gift-attendance-tracker.firebasestorage.app",
    messagingSenderId: "40292587335",
    appId: "1:40292587335:web:6788dab5131b3c58b91e62",
    measurementId: "G-WNQVJ14B0F"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>


npm install -g firebase-tools