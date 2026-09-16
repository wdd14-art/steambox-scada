/**
 * ============================================================================
 * UNIVERSAL HAIWELL SCADA RAW DATA BRIDGE (100% HEADLESS & INDEPENDENT)
 * ============================================================================
 * Modul Universal untuk mengekspos seluruh data tag Haiwell SCADA (apa pun
 * jenis mesinnya: PLC, PID Controller, Inverter, Sensor, dll.) ke format JSON
 * real-time tanpa batasan jumlah tag dan tanpa ketergantungan pada nama mesin tertentu.
 *
 * FITUR UTAMA:
 * 1. Otomatis mengenali semua tag (1 hingga ribuan tag) dari Haiwell SCADA.
 * 2. Otomatis mengubah sistem titik ("Area.Mesin.Sensor") menjadi hierarki JSON rapi.
 * 3. Tulis balik ke SCADA cukup sebutkan nama tag: HaiwellBridge.writeTag("nama", nilai).
 * 4. 0% Elemen Tampilan (Zero DOM / Headless).
 * ============================================================================
 */

(function (global) {
    'use strict';

    // State Penyimpanan Universal Seluruh Tag SCADA
    // Format Flat: { "nama_tag": nilai, ... }
    const flatTagState = {};
    
    // Pemetaan ID ke Nama Tag & Sebaliknya
    const idToNameMap = {};
    const nameToIdMap = {};

    // Daftar Callback Listener
    const dataListeners = [];
    const specificTagListeners = {};

    // Helper: Mengambil memori variabel SCADA jika dibuka di WebBox lokal
    function getScadaVarsMap() {
        try { if (parent && parent.variables && typeof parent.variables === 'object') return parent.variables; } catch (e) {}
        try { if (window.parent && window.parent.variables && typeof window.parent.variables === 'object') return window.parent.variables; } catch (e) {}
        try { if (top && top.variables && typeof top.variables === 'object') return top.variables; } catch (e) {}
        if (!window.variables) window.variables = {};
        return window.variables;
    }

    // Helper: Memecah "Area.Mesin.Sensor" menjadi Objek JSON Bersarang (Tree Hierarchy)
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

    // Helper: Membersihkan nama tag dari simbol sistem jika ada
    function cleanTagName(rawName) {
        if (!rawName) return '';
        // Buang simbol $ di awal jika ada (misal: $Mesin.Suhu -> Mesin.Suhu)
        return rawName.replace(/^\$/, '');
    }

    // Inisialisasi Kamus Pemetaan Tag dari Data SCADA
    function registerTag(id, name, fullName) {
        const idStr = String(id);
        const resolvedName = cleanTagName(fullName || name || idStr);
        idToNameMap[idStr] = resolvedName;
        nameToIdMap[resolvedName] = Number(id);
        
        // Buat alias pencarian tanpa case-sensitive
        nameToIdMap[resolvedName.toLowerCase()] = Number(id);
    }

    // Memproses Pembaruan Data dari Haiwell SCADA
    function handleIncomingData(payload) {
        if (!payload) return;
        const varsMap = getScadaVarsMap();
        let anyChange = false;
        const changedTags = {};

        // 1. Jika payload berupa Array (Snapshot Awal dari SCADA)
        if (Array.isArray(payload)) {
            payload.forEach(item => {
                if (item && item.ID !== undefined) {
                    const idStr = String(item.ID);
                    registerTag(item.ID, item.Name, item.FullName);
                    
                    const tagName = idToNameMap[idStr];
                    const val = item.Value;
                    if (flatTagState[tagName] !== val) {
                        flatTagState[tagName] = val;
                        changedTags[tagName] = val;
                        anyChange = true;
                    }
                }
            });
        }
        // 2. Jika payload berupa Objek Pasangan { [ID]: Nilai } (Event Real-time)
        else if (typeof payload === 'object') {
            for (const id in payload) {
                const idStr = String(id);
                let rawVal = payload[id];
                if (rawVal && typeof rawVal === 'object' && rawVal.Value !== undefined) {
                    rawVal = rawVal.Value;
                }

                // Cek nama tag di kamus atau di memori SCADA
                if (!idToNameMap[idStr] && varsMap[idStr]) {
                    registerTag(id, varsMap[idStr].Name, varsMap[idStr].FullName);
                }

                const tagName = idToNameMap[idStr] || `Tag_${idStr}`;
                if (flatTagState[tagName] !== rawVal) {
                    flatTagState[tagName] = rawVal;
                    changedTags[tagName] = rawVal;
                    anyChange = true;
                }
            }
        }

        // Jika ada perubahan nilai, kabari semua listener
        if (anyChange) {
            broadcastUpdates(changedTags);
        }
    }

    function broadcastUpdates(changedTags) {
        const flatSnapshot = JSON.parse(JSON.stringify(flatTagState));
        const treeSnapshot = buildNestedTree(flatSnapshot);

        // Notifikasi ke listener umum
        dataListeners.forEach(cb => {
            try { cb(flatSnapshot, treeSnapshot); } catch (e) { console.error("[HaiwellBridge Error]", e); }
        });

        // Notifikasi ke listener tag spesifik
        for (const tagName in changedTags) {
            const newVal = changedTags[tagName];
            if (specificTagListeners[tagName]) {
                specificTagListeners[tagName].forEach(cb => {
                    try { cb(newVal, tagName); } catch (e) {}
                });
            }
        }

        // Trigger Event ke Window Browser (untuk kemudahan tim IT)
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('haiwell:update', {
                detail: {
                    flat: flatSnapshot,
                    tree: treeSnapshot,
                    changed: changedTags
                }
            }));
        }
    }

    // Koneksi WebSocket Socket.io ke Haiwell SCADA
    let socket = null;
    function initSocket() {
        if (typeof io !== 'function') {
            return;
        }

        try {
            const hostIP = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '127.0.0.1';
            const scadaUrl = (window.HAIWELL_SCADA_URL) || `http://${hostIP}:8888`;
            
            socket = io(scadaUrl, { reconnection: true });
            window.activeSocket = socket;

            socket.on('connect', () => {
                console.log(`[HaiwellBridge] Terhubung ke Haiwell SCADA di ${scadaUrl}`);
                // Handshake otorisasi bypass lokal (Hak Akses Baca & Tulis Penuh)
                socket.emit("conn", "myLocalId");
                socket.emit("get all variables");
            });

            // Mendengarkan siaran data dari Haiwell SCADA
            socket.on('return var to browser', (data) => handleIncomingData(data));
            socket.on('return all var to browser', (data) => handleIncomingData(data));
            socket.on('var to browser', (data) => handleIncomingData(data));
            socket.on('varChange', (id, val) => {
                const patch = {};
                patch[String(id)] = val;
                handleIncomingData(patch);
            });

            socket.on('disconnect', () => {
                console.warn("[HaiwellBridge] Koneksi ke Haiwell SCADA terputus.");
            });
        } catch (err) {
            console.error("[HaiwellBridge Init Exception]", err);
        }
    }

    // ========================================================================
    // API PUBLIK UNIVERSAL (UNTUK DIGUNAKAN TIM IT / LARAVEL)
    // ========================================================================
    const HaiwellBridge = {
        /**
         * Menerima pembaruan data secara real-time setiap ada tag yang berubah
         * @param {Function} callback (flatData, treeData) => void
         */
        onData: function (callback) {
            if (typeof callback === 'function') {
                dataListeners.push(callback);
                // Langsung kirim data yang ada saat ini
                const flat = JSON.parse(JSON.stringify(flatTagState));
                callback(flat, buildNestedTree(flat));
            }
        },

        /**
         * Mendengarkan perubahan HANYA pada satu tag tertentu
         * @param {string} tagName Nama tag di SCADA (contoh: "Suhu_Oven" atau "Line_1.Motor.Speed")
         * @param {Function} callback (nilaiBaru, namaTag) => void
         */
        onTagChange: function (tagName, callback) {
            const clean = cleanTagName(tagName);
            if (!specificTagListeners[clean]) specificTagListeners[clean] = [];
            specificTagListeners[clean].push(callback);
        },

        /**
         * Mengambil nilai tag tertentu saat ini
         * @param {string} tagName Nama tag di SCADA
         */
        getTag: function (tagName) {
            const clean = cleanTagName(tagName);
            return flatTagState[clean] !== undefined ? flatTagState[clean] : null;
        },

        /**
         * Mengambil seluruh tag dalam format Flat Object JSON
         * Output: { "Tag_A": 10, "Tag_B": true, "Mesin.Suhu": 105.2 }
         */
        getAllFlat: function () {
            return JSON.parse(JSON.stringify(flatTagState));
        },

        /**
         * Mengambil seluruh tag dalam format Nested Tree Hierarchy JSON
         * Output: { "Mesin": { "Suhu": 105.2 }, "Tag_A": 10 }
         */
        getAllTree: function () {
            return buildNestedTree(JSON.parse(JSON.stringify(flatTagState)));
        },

        /**
         * Mengirim perintah kontrol (WRITE) ke SCADA cukup dengan menyebutkan Nama Tag
         * @param {string} tagName Nama tag di SCADA (contoh: "Suhu_Target", "Motor_Run", "integer")
         * @param {any} value Nilai baru yang ingin ditulis (angka, boolean, string)
         * @returns {boolean} Status berhasil dikirim
         */
        writeTag: function (tagName, value) {
            const clean = cleanTagName(tagName);
            let tagId = nameToIdMap[clean] || nameToIdMap[clean.toLowerCase()];

            // Jika belum terdaftar di kamus lokal, coba cari di memori runtime SCADA
            if (tagId === undefined || tagId === null) {
                const varsMap = getScadaVarsMap();
                for (const k in varsMap) {
                    const item = varsMap[k];
                    if (item && (cleanTagName(item.FullName) === clean || cleanTagName(item.Name) === clean)) {
                        tagId = Number(item.ID);
                        registerTag(tagId, item.Name, item.FullName);
                        break;
                    }
                }
            }

            if (tagId !== undefined && tagId !== null && socket) {
                const valStr = String(value);
                socket.emit("SetById", tagId, valStr, "WRITE");
                console.log(`[HaiwellBridge] WRITE -> Tag: "${clean}" (ID: ${tagId}) = ${valStr}`);
                return true;
            }

            console.warn(`[HaiwellBridge] Gagal menulis: Tag "${clean}" tidak ditemukan di kamus SCADA.`);
            return false;
        }
    };

    // Auto-inisialisasi socket
    if (typeof document !== 'undefined') {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initSocket();
        } else {
            document.addEventListener('DOMContentLoaded', initSocket);
        }
    } else {
        initSocket();
    }

    // Ekspos ke global scope
    global.HaiwellBridge = HaiwellBridge;

})(typeof window !== 'undefined' ? window : this);
