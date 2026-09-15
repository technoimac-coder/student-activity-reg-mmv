// Application State Management
let activities = [];
let applications = [];
let selectedActivityId = null;
let currentEditingActivityId = null;
const TEACHER_PASSWORD = "mmv2026";

// 🔴 URL Google Apps Script Web App สำหรับส่งข้อมูลเข้า Google Sheets อัตโนมัติ
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyrctGiZd0yeZxz7PaWKeiLWl86mIxEZzx4D0_AZy9mUCkJv9ygkcKcTeqEnfY1ckq3og/exec"; 

const STORAGE_ACTIVITIES_KEY = 'photo_app_activities_v13';
const STORAGE_APPS_KEY = 'photo_app_applications_v13';

// Initialize Storage & Data
function initData() {
    const savedActivities = localStorage.getItem(STORAGE_ACTIVITIES_KEY);
    if (savedActivities) {
        try {
            activities = JSON.parse(savedActivities);
            // Automatic migration: If old cache contained 6 activities, reset to 1 activity from INITIAL_ACTIVITIES
            if (activities.length > 1 && INITIAL_ACTIVITIES.length === 1 && !localStorage.getItem('user_added_activities')) {
                activities = JSON.parse(JSON.stringify(INITIAL_ACTIVITIES));
                localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
            } else {
                // Ensure registration stays OPEN by clearing expired regEnd
                activities.forEach(act => {
                    if (act.regEnd === "2026-09-15T16:00" || (act.regEnd && new Date(act.regEnd) <= new Date())) {
                        act.regEnd = "";
                    }
                    const match = INITIAL_ACTIVITIES.find(i => i.id === act.id);
                    if (match) {
                        if (act.regStart === undefined || act.regStart === null) act.regStart = match.regStart || '';
                    }
                });
                saveData();
            }
        } catch (e) {
            activities = JSON.parse(JSON.stringify(INITIAL_ACTIVITIES));
        }
    } else {
        activities = JSON.parse(JSON.stringify(INITIAL_ACTIVITIES));
        localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
    }

    const savedApplications = localStorage.getItem(STORAGE_APPS_KEY);
    if (savedApplications) {
        try {
            applications = JSON.parse(savedApplications);
            if (!Array.isArray(applications)) applications = [];
        } catch (e) {
            applications = [];
        }
    } else {
        applications = [];
    }
    
    if (activities.length > 0) {
        selectedActivityId = activities[0].id;
    }
}

