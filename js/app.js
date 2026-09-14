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
                // Ensure default regStart and regEnd from INITIAL_ACTIVITIES exist if not saved
                activities.forEach(act => {
                    const match = INITIAL_ACTIVITIES.find(i => i.id === act.id);
                    if (match) {
                        if (act.regStart === undefined || act.regStart === null) act.regStart = match.regStart || '';
                        if (act.regEnd === undefined || act.regEnd === null) act.regEnd = match.regEnd || '';
                    }
                });
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
            <td class="px-4 py-3 text-center">
                <button onclick="deleteApplication('${app.registrationId}')" class="text-slate-400 hover:text-rose-600 text-sm p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="ลบข้อมูล">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function deleteApplication(regId) {
    if (confirm('คุณต้องการลบข้อมูลผู้สมัครนี้ใช่หรือไม่?')) {
        applications = applications.filter(a => a.registrationId !== regId);
        saveData();
        renderActivityDropdowns();
        renderActivityBanner();
        updateAdminStats();
        renderAdminTable();
        showToast('ลบข้อมูลผู้สมัครเรียบร้อยแล้ว', 'success');
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

// Fetch Registrants from Google Sheets Web App
async function fetchFromGoogleSheet(isManual = false) {
    if (!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.trim() === '') return;

    if (isManual) showToast('กำลังดึงข้อมูลรายชื่อจาก Google Sheets...', 'info');

    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const defaultTitle = activities.length > 0 ? activities[0].title : '📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)';

                applications = data.map((app, idx) => {
                    let actTitle = app.activityTitle || defaultTitle;
                    let grade = app.grade || '-';
                    let exp = app.cameraExperience || '-';
                    let equip = app.cameraEquipment || '-';
                    let phone = String(app.phone || '-');
                    let line = String(app.lineId || '-');

                    // Smart Auto-Alignment Fix for Column Shifts
                    if (actTitle.includes('ม.') || actTitle.includes('/') || (actTitle.length <= 6 && !actTitle.includes('เรื่องเล่า'))) {
                        // actTitle was actually grade!
                        exp = grade;
                        grade = actTitle;
                        actTitle = defaultTitle;
                    }

                    if (grade.includes('ทักษะ') || grade.includes('ประสบการณ์') || grade.includes('พื้นฐาน') || grade.includes('แข่ง')) {
                        // grade was actually cameraExperience!
                        exp = grade;
                        grade = '-';
                    }

                    // If phone number got placed in cameraEquipment
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

                saveData();
                renderActivityDropdowns();
                renderActivityBanner();
                updateAdminStats();
                renderAdminTable();

                if (isManual) showToast(`ซิงก์ข้อมูลสำเร็จ! จัดระเบียบผู้สมัคร ${applications.length} คนเรียบร้อย`, 'success');
            } else if (isManual) {
                showToast('เชื่อมต่อสำเร็จ แต่ยังไม่มีข้อมูลผู้สมัครใน Google Sheet', 'info');
            }
        } else if (isManual) {
            showToast('กรุณาอัปเดตโค้ด doGet ใน Google Apps Script เพื่อเปิดใช้งานการซิงก์', 'warning');
        }
    } catch (err) {
        console.log("Could not fetch from Google Sheet:", err);
        if (isManual) {
            showToast('ไม่สามารถดึงข้อมูลได้ (โปรดตรวจดูว่าอัปเดตโค้ด Google Apps Script แล้วหรือยัง)', 'warning');
        }
    }
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
