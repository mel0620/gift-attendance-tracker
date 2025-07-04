import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, query, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
            await signInAnonymously(auth);
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
const bothAttendanceInput = document.getElementById('both_attendance');
const attendanceDateInput = document.getElementById('attendance_date');
const saveAttendanceButton = document.getElementById('save_attendance');
const reportContainer = document.getElementById('report_container');
const monthlyReportContainer = document.getElementById('monthly_report_container');
const yearlyReportContainer = document.getElementById('yearly_report_container');
const allRecordsContainer = document.getElementById('all_records_container');
const overallSummaryContainer = document.getElementById('overall_summary_container');
const toastContainer = document.getElementById('toast-container');

// Views and Pages
const mainView = document.getElementById('main_view');
const pageDaily = document.getElementById('page_daily');
const pageMonthly = document.getElementById('page_monthly');
const pageYearly = document.getElementById('page_yearly');
const pageAll = document.getElementById('page_all');

// Tabs
const tabDaily = document.getElementById('tab_daily');
const tabMonthly = document.getElementById('tab_monthly');
const tabYearly = document.getElementById('tab_yearly');

// Links for navigation
const viewAllLink = document.getElementById('view_all_link');
const backLink = document.getElementById('back_link');

// --- Modal DOM Elements ---
const editModal = document.getElementById('edit_modal');
const editMorningInput = document.getElementById('edit_morning_attendance');
const editAfternoonInput = document.getElementById('edit_afternoon_attendance');
const editBothInput = document.getElementById('edit_both_attendance');
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

viewAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    mainView.style.display = 'none';
    pageAll.style.display = 'block';
});

backLink.addEventListener('click', (e) => {
    e.preventDefault();
    pageAll.style.display = 'none';
    mainView.style.display = 'block';
});

// Add event listeners to parent containers for edit buttons
reportContainer.addEventListener('click', handleEditClick);
allRecordsContainer.addEventListener('click', handleEditClick);

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

    const morningCount = parseInt(morningAttendanceInput.value, 10) || 0;
    const afternoonCount = parseInt(afternoonAttendanceInput.value, 10) || 0;
    const bothCount = parseInt(bothAttendanceInput.value, 10) || 0;
    const attendanceDate = attendanceDateInput.value;

    if (!attendanceDate) {
        showToast("Please select a date.", "error");
        return;
    }
    
    if (morningCount < 0 || afternoonCount < 0 || bothCount < 0) {
        showToast("Attendance cannot be negative.", "error");
        return;
    }

    if (bothCount > morningCount || bothCount > afternoonCount) {
        showToast("Attendees of both services cannot exceed morning or afternoon attendance.", "error");
        return;
    }

    try {
        const attendanceCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/attendance`);
        await addDoc(attendanceCollectionRef, {
            morning: morningCount,
            afternoon: afternoonCount,
            both: bothCount,
            date: attendanceDate,
            createdAt: serverTimestamp()
        });

        showToast("Attendance saved successfully!");
        morningAttendanceInput.value = '';
        afternoonAttendanceInput.value = '';
        bothAttendanceInput.value = '0';
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
            if (data.date) {
                attendanceRecords.push({ id: doc.id, ...data });
            }
        });

        const sortedRecords = [...attendanceRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        generateOverallSummary(sortedRecords);
        generateRecentRecords(sortedRecords);
        generateMonthlyReport(sortedRecords);
        generateYearlyReport(sortedRecords);
        generateAllRecordsList(sortedRecords);

    }, (error) => {
        console.error("Error loading attendance report:", error);
        [reportContainer, monthlyReportContainer, yearlyReportContainer, allRecordsContainer].forEach(container => {
            container.innerHTML = `<p class="text-red-500">Error loading report.</p>`;
        });
    });
}

function generateOverallSummary(records) {
    if (records.length === 0) {
        overallSummaryContainer.innerHTML = '';
        return;
    }
    let totalMorning = 0;
    let totalAfternoon = 0;
    let totalUnique = 0;

    records.forEach(record => {
        const both = record.both || 0;
        totalMorning += record.morning;
        totalAfternoon += record.afternoon;
        totalUnique += (record.morning + record.afternoon - both);
    });

    const averageMorning = (records.length > 0) ? Math.round(totalMorning / records.length) : 0;
    const averageAfternoon = (records.length > 0) ? Math.round(totalAfternoon / records.length) : 0;
    const averageTotal = (records.length > 0) ? Math.round(totalUnique / records.length) : 0;

    overallSummaryContainer.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div class="bg-blue-100 p-3 rounded-lg">
                <p class="text-sm text-blue-800">Avg. Morning</p>
                <p class="text-2xl font-bold text-blue-900">${averageMorning}</p>
            </div>
            <div class="bg-green-100 p-3 rounded-lg">
                <p class="text-sm text-green-800">Avg. Afternoon</p>
                <p class="text-2xl font-bold text-green-900">${averageAfternoon}</p>
            </div>
            <div class="bg-purple-100 p-3 rounded-lg">
                <p class="text-sm text-purple-800">Avg. Unique Total</p>
                <p class="text-2xl font-bold text-purple-900">${averageTotal}</p>
            </div>
        </div>
    `;
}