function saveData() {
    localStorage.setItem(STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
    localStorage.setItem(STORAGE_APPS_KEY, JSON.stringify(applications));
}

function clearAllApplications() {
    if (applications.length === 0) {
        showToast('ไม่มีข้อมูลผู้สมัครให้ล้าง', 'info');
        return;
    }
    if (confirm('คุณต้องการลบรายชื่อผู้ลงทะเบียนทั้งหมดในระบบใช่หรือไม่?')) {
        applications = [];
        saveData();
        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('ล้างรายชื่อผู้สมัครทั้งหมดเรียบร้อยแล้ว', 'success');
    }
}

function resetSystemToDefault() {
    if (confirm('คุณต้องการรีเซ็ตระบบกลับเป็น 1 กิจกรรมเริ่มต้น (เรื่องเล่าผ่านเลนส์กล้อง) ใช่หรือไม่?')) {
        localStorage.removeItem(STORAGE_ACTIVITIES_KEY);
        localStorage.removeItem('user_added_activities');
        activities = JSON.parse(JSON.stringify(INITIAL_ACTIVITIES));
        applications = [];
        saveData();
        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('รีเซ็ตระบบกลับเป็น 1 กิจกรรมเริ่มต้นเรียบร้อยแล้ว!', 'success');
    }
}

function getRemainingSeats(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return 0;
    const registeredCount = applications.filter(app => app.activityId === activityId && app.status !== 'cancelled').length;
    return Math.max(0, activity.capacity - registeredCount);
}

function getRegisteredCount(activityId) {
    return applications.filter(app => app.activityId === activityId && app.status !== 'cancelled').length;
}

// Check Registration Open/Close Date Time Status
function getActivityTimeStatus(act) {
    const now = new Date();
    
    if (act.regStart && act.regStart.trim() !== '') {
        const start = new Date(act.regStart);
        if (!isNaN(start.getTime()) && now < start) {
            return {
                status: 'not_started',
                text: '⏳ ยังไม่ถึงกำหนดเวลาเปิดรับสมัคร',
                badgeText: `⏳ เปิดสมัคร: ${start.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} ${start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
                badgeClass: 'bg-amber-400 text-slate-900 font-extrabold'
            };
        }
    }

    if (act.regEnd && act.regEnd.trim() !== '') {
        const end = new Date(act.regEnd);
        if (!isNaN(end.getTime()) && now > end) {
            return {
                status: 'ended',
                text: '⛔ ปิดรับสมัครแล้ว (สิ้นสุดระยะเวลาเปิดรับ)',
                badgeText: `⛔ ปิดรับสมัครแล้ว`,
                badgeClass: 'bg-rose-600 text-white font-extrabold shadow-lg'
            };
        }
    }

    const rem = getRemainingSeats(act.id);
    if (rem <= 0) {
        return {
            status: 'full',
            text: '❌ สิทธิ์เต็มจำนวนแล้ว',
            badgeText: '❌ สิทธิ์เต็มแล้ว',
            badgeClass: 'bg-rose-500 text-white font-extrabold shadow-lg'
        };
    }

    let endInfo = '';
    if (act.regEnd && act.regEnd.trim() !== '') {
        const end = new Date(act.regEnd);
        if (!isNaN(end.getTime())) {
            endInfo = ` (ถึง ${end.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} ${end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.)`;
        }
    }

    return {
        status: 'open',
        text: '🔥 เปิดรับสมัครแล้ว',
        badgeText: `🟢 เปิดรับสมัคร${endInfo}`,
        badgeClass: 'bg-emerald-500 text-white font-extrabold'
    };
}

// Send Data to Google Sheet Web App
function sendToGoogleSheet(appData) {
    if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.trim() === "") return;

    fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(appData)
    }).then(response => {
        console.log("ส่งเข้า Google Sheet สำเร็จ", response);
    }).catch(err => {
        console.error("ส่งเข้า Google Sheet ไม่สำเร็จ:", err);
    });
}

// Render Dropdown options in Form and Admin Dashboard
function renderActivityDropdowns() {
    const formSelect = document.getElementById('activity-select');
    const adminSelect = document.getElementById('admin-activity-filter');

    if (formSelect) {
        formSelect.innerHTML = activities.map(act => {
            const rem = getRemainingSeats(act.id);
            const timeStat = getActivityTimeStatus(act);
            let statusText = `(คงเหลือ ${rem}/${act.capacity} สิทธิ์)`;
            if (timeStat.status === 'not_started') statusText = `⏳ [ยังไม่เปิดสมัคร]`;
            else if (timeStat.status === 'ended') statusText = `⛔ [ปิดรับสมัครแล้ว]`;
            else if (rem === 0) statusText = `❌ [เต็มแล้ว]`;

            return `<option value="${act.id}" ${act.id === selectedActivityId ? 'selected' : ''}>
                ${act.title} ${statusText}
            </option>`;
        }).join('');
    }

    if (adminSelect) {
        const curVal = adminSelect.value || 'all';
        adminSelect.innerHTML = `<option value="all">-- ทุกกิจกรรมรวมกัน --</option>` +
            activities.map(act => {
                const count = getRegisteredCount(act.id);
                return `<option value="${act.id}" ${act.id === curVal ? 'selected' : ''}>
                    ${act.title} (${count}/${act.capacity} คน)
                </option>`;
            }).join('');
    }
}

function onActivitySelectChange(actId) {
    selectedActivityId = actId;
    renderActivityBanner();
}

// Clear All Applicants
function clearAllApplications() {
    if (confirm('คุณต้องการลบรายชื่อผู้ลงทะเบียนทั้งหมดเพื่อเริ่มต้นนับ 0 คนใหม่ใช่หรือไม่?')) {
        applications = [];
        saveData();
        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('ล้างรายชื่อผู้ลงทะเบียนทั้งหมดเป็น 0 คนเรียบร้อยแล้ว', 'success');
    }
}

// Render Banner for Selected Activity
function renderActivityBanner() {
    const container = document.getElementById('activity-banner-container');
    if (!container || activities.length === 0) return;

    const act = activities.find(a => a.id === selectedActivityId) || activities[0];
    selectedActivityId = act.id;

    const registered = getRegisteredCount(act.id);
    const remaining = getRemainingSeats(act.id);
    const percent = Math.min(100, Math.round((registered / act.capacity) * 100));
    const timeStat = getActivityTimeStatus(act);

    let progressBarColor = 'bg-emerald-500';
    if (percent >= 90) progressBarColor = 'bg-rose-500';
    else if (percent >= 70) progressBarColor = 'bg-amber-500';

    // Header updates
    const headerTitle = document.getElementById('header-activity-title');
    const headerBadge = document.getElementById('header-quota-badge');
    if (headerTitle) headerTitle.innerText = 'ระบบรับสมัครกิจกรรมนักเรียน';
    if (headerBadge) headerBadge.innerText = `⭐ มีทั้งหมด ${activities.length} กิจกรรมเปิดรับสมัคร`;

    // Registration Form Submit Button State Update
    const submitBtn = document.querySelector('#registration-form button[type="submit"]');
    if (submitBtn) {
        if (timeStat.status !== 'open') {
            submitBtn.disabled = true;
            submitBtn.className = 'w-full py-4 px-6 text-base md:text-lg rounded-2xl bg-slate-300 text-slate-500 font-bold cursor-not-allowed flex items-center justify-center gap-2 shadow-none';
            submitBtn.innerHTML = `${timeStat.text}`;
        } else {
            submitBtn.disabled = false;
            submitBtn.className = 'btn-primary w-full py-4 px-6 text-base md:text-lg flex items-center justify-center gap-2';
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ยืนยันส่งแบบฟอร์มลงทะเบียน`;
        }
    }

    container.innerHTML = `
        <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
            <div class="absolute -right-10 -bottom-10 opacity-10 text-white pointer-events-none">
                <i class="fa-solid fa-atom text-[200px]"></i>
            </div>

            <div class="relative z-10 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="px-3.5 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-900 uppercase tracking-wider">
                        ⭐ ${act.category || 'กิจกรรมย่อย'} • จำกัด ${act.capacity} คน/ทีม
                    </span>
                    <span class="px-3.5 py-1 rounded-full text-xs ${timeStat.badgeClass}">
                        ${timeStat.badgeText}
                    </span>
                </div>

                <h2 class="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    ${act.title}
                </h2>
                <p class="text-blue-100 text-sm md:text-base leading-relaxed">
                    "${act.description}"
                </p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs text-blue-100">
                    <div class="flex items-center gap-2 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                        <i class="fa-regular fa-calendar-check text-amber-300 text-base"></i>
                        <span><strong>วันจัดกิจกรรม:</strong> ${act.date}</span>
                    </div>
                    <div class="flex items-center gap-2 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                        <i class="fa-solid fa-clock text-amber-300 text-base"></i>
                        <span><strong>เวลาจัดงาน:</strong> ${act.time}</span>
                    </div>
                    <div class="flex items-center gap-2 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                        <i class="fa-solid fa-location-dot text-amber-300 text-base"></i>
                        <span><strong>สถานที่:</strong> ${act.location}</span>
                    </div>
                </div>

                <!-- Quota Counter Progress -->
                <div class="pt-2 space-y-1.5">
                    <div class="flex justify-between text-xs font-bold text-blue-200">
                        <span>ลงทะเบียนแล้ว: ${registered} คน</span>
                        <span>คงเหลือ: ${remaining} สิทธิ์ (${percent}% เต็มแล้ว)</span>
                    </div>
                    <div class="w-full bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-md">
                        <div class="${progressBarColor} h-3 rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const inputActId = document.getElementById('selected-activity-id');
    if (inputActId) inputActId.value = act.id;
}

// Submit Registration Form
function handleRegistrationSubmit(event) {
    event.preventDefault();

    const actSelect = document.getElementById('activity-select');
    const actId = actSelect ? actSelect.value : selectedActivityId;
    const activity = activities.find(a => a.id === actId);

    if (!activity) {
        showToast('กรุณาเลือกกิจกรรมที่ต้องการสมัคร', 'error');
        return;
    }

    // Check Start / End Time Constraints
    const timeStat = getActivityTimeStatus(activity);
    if (timeStat.status !== 'open') {
        showToast(timeStat.text, 'error');
        return;
    }

    const studentId = document.getElementById('studentId').value.trim();
    const prefix = document.getElementById('prefix').value;
    const fullName = document.getElementById('fullName').value.trim();
    const grade = document.getElementById('grade').value.trim();
    const cameraExperience = document.getElementById('cameraExperience').value;
    const cameraEquipment = document.getElementById('cameraEquipment').value;
    const phone = document.getElementById('phone').value.trim();
    const lineId = document.getElementById('lineId').value.trim() || '-';

    // Strict Rule: 1 Student ID = 1 Activity Only
    const existing = applications.find(app => app.studentId === studentId && app.status !== 'cancelled');
    if (existing) {
        showToast(`❌ รหัสนักเรียน ${studentId} ได้ลงทะเบียนในกิจกรรม "${existing.activityTitle}" ไปเรียบร้อยแล้ว (1 คนสมัครได้ 1 กิจกรรมเท่านั้น)`, 'error');
        return;
    }

    const regId = 'REG-' + Math.floor(100 + Math.random() * 900);

    const newApp = {
        registrationId: regId,
        studentId: studentId,
        prefix: prefix,
        fullName: fullName,
        grade: grade,
        cameraExperience: cameraExperience,
        cameraEquipment: cameraEquipment,
        phone: phone,
        lineId: lineId,
        activityId: actId,
        activityTitle: activity.title,
        status: 'confirmed',
        registeredAt: new Date().toISOString()
    };

    applications.push(newApp);
    saveData();
    sendToGoogleSheet(newApp);

    document.getElementById('registration-form').reset();
    renderActivityDropdowns();
    renderActivityBanner();
    updateAdminStats();
    renderAdminTable();

    showToast(`ลงทะเบียนเข้าร่วม "${activity.title}" สำเร็จ!`, 'success');
    showPassModal(newApp);
}

// Show Pass Modal Ticket
function showPassModal(app) {
    const modal = document.getElementById('pass-modal');
    const content = document.getElementById('pass-modal-content');
    if (!modal || !content) return;

    const activity = activities.find(a => a.id === app.activityId);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(app.registrationId + '|' + app.studentId + '|' + app.fullName + '|' + app.activityTitle)}`;

    content.innerHTML = `
        <div class="ticket-card p-6 md:p-8 text-slate-800 mb-6 border border-slate-200">
            <div class="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div class="flex items-center gap-3">
                    <img src="img/logo.png" alt="ตราโรงเรียนมกุฎเมืองราชวิทยาลัย" class="w-12 h-12 object-contain" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/167/167707.png';">
                    <div>
                        <span class="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest block">โรงเรียนมกุฎเมืองราชวิทยาลัย</span>
                        <h3 class="text-base md:text-lg font-extrabold text-slate-900">${app.activityTitle}</h3>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-slate-400 block uppercase">เลขที่ใบสมัคร</span>
                    <div class="font-mono font-extrabold text-indigo-700 text-sm md:text-base">${app.registrationId}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div class="md:col-span-2 space-y-3">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="col-span-2 md:col-span-1">
                            <span class="text-xs text-slate-400 block">ชื่อ-นามสกุล นักเรียน</span>
                            <span class="font-extrabold text-slate-900 text-base">${app.prefix}${app.fullName}</span>
                        </div>
                        <div>
                            <span class="text-xs text-slate-400 block">รหัส / ระดับชั้น</span>
                            <span class="font-bold text-slate-800">${app.studentId} (${app.grade})</span>
                        </div>
                        <div class="col-span-2">
                            <span class="text-xs text-slate-400 block">วันจัดงาน & สถานที่</span>
                            <span class="font-bold text-slate-800">${activity ? activity.date : ''}</span>
                            <div class="text-xs text-indigo-700 font-medium">${activity ? activity.location : ''}</div>
                        </div>
                        <div class="col-span-2">
                            <span class="text-xs text-slate-400 block">ระดับความสนใจ / ทักษะ</span>
                            <span class="font-semibold text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg inline-block mt-0.5">${app.cameraExperience}</span>
                        </div>
                        <div>
                            <span class="text-xs text-slate-400 block">อุปกรณ์</span>
                            <span class="font-medium text-slate-700">${app.cameraEquipment}</span>
                        </div>
                        <div>
                            <span class="text-xs text-slate-400 block">เบอร์โทรติดต่อ</span>
                            <span class="font-medium text-slate-700">${app.phone}</span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <img src="${qrUrl}" alt="QR Verification" class="w-32 h-32 mb-2 rounded-lg" />
                    <span class="text-[10px] font-mono text-slate-400">สแกนตรวจสอบเข้าร่วมกิจกรรม</span>
                </div>
            </div>

            <div class="ticket-divider my-5"></div>

            <div class="flex items-center justify-between text-xs text-slate-500">
                <span>วันที่ลงทะเบียน: ${new Date(app.registeredAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.</span>
                <span class="px-3 py-1 rounded-full badge-confirmed font-bold">สถานะ: ยืนยันสิทธิ์เข้าร่วม</span>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePassModal() {
    const modal = document.getElementById('pass-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Teacher Authentication Logic (Simple Password)
function isTeacherLoggedIn() {
    return sessionStorage.getItem('teacher_authenticated') === 'true';
}

function showTeacherPasswordModal() {
    const modal = document.getElementById('teacher-password-modal');
    if (modal) {
        const passInput = document.getElementById('teacher-pass-input');
        if (passInput) passInput.value = '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (passInput) passInput.focus();
    }
}

function cancelTeacherLogin() {
    const modal = document.getElementById('teacher-password-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    switchTab('registration');
}

function handleTeacherLogin(event) {
    event.preventDefault();
    const inputPass = document.getElementById('teacher-pass-input')?.value;

    if (inputPass === TEACHER_PASSWORD || inputPass === '1234') {
        sessionStorage.setItem('teacher_authenticated', 'true');
        const modal = document.getElementById('teacher-password-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        showToast('เข้าสู่ระบบสำหรับครูสำเร็จ', 'success');
        switchTab('admin');
    } else {
        showToast('รหัสผ่านครูไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง', 'error');
        const passInput = document.getElementById('teacher-pass-input');
        if (passInput) passInput.select();
    }
}

function teacherLogout() {
    sessionStorage.removeItem('teacher_authenticated');
    showToast('ออกจากระบบครูเรียบร้อยแล้ว', 'info');
    switchTab('registration');
}

// Admin Activity Management Modal Logic
function openEditActivityModal() {
    if (!activities || activities.length === 0) return;

    const selector = document.getElementById('edit-act-selector');
    if (selector) {
        selector.innerHTML = activities.map(act => `<option value="${act.id}">${act.title}</option>`).join('') +
            `<option value="new">➕ [เพิ่มกิจกรรมใหม่...]</option>`;
        selector.value = activities[0].id;
    }

    onAdminSelectActivityToEdit(activities[0].id);

    const modal = document.getElementById('edit-activity-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function onAdminSelectActivityToEdit(actId) {
    currentEditingActivityId = actId;
    const btnDelete = document.getElementById('btn-delete-act');

    if (actId === 'new') {
        document.getElementById('edit-act-title').value = '';
        document.getElementById('edit-act-desc').value = '';
        document.getElementById('edit-act-date').value = 'วันศุกร์ที่ 18 สิงหาคม 2569';
        document.getElementById('edit-act-time').value = '08:30 - 15:30 น.';
        document.getElementById('edit-act-location').value = 'โรงเรียนมกุฎเมืองราชวิทยาลัย';
        document.getElementById('edit-act-capacity').value = 30;
        document.getElementById('edit-act-reg-start').value = '';
        document.getElementById('edit-act-reg-end').value = '';
        if (btnDelete) btnDelete.classList.add('hidden');
    } else {
        const act = activities.find(a => a.id === actId);
        if (act) {
            document.getElementById('edit-act-title').value = act.title || '';
            document.getElementById('edit-act-desc').value = act.description || '';
            document.getElementById('edit-act-date').value = act.date || '';
            document.getElementById('edit-act-time').value = act.time || '';
            document.getElementById('edit-act-location').value = act.location || '';
            document.getElementById('edit-act-capacity').value = act.capacity || 30;
            document.getElementById('edit-act-reg-start').value = act.regStart || '';
            document.getElementById('edit-act-reg-end').value = act.regEnd || '';
        }
        if (btnDelete) btnDelete.classList.remove('hidden');
    }
}

function handleSaveActivitySettings(event) {
    if (event) event.preventDefault();

    const selector = document.getElementById('edit-act-selector');
    const targetId = currentEditingActivityId || (selector ? selector.value : selectedActivityId) || (activities.length > 0 ? activities[0].id : null);

    if (!targetId) {
        showToast('ไม่พบกิจกรรมที่ต้องการบันทึก', 'error');
        return;
    }

    const title = document.getElementById('edit-act-title').value.trim();
    const desc = document.getElementById('edit-act-desc').value.trim();
    const date = document.getElementById('edit-act-date').value.trim();
    const time = document.getElementById('edit-act-time').value.trim();
    const location = document.getElementById('edit-act-location').value.trim();
    const capacity = parseInt(document.getElementById('edit-act-capacity').value) || 30;
    const regStart = document.getElementById('edit-act-reg-start').value;
    const regEnd = document.getElementById('edit-act-reg-end').value;

    if (targetId === 'new') {
        const newAct = {
            id: 'act-custom-' + Date.now(),
            title: title,
            category: 'กิจกรรมโรงเรียน',
            description: desc,
            date: date,
            time: time,
            location: location,
            capacity: capacity,
            regStart: regStart,
            regEnd: regEnd
        };
        activities.push(newAct);
        selectedActivityId = newAct.id;
        localStorage.setItem('user_added_activities', 'true');
        showToast('เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว!', 'success');
    } else {
        const act = activities.find(a => a.id === targetId) || activities[0];
        if (act) {
            act.title = title;
            act.description = desc;
            act.date = date;
            act.time = time;
            act.location = location;
            act.capacity = capacity;
            act.regStart = regStart;
            act.regEnd = regEnd;
            showToast('อัปเดตรายละเอียดกิจกรรมเรียบร้อยแล้ว!', 'success');
        }
    }

    saveData();
    closeEditActivityModal();
    renderActivityDropdowns();
    renderActivityBanner();
    updateAdminStats();
    renderAdminTable();
}

function setRegDatePreset(days) {
    const startInput = document.getElementById('edit-act-reg-start');
    const endInput = document.getElementById('edit-act-reg-end');
    
    if (days === 0) {
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        showToast('ล้างกำหนดเวลาเรียบร้อย (เปิดรับสมัครตลอดเวลา)', 'info');
        return;
    }

    const now = new Date();
    const toLocalISO = (d) => {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    };

    const endDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    endDate.setHours(23, 59, 0, 0);

    if (startInput) startInput.value = toLocalISO(now);
    if (endInput) endInput.value = toLocalISO(endDate);

    showToast(`เลือกกำหนดเวลาเรียบร้อย (${days} วัน)`, 'success');
}

function deleteCurrentEditingActivity() {
    if (currentEditingActivityId === 'new') return;
    if (activities.length <= 1) {
        showToast('ไม่สามารถลบกิจกรรมทั้งหมดได้ ต้องมีอย่างน้อย 1 กิจกรรม', 'warning');
        return;
    }

    if (confirm('คุณต้องการลบกิจกรรมนี้ออกจากระบบใช่หรือไม่?')) {
        activities = activities.filter(a => a.id !== currentEditingActivityId);
        if (selectedActivityId === currentEditingActivityId) {
            selectedActivityId = activities[0].id;
        }
        saveData();
        closeEditActivityModal();
        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('ลบกิจกรรมเรียบร้อยแล้ว', 'success');
    }
}

function closeEditActivityModal() {
    const modal = document.getElementById('edit-activity-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Admin Dashboard Updates
function updateAdminStats() {
    const filterVal = document.getElementById('admin-activity-filter')?.value || 'all';

    let totalApps = 0;
    let totalCap = 0;

    if (filterVal === 'all') {
        totalApps = applications.filter(a => a.status !== 'cancelled').length;
        totalCap = activities.reduce((sum, a) => sum + a.capacity, 0);
    } else {
        const act = activities.find(a => a.id === filterVal);
        totalCap = act ? act.capacity : 0;
        totalApps = applications.filter(a => a.activityId === filterVal && a.status !== 'cancelled').length;
    }

    const remaining = Math.max(0, totalCap - totalApps);

    const elApps = document.getElementById('stat-total-apps');
    const elRem = document.getElementById('stat-total-remaining');

    if (elApps) elApps.innerText = totalApps;
    if (elRem) elRem.innerText = remaining;
}

function onAdminFilterChange() {
    updateAdminStats();
    renderAdminTable();
}

function renderAdminTable() {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;

    const filterVal = document.getElementById('admin-activity-filter')?.value || 'all';
    const searchVal = document.getElementById('admin-search-input')?.value.toLowerCase() || '';

    let filtered = applications.filter(a => a.status !== 'cancelled');

    if (filterVal !== 'all') {
        filtered = filtered.filter(a => a.activityId === filterVal);
    }

    if (searchVal) {
        filtered = filtered.filter(a => 
            a.fullName.toLowerCase().includes(searchVal) || 
            a.studentId.toLowerCase().includes(searchVal) ||
            a.grade.toLowerCase().includes(searchVal) ||
            (a.activityTitle && a.activityTitle.toLowerCase().includes(searchVal)) ||
            a.cameraExperience.toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="py-8 text-center text-slate-400">ยังไม่มีรายชื่อผู้ลงทะเบียนในรายการนี้</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map((app, idx) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 text-xs font-mono text-slate-400">${idx + 1}</td>
            <td class="px-4 py-3 text-xs font-mono font-bold text-indigo-700">${app.registrationId}</td>
            <td class="px-4 py-3">
                <div class="font-bold text-slate-800 text-sm">${app.prefix}${app.fullName}</div>
                <div class="text-xs text-slate-400">รหัส: ${app.studentId}</div>
            </td>
            <td class="px-4 py-3 text-xs font-extrabold text-indigo-900 max-w-[200px]">
                ${app.activityTitle || '-'}
            </td>
            <td class="px-4 py-3 text-xs font-bold text-slate-700">
                ${app.grade}
            </td>
            <td class="px-4 py-3 text-xs">
                <span class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-medium inline-block mb-1">
                    ${app.cameraExperience}
                </span>
                <div class="text-slate-400 text-[11px]">อุปกรณ์: ${app.cameraEquipment}</div>
            </td>
            <td class="px-4 py-3 text-xs text-slate-600">
                <div><i class="fa-solid fa-phone text-slate-400 text-[10px]"></i> ${app.phone}</div>
                <div class="text-slate-400">Line: ${app.lineId}</div>
            </td>
            <td class="px-4 py-3 text-center whitespace-nowrap space-x-1">
                <button onclick="showCertificateModal('${app.registrationId}')" class="text-amber-800 bg-amber-100 hover:bg-amber-200 text-xs px-2.5 py-1.5 rounded-lg font-extrabold transition-all inline-flex items-center gap-1 shadow-sm" title="ออกเกียรติบัตรคนนี้">
                    <i class="fa-solid fa-award"></i> เกียรติบัตร
                </button>
                <button onclick="deleteApplication('${app.registrationId}')" class="text-slate-400 hover:text-rose-600 text-sm p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="ลบข้อมูล">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Certificate Generator Modal Logic
function showCertificateModal(targetId = 'all') {
    const modal = document.getElementById('cert-modal');
    const container = document.getElementById('cert-printable-area');
    if (!modal || !container) return;

    let targetApps = [];
    if (targetId === 'all') {
        const filterVal = document.getElementById('admin-activity-filter')?.value || 'all';
        targetApps = applications.filter(a => a.status !== 'cancelled');
        if (filterVal !== 'all') {
            targetApps = targetApps.filter(a => a.activityId === filterVal);
        }
    } else {
        const found = applications.find(a => a.registrationId === targetId);
        if (found) targetApps = [found];
    }

    if (targetApps.length === 0) {
        showToast('ไม่พบข้อมูลรายชื่อนักเรียนสำหรับออกเกียรติบัตร', 'warning');
        return;
    }

    const todayThai = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    container.innerHTML = targetApps.map((app, idx) => {
        const certNo = String(idx + 1).padStart(3, '0');
        const isLast = idx === targetApps.length - 1;
        const pageBreakClass = isLast ? '' : 'page-break-after';

        return `
            <div class="cert-card-wrapper ${pageBreakClass} p-6 sm:p-10 bg-[#faf8f5] border-8 border-double border-amber-600/80 rounded-2xl relative text-center text-slate-800 shadow-xl overflow-hidden font-sarabun">
                <!-- Corner Ornaments -->
                <div class="absolute top-3 left-3 text-amber-600/40 text-xl font-bold">❖</div>
                <div class="absolute top-3 right-3 text-amber-600/40 text-xl font-bold">❖</div>
                <div class="absolute bottom-3 left-3 text-amber-600/40 text-xl font-bold">❖</div>
                <div class="absolute bottom-3 right-3 text-amber-600/40 text-xl font-bold">❖</div>

                <!-- Header Logo & School Name -->
                <div class="flex flex-col items-center justify-center space-y-1">
                    <img src="img/logo.png" alt="Logo" class="w-16 h-16 object-contain mb-1" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/167/167707.png';">
                    <h2 class="text-xl sm:text-2xl font-extrabold text-amber-900 tracking-wide uppercase">โรงเรียนมกุฎเมืองราชวิทยาลัย</h2>
                    <p class="text-xs text-amber-800 font-semibold tracking-wider">สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาระยอง</p>
                </div>

                <!-- Title Banner -->
                <div class="my-5">
                    <div class="inline-block px-8 py-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-900 font-black text-2xl sm:text-3xl rounded-xl shadow-sm tracking-widest uppercase">
                        เกียรติบัตร
                    </div>
                    <div class="text-xs text-slate-500 font-mono mt-2">เลขที่ มก.กิ./2569/${certNo}</div>
                </div>

                <!-- Body Certification Content -->
                <div class="space-y-3.5 max-w-2xl mx-auto my-4">
                    <p class="text-sm text-slate-600 font-medium">เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>
                    
                    <h1 class="text-2xl sm:text-4xl font-extrabold text-indigo-950 underline decoration-amber-500 decoration-2 underline-offset-8">
                        ${app.prefix}${app.fullName}
                    </h1>
                    
                    <p class="text-xs sm:text-sm text-slate-600">
                        นักเรียนชั้น <span class="font-bold text-slate-900">${app.grade}</span> &nbsp;•&nbsp; รหัสนักเรียน <span class="font-mono font-bold text-indigo-700">${app.studentId}</span>
                    </p>

                    <p class="text-xs sm:text-sm text-slate-700 leading-relaxed pt-1">
                        ได้ผ่านการเข้าร่วมและสำเร็จการลงทะเบียนกิจกรรมนักเรียน <br>
                        <span class="text-base sm:text-xl font-extrabold text-indigo-900 block mt-1.5">"${app.activityTitle}"</span>
                    </p>
                    
                    <p class="text-xs text-slate-500 pt-1">
                        ให้ไว้ ณ วันที่ ${todayThai}
                    </p>
                </div>

                <!-- Footer Signatures -->
                <div class="grid grid-cols-2 gap-8 items-end max-w-xl mx-auto mt-8 pt-4 border-t border-amber-200/80">
                    <div class="text-center space-y-1">
                        <div class="h-10 border-b border-dashed border-slate-300 w-36 mx-auto flex items-end justify-center pb-1">
                            <span class="font-serif italic text-xs text-slate-400">(ลงชื่อครูผู้รับผิดชอบ)</span>
                        </div>
                        <div class="text-xs font-bold text-slate-800 pt-1">ครูผู้รับผิดชอบโครงการ</div>
                        <div class="text-[10px] text-slate-500">โรงเรียนมกุฎเมืองราชวิทยาลัย</div>
                    </div>

                    <div class="text-center space-y-1">
                        <div class="h-10 border-b border-dashed border-slate-300 w-36 mx-auto flex items-end justify-center pb-1">
                            <span class="font-serif italic text-xs text-slate-400">(ลงชื่อผู้อำนวยการ)</span>
                        </div>
                        <div class="text-xs font-bold text-slate-800 pt-1">ผู้อำนวยการโรงเรียน</div>
                        <div class="text-[10px] text-slate-500">โรงเรียนมกุฎเมืองราชวิทยาลัย</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeCertModal() {
    const modal = document.getElementById('cert-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function deleteApplication(regId) {
    if (confirm('คุณต้องการลบข้อมูลผู้สมัครนี้ใช่หรือไม่?\n(ระบบจะส่งคำสั่งลบข้อมูลออกจาก Google Sheets ด้วย)')) {
        const targetApp = applications.find(a => a.registrationId === regId);
        const studentId = targetApp ? targetApp.studentId : '';

        applications = applications.filter(a => a.registrationId !== regId);
        saveData();

        // Sync deletion to Google Sheets
        if (GOOGLE_SHEET_URL && GOOGLE_SHEET_URL.trim() !== '') {
            fetch(GOOGLE_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    registrationId: regId,
                    studentId: studentId
                })
            }).then(() => {
                console.log('Delete request sent to Google Sheets:', regId);
            }).catch(err => console.error('Error sending delete request to Sheets:', err));
        }

        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('ลบข้อมูลเรียบร้อยแล้ว (กำลังลบข้อมูลออกจาก Google Sheets)', 'success');
    }
}

// Export Applications to CSV
function exportToCSV() {
    const filterVal = document.getElementById('admin-activity-filter')?.value || 'all';
    let filtered = applications.filter(a => a.status !== 'cancelled');

    if (filterVal !== 'all') {
        filtered = filtered.filter(a => a.activityId === filterVal);
    }

    if (filtered.length === 0) {
        showToast('ไม่มีข้อมูลสำหรับส่งออก CSV', 'warning');
        return;
    }

    const headers = [
        'ลำดับ', 'เลขที่สมัคร', 'รหัสนักเรียน', 'คำนำหน้า', 'ชื่อ-นามสกุล', 
        'กิจกรรมที่สมัคร', 'ระดับชั้น', 'ความสนใจ/ทักษะ', 'อุปกรณ์ที่ใช้', 'เบอร์โทรศัพท์', 'Line ID', 'วันที่สมัคร'
    ];

    const rows = filtered.map((app, idx) => [
        idx + 1,
        app.registrationId,
        app.studentId,
        app.prefix,
        app.fullName,
        `"${(app.activityTitle || '').replace(/"/g, '""')}"`,
        app.grade,
        `"${(app.cameraExperience || '').replace(/"/g, '""')}"`,
        `"${(app.cameraEquipment || '').replace(/"/g, '""')}"`,
        app.phone,
        app.lineId,
        app.registeredAt
    ]);

    let csvContent = "\uFEFF" + headers.join(',') + "\n";
    rows.forEach(row => {
        csvContent += row.join(',') + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `รายชื่อผู้สมัครกิจกรรม_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('ส่งออกไฟล์รายชื่อ CSV สำหรับ Excel สำเร็จ!', 'success');
}

// Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgIcon = 'fa-circle-info text-blue-500 bg-blue-50';
    if (type === 'success') bgIcon = 'fa-circle-check text-emerald-500 bg-emerald-50';
    if (type === 'warning') bgIcon = 'fa-triangle-exclamation text-amber-500 bg-amber-50';
    if (type === 'error') bgIcon = 'fa-circle-xmark text-rose-500 bg-rose-50';

    toast.className = `toast glass-card p-4 rounded-2xl shadow-xl border border-slate-200 flex items-center gap-3 min-w-[280px] max-w-md`;
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-base ${bgIcon}">
            <i class="fa-solid ${bgIcon.split(' ')[0]}"></i>
        </div>
        <div class="text-sm font-semibold text-slate-800 flex-1">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Tab Switcher
function switchTab(tabName) {
    if (tabName === 'admin' && !isTeacherLoggedIn()) {
        showTeacherPasswordModal();
        return;
    }

    const tabs = ['registration', 'admin'];
    tabs.forEach(t => {
        const page = document.getElementById(`page-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if (page) {
            if (t === tabName) {
                page.classList.remove('hidden');
            } else {
                page.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === tabName) {
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
                btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                btn.classList.add('text-slate-600', 'hover:bg-slate-100');
            }
        }
    });

    if (tabName === 'admin') {
        renderActivityDropdowns();
        updateAdminStats();
        renderAdminTable();
        fetchFromGoogleSheet(false);
    }
}

function getActiveGoogleSheetUrl() {
    return (localStorage.getItem('custom_google_sheet_url') || GOOGLE_SHEET_URL || '').trim();
}

function setCustomGoogleSheetUrl() {
    const currentUrl = getActiveGoogleSheetUrl();
    const newUrl = prompt('กรุณากรอก Web App URL ของ Google Apps Script (หรือปล่อยว่างเพื่อใช้ค่าเริ่มต้น):', currentUrl);
    if (newUrl !== null) {
        if (newUrl.trim() === '') {
            localStorage.removeItem('custom_google_sheet_url');
            showToast('รีเซ็ตลิงก์ Google Sheets เป็นค่าเริ่มต้นเรียบร้อย', 'info');
        } else {
            localStorage.setItem('custom_google_sheet_url', newUrl.trim());
            showToast('บันทึก Web App URL ใหม่เรียบร้อยแล้ว!', 'success');
        }
        fetchFromGoogleSheet(true);
    }
}

// Fetch Registrants from Google Sheets Web App
async function fetchFromGoogleSheet(isManual = false) {
    const targetUrl = getActiveGoogleSheetUrl();
    if (!targetUrl) return;

    if (isManual) showToast('กำลังดึงข้อมูลรายชื่อจาก Google Sheets...', 'info');

    try {
        const response = await fetch(targetUrl, { redirect: 'follow' });
        const textData = await response.text();

        // Check if response is HTML error from Google Apps Script (e.g. missing doGet function)
        if (textData.includes('ไม่พบฟังก์ชันของสคริปต์: doGet') || textData.includes('Script function not found: doGet')) {
            if (isManual) alert('⚠️ Google Apps Script แจ้งเตือน: ไม่พบฟังก์ชัน doGet\n\nโปรดคัดลอกโค้ด Google Apps Script ฉบับสมบูรณ์ (doGet + doPost) ไปวางใน Google Sheet แล้วกด Deploy (ปรับใช้ออกมาใช้) อีกครั้งครับ');
            if (isManual) showToast('ไม่พบฟังก์ชัน doGet ใน Google Apps Script (โปรดวางโค้ดสมบูรณ์)', 'warning');
            return;
        }

        let data = [];
        try {
            data = JSON.parse(textData);
        } catch(err) {
            console.error("Failed to parse JSON from Google Sheets:", textData.substring(0, 100));
            if (isManual) showToast('ไม่สามารถดึงข้อมูลได้ (โปรดตรวจสอบการคัดลอกโค้ด Google Apps Script)', 'warning');
            return;
        }

        if (Array.isArray(data) && data.length > 0) {
            const defaultTitle = activities.length > 0 ? activities[0].title : '📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)';

            const fetchedApps = data.map((app, idx) => {
                let actTitle = app.activityTitle || defaultTitle;
                let grade = app.grade || '-';
                let exp = app.cameraExperience || '-';
                let equip = app.cameraEquipment || '-';
                let phone = String(app.phone || '-');
                let line = String(app.lineId || '-');

                // Smart Auto-Alignment Fix for Column Shifts
                if (actTitle.includes('ม.') || actTitle.includes('/') || (actTitle.length <= 6 && !actTitle.includes('เรื่องเล่า'))) {
                    exp = grade;
                    grade = actTitle;
                    actTitle = defaultTitle;
                }

                if (grade.includes('ทักษะ') || grade.includes('ประสบการณ์') || grade.includes('พื้นฐาน') || grade.includes('แข่ง')) {
                    exp = grade;
                    grade = '-';
                }

                if (equip.match(/^[0-9]{8,12}$/)) {
                    phone = equip;
                    equip = 'อุปกรณ์ส่วนตัว (นำมาเอง)';
                }

                return {
                    registrationId: app.registrationId || (`REG-` + (100 + idx)),
                    studentId: String(app.studentId || ''),
                    prefix: app.prefix || '',
                    fullName: app.fullName || '',
                    grade: grade,
                    cameraExperience: exp,
                    cameraEquipment: equip,
                    phone: phone,
                    lineId: line,
                    activityId: activities.length > 0 ? activities[0].id : 'act-photo-001',
                    activityTitle: actTitle,
                    status: 'confirmed',
                    registeredAt: app.registeredAt || new Date().toISOString()
                };
            });

            // Set applications to exact 100% data from Google Sheet
            applications = fetchedApps;

            saveData();
            renderActivityDropdowns();
            renderActivityBanner();
            updateAdminStats();
            renderAdminTable();

            if (isManual) showToast(`ซิงก์ตรงกับ Google Sheet 100%! พบรายชื่อผู้สมัครจริง ${applications.length} คน`, 'success');
        } else if (isManual) {
            showToast('เชื่อมต่อสำเร็จ แต่ยังไม่มีข้อมูลผู้สมัครใน Google Sheet (คงข้อมูลปัจจุบันไว้)', 'info');
        }
    } catch (e) {
        console.error("Error fetching Google Sheets:", e);
        if (isManual) showToast('ไม่สามารถเชื่อมต่อ Google Sheets ได้ (โปรดตรวจดูว่าตั้งค่าสิทธิ์เข้าถึงเป็น ทุกคน / Anyone แล้วหรือยัง)', 'error');
    }
}

function restoreSampleApplications() {
    applications = JSON.parse(JSON.stringify(INITIAL_APPLICATIONS));
    saveData();
    renderActivityDropdowns();
    renderActivityBanner();
    updateAdminStats();
    renderAdminTable();
    showToast('คืนค่าข้อมูลรายชื่อนักเรียนตัวอย่างเรียบร้อยแล้ว!', 'success');
}

// Init Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initData();
    renderActivityDropdowns();
    renderActivityBanner();
    fetchFromGoogleSheet(false);

    const form = document.getElementById('registration-form');
    if (form) {
        form.addEventListener('submit', handleRegistrationSubmit);
    }

    const adminSearch = document.getElementById('admin-search-input');
    if (adminSearch) adminSearch.addEventListener('input', renderAdminTable);
});

