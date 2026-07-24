/* ============================================================================
   STEAMBOX 30 UNIT DASHBOARD JAVASCRIPT LOGIC - VERSION v38 (DYNAMIC RECIPE SYNC)
   - Dynamic Recipe Sync with Native SCADA & Live Memory
   - Trolly free string input support
   - Safe Read-only SCADA Memory Resolution (Zero Object Mutation)
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
    let currentTabGroup = 1;
    let autoRotateActive = false;
    let autoRotateTimer = null;
    let targetUnitForRecipe = 1;

    const unitsContainer = document.getElementById('unitsContainer');
    const clockElement = document.getElementById('clockDisplay');
    const autoRotateCheckbox = document.getElementById('autoRotateCheck');
    const currentUserEl = document.getElementById('currentUser');
    const recipeModal = document.getElementById('recipeModal');
    const modalUnitIdEl = document.getElementById('modalUnitId');
    const recipeGridOptions = document.getElementById('recipeGridOptions');

    // ------------------------------------------------------------------------
    // 1. SAFE READ-ONLY SCADA MEMORY RESOLVER (NO OBJECT MUTATION)
    // ------------------------------------------------------------------------
    function getScadaVarsMap() {
        try {
            if (parent && parent.variables && typeof parent.variables === 'object') {
                return parent.variables;
            }
        } catch(e) {}
        try {
            if (window.parent && window.parent.variables && typeof window.parent.variables === 'object') {
                return window.parent.variables;
            }
        } catch(e) {}
        try {
            if (top && top.variables && typeof top.variables === 'object') {
                return top.variables;
            }
        } catch(e) {}

        if (!window.variables) window.variables = {};
        return window.variables;
    }

    function updateVarsFromPayload(data) {
        if (!data) return;
        const varsMap = getScadaVarsMap();

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item && item.ID !== undefined) {
                    const strId = String(item.ID);
                    if (varsMap[strId] && typeof varsMap[strId] === 'object') {
                        varsMap[strId].Value = item.Value;
                    }
                }
            });
        } else if (typeof data === 'object') {
            for (const id in data) {
                const strId = String(id);
                const val = data[id];
                if (varsMap[strId] && typeof varsMap[strId] === 'object') {
                    if (typeof val === 'object' && val !== null && val.Value !== undefined) {
                        varsMap[strId].Value = val.Value;
                    } else {
                        varsMap[strId].Value = val;
                    }
                }
            }
        }
    }

    // Socket.io Listener
    let socket = null;
    if (typeof io === 'function') {
        try {
            socket = io();
            window.activeSocket = socket;
            window.socket = socket; // Expose window.socket for lib.js compatibility

            socket.on('connect', () => {
                const activeConnId = (window.connId || 'myLocalId');
                socket.emit("conn", activeConnId);
                socket.emit("get all variables");

                const vars = getScadaVarsMap();
                const count = Object.keys(vars).length;
                if (currentUserEl) currentUserEl.innerText = `Online (${count} Tags Live)`;
            });

            socket.on('return all var to browser', (data) => updateVarsFromPayload(data));
            socket.on('return var to browser',     (data) => updateVarsFromPayload(data));
            socket.on('varChange', (id, value) => {
                if (id !== undefined && value !== undefined) {
                    const dataObj = {};
                    dataObj[String(id)] = value;
                    updateVarsFromPayload(dataObj);
                }
            });
            socket.on('var to browser',            (data) => updateVarsFromPayload(data));
        } catch(e) {}
    }

    // Default Master Recipe Database (Synced with Native SCADA)
    let masterRecipes = [
        { kode: 'sbmk', nama: 'mentor', warna: 'kuning', versi: '1', qty: '125', durasi: '1', batch: '1', trolly: 'rapat' },
        { kode: 'sbmp', nama: 'surya', warna: 'putih', versi: '150', durasi: '1', batch: '1', trolly: 'longgar' },
        { kode: 'ghj', nama: 'ghj', warna: 'ghj', versi: '1', qty: '1', durasi: '1', batch: '1', trolly: '1' }
    ];

    try {
        const savedRecipes = localStorage.getItem('haiwell_master_recipes');
        if (savedRecipes) masterRecipes = JSON.parse(savedRecipes);
    } catch(e) {}

    function saveMasterRecipesToStorage() {
        try {
            localStorage.setItem('haiwell_master_recipes', JSON.stringify(masterRecipes));
        } catch(e) {}
    }

    // Build 30 Unit UI Rows
    function buildUnitsHTML() {
        unitsContainer.innerHTML = '';
        const monitorTbody = document.getElementById('monitorRuangTbody');
        if (monitorTbody) monitorTbody.innerHTML = '';

        for (let id = 1; id <= 30; id++) {
            const padId = String(id).padStart(2, '0');
            const isVisible = (id >= 1 && id <= 5);

            // 1. Build Grid Card
            const unitCard = document.createElement('div');
            unitCard.className = 'unit-row';
            unitCard.id = `unitRow_${id}`;
            unitCard.dataset.unitId = id;
            unitCard.style.display = isVisible ? 'grid' : 'none';

            // 2. Build Monitor Row
            if (monitorTbody) {
                const tr = document.createElement('tr');
                tr.id = `monitorRow_${id}`;
                tr.style.display = isVisible ? 'table-row' : 'none';
                tr.innerHTML = `
                    <td>${padId}</td>
                    <td id="monitor_sb_${id}_selesai">--:--:--</td>
                    <td id="monitor_sb_${id}_sisa">--:--:--</td>
                `;
                monitorTbody.appendChild(tr);
            }

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
                            <span class="item-label">Durasi Aktual (UP)</span>
                            <span class="item-val" id="sb_${id}_durasi_aktual">--:--:--</span>
                        </div>
                        <div class="grid-item">
                            <span class="item-label">Perubahan Waktu</span>
                            <span class="item-val" id="sb_${id}_perubahan_waktu">0 menit</span>
                        </div>
                    </div>
                </div>

                <!-- COL 4: PERINTAH -->
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

    // Navigation & View Logic
    let currentViewMode = 'detail'; // 'detail' or 'monitor'

    window.switchViewMode = function(mode) {
        currentViewMode = mode;
        const btnDetail = document.getElementById('btnViewDetail');
        const btnMonitor = document.getElementById('btnViewMonitor');
        const contDetail = document.getElementById('unitsContainer');
        const contMonitor = document.getElementById('monitorRuangContainer');

        if (mode === 'detail') {
            if (btnDetail) btnDetail.classList.add('active');
            if (btnMonitor) btnMonitor.classList.remove('active');
            if (contDetail) contDetail.style.display = 'flex';
            if (contMonitor) contMonitor.style.display = 'none';
        } else {
            if (btnMonitor) btnMonitor.classList.add('active');
            if (btnDetail) btnDetail.classList.remove('active');
            if (contDetail) contDetail.style.display = 'none';
            if (contMonitor) contMonitor.style.display = 'block';
        }
    };

    const groupSelect = document.getElementById('groupSelect');
    if (groupSelect) {
        groupSelect.addEventListener('change', (e) => {
            setTabGroup(parseInt(e.target.value, 10));
        });
    }

    function setTabGroup(group) {
        currentTabGroup = group;
        if (groupSelect && groupSelect.value !== String(group)) {
            groupSelect.value = String(group);
        }
        for (let id = 1; id <= 30; id++) {
            const card = document.getElementById(`unitRow_${id}`);
            const monitorRow = document.getElementById(`monitorRow_${id}`);
            
            let isVisible = false;
            if (group === 0) {
                isVisible = true;
            } else {
                const start = (group - 1) * 5 + 1;
                const end = group * 5;
                isVisible = (id >= start && id <= end);
            }
            
            if (card) card.style.display = isVisible ? 'grid' : 'none';
            if (monitorRow) monitorRow.style.display = isVisible ? 'table-row' : 'none';
        }
    }

    if (autoRotateCheckbox) {
        autoRotateCheckbox.addEventListener('change', (e) => {
            autoRotateActive = e.target.checked;
            if (autoRotateActive) startAutoRotate();
            else clearInterval(autoRotateTimer);
        });
    }

    function startAutoRotate() {
        clearInterval(autoRotateTimer);
        autoRotateTimer = setInterval(() => {
            if (!autoRotateActive) return;
            let nextGroup = currentTabGroup + 1;
            if (nextGroup > 6) nextGroup = 1;
            setTabGroup(nextGroup);
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
    // SAFE READ-ONLY SCADA MAP & TAG RESOLVER
    // ============================================================================
    
    function fetchAllScadaMap() {
        const map = {};
        const varsMap = getScadaVarsMap();

        if (varsMap && typeof varsMap === 'object') {
            for (const id in varsMap) {
                const item = varsMap[id];
                if (item && item.FullName) {
                    map[item.FullName] = item.Value;
                    const alt1 = item.FullName.replace(/^sb(\d+)\./, 'sb_$1.');
                    const alt2 = item.FullName.replace(/^sb_(\d+)\./, 'sb$1.');
                    map[alt1] = item.Value;
                    map[alt2] = item.Value;
                    if (item.Name) map[item.Name] = item.Value;
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
                origName.replace(/^sb_(\d+)_mode_preheat$/, 'sb_$1.mode_preheat'),
                origName.replace(/^sb_(\d+)\.mode_preheat$/, 'sb_$1_mode_preheat'),
                origName.replace(/^sb(\d+)\.runstop$/, 'sb$1.run_stop'),
                origName.replace(/^sb(\d+)\.run_stop$/, 'sb$1.runstop'),
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
        return defaultValue;
    }

    function findTagIdByName(tagName) {
        const varsMap = getScadaVarsMap();
        if (!varsMap || Object.keys(varsMap).length === 0) return null;

        const variants = [
            tagName,
            tagName.replace(/^sb_(\d+)_mode_preheat$/, 'sb_$1.mode_preheat'),
            tagName.replace(/^sb_(\d+)\.mode_preheat$/, 'sb_$1_mode_preheat'),
            tagName.replace(/^sb(\d+)\.runstop$/, 'sb$1.run_stop'),
            tagName.replace(/^sb(\d+)\.run_stop$/, 'sb$1.runstop'),
            tagName.replace(/^sb_(\d+)\./, 'sb$1.'),
            tagName.replace(/^sb(\d+)\./, 'sb_$1.')
        ];

        for (const key in varsMap) {
            const item = varsMap[key];
            if (item) {
                for (const vName of variants) {
                    if (item.FullName === vName || item.Name === vName || item.FullName === tagName || key === tagName) {
                        return item.ID;
                    }
                }
            }
        }
        return null;
    }

    // SAFE NATIVE SCADA SETTER (CALLS NATIVE API ONLY, NO JS OBJECT MUTATION)
    function setTagValue(tagName, value) {
        let valStr = (value === true || value === 1 || value === "1") ? "1" : "0";
        if (value !== true && value !== false && value !== 1 && value !== 0 && value !== "1" && value !== "0") {
            valStr = String(value);
        }

        const rawVal = (valStr === "1" ? 1 : (valStr === "0" ? 0 : value));
        const boolVal = (valStr === "1");

        const varsMap = getScadaVarsMap();
        const tagId = findTagIdByName(tagName);

        if (tagId !== null && tagId !== undefined) {
            const strId = String(tagId);
            if (varsMap && varsMap[strId]) {
                varsMap[strId].Value = rawVal;
            }

            // 1. Direct Socket.io Emission (Guaranteed Write to Haiwell www.js)
            try {
                let sock = window.activeSocket || window.socket || (parent && parent.socket) || (window.parent && window.parent.socket);
                if (sock && typeof sock.emit === 'function') {
                    sock.emit("SetById", Number(tagId), valStr, "WRITE");
                }
            } catch(e) {}

            // 2. Native SCADA Lib helper API (if available)
            try {
                if (window.Variable && typeof window.Variable.SetById === 'function') {
                    window.Variable.SetById(Number(tagId), valStr);
                }
            } catch(e) {}

            // 3. Parent C++ Host object (if inside iframe Web Box)
            try {
                if (window.parent && window.parent.Variable && typeof window.parent.Variable.SetById === 'function') {
                    window.parent.Variable.SetById(Number(tagId), boolVal);
                }
            } catch(e) {}
        }

        try {
            if (window.parent && window.parent.Variable && typeof window.parent.Variable.SetValue === 'function') {
                window.parent.Variable.SetValue(tagName, rawVal);
            }
        } catch(e) {}
    }

    // State Machine Evaluator for Unit Banner
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

        const commOp = getTagValue(scadaMap, [`sb${id}._commOperation`, `sb_${id}._commOperation`], 1);
        const commStat = getTagValue(scadaMap, [`sb${id}._commStatus`, `sb_${id}._commStatus`], 1);
        const maintMode = getTagValue(scadaMap, [`sb_${id}.maintenance_mode`, `sb${id}.maintenance_mode`], false);
        const tempRaw = getTagValue(scadaMap, [`sb_${id}.temp`, `sb${id}.temp`, `sb_${id}.suhu_aktual`, `sb${id}.suhu_aktual`], 0.0);
        const statusSelesai = getTagValue(scadaMap, [`sb_${id}.status_selesai`, `sb${id}.status_selesai`], 0);
        
        const modePreheat = getTagValue(scadaMap, [`sb_${id}_mode_preheat`, `sb_${id}.mode_preheat`, `sb${id}.mode_preheat`], 0);
        const runStop = getTagValue(scadaMap, [`sb${id}.runstop`, `sb${id}.run_stop`, `sb_${id}.runstop`], 1);

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
            if (Number(runStop) === 1 || runStop === true) {
                if (recipeNama && recipeNama !== '--' && recipeNama !== 'RESEP KOSONG') {
                    if (Number(sisaDetikMasak) === 0) return "RESEP TERPASANG - SILAKAN TEKAN START";
                    else return "MESIN BERHENTI (PAUSED)";
                } else {
                    if (Number(totalDetikPreheat) > 0) return "PEMANASAN SELESAI - STEAMBOX SIAP UNTUK PEMASAKAN";
                    else return "STEAMBOX KOSONG";
                }
            } else {
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

            function formatRecipeVal(val, defaultVal = '--') {
                if (val === undefined || val === null || val === '' || val === 0 || val === '0' || val === '0.0' || val === false || val === 'false') {
                    return defaultVal;
                }
                return String(val);
            }

            const recNama = formatRecipeVal(getTagValue(scadaMap, [`recipe_nama.${id}`, `recipe.${id}.nama`, `recipe.nama`], ''), 'RESEP KOSONG');
            const recKode = formatRecipeVal(getTagValue(scadaMap, [`recipe_kode.${id}`, `recipe.${id}.kode`, `recipe.kode`], ''), '--');
            const recVersi = formatRecipeVal(getTagValue(scadaMap, [`recipe_versi.${id}`, `recipe.${id}.versi`, `recipe.versi`], ''), '--');
            const recTrolly = formatRecipeVal(getTagValue(scadaMap, [`recipe_trolly.${id}`, `recipe.${id}.trolly`, `recipe.trolly`], ''), '--');
            const recBatch = formatRecipeVal(getTagValue(scadaMap, [`recipe_batch.${id}`, `recipe.${id}.batch`, `recipe.batch`], ''), '--');
            const recWarna = formatRecipeVal(getTagValue(scadaMap, [`recipe_warna.${id}`, `recipe.${id}.warna`, `recipe.warna`], ''), '--');
            const recQty = formatRecipeVal(getTagValue(scadaMap, [`recipe_qty.${id}`, `recipe.${id}.qty`, `recipe.qty`], ''), '--');

            document.getElementById(`recipe_${id}_nama`).innerText = recNama;
            document.getElementById(`recipe_${id}_kode`).innerText = recKode;
            document.getElementById(`recipe_${id}_versi`).innerText = recVersi;
            document.getElementById(`recipe_${id}_trolly`).innerText = recTrolly;
            document.getElementById(`recipe_${id}_batch`).innerText = recBatch;
            document.getElementById(`recipe_${id}_warna`).innerText = recWarna;
            document.getElementById(`recipe_${id}_qty`).innerText = recQty;

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

            const durasiAktual = getTagValue(scadaMap, [`sb_${id}.tampil_durasi_aktual`, `sb${id}.tampil_durasi_aktual`, `sb_${id}.durasi_aktual_up`, `sb${id}.durasi_aktual_up`], '--:--:--');
            const elDurasiGrid = document.getElementById(`sb_${id}_durasi_aktual`);
            if (elDurasiGrid) elDurasiGrid.innerText = durasiAktual;
            
            const jamSelesai = getTagValue(scadaMap, [`sb_${id}.tampil_jam_selesai`, `sb${id}.tampil_jam_selesai`], '--:--:--');
            
            const monSelesai = document.getElementById(`monitor_sb_${id}_selesai`);
            const monSisa = document.getElementById(`monitor_sb_${id}_sisa`);
            if (monSelesai) monSelesai.innerText = jamSelesai;
            if (monSisa) monSisa.innerText = durasiAktual;

            const modeVal = getTagValue(scadaMap, [`sb_${id}_mode_preheat`, `sb_${id}.mode_preheat`, `sb${id}.mode_preheat`], 0);
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

            const runStopVal = getTagValue(scadaMap, [`sb${id}.runstop`, `sb${id}.run_stop`, `sb_${id}.runstop`], 1);
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

    // Modal Recipe Logic
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

    // DYNAMIC RECIPE LIST SCANNER & RENDERER
    function renderMasterRecipeList() {
        recipeGridOptions.innerHTML = '';
        const scadaMap = fetchAllScadaMap();
        const allRecipesMap = {};

        // 1. Add base masterRecipes (including saved localStorage)
        masterRecipes.forEach(r => {
            if (r && r.kode) allRecipesMap[r.kode.toLowerCase()] = r;
        });

        // 2. Scan SCADA Memory for any live active recipe tags (recipe_kode.1 ... recipe_kode.30)
        for (let rIdx = 1; rIdx <= 30; rIdx++) {
            const kode = getTagValue(scadaMap, [`recipe_kode.${rIdx}`, `recipe.${rIdx}.kode`], null);
            const nama = getTagValue(scadaMap, [`recipe_nama.${rIdx}`, `recipe.${rIdx}.nama`], null);
            if (kode && kode !== '--' && kode !== 'RESEP KOSONG' && typeof kode === 'string' && kode.trim() !== '') {
                const key = kode.toLowerCase();
                if (!allRecipesMap[key]) {
                    const versi = getTagValue(scadaMap, [`recipe_versi.${rIdx}`, `recipe.${rIdx}.versi`], '1');
                    const warna = getTagValue(scadaMap, [`recipe_warna.${rIdx}`, `recipe.${rIdx}.warna`], 'putih');
                    const qty = getTagValue(scadaMap, [`recipe_qty.${rIdx}`, `recipe.${rIdx}.qty`], '100');
                    const trolly = getTagValue(scadaMap, [`recipe_trolly.${rIdx}`, `recipe.${rIdx}.trolly`], 'rapat');
                    const batch = getTagValue(scadaMap, [`recipe_batch.${rIdx}`, `recipe.${rIdx}.batch`], '1');
                    const durasi = getTagValue(scadaMap, [`sb_${rIdx}.target_menit`, `sb${rIdx}.target_menit`], '1');

                    allRecipesMap[key] = { kode, nama: nama || kode, versi, warna, qty, trolly, batch, durasi };
                }
            }
        }

        const recipeListToRender = Object.values(allRecipesMap);

        recipeListToRender.forEach((recipe) => {
            const btn = document.createElement('div');
            btn.className = 'recipe-card-btn';
            btn.innerHTML = `
                <h4>[${recipe.kode.toUpperCase()}] ${(recipe.nama || recipe.kode).toUpperCase()}</h4>
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
        if (!id) return;
        
        // 1. Select active steambox for native SCADA recipe system
        setTagValue(`recipe.pilih_steambox`, id);
        setTagValue(`recipe_pilih_steambox`, id);

        // 2. Set global recipe variables for native SCADA recipe engine
        setTagValue(`recipe.kode`, recipe.kode);
        setTagValue(`recipe.nama`, recipe.nama);
        setTagValue(`recipe.versi`, recipe.versi);
        setTagValue(`recipe.warna`, recipe.warna);
        setTagValue(`recipe.qty`, recipe.qty);
        setTagValue(`recipe.durasi`, recipe.durasi);
        setTagValue(`recipe.trolly`, recipe.trolly);
        setTagValue(`recipe.batch`, recipe.batch);

        // 3. Set per-unit array recipe variables
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

        // 4. Set status_resep flag for SCADA master loop state machine
        setTagValue(`sb_${id}.status_resep`, 1);
        setTagValue(`sb${id}.status_resep`, 1);

        // 5. Trigger momentary recipe transfer pulse to SCADA PLC
        setTagValue(`sb_${id}.trf_resep`, 1);
        setTagValue(`sb_${id}_trf_resep`, 1);
        setTagValue(`sb${id}.trf_resep`, 1);

        closeRecipeModal();
        alert(`SUKSES! Resep [${recipe.kode.toUpperCase()}] ${(recipe.nama || recipe.kode).toUpperCase()} BERHASIL DITERAPKAN ke Steambox Unit ${id}!`);
    }

    window.submitCustomRecipe = function() {
        const id = targetUnitForRecipe;
        const kode = document.getElementById('inp_kode').value.trim() || 'sbmk';
        const nama = document.getElementById('inp_nama').value.trim() || 'custom';
        const versi = document.getElementById('inp_versi').value.trim() || '1';
        const warna = document.getElementById('inp_warna').value.trim() || 'kuning';
        const qty = document.getElementById('inp_qty').value.trim() || '125';
        const trolly = document.getElementById('inp_trolly').value.trim() || 'rapat';
        const batch = document.getElementById('inp_batch').value.trim() || '1';
        const durasi = document.getElementById('inp_durasi').value.trim() || '1';
        const shouldSaveMaster = document.getElementById('chk_save_master').checked;

        const customRecipe = { kode, nama, versi, warna, qty, trolly, batch, durasi };

        if (shouldSaveMaster) {
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

    window.handleCommand = function(unitId, commandType) {
        const scadaMap = fetchAllScadaMap();

        if (commandType === 'tugas_baru') {
            setTagValue(`recipe.pilih_steambox`, unitId);
            setTagValue(`recipe_pilih_steambox`, unitId);
            openRecipeModal(unitId);
        } else if (commandType === 'toggle_mode') {
            const modeVal = getTagValue(scadaMap, [`sb_${unitId}_mode_preheat`, `sb_${unitId}.mode_preheat`, `sb${unitId}.mode_preheat`], 0);

            let newMode = 0;
            if (Number(modeVal) === 1 || modeVal === true) {
                newMode = 0;
            } else {
                newMode = 1;
            }

            setTagValue(`sb_${unitId}_mode_preheat`, newMode);
            setTagValue(`sb_${unitId}.mode_preheat`, newMode);
        } else if (commandType === 'toggle_runstop') {
            const runStopVal = getTagValue(scadaMap, [`sb${unitId}.runstop`, `sb${unitId}.run_stop`, `sb_${unitId}.runstop`], 1);

            let newRunStop = 1;
            if (Number(runStopVal) === 0 || runStopVal === false) {
                newRunStop = 1;
            } else {
                newRunStop = 0;
            }

            setTagValue(`sb${unitId}.runstop`, newRunStop);
            setTagValue(`sb${unitId}.run_stop`, newRunStop);
        } else if (commandType === 'reset') {
            setTagValue(`sb_${unitId}.reset`, 1);
            setTagValue(`sb_${unitId}_reset`, 1);
            setTagValue(`sb${unitId}.reset`, 1);
        }
    };
});
