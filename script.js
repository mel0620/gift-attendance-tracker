import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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

let currentEditingId = null;

// --- DOM Elements ---
const loginView = document.getElementById('login_view');
const appView = document.getElementById('app_view');
const loginForm = document.getElementById('login_form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login_error');
const logoutBtn = document.getElementById('logout_btn');

// Main Entry Form
const attendanceDateInput = document.getElementById('attendance_date');
const saveAttendanceButton = document.getElementById('save_attendance');
const morningInputs = {
    adults: document.getElementById('morning_adults'),
    youth: document.getElementById('morning_youth'),
    kids: document.getElementById('morning_kids'),
    visitors: document.getElementById('morning_visitors'),
};
const afternoonInputs = {
    adults: document.getElementById('afternoon_adults'),
    youth: document.getElementById('afternoon_youth'),
    kids: document.getElementById('afternoon_kids'),
    visitors: document.getElementById('afternoon_visitors'),
};
const bothTotalInput = document.getElementById('both_total');
const baptizedTotalInput = document.getElementById('baptized_total');


// Report Containers
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

// Links
const viewAllLink = document.getElementById('view_all_link');
const backLink = document.getElementById('back_link');

// Edit Modal
const editModal = document.getElementById('edit_modal');
const editMorningInputs = {
    adults: document.getElementById('edit_morning_adults'),
    youth: document.getElementById('edit_morning_youth'),
    kids: document.getElementById('edit_morning_kids'),
    visitors: document.getElementById('edit_morning_visitors'),
};
const editAfternoonInputs = {
    adults: document.getElementById('edit_afternoon_adults'),
    youth: document.getElementById('edit_afternoon_youth'),
    kids: document.getElementById('edit_afternoon_kids'),
    visitors: document.getElementById('edit_afternoon_visitors'),
};
const editBothTotalInput = document.getElementById('edit_both_total');
const editBaptizedTotalInput = document.getElementById('edit_baptized_total');
const editDateInput = document.getElementById('edit_attendance_date');
const saveChangesBtn = document.getElementById('save_changes_btn');
const cancelEditBtn = document.getElementById('cancel_edit_btn');
const deleteRecordBtn = document.getElementById('delete_record_btn');

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.style.display = 'none';
        appView.style.display = 'block';
        loadAttendanceReport();
    } else {
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }
});

// --- Event Listeners ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = 'Invalid email or password.';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));
attendanceDateInput.valueAsDate = new Date();
saveAttendanceButton.addEventListener('click', saveAttendance);
tabDaily.addEventListener('click', () => switchTab('daily'));
tabMonthly.addEventListener('click', () => switchTab('monthly'));
tabYearly.addEventListener('click', () => switchTab('yearly'));
viewAllLink.addEventListener('click', (e) => { 
    e.preventDefault(); 
    mainView.style.display = 'none'; 
    pageAll.style.display = 'block'; 
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 🔥 Scroll to top
});
backLink.addEventListener('click', (e) => { e.preventDefault(); pageAll.style.display = 'none'; mainView.style.display = 'block'; });
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

function getCountsFromInputs(inputs) {
    const counts = {};
    for (const key in inputs) {
        const value = parseInt(inputs[key].value, 10) || 0;
        if (value < 0) throw new Error("Attendance cannot be negative.");
        counts[key] = value;
    }
    return counts;
}

