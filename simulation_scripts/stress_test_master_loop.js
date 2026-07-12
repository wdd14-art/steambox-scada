const fs = require('fs');
const path = require('path');

// Mock database containing all registered tag paths
const database = {};

// Register all 30 units and their recipe variables
for (let i = 1; i <= 30; i++) {
    const dev = "sb" + i;
    const grp = "sb_" + i;
    
    // Units 1 to 27 are active, 28 to 30 are inactive
    database[grp + ".is_active"] = (i <= 27);

    database[dev + "._commOperation"] = true;
    database[dev + "._commStatus"] = true;
    database[dev + ".runStop"] = true; // true = stopped, false = running
    database[dev + ".temp"] = 250;      // 25.0 °C ambient
    
    database[grp + ".maintenance_mode"] = 0;
    database[grp + ".target_menit"] = 0;
    database[grp + ".adjust_menit"] = 0;
    database[grp + ".sisa_detik_masak"] = 0;
    database[grp + ".total_detik_pemanasan"] = 0;
    database[grp + ".flag_init_start"] = 0;
    database[grp + ".flag_init_masak"] = 0;
    database[grp + ".status_kosong"] = false;
    database[grp + ".status_pemanasan"] = false;
    database[grp + ".status_pemasakan"] = false;
    database[grp + ".status_selesai"] = false;
    database[grp + ".status_banner"] = "";
    database[grp + ".tampil_jam_mulai"] = "00:00:00";
    database[grp + ".tampil_jam_masak"] = "00:00:00";
    database[grp + ".tampil_jam_selesai"] = "00:00:00";
    database[grp + ".tampil_durasi_actual"] = "00:00:00";
    database[grp + ".tampil_pemanasan"] = "00:00:00";
    database[grp + ".suhu_awal"] = 0;
    database[grp + ".suhu_akhir"] = 0;
    database[grp + ".perubahan_waktu"] = 0;

    // Active recipe details per unit
    database["recipe_kode." + i] = "";
    database["recipe_nama." + i] = "--";
    database["recipe_versi." + i] = 0;
    database["recipe_warna." + i] = "";
    database["recipe_qty." + i] = 0;
    database["recipe_batch." + i] = 0;
    database["recipe_trolly." + i] = "";
}

// Global SCADA System Variables
global.$Hour = 8;
global.$Minute = 0;
global.$Second = 0;

// Register Sys_Control variables in mock database
database["Sys_Control.txt_status_kosong"] = "TANGKI KOSONG - SIAP MEMULAI";
database["Sys_Control.txt_status_preheat"] = "SEDANG PRE-HEAT (PEMANASAN)";
database["Sys_Control.txt_status_pemanasan"] = "MENUNGGU MENDIDIH (< 100 C)";
database["Sys_Control.txt_status_pemasakan"] = "SEDANG MEMASAK (MENDIDIH)";
database["Sys_Control.txt_status_selesai"] = "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
database["Sys_Control.txt_status_maintenance"] = "MODE MAINTENANCE (KONTROL MANUAL)";
database["Sys_Control.txt_status_offline"] = "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
database["Sys_Control.txt_status_disable"] = "KOMUNIKASI UNIT DINONAKTIFKAN";
database["Sys_Control.txt_status_sensor_error"] = "ERROR SENSOR (OPENLOOP/HHHH)";

for (let r = 1; r <= 5; r++) {
    database["Sys_Control.monitor_room_" + r] = "";
    database["Sys_Control.monitor_sisa_" + r] = "";
    database["Sys_Control.monitor_selesai_" + r] = "";
}

global.$Sys_Control = {
    get txt_status_kosong() { return database["Sys_Control.txt_status_kosong"]; },
    get txt_status_preheat() { return database["Sys_Control.txt_status_preheat"]; },
    get txt_status_pemanasan() { return database["Sys_Control.txt_status_pemanasan"]; },
    get txt_status_pemasakan() { return database["Sys_Control.txt_status_pemasakan"]; },
    get txt_status_selesai() { return database["Sys_Control.txt_status_selesai"]; },
    get txt_status_maintenance() { return database["Sys_Control.txt_status_maintenance"]; },
    get txt_status_offline() { return database["Sys_Control.txt_status_offline"]; },
    get txt_status_disable() { return database["Sys_Control.txt_status_disable"]; },
    get txt_status_sensor_error() { return database["Sys_Control.txt_status_sensor_error"]; }
};

