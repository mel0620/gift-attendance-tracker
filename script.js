import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, query, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
// const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : { apiKey: "your-api-key", authDomain: "your-auth-domain", projectId: "your-project-id" };
// const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-church-attendance';

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

const appId = firebaseConfig.appId;

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null;
let isAuthReady = false;
let currentEditingId = null;

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
    } else {
        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Authentication Error:", error);
        }
    }
    isAuthReady = true;
    loadAttendanceReport();
});

// --- DOM Elements ---
const morningAttendanceInput = document.getElementById('morning_attendance');
const afternoonAttendanceInput = document.getElementById('afternoon_attendance');
const attendanceDateInput = document.getElementById('attendance_date');
const saveAttendanceButton = document.getElementById('save_attendance');
const reportContainer = document.getElementById('report_container');
const monthlyReportContainer = document.getElementById('monthly_report_container');
const yearlyReportContainer = document.getElementById('yearly_report_container');
const toastContainer = document.getElementById('toast-container');
const tabDaily = document.getElementById('tab_daily');
const tabMonthly = document.getElementById('tab_monthly');
const tabYearly = document.getElementById('tab_yearly');
const pageDaily = document.getElementById('page_daily');
const pageMonthly = document.getElementById('page_monthly');
const pageYearly = document.getElementById('page_yearly');

// --- Modal DOM Elements ---
const editModal = document.getElementById('edit_modal');
const editMorningInput = document.getElementById('edit_morning_attendance');
const editAfternoonInput = document.getElementById('edit_afternoon_attendance');
const editDateInput = document.getElementById('edit_attendance_date');
const saveChangesBtn = document.getElementById('save_changes_btn');
const cancelEditBtn = document.getElementById('cancel_edit_btn');
const deleteRecordBtn = document.getElementById('delete_record_btn');

// --- Set default date to today ---
attendanceDateInput.valueAsDate = new Date();

// --- Event Listeners ---
saveAttendanceButton.addEventListener('click', saveAttendance);
tabDaily.addEventListener('click', () => switchTab('daily'));
tabMonthly.addEventListener('click', () => switchTab('monthly'));
tabYearly.addEventListener('click', () => switchTab('yearly'));
reportContainer.addEventListener('click', handleReportClick);
cancelEditBtn.addEventListener('click', closeEditModal);
saveChangesBtn.addEventListener('click', saveChanges);
deleteRecordBtn.addEventListener('click', handleDeleteClick);

// --- Main Functions ---

function switchTab(tabName) {
    [tabDaily, tabMonthly, tabYearly].forEach(tab => tab.classList.remove('active'));
    [pageDaily, pageMonthly, pageYearly].forEach(page => page.classList.remove('active'));
    document.getElementById(`tab_${tabName}`).classList.add('active');
    document.getElementById(`page_${tabName}`).classList.add('active');
}

async function saveAttendance() {
    if (!isAuthReady || !userId) {
        showToast("Authentication not ready. Please wait.", "error");
        return;
    }

    const morningCount = parseInt(morningAttendanceInput.value, 10);
    const afternoonCount = parseInt(afternoonAttendanceInput.value, 10);
    const attendanceDate = attendanceDateInput.value;

    if (isNaN(morningCount) || isNaN(afternoonCount) || !attendanceDate) {
        showToast("Please fill in all fields correctly.", "error");
        return;
    }
    
    if (morningCount < 0 || afternoonCount < 0) {
        showToast("Attendance cannot be negative.", "error");
        return;
    }

    try {
        const attendanceCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/attendance`);
        await addDoc(attendanceCollectionRef, {
            morning: morningCount,
            afternoon: afternoonCount,
            date: attendanceDate,
            createdAt: serverTimestamp()
        });

        showToast("Attendance saved successfully!");
        morningAttendanceInput.value = '';
        afternoonAttendanceInput.value = '';
    } catch (error) {
        console.error("Error saving attendance: ", error);
        showToast("Error saving attendance. Please try again.", "error");
    }
}

async function loadAttendanceReport() {
    if (!isAuthReady || !userId) return;

    const attendanceCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/attendance`);
    const q = query(attendanceCollectionRef);

    onSnapshot(q, (querySnapshot) => {
        const attendanceRecords = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure records have a date field before processing
            if (data.date) {
                attendanceRecords.push({ id: doc.id, ...data });
            }
        });

        const sortedDaily = [...attendanceRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        generateOverallReport(sortedDaily);
        generateMonthlyReport(attendanceRecords);
        generateYearlyReport(attendanceRecords);
    }, (error) => {
        console.error("Error loading attendance report:", error);
        [reportContainer, monthlyReportContainer, yearlyReportContainer].forEach(container => {
            container.innerHTML = `<p class="text-red-500">Error loading report.</p>`;
        });
    });
}