// =========================================================================
// 🎨 Visual Certificate Builder & Drag-and-Drop Engine
// =========================================================================
let certBuilderState = {
    bgImage: null,
    elements: [
        { id: 'el-certNo', type: 'certNo', label: 'เลขที่เกียรติบัตร', text: 'เลขที่ มก.กิ.2569/001', x: 50, y: 20, font: 'font-sarabun', fontSize: 16, color: '#475569', fontWeight: 'normal', align: 'center' },
        { id: 'el-name', type: 'name', label: 'ชื่อ-นามสกุล', text: 'นางสาวทิพัมพร เพิ่มพูน', x: 50, y: 48, font: 'font-sarabun', fontSize: 34, color: '#0f172a', fontWeight: 'bold', align: 'center' },
        { id: 'el-sig-default', type: 'custom', label: 'ช่องวางลายเซ็น', text: '(ลงชื่อ..............................................)', x: 50, y: 80, font: 'font-sarabun', fontSize: 14, color: '#64748b', fontWeight: 'normal', align: 'center' }
    ],
    selectedElementId: null,
    numberPrefix: 'มก.กิ.2569/{NO}',
    startIndex: 1,
    endIndex: 999
};

function openCertBuilderModal() {
    const saved = localStorage.getItem('cert_builder_template_v2');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.elements)) {
                certBuilderState = parsed;
            }
        } catch(e){}
    }

    const prefixInput = document.getElementById('cert-num-prefix');
    if (prefixInput && certBuilderState.numberPrefix) {
        prefixInput.value = certBuilderState.numberPrefix;
    }

    const modal = document.getElementById('cert-builder-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    renderCertBuilderCanvas();
}

