const fs = require('fs');
const path = require('path');

// Mock database containing all registered tag paths
const database = {};

// Register all 30 units
for (let i = 1; i <= 30; i++) {
    const dev = "sb" + i;
    const grp = "sb_" + i;
    
    // Inactive unit
    if (i === 1) {
        database[grp + ".is_active"] = false;
    } else {
        database[grp + ".is_active"] = true;
    }

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
}

// Global SCADA System Variables
global.$Hour = 10;
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
    get txt_status_sensor_error() { return database["Sys_Control.txt_status_sensor_error"]; },
    
    get monitor_room_1() { return database["Sys_Control.monitor_room_1"]; },
    set monitor_room_1(v) { database["Sys_Control.monitor_room_1"] = v; },
    get monitor_sisa_1() { return database["Sys_Control.monitor_sisa_1"]; },
    set monitor_sisa_1(v) { database["Sys_Control.monitor_sisa_1"] = v; },
    get monitor_selesai_1() { return database["Sys_Control.monitor_selesai_1"]; },
    set monitor_selesai_1(v) { database["Sys_Control.monitor_selesai_1"] = v; },

    get monitor_room_2() { return database["Sys_Control.monitor_room_2"]; },
    set monitor_room_2(v) { database["Sys_Control.monitor_room_2"] = v; },
    get monitor_sisa_2() { return database["Sys_Control.monitor_sisa_2"]; },
    set monitor_sisa_2(v) { database["Sys_Control.monitor_sisa_2"] = v; },
    get monitor_selesai_2() { return database["Sys_Control.monitor_selesai_2"]; },
    set monitor_selesai_2(v) { database["Sys_Control.monitor_selesai_2"] = v; },

    get monitor_room_3() { return database["Sys_Control.monitor_room_3"]; },
    set monitor_room_3(v) { database["Sys_Control.monitor_room_3"] = v; },
    get monitor_sisa_3() { return database["Sys_Control.monitor_sisa_3"]; },
    set monitor_sisa_3(v) { database["Sys_Control.monitor_sisa_3"] = v; },
    get monitor_selesai_3() { return database["Sys_Control.monitor_selesai_3"]; },
    set monitor_selesai_3(v) { database["Sys_Control.monitor_selesai_3"] = v; },

    get monitor_room_4() { return database["Sys_Control.monitor_room_4"]; },
    set monitor_room_4(v) { database["Sys_Control.monitor_room_4"] = v; },
    get monitor_sisa_4() { return database["Sys_Control.monitor_sisa_4"]; },
    set monitor_sisa_4(v) { database["Sys_Control.monitor_sisa_4"] = v; },
    get monitor_selesai_4() { return database["Sys_Control.monitor_selesai_4"]; },
    set monitor_selesai_4(v) { database["Sys_Control.monitor_selesai_4"] = v; },

    get monitor_room_5() { return database["Sys_Control.monitor_room_5"]; },
    set monitor_room_5(v) { database["Sys_Control.monitor_room_5"] = v; },
    get monitor_sisa_5() { return database["Sys_Control.monitor_sisa_5"]; },
    set monitor_sisa_5(v) { database["Sys_Control.monitor_sisa_5"] = v; },
    get monitor_selesai_5() { return database["Sys_Control.monitor_selesai_5"]; },
    set monitor_selesai_5(v) { database["Sys_Control.monitor_selesai_5"] = v; }
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

// SETUP TESTING CONFIGURATIONS
console.log("=== MEMULAI SIMULASI KASUS UJI COBA 30 UNIT STEAMBOX ===");

// 1. Unit 1: Inactive (Bypass checking)
// Expected: _commOperation = false, status_banner = txtDisabled

// 2. Unit 2: Pre-heat Mode (running, starts at 98.0C, goes to 100.5C)
database["sb2.runStop"] = false;
database["sb_2.target_menit"] = 0;
database["sb2.temp"] = 980;