function generateRecentRecords(records) {
    if (records.length === 0) {
        reportContainer.innerHTML = '<p class="text-gray-600">No recent records.</p>';
        return;
    }

    let reportHTML = '';
    records.slice(0, 5).forEach(record => {
        const both = record.both || 0;
        const total = record.morning + record.afternoon - both;
        reportHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                <div>
                    <span class="font-medium">${new Date(record.date + 'T00:00:00').toLocaleDateString()}</span>
                    <div class="text-sm text-gray-600">
                        <span class="mr-4">M: ${record.morning}</span>
                        <span class="mr-4">A: ${record.afternoon}</span>
                        <span class="mr-4">B: ${both}</span>
                        <span class="font-semibold">T: ${total}</span>
                    </div>
                </div>
                <button class="edit-btn text-sm text-blue-600 hover:text-blue-800 font-medium" data-id="${record.id}">Edit</button>
            </div>
        `;
    });
    reportContainer.innerHTML = reportHTML;
}

function generateMonthlyReport(records) {
     if (records.length === 0) {
        monthlyReportContainer.innerHTML = '<p class="text-gray-600">No data yet.</p>';
        return;
    }
    const monthlyData = {};
    records.forEach(record => {
        const date = new Date(record.date + 'T00:00:00');
        const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { morningTotal: 0, afternoonTotal: 0, bothTotal: 0, count: 0, sortKey: date.getFullYear() * 100 + date.getMonth() };
        }
        monthlyData[monthYear].morningTotal += record.morning;
        monthlyData[monthYear].afternoonTotal += record.afternoon;
        monthlyData[monthYear].bothTotal += (record.both || 0);
        monthlyData[monthYear].count++;
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => monthlyData[b].sortKey - monthlyData[a].sortKey);
    let reportHTML = '<div class="space-y-3">';
    sortedMonths.forEach(monthYear => {
        const data = monthlyData[monthYear];
        const avgMorning = Math.round(data.morningTotal / data.count);
        const avgAfternoon = Math.round(data.afternoonTotal / data.count);
        const avgTotal = Math.round((data.morningTotal + data.afternoonTotal - data.bothTotal) / data.count);

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
                        <p>Avg. Unique Total</p>
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
        yearlyReportContainer.innerHTML = '<p class="text-gray-600">No data yet.</p>';
        return;
    }

    const yearlyData = {};
    records.forEach(record => {
        const year = new Date(record.date + 'T00:00:00').getFullYear();
        if (!yearlyData[year]) {
            yearlyData[year] = { morningTotal: 0, afternoonTotal: 0, bothTotal: 0, count: 0 };
        }
        yearlyData[year].morningTotal += record.morning;
        yearlyData[year].afternoonTotal += record.afternoon;
        yearlyData[year].bothTotal += (record.both || 0);
        yearlyData[year].count++;
    });

    const sortedYears = Object.keys(yearlyData).sort((a, b) => b - a);
    let reportHTML = '<div class="space-y-4">';

    sortedYears.forEach(year => {
        const data = yearlyData[year];
        const avgMorning = Math.round(data.morningTotal / data.count);
        const avgAfternoon = Math.round(data.afternoonTotal / data.count);
        const totalAverage = Math.round((data.morningTotal + data.afternoonTotal - data.bothTotal) / data.count);

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
                        <p class="text-sm text-purple-800">Avg. Unique Total</p>
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

function generateAllRecordsList(records) {
    if (records.length === 0) {
        allRecordsContainer.innerHTML = '<p class="text-gray-600">No data yet.</p>';
        return;
    }

    let listHTML = '';
    records.forEach(record => {
        const both = record.both || 0;
        const total = record.morning + record.afternoon - both;
        listHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                <div>
                    <span class="font-medium">${new Date(record.date + 'T00:00:00').toLocaleDateString()}</span>
                    <div class="text-sm text-gray-600">
                        <span class="mr-4">M: ${record.morning}</span>
                        <span class="mr-4">A: ${record.afternoon}</span>
                        <span class="mr-4">B: ${both}</span>
                        <span class="font-semibold">T: ${total}</span>
                    </div>
                </div>
                <button class="edit-btn text-sm text-blue-600 hover:text-blue-800 font-medium" data-id="${record.id}">Edit</button>
            </div>
        `;
    });
    allRecordsContainer.innerHTML = listHTML;
}

// --- Modal and Edit Functions ---

function handleEditClick(e) {
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
            editBothInput.value = data.both || 0;
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
    const morning = parseInt(editMorningInput.value, 10) || 0;
    const afternoon = parseInt(editAfternoonInput.value, 10) || 0;
    const both = parseInt(editBothInput.value, 10) || 0;
    const date = editDateInput.value;

    if (!date) {
        showToast("Please select a date.", "error");
        return;
    }
    
    if (morning < 0 || afternoon < 0 || both < 0) {
        showToast("Attendance cannot be negative.", "error");
        return;
    }

    if (both > morning || both > afternoon) {
        showToast("Attendees of both services cannot exceed morning or afternoon attendance.", "error");
        return;
    }

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/attendance`, currentEditingId);
    try {
        await updateDoc(docRef, { morning, afternoon, both, date });
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
