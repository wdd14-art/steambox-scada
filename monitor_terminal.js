/**
 * ============================================================================
 * UNIVERSAL LIVE TERMINAL MONITOR (100% DINAMIS - ZERO HARDCODE)
 * ============================================================================
 * Menyaring tag buatan pengguna (mengabaikan jam/milidetik internal SCADA),
 * membaca Nama Lengkap Grup (FullName misal boiler.fault, mixer3.speed),
 * dan menampilkan perubahan data dalam format Flat JSON & Nested JSON Tree.
 * ============================================================================
 */

const io = require('C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/node_modules/socket.io-client');
const fs = require('fs');
const path = 'C:/Program Files (x86)/Haiwell/HaiwellScada3/Resources/app/webserver/bin/nodeVar.js';
const publicJsonPath = 'nodejs/public/scada_tags.json';

function getLatestNodeVar() {
    try {
        delete require.cache[require.resolve(path)];
        const vars = require(path).variables || {};
        
        // Simpan snapshot kamus tag ke nodejs/public/scada_tags.json agar browser web juga dapat membacanya
        try {
            const exportData = {};
            for (const id in vars) {
                const item = vars[id];
                const fullName = item.FullName || item.Name || '';
                if (Number(id) > 25 && !fullName.startsWith('$')) {
                    exportData[id] = {
                        id: Number(id),
                        name: item.Name,
                        fullName: fullName.replace(/^\$/, ''),
                        dataType: item.DataType,
                        value: item.Value
                    };
                }
            }
            fs.writeFileSync(publicJsonPath, JSON.stringify(exportData, null, 2));
        } catch (err) {}

        return vars;
    } catch (e) {
        return {};
    }
}

// Helper: Memecah "boiler.fault" menjadi Objek Pohon Bersarang { boiler: { fault: false } }
function buildNestedTree(flatData) {
    const tree = {};
    for (const fullKey in flatData) {
        const val = flatData[fullKey];
        const parts = fullKey.split('.');
        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = val;
            } else {
                if (!current[part] || typeof current[part] !== 'object') {
                    current[part] = {};
                }
                current = current[part];
            }
        }
    }
    return tree;
}

console.clear();
console.log("========================================================================");
console.log(" 🔴 [UNIVERSAL MONITOR] LIVE STREAMING DATA MENTAH DARI HAIWELL SCADA");
console.log("========================================================================");
console.log(" Status: Menghubungkan ke port 8888...\n");

const socket = io('http://127.0.0.1:8888', { reconnection: true });

let tagDictionary = getLatestNodeVar();
const userTagValues = {};

// Filter: Abaikan variabel sistem internal SCADA (Jam, Detik, Milidetik, ID 1-25)
function isSystemTag(id, fullName) {
    if (Number(id) <= 25) return true;
    if (!fullName) return false;
    const lower = fullName.toLowerCase();
    return lower.startsWith('$') || 
           ['millisecond', 'second', 'time', 'runtime', 'runsecond', 'year', 'month', 'day', 'hour', 'minute'].includes(lower);
}

function getTagName(info, id) {
    if (!info) return `Tag_${id}`;
    const raw = info.FullName || info.Name || `Tag_${id}`;
    return raw.replace(/^\$/, '');
}

socket.on('connect', () => {
    console.log(">>> ✅ TERHUBUNG KE HAIWELL SCADA RUNTIME (Port 8888)");
    tagDictionary = getLatestNodeVar();

    console.log("\n>>> 📋 DAFTAR TAG USER YANG TERDETEKSI DI HAIWELL SCADA:");
    let count = 0;
    const initialTreeData = {};

    for (const id in tagDictionary) {
        const item = tagDictionary[id];
        const fullName = getTagName(item, id);
        if (!isSystemTag(id, fullName)) {
            count++;
            console.log(`    [ID: ${id.padEnd(4)}] "${fullName.padEnd(20)}" (${item.DataType.padEnd(6)}) = ${item.Value}`);
            userTagValues[id] = item.Value;
            initialTreeData[fullName] = item.Value;
        }
    }
    console.log(`>>> Total: ${count} tag user aktif ditemukan.`);
    console.log("------------------------------------------------------------------------");
    console.log(">>> 🌳 INITIAL JSON TREE SNAPSHOT:");
    console.log(JSON.stringify(buildNestedTree(initialTreeData), null, 2));
    console.log("------------------------------------------------------------------------");
    console.log(">>> Mengirim handshake 'myLocalId'...");
    socket.emit("conn", "myLocalId");
    socket.emit("get all variables");
    console.log(">>> 🟢 MONITOR AKTIF! Silakan ubah angka/status tag apa saja di SCADA.\n");
});

// Tangkap aliran data realtime
socket.on('return var to browser', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    tagDictionary = getLatestNodeVar();

    let anyChange = false;
    const changedList = {};
    const flatBatch = {};

    for (const id in payload) {
        const idStr = String(id);
        const val = payload[id];

        const info = tagDictionary[idStr] || {};
        const fullName = getTagName(info, idStr);

        // Abaikan tag sistem (milidetik, dll)
        if (isSystemTag(id, fullName)) continue;

        if (userTagValues[idStr] !== val) {
            userTagValues[idStr] = val;
            changedList[idStr] = {
                nama: fullName,
                tipe: info.DataType || 'UNKNOWN',
                nilai: val
            };
            flatBatch[fullName] = val;
            anyChange = true;
        }
    }

    if (anyChange) {
        const jam = new Date().toLocaleTimeString('id-ID');
        for (const id in changedList) {
            const item = changedList[id];
            console.log(`[${jam}] ⚡ PERUBAHAN TAG USER: "${item.nama}" (ID: ${id}, Tipe: ${item.tipe}) = ${item.nilai}`);
        }
        
        console.log(">>> 📦 STREAM PAYLOAD (Hierarki JSON):");
        console.log(JSON.stringify(buildNestedTree(flatBatch), null, 2));
        console.log("------------------------------------------------------------------------");
    }
});

socket.on('disconnect', () => {
    console.log("\n>>> ❌ KONEKSI TERPUTUS dari Haiwell SCADA.");
});