async function saveAttendance() {
    const attendanceDate = attendanceDateInput.value;
    if (!attendanceDate) {
        showToast("Please select a date.", "error");
        return;
    }
    try {
        const morning = getCountsFromInputs(morningInputs);
        const afternoon = getCountsFromInputs(afternoonInputs);
        const bothTotal = parseInt(bothTotalInput.value, 10) || 0;
        const baptizedTotal = parseInt(baptizedTotalInput.value, 10) || 0;

        if (bothTotal < 0) throw new Error("Attendance cannot be negative.");

        const morningTotal = Object.values(morning).reduce((a, b) => a + b, 0);
        const afternoonTotal = Object.values(afternoon).reduce((a, b) => a + b, 0);

        // ✅ Stop saving if all fields = 0
        if (morningTotal === 0 && afternoonTotal === 0 && bothTotal === 0) {
            showToast("Cannot save. All attendance values are zero.", "error");
            return;
        }

        if (bothTotal > morningTotal || bothTotal > afternoonTotal) {
            throw new Error("'Both' count cannot exceed total morning or afternoon attendance.");
        }

        const attendanceCollectionRef = collection(db, `artifacts/${appId}/attendance`);
        await addDoc(attendanceCollectionRef, {
            date: attendanceDate,
            morning,
            afternoon,
            both: bothTotal,
            baptized: baptizedTotal,
            createdAt: serverTimestamp()
        });

        showToast("Attendance saved successfully!");
        [...Object.values(morningInputs), ...Object.values(afternoonInputs)].forEach(input => input.value = '0');
        bothTotalInput.value = '0';
        baptizedTotalInput.value = '0';
    } catch (error) {
        showToast(error.message, "error");
    }
}

let unsubscribe;
function loadAttendanceReport() {
    if (unsubscribe) unsubscribe(); 
    
    const attendanceCollectionRef = collection(db, `artifacts/${appId}/attendance`);
    const q = query(attendanceCollectionRef);

    unsubscribe = onSnapshot(q, (querySnapshot) => {
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
    });
}

function getUniqueTotal(record) {
    const morningTotal = Object.values(record.morning).reduce((a, b) => a + b, 0);
    const afternoonTotal = Object.values(record.afternoon).reduce((a, b) => a + b, 0);
    // Handle both old (object) and new (number) data formats for 'both'
    const bothTotal = typeof record.both === 'number' ? record.both : 
                      (record.both ? Object.values(record.both).reduce((a, b) => a + b, 0) : 0);
    return morningTotal + afternoonTotal - bothTotal;
}

