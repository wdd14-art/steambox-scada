/**
 * ============================================================================
 * HEADLESS TEST: SIMULASI TAG "integer" & "boolean" (HAIWELL SCADA RUNTIME)
 * ============================================================================
 */

const io = require('C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/node_modules/socket.io-client');
const socket = io('http://127.0.0.1:8888', { timeout: 4000 });

console.log("\n========================================================================");
console.log(" [HEADLESS TEST] MENGHUBUNGKAN KE HAIWELL SCADA (PORT 8888)...");
console.log(" Target Tag: 'integer' & 'boolean'");
console.log("========================================================================\n");

let targetIntegerTag = null;
let targetBooleanTag = null;

socket.on('connect', () => {
    console.log(">>> [CONNECTED] Sukses tersambung ke Haiwell SCADA Socket.io!");
    socket.emit("conn", "test_simulasi_client");
    socket.emit("get all variables");
});

socket.on('return all var to browser', (data) => {
    console.log(`>>> [DATA RECEIVED] Total ${Array.isArray(data) ? data.length : Object.keys(data).length} variabel SCADA terbaca.`);
    
    // Cari tag bernama integer dan boolean
    if (Array.isArray(data)) {
        data.forEach(item => {
            checkAndBindTag(item);
        });
    } else if (typeof data === 'object') {
        for (const k in data) {
            checkAndBindTag(data[k]);
        }
    }

    printCurrentState();

    // Jalankan tes tulis otomatis setelah 2 detik
    setTimeout(runWriteTest, 2000);
});

function checkAndBindTag(item) {
    if (!item) return;
    const name = (item.Name || item.FullName || '').toLowerCase();
    if (name === 'integer' || name.endsWith('.integer')) {
        targetIntegerTag = item;
    }
    if (name === 'boolean' || name.endsWith('.boolean')) {
        targetBooleanTag = item;
    }
}

function printCurrentState() {
    console.log("\n------------------------------------------------------------------------");
    console.log(" HASIL PEMINDAIAN TAG SIMULASI:");
    if (targetIntegerTag) {
        console.log(` ✅ Tag 'integer' DITEMUKAN! -> ID: ${targetIntegerTag.ID}, Nilai Saat Ini: ${targetIntegerTag.Value}`);
    } else {
        console.log(" ❌ Tag 'integer' belum terdeteksi di memori SCADA.");
    }

    if (targetBooleanTag) {
        console.log(` ✅ Tag 'boolean' DITEMUKAN! -> ID: ${targetBooleanTag.ID}, Nilai Saat Ini: ${targetBooleanTag.Value}`);
    } else {
        console.log(" ❌ Tag 'boolean' belum terdeteksi di memori SCADA.");
    }
    console.log("------------------------------------------------------------------------\n");
}

// Live stream listener
socket.on('varChange', (id, val) => {
    const strId = String(id);
    let matched = false;

    if (targetIntegerTag && String(targetIntegerTag.ID) === strId) {
        targetIntegerTag.Value = val;
        console.log(`⚡ [LIVE STREAM UPDATE] Tag 'integer' berubah nilai -> ${val}`);
        matched = true;
    }
    if (targetBooleanTag && String(targetBooleanTag.ID) === strId) {
        targetBooleanTag.Value = val;
        console.log(`⚡ [LIVE STREAM UPDATE] Tag 'boolean' berubah nilai -> ${val}`);
        matched = true;
    }

    if (matched) {
        console.log("   JSON Output:", JSON.stringify({
            timestamp: new Date().toISOString(),
            integer: targetIntegerTag ? targetIntegerTag.Value : null,
            boolean: targetBooleanTag ? targetBooleanTag.Value : null
        }));
    }
});

// Write test function
function runWriteTest() {
    if (!targetIntegerTag && !targetBooleanTag) {
        console.log(">>> Menunggu tag terdeteksi...");
        return;
    }

    console.log(">>> [WRITE TEST] Mengirim nilai uji dari skrip headless ke Haiwell SCADA...");
    
    if (targetIntegerTag) {
        const testNum = Math.floor(Math.random() * 900) + 100; // Contoh angka acak 3 digit
        console.log(`>>> Menulis nilai ${testNum} ke tag 'integer' (ID: ${targetIntegerTag.ID})...`);
        socket.emit("SetById", Number(targetIntegerTag.ID), String(testNum), "WRITE");
    }

    if (targetBooleanTag) {
        const newBool = (targetBooleanTag.Value == 1 || targetBooleanTag.Value === true) ? "0" : "1";
        console.log(`>>> Menulis nilai ${newBool} (toggle) ke tag 'boolean' (ID: ${targetBooleanTag.ID})...`);
        socket.emit("SetById", Number(targetBooleanTag.ID), String(newBool), "WRITE");
    }

    console.log(">>> Perintah tulis selesai dikirim! Silakan periksa layar Haiwell SCADA Anda!");
    console.log(">>> Skrip tetap berjalan mendengarkan perubahan nilai secara live (Tekan Ctrl+C untuk keluar)...\n");
}
