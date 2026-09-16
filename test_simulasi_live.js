/**
 * ============================================================================
 * TEST LIVE: SIMULASI TAG "integer" (ID: 169) & "boolean" (ID: 170)
 * ============================================================================
 */

const io = require('C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/node_modules/socket.io-client');
const nodeVar = require('C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/bin/nodeVar.js').variables;

// Ambil info tag 169 dan 170
const tagInt = nodeVar['169'];
const tagBool = nodeVar['170'];

console.log("\n========================================================================");
console.log(" [HEADLESS TEST] SIMULASI RAW DATA TAG HAIWELL SCADA RUNTIME");
console.log(` - Tag Integer : "${tagInt ? tagInt.Name : 'integer'}" (ID: 169, Tipe: ${tagInt ? tagInt.DataType : 'SHORT'})`);
console.log(` - Tag Boolean : "${tagBool ? tagBool.Name : 'boolean'}" (ID: 170, Tipe: ${tagBool ? tagBool.DataType : 'BOOL'})`);
console.log("========================================================================\n");

const socket = io('http://127.0.0.1:8888', {
    reconnection: true,
    timeout: 3000
});

let currentValues = {
    integer: tagInt ? tagInt.Value : 0,
    boolean: tagBool ? tagBool.Value : false
};

socket.on('connect', () => {
    console.log(`>>> [CONNECTED] Tersambung ke Haiwell SCADA di port 8888! (Socket ID: ${socket.id})`);
    
    // Kirim handshake otentikasi read/write
    socket.emit("conn", "myLocalId");
    
    // Minta snapshot seluruh variabel
    socket.emit("get all variables");
    console.log(">>> [HANDSHAKE] Handshake 'myLocalId' & 'get all variables' terkirim.\n");
});

// Event penerimaan data dari Haiwell SCADA
socket.on('return var to browser', (data) => {
    let changed = false;

    if (data['169'] !== undefined) {
        currentValues.integer = Number(data['169']);
        changed = true;
    }
    if (data['170'] !== undefined) {
        currentValues.boolean = (data['170'] === 1 || data['170'] === true || data['170'] === '1');
        changed = true;
    }

    if (changed) {
        console.log("------------------------------------------------------------------------");
        console.log("⚡ [RAW JSON LIVE STREAM DITERIMA DARI SCADA]:");
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            data_mentah: {
                integer: currentValues.integer,
                boolean: currentValues.boolean
            }
        }, null, 2));
        console.log("------------------------------------------------------------------------\n");
    }
});

// Setelah 3 detik, coba jalankan TEST WRITE (mengirim nilai baru dari script ke SCADA)
setTimeout(() => {
    const testAngka = Math.floor(Math.random() * 800) + 100; // Angka acak misal 345
    const newBool = currentValues.boolean ? "0" : "1";       // Toggle boolean

    console.log(`>>> [TEST WRITE] Mengirim nilai baru dari script ke Haiwell SCADA:`);
    console.log(`    -> Tulis ke 'integer' (ID: 169) = ${testAngka}`);
    console.log(`    -> Tulis ke 'boolean' (ID: 170) = ${newBool}`);

    socket.emit("SetById", 169, String(testAngka), "WRITE");
    socket.emit("SetById", 170, newBool, "WRITE");
    console.log(">>> Perintah tulis terkirim! Menunggu konfirmasi pantulan dari SCADA...\n");
}, 3000);

socket.on('disconnect', () => {
    console.log(">>> [DISCONNECTED] Koneksi ke Haiwell SCADA terputus.");
});
