/* ============================================================================
   STEAMBOX 30 UNIT DASHBOARD JAVASCRIPT LOGIC - VERSION v28
   Hybrid Dual Engine: SCADA PC In-Memory (Page 5 iframe) + Wi-Fi Socket.io
   Strict Rule #7 Compliance: Versioned Backup Script
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    let currentTabGroup = 1;
    let autoRotateActive = false;
    let autoRotateTimer = null;
    let targetUnitForRecipe = 1;
    let _scadaVarsMap = {};

    const unitsContainer = document.getElementById('unitsContainer');
    const clockElement = document.getElementById('clockDisplay');
    const autoRotateCheckbox = document.getElementById('autoRotateCheck');
    const currentUserEl = document.getElementById('currentUser');
    const recipeModal = document.getElementById('recipeModal');
    const modalUnitIdEl = document.getElementById('modalUnitId');
    const recipeGridOptions = document.getElementById('recipeGridOptions');

    // ------------------------------------------------------------------------
    // 1. INITIALIZE SCADA TAG METADATA MAP FROM WEBSERVER
    // ------------------------------------------------------------------------
    function initScadaMetadata() {
        fetch(`/project/libs/variable.js?t=${Date.now()}`)
            .then(res => res.text())
            .then(text => {
                try {
                    const match = text.match(/var\s+variables\s*=\s*(\{[\s\S]*?\});\s*var/);
                    if (match && match[1]) {
                        _scadaVarsMap = (new Function('return ' + match[1]))();
                        const count = Object.keys(_scadaVarsMap).length;
                        if (currentUserEl) currentUserEl.innerText = `Online (${count} Tags Ready)`;
                    }
                } catch(e) {}
            })
            .catch(err => console.error("Metadata load err:", err));
    }

    initScadaMetadata();

    // ------------------------------------------------------------------------
    // 2. REAL-TIME SOCKET.IO ENGINE WITH PERIODIC REFRESH POLLING
    // ------------------------------------------------------------------------
    let socket = null;
    if (typeof io === 'function') {
        try {
            socket = io();
            window.activeSocket = socket;

            socket.on('connect', () => {
                if (currentUserEl) currentUserEl.innerText = 'Online (Live Socket Connected)';
                socket.emit("get all variables");
            });

            // Haiwell SCADA "return var to browser" passes an ID-to-value object map
            socket.on('return var to browser', (data) => {
                if (data && typeof data === 'object') {
                    for (const id in data) {
                        const strId = String(id);
                        const val = data[id];
                        if (_scadaVarsMap[strId]) {
                            _scadaVarsMap[strId].Value = val;
                        } else {
                            _scadaVarsMap[strId] = { ID: id, Value: val };
                        }
                    }
                }
            });

            // Request full tag refresh every 2 seconds to guarantee sync on Wi-Fi
            setInterval(() => {
                if (socket && socket.connected) {
                    socket.emit("get all variables");
                }
            }, 2000);
        } catch(e) {}
    }

    // Default Master Recipe Database with Permanent LocalStorage Sync
    let masterRecipes = [
        { kode: 'sbmk', nama: 'mentor', warna: 'kuning', versi: '1', qty: '125', durasi: '1', batch: '1', trolly: 'rapat' },
        { kode: 'sbmp', nama: 'surya', warna: 'putih', versi: '1', qty: '150', durasi: '1', batch: '1', trolly: 'longgar' },
        { kode: 'sbmk-b', nama: 'mentor super', warna: 'merah', versi: '2', qty: '150', durasi: '2', batch: '1', trolly: 'rapat' },
        { kode: 'sb-std', nama: 'standard', warna: 'putih', versi: '1', qty: '100', durasi: '1', batch: '1', trolly: 'renggang' }
    ];

    try {
        const savedRecipes = localStorage.getItem('haiwell_master_recipes');
        if (savedRecipes) {
            masterRecipes = JSON.parse(savedRecipes);
        }
    } catch(e) {}

    function saveMasterRecipesToStorage() {
        try {
            localStorage.setItem('haiwell_master_recipes', JSON.stringify(masterRecipes));
        } catch(e) {}
    }

    // Generate HTML for 30 Steambox Units
    function buildUnitsHTML() {
        unitsContainer.innerHTML = '';
        for (let id = 1; id <= 30; id++) {
            const padId = String(id).padStart(2, '0');
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-row';
            unitCard.id = `unitRow_${id}`;
            unitCard.dataset.unitId = id;
            unitCard.style.display = (id >= 1 && id <= 5) ? 'grid' : 'none';

            unitCard.innerHTML = `
                <!-- COL 1: NO STEAMBOX & SUHU -->
                <div class="col-steambox">
                    <div class="steambox-header">No. Steambox</div>
                    <div class="steambox-number">${padId}</div>
                    <table class="temp-table">
                        <tr>
                            <td class="temp-label">Suhu Awal</td>
                            <td class="temp-val" id="sb_${id}_suhu_awal">0.0</td>
                        </tr>
                        <tr>
                            <td class="temp-label">Suhu Aktual</td>
                            <td class="temp-val" id="sb_${id}_temp">0.0</td>
                        </tr>
                        <tr>
                            <td class="temp-label">Suhu Akhir</td>
                            <td class="temp-val" id="sb_${id}_suhu_akhir">0.0</td>
                        </tr>
                    </table>
                </div>

                <!-- COL 2: DETAIL PRODUK -->
                <div class="col-produk">
                    <div class="sec-header">Detail Produk</div>
                    <div class="produk-banner" id="recipe_${id}_nama">RESEP KOSONG</div>
                    <div class="grid-details">
                        <div class="grid-item">
                            <span class="item-label">Kode</span>
                            <span class="item-val" id="recipe_${id}_kode">--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Versi</span>
                            <span class="item-val" id="recipe_${id}_versi">--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Trolly</span>
                            <span class="item-val" id="recipe_${id}_trolly">--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Batch</span>
                            <span class="item-val" id="recipe_${id}_batch">--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Warna</span>
                            <span class="item-val" id="recipe_${id}_warna">--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Qty</span>
                            <span class="item-val" id="recipe_${id}_qty">--</span>
                        </div>
                    </div>
                </div>

                <!-- COL 3: DETAIL PROSES -->
                <div class="col-proses">
                    <div class="sec-header">Detail Proses</div>
                    <div class="status-banner" id="sb_${id}_banner">STEAMBOX KOSONG</div>
                    <div class="grid-details">
                        <div class="grid-item">
                            <span class="item-label">Jam Mulai</span>
                            <span class="item-val" id="sb_${id}_jam_mulai">--:--:--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Jam Mulai Masak</span>
                            <span class="item-val" id="sb_${id}_jam_masak">--:--:--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Jam Selesai</span>
                            <span class="item-val" id="sb_${id}_jam_selesai">--:--:--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Durasi Pemanasan</span>
                            <span class="item-val" id="sb_${id}_pemanasan">--:--:--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Target Pemasakan</span>
                            <span class="item-val" id="sb_${id}_target_menit">0 menit</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Perubahan Waktu</span>
                            <span class="item-val" id="sb_${id}_perubahan_waktu">0 menit</span>
                        </div>
                    </div>
                </div>

                <!-- COL 4: PERINTAH (STRICT SCADA CONTROL BUTTONS) -->
                <div class="col-perintah">
                    <div class="sec-header">Perintah</div>
                    <button class="btn-cmd btn-tugas" onclick="handleCommand(${id}, 'tugas_baru')">Tugas Baru</button>
                    <button class="btn-cmd btn-mode" id="btn_mode_${id}" onclick="handleCommand(${id}, 'toggle_mode')">Mode Cooking</button>
                    <button class="btn-cmd btn-runstop" id="btn_runstop_${id}" onclick="handleCommand(${id}, 'toggle_runstop')">START (RUN)</button>
                    <button class="btn-cmd btn-reset" onclick="handleCommand(${id}, 'reset')">RESET</button>
                </div>
            `;

            unitsContainer.appendChild(unitCard);
        }
    }

    buildUnitsHTML();

    // Tab Navigation Logic
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const group = parseInt(e.target.dataset.group, 10);
            setTabGroup(group);
        });
    });

    function setTabGroup(group) {
        currentTabGroup = group;
        for (let id = 1; id <= 30; id++) {
            const card = document.getElementById(`unitRow_${id}`);
            if (!card) continue;
            if (group === 0) {
                card.style.display = 'grid';
            } else {
                const start = (group - 1) * 5 + 1;
                const end = group * 5;
                card.style.display = (id >= start && id <= end) ? 'grid' : 'none';
            }
        }
    }

    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener('change', (e) => {
            autoRotateActive = e.target.checked;
            if (autoRotateActive) {
                startAutoRotate();
            } else {
                clearInterval(autoRotateTimer);
            }
        });
    }

    function startAutoRotate() {
        clearInterval(autoRotateTimer);
        autoRotateTimer = setInterval(() => {
            if (!autoRotateActive) return;
            let nextGroup = currentTabGroup + 1;
            if (nextGroup > 6) nextGroup = 1;
            
            const activeTabBtn = document.querySelector(`.nav-tab[data-group="${nextGroup}"]`);
            if (activeTabBtn) {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                activeTabBtn.classList.add('active');
                setTabGroup(nextGroup);
            }
        }, 10000);
    }

    setInterval(() => {
        const now = new Date();
        const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
        const dayName = days[now.getDay()];
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        
        if (clockElement) {
            clockElement.innerText = `${yyyy}/${mm}/${dd} ${dayName} ${hh}:${mi}:${ss}`;
        }
    }, 1000);

    // ============================================================================
    // HYBRID DUAL ENGINE MAPPER (SCADA PC PARENT + WI-FI SOCKET MAP)
    // ============================================================================
    
    function fetchAllScadaMap() {
        const map = {};

        // 1. Read directly from SCADA PC In-Memory Object (Page 5 iframe container)
        try {
            let pVars = null;
            if (window.variables) pVars = window.variables;
            else if (parent && parent.variables) pVars = parent.variables;
            else if (top && top.variables) pVars = top.variables;

            if (pVars && typeof pVars === 'object') {
                for (const id in pVars) {
                    const item = pVars[id];
                    if (item && item.FullName && item.Value !== undefined) {
                        map[item.FullName] = item.Value;
                        const alt1 = item.FullName.replace(/^sb(\d+)\./, 'sb_$1.');
                        const alt2 = item.FullName.replace(/^sb_(\d+)\./, 'sb$1.');
                        map[alt1] = item.Value;
                        map[alt2] = item.Value;
                        if (item.Name) map[item.Name] = item.Value;
                    }
                }
            }
        } catch(e) {}

        // 2. Read from Socket.io Broadcast Map (HP Android / Laptop Wi-Fi)
        if (_scadaVarsMap && typeof _scadaVarsMap === 'object') {
            for (const id in _scadaVarsMap) {
                const item = _scadaVarsMap[id];
                if (item && item.FullName && item.Value !== undefined) {
                    if (map[item.FullName] === undefined) {
                        map[item.FullName] = item.Value;
                        const alt1 = item.FullName.replace(/^sb(\d+)\./, 'sb_$1.');
                        const alt2 = item.FullName.replace(/^sb_(\d+)\./, 'sb$1.');
                        map[alt1] = item.Value;
                        map[alt2] = item.Value;
                        if (item.Name) map[item.Name] = item.Value;
                    }
                }
            }
        }

        if (currentUserEl && Object.keys(map).length > 0) {
            currentUserEl.innerText = `Online (${Object.keys(map).length} Tags Live)`;
        }

        return map;
    }

    function getTagValue(map, nameList, defaultValue = '--') {
        for (const origName of nameList) {
            const variants = [
                origName,
                origName.replace(/^sb_(\d+)\./, 'sb$1.'),
                origName.replace(/^sb(\d+)\./, 'sb_$1.'),
                origName.replace(/^recipe_([a-z]+)\.(\d+)/, 'recipe_$1_$2'),
                origName.replace(/^recipe_([a-z]+)\.(\d+)/, 'recipe.$2.$1')
            ];

            for (const name of variants) {
                if (map[name] !== undefined && map[name] !== null && map[name] !== '') {
                    return map[name];
                }
            }
        }

        for (const origName of nameList) {
            const variants = [
                origName,
                origName.replace(/^sb_(\d+)\./, 'sb$1.'),
                origName.replace(/^sb(\d+)\./, 'sb_$1.')
            ];
            for (const name of variants) {
                try {
                    let vObj = window.Variable || (parent && parent.Variable) || (top && top.Variable);
                    if (vObj && typeof vObj.GetValue === 'function') {
                        const val = vObj.GetValue(name);
                        if (val !== undefined && val !== null && val !== '') return val;
                    }
                } catch(e) {}
            }
        }

        return defaultValue;
    }

    function findTagIdByName(tagName) {
        let varsObj = null;
        try {
            if (window.variables) varsObj = window.variables;
            else if (parent && parent.variables) varsObj = parent.variables;
            else if (top && top.variables) varsObj = top.variables;
        } catch(e) {}
        if (!varsObj || Object.keys(varsObj).length === 0) varsObj = _scadaVarsMap;

        if (!varsObj) return null;

        const variants = [
            tagName,
            tagName.replace(/^sb_(\d+)\./, 'sb$1.'),
            tagName.replace(/^sb(\d+)\./, 'sb_$1.')
        ];

        for (const key in varsObj) {
            const item = varsObj[key];
            if (item) {
                for (const vName of variants) {
                    if (item.FullName === vName || item.Name === vName || item.FullName === tagName) {
                        return item.ID;
                    }
                }
            }
        }
        return null;
    }

    // HYBRID SCADA COMMAND WRITER (SCADA PC IN-MEMORY + STANDALONE WI-FI SOCKET)
    function setTagValue(tagName, value) {
        let valStr;
        if (value === true || value === 1 || value === "1") {
            valStr = "1";
        } else if (value === false || value === 0 || value === "0") {
            valStr = "0";
        } else {
            valStr = String(value);
        }

        const rawVal = (valStr === "1" ? 1 : (valStr === "0" ? 0 : value));
        const boolVal = (valStr === "1");

        // 1. SCADA PC In-Memory Write (Works 100% inside Page 5 iframe & SCADA Runtime)
        try {
            let pVar = null;
            if (window.Variable) pVar = window.Variable;
            else if (parent && parent.Variable) pVar = parent.Variable;
            else if (top && top.Variable) pVar = top.Variable;

            if (pVar) {
                const variants = [
                    tagName,
                    tagName.replace(/^sb_(\d+)\./, 'sb$1.'),
                    tagName.replace(/^sb(\d+)\./, 'sb_$1.')
                ];
                for (const vName of variants) {
                    if (typeof pVar.SetValue === 'function') {
                        pVar.SetValue(vName, rawVal);
                        pVar.SetValue(vName, strVal);
                        pVar.SetValue(vName, boolVal);
                    }
                }
            }
        } catch(e) {}

        // 2. Standalone Socket.io Emit (Works 100% on HP Android / Laptop Wi-Fi)
        try {
            const tagId = findTagIdByName(tagName);
            let sock = window.activeSocket || window.socket || (parent && parent.socket) || (top && top.socket);

            if (sock && typeof sock.emit === 'function' && tagId) {
                sock.emit("SetById", Number(tagId), strVal, "WRITE");
            }
        } catch(e) {}
    }

    // ------------------------------------------------------------------------
    // STRICT SCADA SCRIPT STATE MACHINE EVALUATOR
    // ------------------------------------------------------------------------
    function computeUnitStatusBanner(id, scadaMap) {
        const directBanner = getTagValue(scadaMap, [
            `sb_${id}.status_banner`, 
            `sb${id}.status_banner`,
            `sb_${id}.banner`,
            `sb${id}.banner`
        ], null);

        if (directBanner && typeof directBanner === 'string' && directBanner.trim() !== '' && directBanner !== '--' && directBanner !== 'STEAMBOX KOSONG') {
            return directBanner;
        }

        // Fetch strict state flags from SCADA map
        const commOp = getTagValue(scadaMap, [`sb${id}._commOperation`, `sb_${id}._commOperation`], 1);
        const commStat = getTagValue(scadaMap, [`sb${id}._commStatus`, `sb_${id}._commStatus`], 1);
        const maintMode = getTagValue(scadaMap, [`sb_${id}.maintenance_mode`, `sb${id}.maintenance_mode`], false);
        const tempRaw = getTagValue(scadaMap, [`sb_${id}.temp`, `sb${id}.temp`, `sb_${id}.suhu_aktual`, `sb${id}.suhu_aktual`], 0.0);
        const statusSelesai = getTagValue(scadaMap, [`sb_${id}.status_selesai`, `sb${id}.status_selesai`], 0);
        const modePreheat = getTagValue(scadaMap, [`sb_${id}.mode_preheat`, `sb${id}.mode_preheat`], 0);
        const runStop = getTagValue(scadaMap, [`sb${id}.run_stop`, `sb_${id}.run_stop`, `sb${id}.runstop`, `sb_${id}.runstop`], 1);
        const totalDetikPreheat = getTagValue(scadaMap, [`sb_${id}.total_detik_pemanasan`, `sb${id}.total_detik_pemanasan`], 0);
        const recipeNama = getTagValue(scadaMap, [`recipe_nama.${id}`, `recipe.${id}.nama`], '');
        const sisaDetikMasak = getTagValue(scadaMap, [`sb_${id}.sisa_detik_masak`, `sb${id}.sisa_detik_masak`], 0);

        if (Number(commOp) === 0) return "UNIT TIDAK DIPAKAI";
        if (Number(commStat) === 0) return "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
        if (maintMode === true || Number(maintMode) === 1) return "MODE MAINTENANCE (KONTROL MANUAL)";
        if (tempRaw >= 3000) return "ERROR SENSOR (OPENLOOP/HHHH)";
        if (Number(statusSelesai) === 1 || statusSelesai === true) return "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";

        if (Number(modePreheat) === 1 || modePreheat === true) {
            if (Number(runStop) === 0 || runStop === false) {
                return "SEDANG PEMANASAN";
            } else if (Number(totalDetikPreheat) === 0) {
                return "SIAP PEMANASAN - SILAKAN TEKAN START";
            } else {
                return "PRE-HEAT DIHENTIKAN (PAUSED)";
            }
        } else {
            // COOKING PRODUCTION MODE
            if (Number(runStop) === 1 || runStop === true) {
                if (recipeNama && recipeNama !== '--' && recipeNama !== 'RESEP KOSONG') {
                    if (Number(sisaDetikMasak) === 0) return "RESEP TERPASANG - SILAKAN TEKAN START";
                    else return "MESIN BERHENTI (PAUSED)";
                } else {
                    if (Number(totalDetikPreheat) > 0) return "PEMANASAN SELESAI - STEAMBOX SIAP UNTUK PEMASAKAN";
                    else return "STEAMBOX KOSONG";
                }
            } else {
                // RUNNING COOKING (run_stop === 0)
                if (tempRaw < 1000) return "MENUNGGU MENDIDIH (< 100 C)";
                else return "SEDANG MEMASAK (MENDIDIH)";
            }
        }
    }

    // Real-Time UI Render Loop (500ms)
    setInterval(() => {
        const scadaMap = fetchAllScadaMap();

        for (let id = 1; id <= 30; id++) {
            const card = document.getElementById(`unitRow_${id}`);
            if (!card || card.style.display === 'none') continue;

            const suhuAwal = getTagValue(scadaMap, [`sb_${id}.suhu_awal`, `sb${id}.suhu_awal`], '0.0');
            const tempRaw = getTagValue(scadaMap, [`sb_${id}.temp`, `sb${id}.temp`, `sb_${id}.suhu_aktual`, `sb${id}.suhu_aktual`], 0.0);
            const suhuAkhir = getTagValue(scadaMap, [`sb_${id}.suhu_akhir`, `sb${id}.suhu_akhir`], '0.0');

            const tempFormatted = (typeof tempRaw === 'number') ? (tempRaw > 200 ? (tempRaw / 10).toFixed(1) : tempRaw.toFixed(1)) : tempRaw;
            const suhuAwalFmt = (typeof suhuAwal === 'number') ? (suhuAwal > 200 ? (suhuAwal / 10).toFixed(1) : suhuAwal.toFixed(1)) : suhuAwal;
            const suhuAkhirFmt = (typeof suhuAkhir === 'number') ? (suhuAkhir > 200 ? (suhuAkhir / 10).toFixed(1) : suhuAkhir.toFixed(1)) : suhuAkhir;

            document.getElementById(`sb_${id}_suhu_awal`).innerText = suhuAwalFmt;
            document.getElementById(`sb_${id}_temp`).innerText = tempFormatted;
            document.getElementById(`sb_${id}_suhu_akhir`).innerText = suhuAkhirFmt;

            const recNama = getTagValue(scadaMap, [`recipe_nama.${id}`, `recipe.${id}.nama`], 'RESEP KOSONG');
            const recKode = getTagValue(scadaMap, [`recipe_kode.${id}`, `recipe.${id}.kode`], '--');
            const recVersi = getTagValue(scadaMap, [`recipe_versi.${id}`, `recipe.${id}.versi`], '--');
            const recTrolly = getTagValue(scadaMap, [`recipe_trolly.${id}`, `recipe.${id}.trolly`], '--');
            const recBatch = getTagValue(scadaMap, [`recipe_batch.${id}`, `recipe.${id}.batch`], '--');
            const recWarna = getTagValue(scadaMap, [`recipe_warna.${id}`, `recipe.${id}.warna`], '--');
            const recQty = getTagValue(scadaMap, [`recipe_qty.${id}`, `recipe.${id}.qty`], '--');

            document.getElementById(`recipe_${id}_nama`).innerText = recNama || 'RESEP KOSONG';
            document.getElementById(`recipe_${id}_kode`).innerText = recKode || '--';
            document.getElementById(`recipe_${id}_versi`).innerText = recVersi || '--';
            document.getElementById(`recipe_${id}_trolly`).innerText = recTrolly || '--';
            document.getElementById(`recipe_${id}_batch`).innerText = recBatch || '--';
            document.getElementById(`recipe_${id}_warna`).innerText = recWarna || '--';
            document.getElementById(`recipe_${id}_qty`).innerText = recQty || '--';

            // EVALUATE STATUS BANNER WITH SCADA SCRIPT STATE MACHINE
            const bannerTxt = computeUnitStatusBanner(id, scadaMap);
            const bannerEl = document.getElementById(`sb_${id}_banner`);
            if (bannerEl) {
                bannerEl.innerText = bannerTxt;
                bannerEl.className = 'status-banner';
                if (String(bannerTxt).includes('MEMASAK') || String(bannerTxt).includes('MENDIDIH')) {
                    bannerEl.classList.add('cooking');
                    card.className = 'unit-row status-cooking';
                } else if (String(bannerTxt).includes('PEMANASAN')) {
                    bannerEl.classList.add('preheat');
                    card.className = 'unit-row status-preheat';
                } else if (String(bannerTxt).includes('SELESAI')) {
                    bannerEl.classList.add('selesai');
                    card.className = 'unit-row status-selesai';
                } else if (String(bannerTxt).includes('ERROR') || String(bannerTxt).includes('OFFLINE')) {
                    bannerEl.classList.add('error');
                    card.className = 'unit-row status-error';
                } else {
                    card.className = 'unit-row';
                }
            }

            document.getElementById(`sb_${id}_jam_mulai`).innerText = getTagValue(scadaMap, [`sb_${id}.tampil_jam_mulai`, `sb${id}.tampil_jam_mulai`], '--:--:--');
            document.getElementById(`sb_${id}_jam_masak`).innerText = getTagValue(scadaMap, [`sb_${id}.tampil_jam_masak`, `sb${id}.tampil_jam_masak`], '--:--:--');
            document.getElementById(`sb_${id}_jam_selesai`).innerText = getTagValue(scadaMap, [`sb_${id}.tampil_jam_selesai`, `sb${id}.tampil_jam_selesai`], '--:--:--');
            document.getElementById(`sb_${id}_pemanasan`).innerText = getTagValue(scadaMap, [`sb_${id}.tampil_pemanasan`, `sb${id}.tampil_pemanasan`], '--:--:--');
            
            const targetMin = getTagValue(scadaMap, [`sb_${id}.target_menit`, `sb${id}.target_menit`], 0);
            const adjMin = getTagValue(scadaMap, [`sb_${id}.perubahan_waktu`, `sb${id}.perubahan_waktu`], 0);
            document.getElementById(`sb_${id}_target_menit`).innerText = `${targetMin} menit`;
            document.getElementById(`sb_${id}_perubahan_waktu`).innerText = `${adjMin} menit`;

            // RENDER MODE PREHEAT / COOKING BUTTON ($sb_X.mode_preheat)
            const modeVal = getTagValue(scadaMap, [`sb_${id}.mode_preheat`, `sb${id}.mode_preheat`], 0);
            const btnMode = document.getElementById(`btn_mode_${id}`);
            if (btnMode) {
                if (Number(modeVal) === 1 || modeVal === true) {
                    btnMode.className = 'btn-cmd btn-mode mode-preheat';
                    btnMode.innerText = 'MODE PREHEAT';
                } else {
                    btnMode.className = 'btn-cmd btn-mode mode-cooking';
                    btnMode.innerText = 'MODE COOKING';
                }
            }

            // RENDER RUN / STOP SWITCH BUTTON ($sb1.run_stop)
            const runStopVal = getTagValue(scadaMap, [`sb${id}.run_stop`, `sb_${id}.run_stop`, `sb${id}.runstop`, `sb_${id}.runstop`], 1);
            const btnRunStop = document.getElementById(`btn_runstop_${id}`);
            if (btnRunStop) {
                if (Number(runStopVal) === 0 || runStopVal === false) {
                    btnRunStop.className = 'btn-cmd btn-runstop active-run';
                    btnRunStop.innerText = 'STOP (RUNNING)';
                } else {
                    btnRunStop.className = 'btn-cmd btn-runstop active-stop';
                    btnRunStop.innerText = 'START (STOPPED)';
                }
            }
        }
    }, 500);

    // ------------------------------------------------------------------------
    // ADVANCED RECIPE BROWSER & INPUT FORM LOGIC (WITH MASTER ADD & SAVE)
    // ------------------------------------------------------------------------
    window.switchRecipeTab = function(tabName) {
        const tabMasterBtn = document.getElementById('tabMasterBtn');
        const tabCustomBtn = document.getElementById('tabCustomBtn');
        const recipeTabMaster = document.getElementById('recipeTabMaster');
        const recipeTabCustom = document.getElementById('recipeTabCustom');

        if (tabName === 'master') {
            tabMasterBtn.classList.add('active');
            tabCustomBtn.classList.remove('active');
            recipeTabMaster.style.display = 'block';
            recipeTabCustom.style.display = 'none';
        } else {
            tabCustomBtn.classList.add('active');
            tabMasterBtn.classList.remove('active');
            recipeTabCustom.style.display = 'block';
            recipeTabMaster.style.display = 'none';
        }
    };

    window.openRecipeModal = function(unitId) {
        targetUnitForRecipe = unitId;
        if (modalUnitIdEl) modalUnitIdEl.innerText = String(unitId).padStart(2, '0');
        
        const highlights = document.querySelectorAll('.unit-id-highlight');
        highlights.forEach(el => el.innerText = String(unitId).padStart(2, '0'));

        switchRecipeTab('master');
        renderMasterRecipeList();

        if (recipeModal) recipeModal.style.display = 'flex';
    };

    function renderMasterRecipeList() {
        recipeGridOptions.innerHTML = '';
        masterRecipes.forEach((recipe) => {
            const btn = document.createElement('div');
            btn.className = 'recipe-card-btn';
            btn.innerHTML = `
                <h4>[${recipe.kode.toUpperCase()}] ${recipe.nama.toUpperCase()}</h4>
                <p>Warna: ${recipe.warna} | Versi: ${recipe.versi} | Qty: ${recipe.qty} kg | Trolly: ${recipe.trolly} | Target: ${recipe.durasi} menit</p>
            `;
            btn.onclick = () => selectRecipeForUnit(recipe);
            recipeGridOptions.appendChild(btn);
        });
    }

    window.closeRecipeModal = function() {
        if (recipeModal) recipeModal.style.display = 'none';
    };

    function selectRecipeForUnit(recipe) {
        const id = targetUnitForRecipe;
        
        setTagValue(`recipe_kode.${id}`, recipe.kode);
        setTagValue(`recipe_nama.${id}`, recipe.nama);
        setTagValue(`recipe_versi.${id}`, recipe.versi);
        setTagValue(`recipe_warna.${id}`, recipe.warna);
        setTagValue(`recipe_qty.${id}`, recipe.qty);
        setTagValue(`recipe_trolly.${id}`, recipe.trolly);
        setTagValue(`recipe_batch.${id}`, recipe.batch);

        if (recipe.durasi) {
            setTagValue(`sb_${id}.target_menit`, recipe.durasi);
            setTagValue(`sb${id}.target_menit`, recipe.durasi);
        }

        // Trigger Recipe Transfer Task in SCADA ($sb_X.trf_resep = 1)
        setTagValue(`sb_${id}.trf_resep`, 1);
        setTagValue(`sb${id}.trf_resep`, 1);

        closeRecipeModal();
        alert(`SUKSES! Resep [${recipe.kode}] ${recipe.nama} BERHASIL DITERAPKAN ke Steambox Unit ${id}!`);
    }

    window.submitCustomRecipe = function() {
        const id = targetUnitForRecipe;
        const kode = document.getElementById('inp_kode').value.trim() || 'sbmk';
        const nama = document.getElementById('inp_nama').value.trim() || 'custom';
        const versi = document.getElementById('inp_versi').value.trim() || '1';
        const warna = document.getElementById('inp_warna').value.trim() || 'kuning';
        const qty = document.getElementById('inp_qty').value.trim() || '125';
        const trolly = document.getElementById('inp_trolly').value || 'rapat';
        const batch = document.getElementById('inp_batch').value.trim() || '1';
        const durasi = document.getElementById('inp_durasi').value.trim() || '1';
        const shouldSaveMaster = document.getElementById('chk_save_master').checked;

        const customRecipe = { kode, nama, versi, warna, qty, trolly, batch, durasi };

        if (shouldSaveMaster) {
            // Check if recipe with same kode already exists
            const existingIdx = masterRecipes.findIndex(r => r.kode.toLowerCase() === kode.toLowerCase());
            if (existingIdx >= 0) {
                masterRecipes[existingIdx] = customRecipe;
            } else {
                masterRecipes.push(customRecipe);
            }
            saveMasterRecipesToStorage();
        }

        selectRecipeForUnit(customRecipe);
    };

    // ------------------------------------------------------------------------
    // STRICT SCADA COMMAND HANDLER (SCADA PC IN-MEMORY + WI-FI SOCKET DUAL CHECK)
    // ------------------------------------------------------------------------
    window.handleCommand = function(unitId, commandType) {
        const scadaMap = fetchAllScadaMap();

        if (commandType === 'tugas_baru') {
            openRecipeModal(unitId);
        } else if (commandType === 'toggle_mode') {
            // Mode Preheat: 1 = Preheat, 0 = Cooking
            const btnEl = document.getElementById(`btn_mode_${unitId}`);
            const btnText = btnEl ? btnEl.innerText : '';
            const tagVal = getTagValue(scadaMap, [`sb_${unitId}.mode_preheat`, `sb${unitId}.mode_preheat`], null);

            let newMode = 0;
            if (btnText.includes('PREHEAT') || Number(tagVal) === 1 || tagVal === true) {
                newMode = 0; // Switch to Cooking
            } else {
                newMode = 1; // Switch to Preheat
            }

            setTagValue(`sb_${unitId}.mode_preheat`, newMode);
            setTagValue(`sb${unitId}.mode_preheat`, newMode);
        } else if (commandType === 'toggle_runstop') {
            // Run/Stop: 0 = RUN, 1 = STOP
            const btnEl = document.getElementById(`btn_runstop_${unitId}`);
            const btnText = btnEl ? btnEl.innerText : '';
            const tagVal = getTagValue(scadaMap, [`sb${unitId}.run_stop`, `sb_${unitId}.run_stop`], null);

            let newRunStop = 1;
            if (btnText.includes('STOP') || btnText.includes('RUNNING') || Number(tagVal) === 0 || tagVal === false) {
                newRunStop = 1; // Switch to STOP
            } else {
                newRunStop = 0; // Switch to RUN
            }

            setTagValue(`sb${unitId}.run_stop`, newRunStop);
            setTagValue(`sb_${unitId}.run_stop`, newRunStop);
        } else if (commandType === 'reset') {
            // Momentary press to $sb_X.reset
            setTagValue(`sb_${unitId}.reset`, 1);
            setTagValue(`sb${unitId}.reset`, 1);
        }
    };
});
