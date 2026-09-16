# DOKUMEN ARSITEKTUR & PANDUAN INTEGRASI OT-TO-IT
## Native WebSocket Reverse-Engineering: Haiwell SCADA to Laravel / Web Platform
**Disusun untuk:** Tim IT Software / Web Developer & Tim Otomasi Pabrik  
**Klasifikasi:** Technical Architecture & Integration Guide (Local-First Edge IoT - Commercial Ready)  
**Status Pengujian:** Terverifikasi 100% Live (Zero Hardcode, Universal Tag Auto-Detection, Read & Write Terbukti)

---

## 1. Ringkasan Eksekutif & Value Komersial

Sistem ini adalah **Jembatan Data Murni (Universal Headless Data Bridge)** yang menghubungkan dunia **OT (Operational Technology / Mesin, PLC, Sensor Pabrik)** dengan dunia **IT (Information Technology / Laravel Web, Database, Notifikasi Telegram/WA)**.

### Nilai Tambah Komersial (High Commercial Value):
1. **Bebas Biaya Lisensi OPC Server:**  
   Menggantikan software middleware berlisensi mahal (seperti Kepware / Matrikon OPC Server yang berharga puluhan juta rupiah per lisensi) menjadi **Rp 0,-**.
2. **Local-First (100% On-Premise, Zero Biaya Cloud Bulanan):**  
   Berjalan sepenuhnya di jaringan lokal pabrik (LAN). Tidak ada kuota data, tidak ada ketergantungan internet publik, dan tidak ada biaya langganan cloud per bulan/tahun.
3. **Headless SCADA Engine:**  
   Haiwell SCADA difungsikan murni sebagai **Hardware Polling Engine** yang terkenal sangat tangguh, stabil, dan memiliki driver komunikasi lengkap ke ribuan jenis PLC/Modbus.
4. **Bebas Polling HTTP & Bebas Enkripsi:**  
   Tidak menggunakan fitur WebAPI resmi Haiwell yang lambat (polling interval dan enkripsi AES-128-CBC). Sistem ini langsung menyadap **Web Server internal native Socket.io di Port 8888** yang menghasilkan data mentah JSON secara *real-time push event* dengan latensi ultra-rendah (< 5 milidetik).
5. **Universal & Zero Code Hardcode:**  
   Tidak terikat pada jenis mesin tertentu. Otomatis mengenali tag baru, nama grup (*dot-notation*), tipe data, dan nilai real-time tanpa perlu mengubah kode jembatan.

---

## 2. Cara Kerja Web Server Native Haiwell di Balik Layar

Ketika software **Haiwell SCADA PC Runtime** dijalankan (`.hwrun`), runtime secara otomatis mengeksekusi sub-program web server berbasis **Node.js dan Express** di latar belakang.

### Lokasi Berkas Kunci di Komputer SCADA:
* Direktori: `C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\`
* Berkas Server Utama: `bin\www.js` (Server WebSocket & TCP Dispatcher)
* Berkas Kamus Tag Proyek: `bin\nodeVar.js` (Kamus metadata seluruh tag)

### Celah Rahasia Otorisasi (*Internal Bypass Key*):
Di dalam berkas `bin\www.js` baris ke-26, terdapat tabel otorisasi akses (`accRight`):
```javascript
var accRight = {
  // 兼容本地hmi本地化 (Kompatibilitas HMI Lokal)
  "myLocalId": {
    "stat": 0,
    "offTime": 0,
    "isWrite": "0"  // <-- "0" artinya: Diberikan Hak Penuh untuk BACA & TULIS
  }
}
```
Haiwell menyediakan ID khusus bernama **`myLocalId`** agar sistem lokal internal memiliki akses baca dan tulis penuh tanpa harus melalui verifikasi lisensi cloud.

---

## 3. Protokol Komunikasi & Spesifikasi Parameter (Port 8888)

Komunikasi antara client (Laravel / Browser / Worker Node.js / Python) dengan Haiwell SCADA menggunakan protokol **WebSocket (Socket.io)**.

* **Target URL:** `http://<IP_PC_SCADA>:8888` *(Contoh: `http://192.168.20.23:8888` atau `http://127.0.0.1:8888`)*
* **Library Client:** `socket.io-client` versi 2.x / 4.x