function generateOverallReport(records) {
    if (records.length === 0) {
        reportContainer.innerHTML = '<p class="text-gray-600">No data yet. Add some attendance records to generate a report.</p>';
        return;
    }

    let totalMorning = 0;
    let totalAfternoon = 0;
    let grandTotal = 0;

    records.forEach(record => {
        totalMorning += record.morning;
        totalAfternoon += record.afternoon;
        grandTotal += record.morning + record.afternoon;
    });

    const averageMorning = (records.length > 0) ? Math.round(totalMorning / records.length) : 0;
    const averageAfternoon = (records.length > 0) ? Math.round(totalAfternoon / records.length) : 0;
    const averageTotal = (records.length > 0) ? Math.round(grandTotal / records.length) : 0;

    let reportHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center mb-6">
            <div class="bg-blue-100 p-3 rounded-lg">
                <p class="text-sm text-blue-800">Avg. Morning</p>
                <p class="text-2xl font-bold text-blue-900">${averageMorning}</p>
            </div>
            <div class="bg-green-100 p-3 rounded-lg">
                <p class="text-sm text-green-800">Avg. Afternoon</p>
                <p class="text-2xl font-bold text-green-900">${averageAfternoon}</p>
            </div>
            <div class="bg-purple-100 p-3 rounded-lg">
                <p class="text-sm text-purple-800">Avg. Total</p>
                <p class="text-2xl font-bold text-purple-900">${averageTotal}</p>
            </div>
        </div>
        <h3 class="text-lg font-semibold mb-2">Recent Records</h3>
        <div class="space-y-2">
    `;

    records.slice(0, 10).forEach(record => {
        reportHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                <div>
                    <span class="font-medium">${new Date(record.date + 'T00:00:00').toLocaleDateString()}</span>
                    <div class="text-sm text-gray-600">
                        <span class="mr-4">M: <span class="font-semibold">${record.morning}</span></span>
                        <span>A: <span class="font-semibold">${record.afternoon}</span></span>
                    </div>
                </div>
                <button class="edit-btn text-sm text-blue-600 hover:text-blue-800 font-medium" data-id="${record.id}">Edit</button>
            </div>
        `;
    });

    reportHTML += `</div>`;
    reportContainer.innerHTML = reportHTML;
}

function generateMonthlyReport(records) {
     if (records.length === 0) {
        monthlyReportContainer.innerHTML = '<p class="text-gray-600">No data yet. Add some attendance records to generate a report.</p>';
        return;
    }
    const monthlyData = {};
    records.forEach(record => {
        const date = new Date(record.date + 'T00:00:00');
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { morningTotal: 0, afternoonTotal: 0, count: 0, sortKey: date.getFullYear() * 100 + date.getMonth() };
        }
        monthlyData[monthYear].morningTotal += record.morning;
        monthlyData[monthYear].afternoonTotal += record.afternoon;
        monthlyData[monthYear].count++;
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => monthlyData[b].sortKey - monthlyData[a].sortKey);
    let reportHTML = '<div class="space-y-3">';
    sortedMonths.forEach(monthYear => {
        const data = monthlyData[monthYear];
        const avgMorning = Math.round(data.morningTotal / data.count);
        const avgAfternoon = Math.round(data.afternoonTotal / data.count);
        const avgTotal = Math.round((data.morningTotal + data.afternoonTotal) / data.count);

        reportHTML += `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-bold text-lg text-gray-800 mb-2">${monthYear}</h4>
                <div class="grid grid-cols-3 gap-2 text-center text-gray-600 text-sm">
                    <div class="bg-blue-100 p-2 rounded">
                        <p>Avg. Morning</p>
                        <p class="font-semibold text-lg text-gray-900">${avgMorning}</p>
                    </div>
                    <div class="bg-green-100 p-2 rounded">
                        <p>Avg. Afternoon</p>
                        <p class="font-semibold text-lg text-gray-900">${avgAfternoon}</p>
                    </div>
                    <div class="bg-purple-100 p-2 rounded">
                        <p>Avg. Total</p>
                        <p class="font-semibold text-lg text-gray-900">${avgTotal}</p>
                    </div>
                </div>
                <div class="text-xs text-gray-500 mt-2 text-right">${data.count} record(s)</div>
            </div>
        `;
    });
    reportHTML += '</div>';
    monthlyReportContainer.innerHTML = reportHTML;
}