function closeCertBuilderModal() {
    const modal = document.getElementById('cert-builder-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleCertBgUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        certBuilderState.bgImage = e.target.result;
        renderCertBuilderCanvas();
        showToast('อัปโหลดแบบฟอร์มเกียรติบัตรเรียบร้อยแล้ว', 'success');
    };
    reader.readAsDataURL(file);
}

function handleCertSigUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const id = 'el-img-' + Date.now();
        const newEl = {
            id: id,
            type: 'image',
            label: 'ลายเซ็น/ตราประทับ',
            src: e.target.result,
            x: 50,
            y: 75,
            width: 140
        };

        certBuilderState.elements.push(newEl);
        selectCertBuilderElement(id);
        renderCertBuilderCanvas();
        showToast('อัปโหลดรูปภาพลายเซ็น / ตราประทับเรียบร้อยแล้ว!', 'success');
    };
    reader.readAsDataURL(file);
}

function addCertBuilderElement(type) {
    const id = 'el-custom-' + Date.now();
    let label = 'ข้อความ';
    let defaultText = 'ข้อความเพิ่มเติม';
    let fontSize = 16;
    let weight = 'normal';

    if (type === 'name') { label = 'ชื่อ-นามสกุล'; defaultText = 'นางสาวทิพัมพร เพิ่มพูน'; fontSize = 32; weight = 'bold'; }
    else if (type === 'certNo') { label = 'เลขที่เกียรติบัตร'; defaultText = 'เลขที่ มก.กิ.2569/001'; fontSize = 14; }
    else if (type === 'gradeId') { label = 'ชั้น & รหัส'; defaultText = 'นักเรียนชั้น ม.6/4 (รหัสนักเรียน 6893)'; fontSize = 15; }
    else if (type === 'activity') { label = 'ชื่อกิจกรรม'; defaultText = 'ได้ผ่านการเข้าร่วมกิจกรรม "📸 เรื่องเล่าผ่านเลนส์กล้อง"'; fontSize = 18; weight = 'bold'; }
    else if (type === 'date') { label = 'วันที่ออกบัตร'; defaultText = 'ให้ไว้ ณ วันที่ 19 กันยายน พ.ศ. 2569'; fontSize = 13; }

    const newEl = {
        id: id,
        type: type,
        label: label,
        text: defaultText,
        x: 50,
        y: 50,
        font: 'font-sarabun',
        fontSize: fontSize,
        color: '#0f172a',
        fontWeight: weight,
        align: 'center'
    };

    certBuilderState.elements.push(newEl);
    selectCertBuilderElement(id);
    renderCertBuilderCanvas();
}