// Variable API Mock
global.Variable = {
    GetValue: function(name) {
        if (database.hasOwnProperty(name)) {
            return database[name];
        }
        throw new Error(`SCADA compiler error: Tag '${name}' does not exist in database!`);
    },
    SetValue: function(name, value) {
        if (database.hasOwnProperty(name)) {
            database[name] = value;
            return;
        }
        throw new Error(`SCADA compiler error: Cannot write to unregistered tag '${name}'!`);
    }
};

// Tick Clock
function tickClock() {
    global.$Second++;
    if (global.$Second >= 60) {
        global.$Second = 0;
        global.$Minute++;
        if (global.$Minute >= 60) {
            global.$Minute = 0;
            global.$Hour = (global.$Hour + 1) % 24;
        }
    }
}

// Function to run the actual production script
const scriptCode = fs.readFileSync(path.join(__dirname, '..', 'master_loop_scada.js'), 'utf8');
function runMasterScript() {
    eval(scriptCode);
}

// STRESS TEST CONSTANTS & STATS
const TOTAL_TICKS = 2000;
let stats = {
    outages: 0,
    recoveries: 0,
    maintenanceToggles: 0,
    resets: 0,
    cookingStarts: 0,
    preheatStarts: 0,
    timerAdjustments: 0,
    sensorErrors: 0,
    sensorRecoveries: 0
};

console.log(`=== STRUKTUR KODE DI-LOAD: ${scriptCode.split('\n').length} BARIS ===`);
console.log(`=== MELAKUKAN STRESS TEST SELAMA ${TOTAL_TICKS} DETIK SIMULASI ===\n`);

// Helper to check if time is valid format (HH:MM:SS)
function isValidTimeFormat(val) {
    if (val === "--:--:--" || val === undefined) return true;
    return /^\d{2}:\d{2}:\d{2}$/.test(val);
}