---

### A. Handshake & Inisialisasi (Wajib Dilakukan Pertama Kali)
Setelah WebSocket terhubung (`connect`), client **wajib** mengirimkan 2 event handshake ini secara berurutan:

```javascript
// 1. Kirim ID otentikasi lokal untuk mengaktifkan izin Read & Write
socket.emit("conn", "myLocalId");

// 2. Minta snapshot awal seluruh variabel SCADA
socket.emit("get all variables");
```

---

### B. Menerima Data (READ / Streaming Event)
Haiwell SCADA menyiarkan data menggunakan satu event tunggal: **`return var to browser`**.

Event ini memancarkan data pada 2 kondisi:
1. **Saat Awal Tersambung:** Mengirim seluruh snapshot nilai variabel di SCADA.
2. **Saat Terjadi Perubahan Fisik (*Event-Driven Push*):** Begitu ada angka sensor atau bit alarm yang berubah di PLC/mesin, SCADA langsung menembakkan event ini hanya untuk ID yang berubah.

#### Format Payload Asli dari SCADA:
Data masuk berupa pasangan `{ [ID_Tag]: Nilai }`:
```json
{
  "170": true,
  "179": 1223
}
```

---

### C. Mengirim Perintah Kontrol (WRITE Command)
Untuk mengubah nilai variabel di SCADA / PLC (misalnya mengubah setpoint suhu, tombol ON/OFF, reset counter), client menembakkan event **`SetById`**.

#### Format Parameter:
`socket.emit("SetById", Tag_ID_Number, Value_String, "WRITE");`

| Parameter | Tipe Data | Deskripsi | Contoh |
| :--- | :--- | :--- | :--- |
| **`id`** | Number / Integer | Angka ID unik tag yang dituju di SCADA | `179` |
| **`value`** | String | Nilai baru yang ingin ditulis (wajib di-cast ke String) | `"1223"` atau `"1"` / `"0"` |
| **`type`** | String | Konstanta penanda operasi tulis | `"WRITE"` |

```javascript
// Contoh: Mengirim nilai speed 1500 ke tag ID 179:
socket.emit("SetById", 179, "1500", "WRITE");

// Contoh: Menyalakan tombol ON (True) ke tag ID 171:
socket.emit("SetById", 171, "1", "WRITE");
```

---

## 4. Bukti Hasil Pengujian Nyata (Real Industrial Test Case)

Pengujian dilakukan langsung pada sistem SCADA aktif dengan membuat tag baru di SCADA tanpa mengubah 1 baris pun kode JavaScript bridge:
* Sistem 1: **WWTP (*Waste Water Treatment Plant*)**
* Sistem 2: **Cold Storage Unit**

### Hasil Log Streaming Terminal:
```text
[02.49.29] ⚡ PERUBAHAN TAG USER: "wwtp.stanby" (ID: 172, Tipe: BOOL) = true
>>> 📦 STREAM PAYLOAD:
{
  "wwtp": { "stanby": true }
}

[02.49.35] ⚡ PERUBAHAN TAG USER: "wwtp.fault" (ID: 170, Tipe: BOOL) = true
>>> 📦 STREAM PAYLOAD:
{
  "wwtp": { "fault": true }
}

[02.49.47] ⚡ PERUBAHAN TAG USER: "coldStorage.frequency" (ID: 178, Tipe: SHORT) = 52
>>> 📦 STREAM PAYLOAD:
{
  "coldStorage": { "frequency": 52 }
}

[02.49.59] ⚡ PERUBAHAN TAG USER: "coldStorage.speed" (ID: 179, Tipe: SHORT) = 1223
>>> 📦 STREAM PAYLOAD:
{
  "coldStorage": { "speed": 1223 }
}
```

### Snapshot JSON Pohon Lengkap (*Full Nested Tree Snapshot*):
```json
{
  "wwtp": {
    "fault": false,
    "running": false,
    "stanby": false,
    "ready": false
  },
  "coldStorage": {
    "load": 45,
    "frequency": 52,
    "speed": 1223
  }
}
```