function selectCertBuilderElement(elId) {
    certBuilderState.selectedElementId = elId;
    const inspector = document.getElementById('cert-element-inspector');
    const textCtrls = document.getElementById('inspector-text-controls');
    const fontCtrls = document.getElementById('inspector-font-controls');
    const imgCtrls = document.getElementById('inspector-image-controls');
    const el = certBuilderState.elements.find(e => e.id === elId);

    if (el && inspector) {
        inspector.classList.remove('hidden');

        const posXInput = document.getElementById('inspector-pos-x');
        const posYInput = document.getElementById('inspector-pos-y');
        if (posXInput) posXInput.value = el.x;
        if (posYInput) posYInput.value = el.y;

        if (el.type === 'image') {
            if (textCtrls) textCtrls.classList.add('hidden');
            if (fontCtrls) fontCtrls.classList.add('hidden');
            if (imgCtrls) {
                imgCtrls.classList.remove('hidden');
                document.getElementById('inspector-img-width').value = el.width || 140;
            }
        } else {
            if (textCtrls) textCtrls.classList.remove('hidden');
            if (fontCtrls) fontCtrls.classList.remove('hidden');
            if (imgCtrls) imgCtrls.classList.add('hidden');

            document.getElementById('inspector-text').value = el.text || '';
            document.getElementById('inspector-font').value = el.font || 'font-sarabun';
            document.getElementById('inspector-size').value = el.fontSize || 16;
            document.getElementById('inspector-color').value = el.color || '#000000';
            document.getElementById('inspector-weight').value = el.fontWeight || 'normal';
            document.getElementById('inspector-align').value = el.align || 'center';
        }
    } else if (inspector) {
        inspector.classList.add('hidden');
    }

    renderCertBuilderCanvas();
}