// 3. Unit 3: Cooking Mode (running, temperature 95.0C -> not boiling yet)
database["sb3.runStop"] = false;
database["sb_3.target_menit"] = 10; // 10 minutes
database["sb3.temp"] = 950;

// 4. Unit 4: Cooking Mode (running, boiling at 100.2C)
database["sb4.runStop"] = false;
database["sb_4.target_menit"] = 5;  // 5 minutes
database["sb4.temp"] = 1002;

// 5. Unit 5: Cooking Mode (MCB Trip / Offline)
database["sb5.runStop"] = false;
database["sb_5.target_menit"] = 8;
database["sb5.temp"] = 1005;
database["sb_5.flag_init_start"] = 1;
database["sb_5.sisa_detik_masak"] = 400;
database["sb5._commStatus"] = false; // MCB Trip!

// 6. Unit 6: Sensor Error (HHHH / raw >= 30000)
database["sb6.runStop"] = false;
database["sb_6.target_menit"] = 12;
database["sb_6.sisa_detik_masak"] = 720;
database["sb6.temp"] = 32767; // Error sensor open-loop

// 7. Unit 7: Reset / Kosongkan Tangki
database["sb7.runStop"] = true; // Stopped
database["sb_7.status_kosong"] = true; // Pressed reset button
database["sb_7.sisa_detik_masak"] = 0;
database["sb_7.status_selesai"] = true;

// 8. Setup other units for outdoor monitor top 5 sorting
// Set them in cooking mode (boiling) with different sisa_detik_masak to verify sort order:
// Unit 10: sisa 30 detik
database["sb10.runStop"] = false; database["sb_10.target_menit"] = 1; database["sb10.temp"] = 1002;
database["sb_10.sisa_detik_masak"] = 30; database["sb_10.flag_init_start"] = 1; database["sb_10.flag_init_masak"] = 1;
// Unit 11: sisa 15 detik (should be rank 2 since unit 15 has 10s)
database["sb11.runStop"] = false; database["sb_11.target_menit"] = 1; database["sb11.temp"] = 1002;
database["sb_11.sisa_detik_masak"] = 15; database["sb_11.flag_init_start"] = 1; database["sb_11.flag_init_masak"] = 1;
// Unit 12: sisa 45 detik
database["sb12.runStop"] = false; database["sb_12.target_menit"] = 1; database["sb12.temp"] = 1002;
database["sb_12.sisa_detik_masak"] = 45; database["sb_12.flag_init_start"] = 1; database["sb_12.flag_init_masak"] = 1;
// Unit 13: sisa 60 detik
database["sb13.runStop"] = false; database["sb_13.target_menit"] = 1; database["sb13.temp"] = 1002;
database["sb_13.sisa_detik_masak"] = 60; database["sb_13.flag_init_start"] = 1; database["sb_13.flag_init_masak"] = 1;
// Unit 14: sisa 90 detik
database["sb14.runStop"] = false; database["sb_14.target_menit"] = 2; database["sb14.temp"] = 1002;
database["sb_14.sisa_detik_masak"] = 90; database["sb_14.flag_init_start"] = 1; database["sb_14.flag_init_masak"] = 1;
// Unit 15: sisa 10 detik (should be rank 1)
database["sb15.runStop"] = false; database["sb_15.target_menit"] = 1; database["sb15.temp"] = 1002;
database["sb_15.sisa_detik_masak"] = 10; database["sb_15.flag_init_start"] = 1; database["sb_15.flag_init_masak"] = 1;

// DETIK 1
console.log("\n--- DETIK 1: KONDISI AWAL JALAN ---");
tickClock();
runMasterScript();