function generateOverallSummary(records) {
    if (records.length === 0) {
        overallSummaryContainer.innerHTML = '';
        return;
    }

    // 🔥 Filter records to current month only
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthRecords = records.filter(rec => {
        const date = new Date(rec.date + 'T00:00:00');
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    if (monthRecords.length === 0) {
        overallSummaryContainer.innerHTML = `
            <p class="text-gray-600 text-center">No records yet for this month.</p>`;
        return;
    }

    // Calculate totals
    const totals = { morning: 0, afternoon: 0, unique: 0 };
    monthRecords.forEach(rec => {
        totals.morning += Object.values(rec.morning).reduce((a, b) => a + b, 0);
        totals.afternoon += Object.values(rec.afternoon).reduce((a, b) => a + b, 0);
        totals.unique += getUniqueTotal(rec);
    });

    // Averages
    const count = monthRecords.length;
    const avgMorning = Math.round(totals.morning / count);
    const avgAfternoon = Math.round(totals.afternoon / count);
    const avgUnique = Math.round(totals.unique / count);

    // ✅ Display Monthly Avg
    const monthName = now.toLocaleString('default', { month: 'short' });
    overallSummaryContainer.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div class="bg-blue-100 p-3 rounded-lg">
                <p class="text-sm text-blue-800">Avg. Morning (${monthName})</p>
                <p class="text-2xl font-bold text-blue-900">${avgMorning}</p>
            </div>
            <div class="bg-green-100 p-3 rounded-lg">
                <p class="text-sm text-green-800">Avg. Afternoon (${monthName})</p>
                <p class="text-2xl font-bold text-green-900">${avgAfternoon}</p>
            </div>
            <div class="bg-purple-100 p-3 rounded-lg">
                <p class="text-sm text-purple-800">Avg. Unique Total (${monthName})</p>
                <p class="text-2xl font-bold text-purple-900">${avgUnique}</p>
            </div>
        </div>`;
}


function generateRecordListItem(record) {
    // Morning
    const mAdults = record.morning.adults || 0;
    const mYouth = record.morning.youth || 0;
    const mKids = record.morning.kids || 0;
    const mVisitors = record.morning.visitors || 0;
    const morningTotal = mAdults + mYouth + mKids + mVisitors;

    // Afternoon
    const aAdults = record.afternoon.adults || 0;
    const aYouth = record.afternoon.youth || 0;
    const aKids = record.afternoon.kids || 0;
    const aVisitors = record.afternoon.visitors || 0;
    const afternoonTotal = aAdults + aYouth + aKids + aVisitors;

    const uniqueTotal = getUniqueTotal(record);
    const baptizedTotal = record.baptized || 0;

    return `
        <div class="bg-gray-50 p-3 rounded-md shadow-sm mb-2">
            <div class="flex justify-between items-center mb-2">
                <span class="font-medium">${new Date(record.date + 'T00:00:00').toLocaleDateString()}</span>
                <button class="edit-btn text-sm text-blue-600 hover:text-blue-800 font-medium" 
                        data-id="${record.id}">Edit</button>
            </div>
            <div class="text-xs text-gray-700 space-y-1">
                <div class="flex justify-between bg-blue-50 p-2 rounded">
                    <span class="font-semibold text-blue-800">Morning</span>
                    <span class="text-blue-700">
                        A:${mAdults} | Y:${mYouth} | K:${mKids} | V:${mVisitors} 
                        <span class="ml-2 font-bold text-blue-900">Total: ${morningTotal}</span>
                    </span>
                </div>
                <div class="flex justify-between bg-green-50 p-2 rounded">
                    <span class="font-semibold text-green-800">Afternoon</span>
                    <span class="text-green-700">
                        A:${aAdults} | Y:${aYouth} | K:${aKids} | V:${aVisitors} 
                        <span class="ml-2 font-bold text-green-900">Total: ${afternoonTotal}</span>
                    </span>
                </div>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs">
                <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Visitors: ${mVisitors + aVisitors}</span>
                <span class="bg-orange-100 text-orange-800 px-2 py-1 rounded">Baptized: ${baptizedTotal}</span>
                <span class="bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">Unique Total: ${uniqueTotal}</span>
            </div>
        </div>`;
}


function generateRecentRecords(records) {
    reportContainer.innerHTML = records.length ? records.slice(0, 5).map(generateRecordListItem).join('') : '<p class="text-gray-600">No recent records.</p>';
}

function generateAllRecordsList(records) {
    allRecordsContainer.innerHTML = records.length ? records.map(generateRecordListItem).join('') : '<p class="text-gray-600">No data yet.</p>';
}

function generateAggregateReport(container, records, groupBy) {
    if (records.length === 0) {
        container.innerHTML = '<p class="text-gray-600">No data yet.</p>';
        return;
    }
    const dataMap = {};
    records.forEach(record => {
        const key = groupBy(record.date);
        if (!dataMap[key]) {
            dataMap[key] = { 
                morning: {}, 
                afternoon: {}, 
                totalVisitors: 0, 
                totalBaptized: 0,   // 🔥 Added
                uniqueTotal: 0, 
                count: 0 
            };
        }

        ['adults', 'youth', 'kids', 'visitors'].forEach(cat => {
            dataMap[key].morning[cat] = (dataMap[key].morning[cat] || 0) + (record.morning[cat] || 0);
            dataMap[key].afternoon[cat] = (dataMap[key].afternoon[cat] || 0) + (record.afternoon[cat] || 0);
        });

        // 🔥 Sum total visitors and baptized
        dataMap[key].totalVisitors += (record.morning.visitors || 0) + (record.afternoon.visitors || 0);
        dataMap[key].totalBaptized += record.baptized || 0;

        dataMap[key].uniqueTotal += getUniqueTotal(record);
        dataMap[key].count++;
    });

    // ✅ Sort latest first
    const sortedKeys = Object.keys(dataMap).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB - dateA;
    });

    container.innerHTML = sortedKeys.map(key => {
        const data = dataMap[key];
        // ✅ Use the same formula as overall_summary_container
        const totalMorning = Object.values(data.morning).reduce((a, b) => a + b, 0);
        const totalAfternoon = Object.values(data.afternoon).reduce((a, b) => a + b, 0);

        const avgMorning = Math.round(totalMorning / data.count);
        const avgAfternoon = Math.round(totalAfternoon / data.count);
        const avgUniqueTotal = Math.round(data.uniqueTotal / data.count);

        return `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition mb-3">
                <h4 class="font-bold text-lg text-gray-800 mb-4">${key}</h4>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <!-- Morning -->
                    <div class="bg-blue-100 p-2 rounded text-center font-semibold text-blue-800">
                        Avg. Morning Total: ${avgMorning}
                    </div>

                    <!-- Afternoon -->
                    <div class="bg-green-100 p-2 rounded text-center font-semibold text-green-800">
                        Avg. Afternoon Total: ${avgAfternoon}
                    </div>
                </div>

                <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div class="bg-purple-100 p-2 rounded text-center font-semibold text-purple-900">
                        Avg. Unique Total: ${avgUniqueTotal}
                    </div>
                    <div class="bg-yellow-100 p-2 rounded text-center font-semibold text-yellow-900">
                        Total Visitors: ${data.totalVisitors}
                    </div>
                    <div class="bg-orange-100 p-2 rounded text-center font-semibold text-orange-900">
                        Total Baptized: ${data.totalBaptized}
                    </div>
                </div>

                <div class="text-xs text-gray-500 mt-3 text-right">
                    ${data.count} record(s)
                </div>
            </div>`;

    }).join('');
}

function generateMonthlyReport(records) {
    generateAggregateReport(monthlyReportContainer, records, date => new Date(date + 'T00:00:00').toLocaleString('default', { month: 'long', year: 'numeric' }));
}

function generateYearlyReport(records) {
    generateAggregateReport(yearlyReportContainer, records, date => new Date(date + 'T00:00:00').getFullYear().toString());
}

// --- Modal and Edit Functions ---
function handleEditClick(e) {
    if (e.target.classList.contains('edit-btn')) {
        openEditModal(e.target.dataset.id);
    }
}

async function openEditModal(recordId) {
    const docRef = doc(db, `artifacts/${appId}/attendance`, recordId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentEditingId = recordId;

            for (const key in editMorningInputs) editMorningInputs[key].value = data.morning[key] || 0;
            for (const key in editAfternoonInputs) editAfternoonInputs[key].value = data.afternoon[key] || 0;

            const bothValue = typeof data.both === 'number' ? data.both : 
                              (data.both ? Object.values(data.both).reduce((a,b)=>a+b,0) : 0);
            editBothTotalInput.value = bothValue;

            editBaptizedTotalInput.value = data.baptized || 0;

            editDateInput.value = data.date;
            editModal.classList.add('active');
        } else {
            showToast("Record not found.", "error");
        }
    } catch (error) {
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
    const date = editDateInput.value;
    if (!date) {
        showToast("Please select a date.", "error");
        return;
    }
    try {
        const morning = getCountsFromInputs(editMorningInputs);
        const afternoon = getCountsFromInputs(editAfternoonInputs);
        const bothTotal = parseInt(editBothTotalInput.value, 10) || 0;
        const baptizedTotal = parseInt(editBaptizedTotalInput.value, 10) || 0;

        if (bothTotal < 0 || baptizedTotal < 0) throw new Error("Attendance cannot be negative.");

        const morningTotal = Object.values(morning).reduce((a, b) => a + b, 0);
        const afternoonTotal = Object.values(afternoon).reduce((a, b) => a + b, 0);
        if (bothTotal > morningTotal || bothTotal > afternoonTotal) {
            throw new Error("'Both' count cannot exceed total morning or afternoon attendance.");
        }

        const docRef = doc(db, `artifacts/${appId}/attendance`, currentEditingId);
        await updateDoc(docRef, { 
            morning, 
            afternoon, 
            both: bothTotal, 
            baptized: baptizedTotal, // 🔥 Include baptized
            date 
        });
        showToast("Record updated successfully!");
        closeEditModal();
    } catch (error) {
        showToast(error.message, "error");
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
    const docRef = doc(db, `artifacts/${appId}/attendance`, currentEditingId);
    try {
        await deleteDoc(docRef);
        showToast("Record deleted successfully!");
        closeEditModal();
    } catch (error) {
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
        navigator.serviceWorker.register('/service-worker.js');
    });
}