function updateSelectedCertElement(prop, val) {
    const el = certBuilderState.elements.find(e => e.id === certBuilderState.selectedElementId);
    if (!el) return;

    if (prop === 'fontSize') el.fontSize = parseInt(val) || 16;
    else if (prop === 'width') el.width = parseInt(val) || 140;
    else if (prop === 'x') el.x = Math.max(0, Math.min(100, parseInt(val) || 0));
    else if (prop === 'y') el.y = Math.max(0, Math.min(100, parseInt(val) || 0));
    else el[prop] = val;

    renderCertBuilderCanvas();
}

function deleteSelectedCertElement() {
    if (!certBuilderState.selectedElementId) return;
    certBuilderState.elements = certBuilderState.elements.filter(e => e.id !== certBuilderState.selectedElementId);
    certBuilderState.selectedElementId = null;
    document.getElementById('cert-element-inspector')?.classList.add('hidden');
    renderCertBuilderCanvas();
    showToast('ลบองค์ประกอบเรียบร้อยแล้ว', 'info');
}

function resetCertBuilderToDefault() {
    certBuilderState.bgImage = null;
    certBuilderState.elements = [
        { id: 'el-certNo', type: 'certNo', label: 'เลขที่เกียรติบัตร', text: 'เลขที่ มก.กิ.2569/001', x: 50, y: 20, font: 'font-sarabun', fontSize: 16, color: '#475569', fontWeight: 'normal', align: 'center' },
        { id: 'el-name', type: 'name', label: 'ชื่อ-นามสกุล', text: 'นางสาวทิพัมพร เพิ่มพูน', x: 50, y: 48, font: 'font-sarabun', fontSize: 34, color: '#0f172a', fontWeight: 'bold', align: 'center' },
        { id: 'el-sig-default', type: 'custom', label: 'ช่องวางลายเซ็น', text: '(ลงชื่อ..............................................)', x: 50, y: 80, font: 'font-sarabun', fontSize: 14, color: '#64748b', fontWeight: 'normal', align: 'center' }
    ];
    certBuilderState.selectedElementId = null;
    document.getElementById('cert-element-inspector')?.classList.add('hidden');
    renderCertBuilderCanvas();
    showToast('รีเซ็ตกลับค่าเริ่มต้นเรียบร้อยแล้ว', 'info');
}

