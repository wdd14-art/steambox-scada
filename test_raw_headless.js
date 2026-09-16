/**
 * ============================================================================
 * TEST RAW DATA HEADLESS (100% CLI / TERMINAL - NO BROWSER / NO UI)
 * ============================================================================
 * Skrip ini berjalan langsung di Node.js (PowerShell / Command Prompt).
 * Terhubung langsung ke WebSocket native Haiwell SCADA di port 8888,
 * menyaring hanya External Variables 30 unit Autonics TK4M,
 * dan mencetak data mentah dalam format JSON murni langsung ke terminal.
 *
 * Cara Menjalankan:
 *   node test_raw_headless.js
 * ============================================================================
 */

// Gunakan socket.io-client yang sudah terpasang di webserver Haiwell
let io;
try {
    io = require('C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/node_modules/socket.io-client');
} catch (e) {
    try {
        io = require('socket.io-client');
    } catch (err) {
        console.error("Gagal memuat socket.io-client:", err.message);
        process.exit(1);
    }
}

const SCADA_URL = process.env.HAIWELL_URL || 'http://127.0.0.1:8888';

console.log("========================================================================");
console.log(" [HEADLESS TEST] HAIWELL SCADA RAW DATA STREAM MONITOR");
console.log(` Target SCADA Engine: ${SCADA_URL}`);
console.log(" Status: Menghubungkan ke port 8888...");
console.log(" (Pastikan Haiwell SCADA PC Runtime dalam kondisi RUN / Aktif)");
console.log("========================================================================\n");

// State memori raw data 30 unit Autonics TK4M
const unitsState = {};
for (let i = 1; i <= 30; i++) {
    unitsState[i] = {
        unit_id: i,
        pv_suhu: null,
        sv_target: null,
        run_stop: null,
        last_update: null
    };
}

const varsMap = {};

function processTag(fullName, val) {
    if (!fullName || val === undefined || val === null) return false;
    const match = fullName.match(/^sb_?(\d+)\.(suhu_aktual|temp|target_suhu|run_?stop|runstop)/i);
    if (!match) return false;

    const unitId = parseInt(match[1], 10);
    if (unitId < 1 || unitId > 30) return false;

    const type = match[2].toLowerCase();
    let changed = false;

    if (type === 'suhu_aktual' || type === 'temp') {
        const num = parseFloat(val);
        if (unitsState[unitId].pv_suhu !== num) {
            unitsState[unitId].pv_suhu = num;
            changed = true;
        }
    } else if (type === 'target_suhu') {
        const num = parseFloat(val);
        if (unitsState[unitId].sv_target !== num) {
            unitsState[unitId].sv_target = num;
            changed = true;
        }
    } else if (type === 'run_stop' || type === 'runstop') {
        const intVal = parseInt(val, 10);
        if (unitsState[unitId].run_stop !== intVal) {
            unitsState[unitId].run_stop = intVal;
            changed = true;
        }
    }

    if (changed) {
        unitsState[unitId].last_update = new Date().toISOString();
        // Cetak stream per unit yang baru saja berubah nilainya
        console.log(`[RAW STREAM UPDATE] Tangki #${String(unitId).padStart(2, '0')} ->`, JSON.stringify(unitsState[unitId]));
    }
    return changed;
}

function handlePayload(data) {
    if (!data) return;
    let anyChange = false;

    if (Array.isArray(data)) {
        data.forEach(item => {
            if (item && item.ID !== undefined) {
                const idStr = String(item.ID);
                if (!varsMap[idStr]) varsMap[idStr] = {};
                varsMap[idStr].Value = item.Value;
                if (item.FullName) varsMap[idStr].FullName = item.FullName;

                if (varsMap[idStr].FullName) {
                    if (processTag(varsMap[idStr].FullName, item.Value)) anyChange = true;
                }
            }
        });
    } else if (typeof data === 'object') {
        for (const id in data) {
            const idStr = String(id);
            const val = (data[id] && typeof data[id] === 'object' && data[id].Value !== undefined) ? data[id].Value : data[id];
            if (varsMap[idStr] && varsMap[idStr].FullName) {
                if (processTag(varsMap[idStr].FullName, val)) anyChange = true;
            }
        }
    }
}

// Inisialisasi koneksi headless socket
const socket = io(SCADA_URL, {
    reconnection: true,
    reconnectionDelay: 2000,
    timeout: 5000
});

socket.on('connect', () => {
    console.log(`\n>>> [TERHUBUNG] Sukses tersambung ke Haiwell SCADA (Socket ID: ${socket.id})`);
    console.log(">>> Mengirim handshake 'conn' dan 'get all variables'...");
    socket.emit("conn", "headless_test_client");
    socket.emit("get all variables");
});

socket.on('return all var to browser', (data) => {
    console.log(`>>> [DATA AWAL DITERIMA] Total ${Array.isArray(data) ? data.length : Object.keys(data).length} tag terbaca.`);
    handlePayload(data);
    console.log("\n>>> SNAPSHOT INITIAL RAW DATA 30 UNIT (JSON):");
    console.log(JSON.stringify(unitsState, null, 2));
    console.log("\n>>> [STANDBY] Menunggu event 'varChange' (perubahan nilai suhu fisik TK4M)...\n");
});

socket.on('return var to browser', (data) => handlePayload(data));
socket.on('var to browser', (data) => handlePayload(data));

socket.on('varChange', (id, value) => {
    const patch = {};
    patch[String(id)] = value;
    handlePayload(patch);
});

socket.on('disconnect', () => {
    console.log(">>> [TERPUTUS] Koneksi ke Haiwell SCADA terputus. Menunggu runtime menyala kembali...");
});

socket.on('connect_error', (err) => {
    // Tampilkan pesan ringkas sekali-kali
    process.stdout.write(`\rMenunggu Haiwell SCADA Runtime di ${SCADA_URL}... (${err.message}) `);
});