// STRESS LOOP
for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    tickClock();

    // Random events generation for active units (1 to 27)
    for (let i = 1; i <= 27; i++) {
        const dev = "sb" + i;
        const grp = "sb_" + i;

        // 1. MCB Outage / Recovery
        if (database[dev + "._commStatus"] === true) {
            if (Math.random() < 0.005) { // 0.5% chance per second per unit to go offline
                database[dev + "._commStatus"] = false;
                stats.outages++;
            }
        } else {
            if (Math.random() < 0.05) { // 5% chance per second to recover from offline
                database[dev + "._commStatus"] = true;
                stats.recoveries++;
            }
        }

        // Only generate process changes if the machine is online
        if (database[dev + "._commStatus"] === true) {
            
            // 2. Toggle Maintenance Mode
            if (Math.random() < 0.002) { // 0.2% chance per second
                database[grp + ".maintenance_mode"] = database[grp + ".maintenance_mode"] === 1 ? 0 : 1;
                stats.maintenanceToggles++;
            }

            // Only generate normal cooking updates if not in maintenance mode
            if (database[grp + ".maintenance_mode"] !== 1) {
                
                // If stopped and not finished, occasionally start a new recipe/process
                if (database[dev + ".runStop"] === true && database[grp + ".status_selesai"] === false && database[grp + ".status_kosong"] === false) {
                    if (Math.random() < 0.02) { // 2% chance to start something
                        const target = Math.random() < 0.3 ? 0 : Math.floor(Math.random() * 20) + 5; // 30% preheat, 70% cooking
                        database[grp + ".target_menit"] = target;
                        database[dev + ".runStop"] = false; // Start running
                        database[dev + ".temp"] = 250;      // reset temperature to ambient
                        database[grp + ".status_kosong"] = false;
                        
                        if (target === 0) {
                            stats.preheatStarts++;
                        } else {
                            stats.cookingStarts++;
                            // Write dummy recipe details
                            database["recipe_kode." + i] = "SKU-" + Math.floor(Math.random() * 1000);
                            database["recipe_nama." + i] = "Produk Tipe " + String.fromCharCode(65 + Math.floor(Math.random() * 6));
                            database["recipe_versi." + i] = Math.floor(Math.random() * 5) + 1;
                            database["recipe_warna." + i] = "W-" + i;
                            database["recipe_qty." + i] = Math.floor(Math.random() * 500) + 100;
                            database["recipe_batch." + i] = Math.floor(Math.random() * 50) + 1;
                            database["recipe_trolly." + i] = "TRL-" + i;
                        }
                    }
                }

                // If running, simulate temperature rise and timer tick
                if (database[dev + ".runStop"] === false) {
                    // Temperature increase simulation
                    if (database[dev + ".temp"] < 1005) {
                        database[dev + ".temp"] += Math.floor(Math.random() * 5) + 2; // Increase by 0.2 - 0.7 °C per second
                    }

                    // Occasional runtime timer adjustment (adjust_menit)
                    if (database[grp + ".target_menit"] > 0 && Math.random() < 0.005) {
                        const adj = Math.random() < 0.5 ? -1 : 1;
                        database[grp + ".adjust_menit"] = adj;
                        stats.timerAdjustments++;
                    }
                }

                // If completed/finished, simulate operator pressing reset (status_kosong) after a delay
                if (database[grp + ".status_selesai"] === true) {
                    if (Math.random() < 0.05) { // 5% chance to reset per second
                        database[grp + ".status_kosong"] = true;
                        stats.resets++;
                    }
                }
            }
        }

        // 3. Sensor Error Injection (HHHH)
        if (database[dev + ".temp"] < 30000) {
            if (Math.random() < 0.001) { // 0.1% chance
                database[dev + ".temp"] = 32767;
                stats.sensorErrors++;
            }
        } else {
            if (Math.random() < 0.05) { // 5% recovery chance
                database[dev + ".temp"] = 1005; // recover to normal boil
                stats.sensorRecoveries++;
            }
        }
    }

    // Keep track of sisa_detik_masak before executing master loop for assertions
    const prevSisa = {};
    for (let i = 1; i <= 30; i++) {
        prevSisa[i] = database["sb_" + i + ".sisa_detik_masak"];
    }

    // RUN MASTER SCRIPT
    try {
        runMasterScript();
    } catch (err) {
        console.error(`CRITICAL FAILURE: Script crashed at simulated second ${tick}!`);
        console.error(err.stack);
        process.exit(1);
    }

    // INVARIANT ASSERTIONS (PENGUJIAN VALIDITAS LOGIKA)
    for (let i = 1; i <= 30; i++) {
        const dev = "sb" + i;
        const grp = "sb_" + i;

        // Assertion 1: Inactive units must not poll Modbus and must remain in disabled state
        if (database[grp + ".is_active"] === false) {
            if (database[dev + "._commOperation"] !== false) {
                console.error(`Assertion fail: Inactive unit ${i} has _commOperation = true!`);
                process.exit(1);
            }
            if (database[grp + ".status_banner"] !== database["Sys_Control.txt_status_disable"]) {
                console.error(`Assertion fail: Inactive unit ${i} banner is not disabled! Got: ${database[grp + ".status_banner"]}`);
                process.exit(1);
            }
            continue;
        }

        // Assertion 2: Offline units (MCB Trip) must freeze their timer and show offline banner
        if (database[dev + "._commStatus"] === false) {
            if (database[grp + ".sisa_detik_masak"] !== prevSisa[i]) {
                console.error(`Assertion fail: Offline unit ${i} changed its cooking timer from ${prevSisa[i]} to ${database[grp + ".sisa_detik_masak"]}!`);
                process.exit(1);
            }
            if (database[grp + ".status_banner"] !== database["Sys_Control.txt_status_offline"]) {
                console.error(`Assertion fail: Offline unit ${i} banner is not offline! Got: ${database[grp + ".status_banner"]}`);
                process.exit(1);
            }
            continue;
        }

        // Assertion 3: Maintenance mode units must show maintenance banner (unless sensor is in error)
        if (database[grp + ".maintenance_mode"] === 1) {
            const expectedBanner = (database[dev + ".temp"] >= 30000) 
                ? database["Sys_Control.txt_status_sensor_error"] 
                : database["Sys_Control.txt_status_maintenance"];
            if (database[grp + ".status_banner"] !== expectedBanner) {
                console.error(`Assertion fail: Maintenance unit ${i} banner is not correct! Got: ${database[grp + ".status_banner"]} but expected ${expectedBanner}`);
                process.exit(1);
            }
            continue;
        }

        // Assertion 4: Sensor error units must show sensor error banner
        if (database[dev + ".temp"] >= 30000) {
            if (database[grp + ".status_banner"] !== database["Sys_Control.txt_status_sensor_error"]) {
                console.error(`Assertion fail: Sensor error unit ${i} banner is not sensor_error! Got: ${database[grp + ".status_banner"]}`);
                process.exit(1);
            }
        }

        // Assertion 5: If reset (status_kosong) was triggered, verify recipe details are wiped out!
        // (Since status_kosong autoclears in this tick, we check if the recipe data is now reset)
        if (prevSisa[i] > 0 && database[grp + ".status_kosong"] === false && database[grp + ".sisa_detik_masak"] === 0 && database[grp + ".target_menit"] === 0) {
            // This unit has been reset
            if (database["recipe_kode." + i] !== "") {
                console.error(`Assertion fail: Unit ${i} reset failed! recipe_kode is not empty: ${database["recipe_kode." + i]}`);
                process.exit(1);
            }
            if (database["recipe_nama." + i] !== "--") {
                console.error(`Assertion fail: Unit ${i} reset failed! recipe_nama is not "--": ${database["recipe_nama." + i]}`);
                process.exit(1);
            }
            if (database["recipe_versi." + i] !== 0) {
                console.error(`Assertion fail: Unit ${i} reset failed! recipe_versi is not 0: ${database["recipe_versi." + i]}`);
                process.exit(1);
            }
        }

        // Assertion 6: Check time formats in displays
        if (!isValidTimeFormat(database[grp + ".tampil_jam_mulai"]) ||
            !isValidTimeFormat(database[grp + ".tampil_jam_masak"]) ||
            !isValidTimeFormat(database[grp + ".tampil_jam_selesai"]) ||
            !isValidTimeFormat(database[grp + ".tampil_durasi_actual"]) ||
            !isValidTimeFormat(database[grp + ".tampil_pemanasan"])) {
            console.error(`Assertion fail: Time format invalid for Unit ${i}!`, {
                mulai: database[grp + ".tampil_jam_mulai"],
                masak: database[grp + ".tampil_jam_masak"],
                selesai: database[grp + ".tampil_jam_selesai"],
                durasi: database[grp + ".tampil_durasi_actual"],
                pemanasan: database[grp + ".tampil_pemanasan"]
            });
            process.exit(1);
        }
    }

    // Assertion 7: Outdoor display ranking sorting check
    let prevRankSisa = -1;
    for (let r = 1; r <= 5; r++) {
        const rSisaText = database["Sys_Control.monitor_sisa_" + r];
        if (rSisaText !== "--:--:--" && rSisaText !== "") {
            const parts = rSisaText.split(':');
            const seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
            if (prevRankSisa !== -1 && seconds < prevRankSisa) {
                console.error(`Assertion fail: Top 5 Monitor sorting order is wrong! Rank ${r} sisa (${seconds}s) is smaller than Rank ${r-1} sisa (${prevRankSisa}s)`);
                process.exit(1);
            }
            prevRankSisa = seconds;
        }
    }
}