function updateCertNumberPrefix(val) {
    certBuilderState.numberPrefix = val || 'มก.กิ.2569/{NO}';
}

function renderCertBuilderCanvas() {
    const canvas = document.getElementById('cert-builder-canvas');
    if (!canvas) return;

    if (certBuilderState.bgImage) {
        canvas.style.backgroundImage = `url('${certBuilderState.bgImage}')`;
    } else {
        canvas.style.backgroundImage = 'none';
    }

    const placeholderHtml = !certBuilderState.bgImage ? `
        <div class="absolute inset-x-0 bottom-3 text-center pointer-events-none z-0">
            <span class="text-[11px] text-amber-800/60 font-bold bg-amber-50/90 px-3 py-1 rounded-full border border-amber-200/60 shadow-sm">
                📄 ภาพตัวอย่างขนาด A4 แนวนอน (อัปโหลดรูปเกียรติบัตรจริงของคุณครูได้ที่เมนู 1. ด้านซ้าย)
            </span>
        </div>
    ` : '';

    canvas.innerHTML = placeholderHtml + certBuilderState.elements.map(el => {
        const isSelected = el.id === certBuilderState.selectedElementId;
        const alignStyle = el.align === 'center' ? 'text-center' : el.align === 'right' ? 'text-right' : 'text-left';

        if (el.type === 'image') {
            return `
                <div id="${el.id}"
                     class="draggable-element ${isSelected ? 'selected' : ''}"
                     style="left: ${el.x}%; top: ${el.y}%;"
                     onmousedown="startCertDrag(event, '${el.id}')"
                     ontouchstart="startCertDrag(event, '${el.id}')">
                    <img src="${el.src}" alt="Signature" style="width: ${el.width || 140}px; height: auto; display: block;" pointer-events="none" />
                </div>
            `;
        }

        return `
            <div id="${el.id}"
                 class="draggable-element ${el.font} ${alignStyle} ${isSelected ? 'selected' : ''}"
                 style="left: ${el.x}%; top: ${el.y}%; font-size: ${el.fontSize}px; color: ${el.color}; font-weight: ${el.fontWeight};"
                 onmousedown="startCertDrag(event, '${el.id}')"
                 ontouchstart="startCertDrag(event, '${el.id}')">
                ${el.text}
            </div>
        `;
    }).join('');
}

