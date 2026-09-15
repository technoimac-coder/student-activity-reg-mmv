// ข้อมูลกิจกรรมเริ่มต้น โรงเรียนมกุฎเมืองราชวิทยาลัย (เริ่มต้น 1 กิจกรรม)
const INITIAL_ACTIVITIES = [
    {
        id: "act-photo-001",
        title: "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)",
        category: "ถ่ายภาพ & ถ่ายวิดีโอ",
        description: "รับสมัครนักเรียนที่สนใจในการถ่ายรูป ถ่ายวีดีโอ ใช้มือถือก็ปัง ใช้กล้องใหญ่ก็ได้ เรียนรู้จากการลงมือทำจริง! เปิดรับทุกระดับชั้น",
        date: "วันเสาร์ที่ 19 กันยายน 2569",
        time: "08:30 - 16:30 น.",
        location: "หอประชุมราชพฤกษ์ โรงเรียนมกุฎเมืองราชวิทยาลัย",
        capacity: 40,
        regStart: "2026-09-10T08:00",
        regEnd: "2026-09-15T16:00",
        tags: ["Photography", "Video", "Smartphone", "Camera"],
        image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
        badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200"
    }
];

// ข้อมูลผู้สมัครเริ่มต้นตัวอย่าง (สำหรับคืนค่าหรือเริ่มต้นใช้งาน)
const INITIAL_APPLICATIONS = [
    {
        registrationId: "REG-101",
        studentId: "6893",
        prefix: "นางสาว",
        fullName: "ทิพัมพร เพิ่มพูน",
        grade: "ม.6/4",
        cameraExperience: "มีพื้นฐานการถ่ายรูปมือถือ",
        cameraEquipment: "กล้องมือถือ iPhone 14 Pro",
        phone: "081-234-5678",
        lineId: "thipampon_p",
        activityId: "act-photo-001",
        activityTitle: "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)",
        status: "confirmed",
        registeredAt: "2026-09-12T09:30:00"
    },
    {
        registrationId: "REG-102",
        studentId: "6901",
        prefix: "นาย",
        fullName: "สมชาย ใจดี",
        grade: "ม.5/1",
        cameraExperience: "เคยถ่ายงานโรงเรียน",
        cameraEquipment: "กล้อง Canon EOS R50",
        phone: "089-876-5432",
        lineId: "somchai_camera",
        activityId: "act-photo-001",
        activityTitle: "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)",
        status: "confirmed",
        registeredAt: "2026-09-12T10:15:00"
    },
    {
        registrationId: "REG-103",
        studentId: "7012",
        prefix: "นางสาว",
        fullName: "กนกวรรณ สุขเสริฐ",
        grade: "ม.4/2",
        cameraExperience: "ไม่มีพื้นฐาน แต่อยากเรียนรู้",
        cameraEquipment: "กล้องมือถือ Samsung Galaxy S23",
        phone: "092-345-6789",
        lineId: "kanokwan_s",
        activityId: "act-photo-001",
        activityTitle: "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)",
        status: "confirmed",
        registeredAt: "2026-09-13T14:20:00"
    },
    {
        registrationId: "REG-104",
        studentId: "6788",
        prefix: "นาย",
        fullName: "ณัฐพงษ์ วิเศษสรรค์",
        grade: "ม.6/1",
        cameraExperience: "ชอบถ่ายวิดีโอสั้น TikTok/Reels",
        cameraEquipment: "กล้อง Sony ZV-E10 + ไมค์สาย",
        phone: "086-789-0123",
        lineId: "nattapong_film",
        activityId: "act-photo-001",
        activityTitle: "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)",
        status: "confirmed",
        registeredAt: "2026-09-14T11:00:00"
    }
];