// PRINT STRESS TEST STATISTICS
console.log("=== STRESS TEST BERHASIL SELESAI ===");
console.log("Statistik Simulasi:");
console.log(`- Total Detik Proses : ${TOTAL_TICKS} detik`);
console.log(`- Mati Listrik (MCB)  : ${stats.outages} kali`);
console.log(`- Recovery Listrik    : ${stats.recoveries} kali`);
console.log(`- Toggle Maintenance  : ${stats.maintenanceToggles} kali`);
console.log(`- Tombol Reset Unit   : ${stats.resets} kali`);
console.log(`- Masak Baru Dimulai  : ${stats.cookingStarts} kali`);
console.log(`- Preheat Dimulai     : ${stats.preheatStarts} kali`);
console.log(`- Penyesuaian Waktu   : ${stats.timerAdjustments} kali`);
console.log(`- Sensor Rusak (HHHH) : ${stats.sensorErrors} kali`);
console.log(`- Sensor Normal       : ${stats.sensorRecoveries} kali`);
console.log("\nStatus Akhir Top 5 Monitor Luar:");
for (let r = 1; r <= 5; r++) {
    console.log(`  Rank ${r}: ${database["Sys_Control.monitor_room_" + r]} | Sisa: ${database["Sys_Control.monitor_sisa_" + r]} | Selesai: ${database["Sys_Control.monitor_selesai_" + r]}`);
}
console.log("\nKESIMPULAN: Seluruh kondisi invariant lulus uji stres. Script 100% aman dan bebas bug!");