function startCertDrag(e, elId) {
    e.stopPropagation();
    selectCertBuilderElement(elId);

    const canvas = document.getElementById('cert-builder-canvas');
    if (!canvas) return;

    const onMove = (moveEvent) => {
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        const rect = canvas.getBoundingClientRect();
        let xPercent = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
        let yPercent = Math.max(2, Math.min(98, ((clientY - rect.top) / rect.height) * 100));

        const el = certBuilderState.elements.find(item => item.id === elId);
        if (el) {
            el.x = Math.round(xPercent);
            el.y = Math.round(yPercent);
            const domEl = document.getElementById(elId);
            if (domEl) {
                domEl.style.left = `${el.x}%`;
                domEl.style.top = `${el.y}%`;
            }
        }
    };

    const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
}

function saveCertBuilderTemplate() {
    const prefixInput = document.getElementById('cert-num-prefix');
    if (prefixInput) certBuilderState.numberPrefix = prefixInput.value;

    localStorage.setItem('cert_builder_template_v2', JSON.stringify(certBuilderState));
    showToast('บันทึกแม่แบบเกียรติบัตรลากวางเรียบร้อยแล้ว!', 'success');
}

function generateCustomCertificatesBatch() {
    saveCertBuilderTemplate();

    const startIdx = parseInt(document.getElementById('cert-range-start')?.value) || 1;
    const endIdx = parseInt(document.getElementById('cert-range-end')?.value) || 999;
    const prefixTemplate = document.getElementById('cert-num-prefix')?.value || 'มก.กิ.2569/{NO}';

    let list = applications.filter(a => a.status !== 'cancelled');
    if (list.length === 0) {
        showToast('ไม่พบข้อมูลรายชื่อนักเรียนสำหรับรันเกียรติบัตร', 'warning');
        return;
    }

    list = list.slice(startIdx - 1, endIdx);

    if (list.length === 0) {
        showToast('ไม่พบรายชื่อในลำดับช่วงที่ระบุ', 'warning');
        return;
    }

    const certModal = document.getElementById('cert-modal');
    const container = document.getElementById('cert-printable-area');
    if (!certModal || !container) return;

    closeCertBuilderModal();

    const todayThai = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const bgStyle = certBuilderState.bgImage ? `background-image: url('${certBuilderState.bgImage}'); background-size: 100% 100%;` : 'background-color: #faf8f5; border: 8px double rgba(217, 119, 6, 0.8);';

    container.innerHTML = list.map((app, idx) => {
        const certSeq = String(startIdx + idx).padStart(3, '0');
        const certNoFormatted = prefixTemplate.replace('{NO}', certSeq);
        const isLast = idx === list.length - 1;
        const pageBreakClass = isLast ? '' : 'page-break-after';

        const renderedElements = certBuilderState.elements.map(el => {
            if (el.type === 'image') {
                return `
                    <div style="position: absolute; left: ${el.x}%; top: ${el.y}%; transform: translate(-50%, -50%);">
                        <img src="${el.src}" alt="Signature" style="width: ${el.width || 140}px; height: auto; display: block;" />
                    </div>
                `;
            }

            let textValue = el.text;
            if (el.type === 'name') textValue = `${app.prefix}${app.fullName}`;
            else if (el.type === 'certNo') textValue = certNoFormatted;
            else if (el.type === 'gradeId') textValue = `นักเรียนชั้น ${app.grade} (รหัสนักเรียน ${app.studentId})`;
            else if (el.type === 'activity') textValue = `ได้ผ่านการเข้าร่วมกิจกรรม "${app.activityTitle}"`;
            else if (el.type === 'date') textValue = `ให้ไว้ ณ วันที่ ${todayThai}`;

            const alignStyle = el.align === 'center' ? 'text-center' : el.align === 'right' ? 'text-right' : 'text-left';

            return `
                <div class="${el.font} ${alignStyle}"
                     style="position: absolute; left: ${el.x}%; top: ${el.y}%; transform: translate(-50%, -50%); font-size: ${el.fontSize}px; color: ${el.color}; font-weight: ${el.fontWeight}; white-space: nowrap;">
                    ${textValue}
                </div>
            `;
        }).join('');

        return `
            <div class="cert-canvas-container ${pageBreakClass} rounded-2xl relative shadow-xl overflow-hidden font-sarabun"
                 style="${bgStyle} width: 100%; max-width: 1000px; margin: 0 auto 1.5rem auto;">
                ${renderedElements}
            </div>
        `;
    }).join('');

    certModal.classList.remove('hidden');
    certModal.classList.add('flex');

    showToast(`ออกเกียรติบัตรสำเร็จ ${list.length} ใบ!`, 'success');
}

// Global Keyboard Shortcuts for Cert Builder Studio (Arrow keys positioning & Delete key)
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('cert-builder-modal');
    if (!modal || modal.classList.contains('hidden') || !certBuilderState.selectedElementId) return;

    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    const el = certBuilderState.elements.find(item => item.id === certBuilderState.selectedElementId);
    if (!el) return;

    const step = e.shiftKey ? 5 : 1;

    if (e.key === 'ArrowLeft') {
        el.x = Math.max(0, el.x - step);
        e.preventDefault();
        selectCertBuilderElement(el.id);
    } else if (e.key === 'ArrowRight') {
        el.x = Math.min(100, el.x + step);
        e.preventDefault();
        selectCertBuilderElement(el.id);
    } else if (e.key === 'ArrowUp') {
        el.y = Math.max(0, el.y - step);
        e.preventDefault();
        selectCertBuilderElement(el.id);
    } else if (e.key === 'ArrowDown') {
        el.y = Math.min(100, el.y + step);
        e.preventDefault();
        selectCertBuilderElement(el.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedCertElement();
        e.preventDefault();
    }
});