// Print results
console.log(`Unit 1 (Inactive) -> _commOperation: ${database["sb1._commOperation"]}, Banner: ${database["sb_1.status_banner"]}`);
console.log(`Unit 2 (Preheat) -> Banner: ${database["sb_2.status_banner"]}, Pemanasan: ${database["sb_2.tampil_pemanasan"]}, runStop: ${database["sb2.runStop"]}`);
console.log(`Unit 3 (Cooking, <100C) -> Banner: ${database["sb_3.status_banner"]}, Sisa: ${database["sb_3.tampil_durasi_actual"]}, Pemanasan: ${database["sb_3.tampil_pemanasan"]}`);
console.log(`Unit 4 (Cooking, >100C) -> Banner: ${database["sb_4.status_banner"]}, Sisa: ${database["sb_4.tampil_durasi_actual"]}, Jam Masak: ${database["sb_4.tampil_jam_masak"]}, Est Selesai: ${database["sb_4.tampil_jam_selesai"]}`);
console.log(`Unit 5 (Offline MCB Trip) -> Banner: ${database["sb_5.status_banner"]}, Sisa Layar (Harus Beku): ${database["sb_5.sisa_detik_masak"]} detik`);
console.log(`Unit 6 (Sensor Error) -> Banner: ${database["sb_6.status_banner"]}, runStop (Harus Tetap False/RUN): ${database["sb6.runStop"]}`);
console.log(`Unit 7 (Reset) -> status_selesai: ${database["sb_7.status_selesai"]}, status_kosong: ${database["sb_7.status_kosong"]}, Banner: ${database["sb_7.status_banner"]}`);

console.log("\nTop 5 Outdoor Display:");
for (let r = 1; r <= 5; r++) {
    console.log(`  Rank ${r}: ${$Sys_Control["monitor_room_" + r]} - Sisa Waktu: ${$Sys_Control["monitor_sisa_" + r]} - Estimasi: ${$Sys_Control["monitor_selesai_" + r]}`);
}

// DETIK 2 (Transition verification)
console.log("\n--- DETIK 2: TRANSISI KONDISI (SUHU NAIK / TIMER BERKURANG) ---");
// Unit 2 Temp exceeds 100C (preheat completes)
database["sb2.temp"] = 1005;
// Unit 3 Temp reaches 100C (boiling starts)
database["sb3.temp"] = 1000;
// Unit 4 continues cooking
// Unit 5 stays offline
// Unit 6 stays sensor error
// Unit 7 has been reset, now starts a new task (target_menit = 3)
database["sb7.runStop"] = false;
database["sb_7.target_menit"] = 3;
database["sb7.temp"] = 990;

tickClock();
runMasterScript();

console.log(`Unit 2 (Preheat selesai) -> Banner: ${database["sb_2.status_banner"]}, runStop (Harus True/STOP): ${database["sb2.runStop"]}, Selesai: ${database["sb_2.status_selesai"]}, Suhu Akhir: ${database["sb_2.suhu_akhir"]/10}C`);
console.log(`Unit 3 (Cooking, Baru Mendidih) -> Banner: ${database["sb_3.status_banner"]}, Sisa: ${database["sb_3.tampil_durasi_actual"]}, Jam Masak: ${database["sb_3.tampil_jam_masak"]}, Est Selesai: ${database["sb_3.tampil_jam_selesai"]}`);
console.log(`Unit 4 (Cooking, Lanjut) -> Sisa: ${database["sb_4.tampil_durasi_actual"]}`);
console.log(`Unit 7 (Task Baru setelah Reset) -> Banner: ${database["sb_7.status_banner"]}, Jam Mulai: ${database["sb_7.tampil_jam_mulai"]}`);

console.log("\nTop 5 Outdoor Display (Sorting order should update):");
for (let r = 1; r <= 5; r++) {
    console.log(`  Rank ${r}: ${$Sys_Control["monitor_room_" + r]} - Sisa Waktu: ${$Sys_Control["monitor_sisa_" + r]} - Estimasi: ${$Sys_Control["monitor_selesai_" + r]}`);
}