function generateYearlyReport(records) {
    if (records.length === 0) {
        yearlyReportContainer.innerHTML = '<p class="text-gray-600">No data yet. Add some attendance records to generate a report.</p>';
        return;
    }

    const yearlyData = {};
    records.forEach(record => {
        const year = new Date(record.date + 'T00:00:00').getFullYear();
        if (!yearlyData[year]) {
            yearlyData[year] = { morningTotal: 0, afternoonTotal: 0, count: 0 };
        }
        yearlyData[year].morningTotal += record.morning;
        yearlyData[year].afternoonTotal += record.afternoon;
        yearlyData[year].count++;
    });

    const sortedYears = Object.keys(yearlyData).sort((a, b) => b - a);
    let reportHTML = '<div class="space-y-4">';

    sortedYears.forEach(year => {
        const data = yearlyData[year];
        const avgMorning = Math.round(data.morningTotal / data.count);
        const avgAfternoon = Math.round(data.afternoonTotal / data.count);
        const totalAverage = Math.round((data.morningTotal + data.afternoonTotal) / data.count);

        reportHTML += `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-bold text-xl text-gray-800 mb-3">${year} Summary</h4>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div class="bg-blue-100 p-3 rounded-lg">
                        <p class="text-sm text-blue-800">Avg. Morning</p>
                        <p class="text-2xl font-bold text-blue-900">${avgMorning}</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-lg">
                        <p class="text-sm text-green-800">Avg. Afternoon</p>
                        <p class="text-2xl font-bold text-green-900">${avgAfternoon}</p>
                    </div>
                     <div class="bg-purple-100 p-3 rounded-lg">
                        <p class="text-sm text-purple-800">Total Avg.</p>
                        <p class="text-2xl font-bold text-purple-900">${totalAverage}</p>
                    </div>
                </div>
                 <div class="text-sm text-gray-500 mt-3 text-center">${data.count} record(s) for ${year}</div>
            </div>
        `;
    });

    reportHTML += '</div>';
    yearlyReportContainer.innerHTML = reportHTML;
}


// --- Modal and Edit Functions ---

function handleReportClick(e) {
    if (e.target.classList.contains('edit-btn')) {
        const recordId = e.target.dataset.id;
        openEditModal(recordId);
    }
}

async function openEditModal(recordId) {
    if (!isAuthReady || !userId) return;
    currentEditingId = recordId;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/attendance`, recordId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            editMorningInput.value = data.morning;
            editAfternoonInput.value = data.afternoon;
            editDateInput.value = data.date;
            editModal.classList.add('active');
        } else {
            showToast("Record not found.", "error");
        }
    } catch (error) {
        console.error("Error fetching record for edit:", error);
        showToast("Could not load record.", "error");
    }
}

function closeEditModal() {
    editModal.classList.remove('active');
    currentEditingId = null;
    deleteRecordBtn.textContent = 'Delete';
    deleteRecordBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
}

async function saveChanges() {
    const morning = parseInt(editMorningInput.value, 10);
    const afternoon = parseInt(editAfternoonInput.value, 10);
    const date = editDateInput.value;

    if (isNaN(morning) || isNaN(afternoon) || !date || morning < 0 || afternoon < 0) {
        showToast("Please fill all fields correctly.", "error");
        return;
    }

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/attendance`, currentEditingId);
    try {
        await updateDoc(docRef, { morning, afternoon, date });
        showToast("Record updated successfully!");
        closeEditModal();
    } catch (error) {
        console.error("Error updating record:", error);
        showToast("Update failed. Please try again.", "error");
    }
}

function handleDeleteClick() {
    if (deleteRecordBtn.textContent === 'Delete') {
        deleteRecordBtn.textContent = 'Confirm Delete?';
        deleteRecordBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
    } else {
        deleteRecord();
    }
}

async function deleteRecord() {
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/attendance`, currentEditingId);
    try {
        await deleteDoc(docRef);
        showToast("Record deleted successfully!");
        closeEditModal();
    } catch (error) {
        console.error("Error deleting record:", error);
        showToast("Deletion failed. Please try again.", "error");
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('ServiceWorker registration successful'))
            .catch(err => console.log('ServiceWorker registration failed: ', err));
    });
}
