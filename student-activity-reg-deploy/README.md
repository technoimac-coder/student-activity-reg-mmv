# 📸 ระบบรับสมัครกิจกรรมนักเรียน โรงเรียนมกุฎเมืองราชวิทยาลัย
> Student Activity Registration Web Application — โรงเรียนมกุฎเมืองราชวิทยาลัย

เว็บแอปพลิเคชันสำหรับรับสมัครนักเรียนเข้าร่วมกิจกรรมโรงเรียน รองรับการกำหนดจำนวนสิทธิ์, เวลาเปิด-ปิดรับสมัครอัตโนมัติ, ระบบป้องกันการสมัครซ้ำ (1 คน = 1 กิจกรรม), แผงควบคุมผู้ดูแลระบบ (สำหรับครู) และการซิงก์ข้อมูลอัตโนมัติไปยัง **Google Sheets**

---

## ✨ คุณสมบัติเด่น (Features)

- 📸 **หน้าเว็บสำหรับนักเรียน:**
  - เลือกกิจกรรมและกรอกข้อมูลการสมัคร (ชื่อ-นามสกุล, ชั้น, ทักษะ/อุปกรณ์, เบอร์โทรศัพท์, Line ID)
  - ระบบตรวจสอบสิทธิ์คงเหลือแบบเรียลไทม์
  - ระบบล็อกสิทธิ์: นักเรียน 1 คน (รหัสนักเรียน) สมัครได้เพียง 1 กิจกรรมเท่านั้น
  - ออกบัตรยืนยันการสมัคร (Pass Ticket) พร้อม **QR Code** สำหรับสแกนตรวจสอบหน้างาน
  - พิมพ์บัตรยืนยันการสมัครย้อนหลังได้

- ⚙️ **แผงควบคุมผู้ดูแลระบบ (สำหรับครู):**
  - ล็อกอินเข้าใช้งานด้วยรหัสผ่านครู (`mmv2026`)
  - กำหนดวัน-เวลา เปิดและปิดรับสมัครล่วงหน้า (มีปุ่มทางลัดเลือก 7 วัน, 15 วัน, 30 วัน หรือไม่จำกัดเวลา)
  - แก้ไขรายละเอียดกิจกรรม, สถานที่, เวลา และจำนวนรับสมัคร (Capacity)
  - สรุปรายชื่อผู้ลงทะเบียน ค้นหาตามชื่อ/ชั้น/รหัส ได้อย่างรวดเร็ว
  - ส่งออกรายชื่อเป็นไฟล์ **CSV (Excel UTF-8)**
  - ปุ่ม **🔄 ดึงข้อมูลจาก Google Sheets** ซิงก์ข้อมูลผู้สมัครข้ามอุปกรณ์แบบเรียลไทม์

---

## 🛠️ โครงสร้างไฟล์ในโครงการ (Project Structure)

```text
student_activity_reg/
├── css/
│   └── styles.css          # ไฟล์ตกแต่งรูปแบบสไตล์ TailWind / Custom CSS
├── img/
│   └── logo.png            # ตราโลโก้โรงเรียนมกุฎเมืองราชวิทยาลัย
├── js/
│   ├── data.js             # ข้อมูลกิจกรรมเริ่มต้น และเวลาเปิด-ปิดสมัคร
│   └── app.js              # โค้ดควบคุมระบบหลัก, LocalStorage & Google Sheets Sync
├── index.html              # หน้าเว็บหลัก (HTML5)
├── README.md               # เอกสารอธิบายโครงการ
└── .gitignore              # ไฟล์ยกเว้นสำหรับ Git
```

---

## 🚀 การติดตั้งและนำไปใช้งาน (Deployment)

1. **โฮสติ้งทั่วไป / Plesk / HostAtom:**
   - อัปโหลดไฟล์ทั้งหมดขึ้นไดเรกทอรี `httpdocs` หรือโฟลเดอร์ของเว็บไซต์ สามารถใช้งานได้ทันทีโดยไม่ต้องใช้ Node.js หรือ Database ภายนอก

2. **GitHub Pages:**
   - เปิดใช้งาน GitHub Pages ในแถบ `Settings` -> `Pages` -> เลือก Branch `main` -> `Save`

---

## 📊 การเชื่อมต่อ Google Sheets (Google Apps Script)

นำโค้ดด้านล่างนี้ไปวางใน **Google Sheets** -> `ส่วนขยาย (Extensions)` -> `Apps Script` เพื่อเปิดใช้งานการบันทึกและซิงก์ข้อมูล:

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[0] || row[1] || row[4]) {
      var val5 = String(row[5] || '');
      var actTitle = "📸 เรื่องเล่าผ่านเลนส์กล้อง (Storytelling Through The Lens)";
      var gradeVal = val5;
      var expVal = String(row[6] || '-');
      var equipVal = String(row[7] || '-');
      var phoneVal = String(row[8] || '-');
      var lineVal = String(row[9] || '-');

      if (val5.includes('เรื่องเล่า')) {
        actTitle = val5;
        gradeVal = String(row[6] || '');
        expVal = String(row[7] || '-');
        equipVal = String(row[8] || '-');
        phoneVal = String(row[9] || '-');
        lineVal = String(row[10] || '-');
      }

      data.push({
        registeredAt: row[0] ? String(row[0]) : '',
        registrationId: row[1] ? String(row[1]) : ('REG-' + (100 + i)),
        studentId: row[2] ? String(row[2]) : '',
        prefix: row[3] ? String(row[3]) : '',
        fullName: row[4] ? String(row[4]) : '',
        activityTitle: actTitle,
        grade: gradeVal,
        cameraExperience: expVal,
        cameraEquipment: equipVal,
        phone: phoneVal,
        lineId: lineVal
      });
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // 🔴 จัดการการลบแถวข้อมูลเมื่อมีการกดลบจากหน้าเว็บ
    if (data.action === 'delete') {
      var rows = sheet.getDataRange().getValues();
      var regIdToDelete = String(data.registrationId || '').trim();
      var studentIdToDelete = String(data.studentId || '').trim();

      for (var i = rows.length - 1; i >= 1; i--) {
        var rowRegId = String(rows[i][1] || '').trim();
        var rowStudentId = String(rows[i][2] || '').trim();

        if ((regIdToDelete && rowRegId === regIdToDelete) || (studentIdToDelete && rowStudentId === studentIdToDelete)) {
          sheet.deleteRow(i + 1); // ลบแถวใน Google Sheet
          return ContentService.createTextOutput("Deleted Row " + (i + 1));
        }
      }
      return ContentService.createTextOutput("Not Found");
    }

    // 🟢 บันทึกข้อมูลการสมัครใหม่
    sheet.appendRow([
      new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      data.registrationId || '',
      data.studentId || '',
      data.prefix || '',
      data.fullName || '',
      data.grade || '',
      data.cameraExperience || '',
      data.cameraEquipment || '',
      data.phone || '',
      data.lineId || '',
      data.activityTitle || ''
    ]);
    return ContentService.createTextOutput("Success");
  } catch(err) {
    return ContentService.createTextOutput("Error: " + err.toString());
  }
}
```

---

© 2026 โรงเรียนมกุฎเมืองราชวิทยาลัย