---

## 5. Panduan Implementasi untuk Tim IT

### Skenario A: Integrasi ke Frontend Web Modern (Laravel Blade / React / Vue)
Gunakan library `haiwell_raw_bridge.js` yang sudah disediakan di folder `nodejs/public/`:

```html
<!-- 1. Muat library Socket.io dari Web Server SCADA -->
<script src="http://192.168.20.23:8888/socket.io/socket.io.js"></script>

<!-- 2. Muat Universal Headless Bridge -->
<script src="haiwell_raw_bridge.js"></script>

<script>
    // Dengarkan seluruh data secara real-time
    HaiwellBridge.onData(function (flatData, treeData) {
        console.log("Status WWTP Fault:", treeData.wwtp?.fault);
        console.log("Speed Cold Storage:", treeData.coldStorage?.speed);
    });

    // Kontrol Balik: Cukup panggil nama tag-nya
    function ubahKecepatan(nilaiBaru) {
        HaiwellBridge.writeTag("coldStorage.speed", nilaiBaru);
    }
</script>
```

---

### Skenario B: Backend Worker (Node.js Service ke Database & Notifikasi Bot Telegram)

Jika data ingin dicatat ke database MySQL / PostgreSQL atau dikirimkan ke Bot Telegram operator:

```javascript
const io = require('socket.io-client');
const axios = require('axios');

const socket = io('http://192.168.20.23:8888');

socket.on('connect', () => {
    socket.emit("conn", "myLocalId");
    socket.emit("get all variables");
});

socket.on('return var to browser', async (payload) => {
    // Tangkap jika terjadi alarm trip pada WWTP
    if (payload['170'] === true || payload['170'] === 1) {
        console.log("🚨 ALARM TRIP DETECTED! Mengirim sinyal ke Telegram...");
        
        await axios.post('https://api.telegram.org/bot<TOKEN>/sendMessage', {
            chat_id: '<CHAT_ID_TEKNISI>',
            text: `⚠️ PERINGATAN PABRIK: WWTP Mengalami FAULT (TRIP)! Mohon segera periksa unit pompa & sensor.`
        });
    }
});
```

---

## 6. Inventaris Berkas Proyek

Seluruh berkas implementasi dan pengujian tersimpan pada direktori SCADA:  
📁 `D:\Project\PTSIAP\Haiwell\Runtime\Demo2_hp_SB16\`

| Nama Berkas | Lokasi | Deskripsi |
| :--- | :--- | :--- |
| **`monitor_terminal.js`** | Root Proyek | Engine live terminal monitor (CLI) yang otomatis membaca FullName dan memformat payload JSON Tree. |
| **`jalankan_monitor_terminal.bat`** | Root Proyek | File shortcut 1-klik untuk menjalankan monitor terminal. |
| **`haiwell_raw_bridge.js`** | `nodejs/public/` | Library bridge universal headless (zero UI) siap pakai untuk Tim IT / Laravel. |
| **`scada_tags.json`** | `nodejs/public/` | Snapshot kamus tag aktif yang otomatis diperbarui dari `nodeVar.js`. |
| **`bukti_live_browser.html`** | `nodejs/public/` | Dashboard web live stream pure JSON lengkap dengan tabel real-time dan kontrol tulis dua arah. |

---

## 7. Catatan Keamanan Pabrik (Air-Gap Security)

1. **Jaga Port 8888 di Jaringan Privat Pabrik (LAN):**  
   Port `8888` Haiwell tidak boleh dibuka langsung ke internet publik (*No Port Forwarding*).
2. **Laravel Sebagai Benteng Utama:**  
   Akses dari luar pabrik (kantor pusat, manajemen, remote smartphone) harus melewati server Laravel yang sudah dilindungi HTTPS SSL, otentikasi login pengguna, dan hak akses (*Role-Based Permissions*).
3. **Fail-Safe Operation:**  
   Logika keselamatan mesin (*Emergency Stop*, *Interlock Hardware*) tetap berada di PLC fisik secara mandiri. Jika koneksi jaringan LAN atau server web mati, mesin fisik tetap aman beroperasi.
