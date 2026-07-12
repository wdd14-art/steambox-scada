// Simulation of the Master Loop SCADA script with Offline / Recovery Handling

// 1. Mock SCADA Global Tags for time
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

// Mock HMI / SCADA database containing registered tags for Unit 29 and 30
var SCADA_Database = {
    // UNIT 29 - Disconnected by user (commOperation = false)
    "SB29._commOperation": false, // Operator manually turned off communication
    "SB29._commStatus": true,
    "SB29.runStop": false,
    "SB29.temp": 950,
    "SB_29.isActive": false,
    "SB_29.maintenanceMode": 0,
    "SB_29.mode_preHeat": false,
    "SB_29.targetMenit": 5,
    "SB_29.adjustMenit": 0,
    "SB_29.sisaDetikMasak": 300,
    "SB_29.totalDetikPemanasan": 0,
    "SB_29.flagInitStart": 0,
    "SB_29.flagInitMasak": 0,
    "SB_29.statusKosong": false,
    "SB_29.statusPemanasan": true, // Started in true state
    "SB_29.statusPemasakan": false,
    "SB_29.statusSelesai": false,
    "SB_29.tampilJamMulai": "00:00:00",
    "SB_29.tampilJamMasak": "00:00:00",
    "SB_29.tampilJamSelesai": "00:00:00",
    "SB_29.tampilDurasiAktual": "00:05:00",
    "SB_29.tampilPemanasan": "00:00:00",
    "SB_29.statusBanner": "",

    // UNIT 30 - Running but will experience MCB Trip (commStatus goes false)
    "SB30._commOperation": true,
    "SB30._commStatus": true,
    "SB30.runStop": false,       // false = RUNNING
    "SB30.temp": 1002,          // 100.2 °C (boiling)
    "SB_30.isActive": true,
    "SB_30.maintenanceMode": 0,
    "SB_30.mode_preHeat": false, // COOKING MODE
    "SB_30.targetMenit": 2,      // 2 minutes target
    "SB_30.adjustMenit": 0,
    "SB_30.sisaDetikMasak": 90,  // 90 seconds remaining (00:01:30)
    "SB_30.totalDetikPemanasan": 15,
    "SB_30.flagInitStart": 1,
    "SB_30.flagInitMasak": 1,
    "SB_30.statusKosong": false,
    "SB_30.statusPemanasan": false,
    "SB_30.statusPemasakan": true,
    "SB_30.statusSelesai": false,
    "SB_30.tampilJamMulai": "11:46:00",
    "SB_30.tampilJamMasak": "11:46:15",
    "SB_30.tampilJamSelesai": "11:47:30",
    "SB_30.tampilDurasiAktual": "00:01:30",
    "SB_30.tampilPemanasan": "00:00:15",
    "SB_30.statusBanner": ""
};

// Pre-populate mock database for all 30 units to prevent runtime key errors in loop
for (var u = 1; u <= 30; u++) {
    var dev = "SB" + u;
    var grp = "SB_" + u;
    if (!SCADA_Database.hasOwnProperty(dev + "._commOperation")) {
        SCADA_Database[dev + "._commOperation"] = false; // default disabled
        SCADA_Database[dev + "._commStatus"] = true;
        SCADA_Database[dev + ".runStop"] = true; // true = stopped/standby
        SCADA_Database[dev + ".temp"] = 250;     // default ambient temp 25.0 C
        SCADA_Database[grp + ".isActive"] = false;
        SCADA_Database[grp + ".maintenanceMode"] = 0;
        SCADA_Database[grp + ".mode_preHeat"] = false;
        SCADA_Database[grp + ".targetMenit"] = 0;
        SCADA_Database[grp + ".adjustMenit"] = 0;
        SCADA_Database[grp + ".sisaDetikMasak"] = 0;
        SCADA_Database[grp + ".totalDetikPemanasan"] = 0;
        SCADA_Database[grp + ".flagInitStart"] = 0;
        SCADA_Database[grp + ".flagInitMasak"] = 0;
        SCADA_Database[grp + ".statusKosong"] = false;
        SCADA_Database[grp + ".statusPemanasan"] = false;
        SCADA_Database[grp + ".statusPemasakan"] = false;
        SCADA_Database[grp + ".statusSelesai"] = false;
        SCADA_Database[grp + ".tampilJamMulai"] = "00:00:00";
        SCADA_Database[grp + ".tampilJamMasak"] = "00:00:00";
        SCADA_Database[grp + ".tampilJamSelesai"] = "00:00:00";
        SCADA_Database[grp + ".tampilDurasiAktual"] = "00:00:00";
        SCADA_Database[grp + ".tampilPemanasan"] = "00:00:00";
        SCADA_Database[grp + ".statusBanner"] = "";
    }
}

// Add threshold limit and text templates to mock database
SCADA_Database["Sys_Control.temp_error_limit"] = 30000;
SCADA_Database["Sys_Control.txt_kosong"] = "TANGKI KOSONG - SIAP MEMULAI";
SCADA_Database["Sys_Control.txt_preheat"] = "SEDANG PRE-HEAT (PEMANASAN)";
SCADA_Database["Sys_Control.txt_pemanasan"] = "MENUNGGU MENDIDIH (< 100 C)";
SCADA_Database["Sys_Control.txt_pemasakan"] = "SEDANG MEMASAK (MENDIDIH)";
SCADA_Database["Sys_Control.txt_selesai"] = "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
SCADA_Database["Sys_Control.txt_maintenance"] = "MODE MAINTENANCE (KONTROL MANUAL)";
SCADA_Database["Sys_Control.txt_offline"] = "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
SCADA_Database["Sys_Control.txt_disabled"] = "KOMUNIKASI UNIT DINONAKTIFKAN";
SCADA_Database["Sys_Control.txt_sensor_error"] = "ERROR SENSOR (OPENLOOP/HHHH)";

// SCADA Native APIs mock-up
function ReadTag(tagName) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        return SCADA_Database[tagName];
    }
    throw new Error("SCADA RUNTIME EXCEPTION: Tag '" + tagName + "' is not registered in the database!");
}

function WriteTag(tagName, value) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        SCADA_Database[tagName] = value;
        return;
    }
    throw new Error("SCADA RUNTIME EXCEPTION: Cannot write to unregistered tag '" + tagName + "'!");
}

// Clock tick helper
function tickClock() {
    $Second++;
    if ($Second >= 60) {
        $Second = 0;
        $Minute++;
        if ($Minute >= 60) {
            $Minute = 0;
            $Hour = ($Hour + 1) % 24;
        }
    }
}

// Master loop script with dynamic tag access and offline handling
function runMasterLoopScript() {
    var waktuSekarangString = ("0" + ($Hour || 0)).slice(-2) + ":" + ("0" + ($Minute || 0)).slice(-2) + ":" + ("0" + ($Second || 0)).slice(-2);
    var totalDetikSekarang = (($Hour || 0) * 3600) + (($Minute || 0) * 60) + ($Second || 0);

    var txtKosong = ReadTag("Sys_Control.txt_kosong") || "TANGKI KOSONG - SIAP MEMULAI";
    var txtPreheat = ReadTag("Sys_Control.txt_preheat") || "SEDANG PRE-HEAT (PEMANASAN)";
    var txtPemanasan = ReadTag("Sys_Control.txt_pemanasan") || "MENUNGGU MENDIDIH (< 100 C)";
    var txtPemasakan = ReadTag("Sys_Control.txt_pemasakan") || "SEDANG MEMASAK (MENDIDIH)";
    var txtSelesai = ReadTag("Sys_Control.txt_selesai") || "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
    var txtMaintenance = ReadTag("Sys_Control.txt_maintenance") || "MODE MAINTENANCE (KONTROL MANUAL)";
    var txtOffline = ReadTag("Sys_Control.txt_offline") || "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
    var txtDisabled = ReadTag("Sys_Control.txt_disabled") || "KOMUNIKASI UNIT DINONAKTIFKAN";
    var txtSensorError = ReadTag("Sys_Control.txt_sensor_error") || "ERROR SENSOR (OPENLOOP/HHHH)";

    for (var i = 1; i <= 30; i++) { // Loop dinamis untuk 30 unit
        var deviceName = "SB" + i;
        var hmiGroupName = "SB_" + i;

        // 1. Baca status aktif unit dari group tag active_unit
        var isUnitActive = ReadTag(hmiGroupName + ".isActive") || false;

        // 2. Sinkronisasi otomatis polling Modbus (_commOperation) ke device
        var currentCommOp = ReadTag(deviceName + "._commOperation");
        if (isUnitActive && currentCommOp !== true) {
            WriteTag(deviceName + "._commOperation", true);
        } else if (!isUnitActive && currentCommOp !== false) {
            WriteTag(deviceName + "._commOperation", false);
        }

        // 3. Lewati pemrosesan jika unit tidak aktif (menghemat beban CPU dan mencegah timeout)
        if (!isUnitActive) {
            WriteTag(hmiGroupName + ".statusBanner", txtDisabled);
            WriteTag(hmiGroupName + ".statusPemanasan", false);
            WriteTag(hmiGroupName + ".statusPemasakan", false);
            WriteTag(hmiGroupName + ".statusSelesai", false);
            continue;
        }

        // Cek Keaktifan Polling dari HMI
        var commOperation = ReadTag(deviceName + "._commOperation");
        
        if (commOperation === true) {
            
            // Cek Status Hubungan Fisik Modbus
            var commStatus = ReadTag(deviceName + "._commStatus");
            var statusText = "";
            var isSensorError = false;
            
            // --- KONDISI ONLINE (KONEKSI NORMAL) ---
            if (commStatus === true) {
                var maintenance_aktif = ReadTag(hmiGroupName + ".maintenanceMode") || 0;
                var Run_status = ReadTag(deviceName + ".runStop"); 
                var raw_pv = ReadTag(deviceName + ".temp") || 0;

                // Proteksi Sensor Error (Openloop / HHHH) jika temp >= 30000 (atau sesuai nilai di tag temp_error_limit)
                var tempErrorLimit = ReadTag("Sys_Control.temp_error_limit") || 30000;
                isSensorError = (raw_pv >= tempErrorLimit);

                var modePreHeat = ReadTag(hmiGroupName + ".mode_preHeat") || false;
                var target = ReadTag(hmiGroupName + ".targetMenit") || 0;
                var adjust = ReadTag(hmiGroupName + ".adjustMenit") || 0;
                var sisa = ReadTag(hmiGroupName + ".sisaDetikMasak") || 0;
                var pemanasan = ReadTag(hmiGroupName + ".totalDetikPemanasan") || 0;
                var fStart = ReadTag(hmiGroupName + ".flagInitStart") || 0;
                var fMasak = ReadTag(hmiGroupName + ".flagInitMasak") || 0;

                var bit_kosong = ReadTag(hmiGroupName + ".statusKosong") || false;
                var bit_pemanasan = ReadTag(hmiGroupName + ".statusPemanasan") || false;
                var bit_pemasakan = ReadTag(hmiGroupName + ".statusPemasakan") || false;
                var bit_selesai = ReadTag(hmiGroupName + ".statusSelesai") || false;

                var hPre = 0; var mPre = 0; var sPre = 0;
                var hAct = 0; var mAct = 0; var sAct = 0;
                var est = 0; var hEst = 0; var mEst = 0; var sEst = 0;

                if (maintenance_aktif !== 1) {
                    
                    if (Run_status === true) {
                        bit_pemanasan = false;
                        bit_pemasakan = false;
                        fStart = 0;

                        if (bit_kosong === true) {
                            bit_selesai = false;
                            fStart = 0;
                            fMasak = 0;
                            pemanasan = 0;
                            sisa = 0;
                            WriteTag(hmiGroupName + ".targetMenit", 0);
                            WriteTag(hmiGroupName + ".adjustMenit", 0);

                            WriteTag(hmiGroupName + ".tampilJamMulai", "00:00:00");
                            WriteTag(hmiGroupName + ".tampilJamMasak", "00:00:00");
                            WriteTag(hmiGroupName + ".tampilJamSelesai", "00:00:00");
                            WriteTag(hmiGroupName + ".tampilDurasiAktual", "00:00:00");
                            WriteTag(hmiGroupName + ".tampilPemanasan", "00:00:00");
                            statusText = txtKosong;
                        } else if (bit_selesai === true) {
                            statusText = txtSelesai;
                        } else {
                            statusText = "MESIN BERHENTI (PAUSED)";
                        }
                    } 
                    else if (Run_status === false) {
                        bit_kosong = false;
                        bit_selesai = false;

                        // MODE PRE-HEAT
                        if (modePreHeat === true) {
                            bit_pemanasan = true;
                            bit_pemasakan = false;
                            statusText = txtPreheat;

                            if (fStart === 0) {
                                WriteTag(hmiGroupName + ".tampilJamMulai", waktuSekarangString);
                                WriteTag(hmiGroupName + ".tampilJamMasak", "--:--:--");
                                WriteTag(hmiGroupName + ".tampilJamSelesai", "--:--:--");
                                WriteTag(hmiGroupName + ".tampilDurasiAktual", "--:--:--");
                                fStart = 1;
                                pemanasan = 0;
                            }

                            pemanasan = pemanasan + 1;
                            hPre = Math.floor(pemanasan / 3600);
                            mPre = Math.floor((pemanasan % 3600) / 60);
                            sPre = pemanasan % 60;
                            WriteTag(hmiGroupName + ".tampilPemanasan", ("0" + hPre).slice(-2) + ":" + ("0" + mPre).slice(-2) + ":" + ("0" + sPre).slice(-2));

                            if (raw_pv > 1000) {
                                Run_status = true; 
                                bit_selesai = true;
                                bit_pemanasan = false;
                                WriteTag(hmiGroupName + ".mode_preHeat", false);
                                fStart = 0;
                            }
                        } 
                        // MODE MEMASAK RESEP
                        else {
                            if (fStart === 0) {
                                WriteTag(hmiGroupName + ".tampilJamMulai", waktuSekarangString);
                                WriteTag(hmiGroupName + ".tampilJamMasak", "--:--:--");
                                WriteTag(hmiGroupName + ".tampilJamSelesai", "--:--:--");
                                fStart = 1;
                                sisa = target * 60;
                                pemanasan = 0;
                                fMasak = 0;
                            }

                            if (adjust !== 0) {
                                sisa = sisa + (adjust * 60);
                                if (sisa < 0) {
                                    sisa = 0;
                                }
                                adjust = 0;
                                WriteTag(hmiGroupName + ".adjustMenit", 0);
                            }

                            if (raw_pv < 1000) {
                                bit_pemanasan = true;
                                bit_pemasakan = false;
                                pemanasan = pemanasan + 1;
                                statusText = txtPemanasan;

                                hPre = Math.floor(pemanasan / 3600);
                                mPre = Math.floor((pemanasan % 3600) / 60);
                                sPre = pemanasan % 60;
                                WriteTag(hmiGroupName + ".tampilPemanasan", ("0" + hPre).slice(-2) + ":" + ("0" + mPre).slice(-2) + ":" + ("0" + sPre).slice(-2));

                                hAct = Math.floor(sisa / 3600);
                                mAct = Math.floor((sisa % 3600) / 60);
                                sAct = sisa % 60;
                                WriteTag(hmiGroupName + ".tampilDurasiAktual", ("0" + hAct).slice(-2) + ":" + ("0" + mAct).slice(-2) + ":" + ("0" + sAct).slice(-2));

                                est = (totalDetikSekarang + sisa) % 86400;
                                hEst = Math.floor(est / 3600);
                                mEst = Math.floor((est % 3600) / 60);
                                sEst = est % 60;
                                WriteTag(hmiGroupName + ".tampilJamSelesai", ("0" + hEst).slice(-2) + ":" + ("0" + mEst).slice(-2) + ":" + ("0" + sEst).slice(-2));
                            }
                            else if (raw_pv >= 1000) {
                                bit_pemanasan = false;
                                bit_pemasakan = true;
                                statusText = txtPemasakan;

                                if (fMasak === 0) {
                                    WriteTag(hmiGroupName + ".tampilJamMasak", waktuSekarangString);
                                    fMasak = 1;
                                }

                                if (sisa > 0) {
                                    sisa = sisa - 1;
                                }

                                if (sisa <= 0) {
                                    sisa = 0;
                                    Run_status = true; 
                                    bit_pemasakan = false;
                                    bit_selesai = true;
                                    fStart = 0;
                                    fMasak = 0;
                                }

                                hAct = Math.floor(sisa / 3600);
                                mAct = Math.floor((sisa % 3600) / 60);
                                sAct = sisa % 60;
                                WriteTag(hmiGroupName + ".tampilDurasiAktual", ("0" + hAct).slice(-2) + ":" + ("0" + mAct).slice(-2) + ":" + ("0" + sAct).slice(-2));

                                est = (totalDetikSekarang + sisa) % 86400;
                                hEst = Math.floor(est / 3600);
                                mEst = Math.floor((est % 3600) / 60);
                                sEst = est % 60;
                                WriteTag(hmiGroupName + ".tampilJamSelesai", ("0" + hEst).slice(-2) + ":" + ("0" + mEst).slice(-2) + ":" + ("0" + sEst).slice(-2));
                            }
                        }
                    }
                } else {
                    statusText = txtMaintenance;
                }

                // Write Back
                WriteTag(deviceName + ".runStop", Run_status);
                WriteTag(hmiGroupName + ".statusKosong", bit_kosong);
                WriteTag(hmiGroupName + ".statusPemanasan", bit_pemanasan);
                WriteTag(hmiGroupName + ".statusPemasakan", bit_pemasakan);
                WriteTag(hmiGroupName + ".statusSelesai", bit_selesai);
                WriteTag(hmiGroupName + ".sisaDetikMasak", sisa);
                WriteTag(hmiGroupName + ".totalDetikPemanasan", pemanasan);
                WriteTag(hmiGroupName + ".flagInitStart", fStart);
                WriteTag(hmiGroupName + ".flagInitMasak", fMasak);
            }
            // --- KONDISI OFFLINE (GANGGUAN KOMUNIKASI / MCB TRIP) ---
            else {
                statusText = txtOffline;
                // Matikan indikator status visual segera di layar
                WriteTag(hmiGroupName + ".statusPemanasan", false);
                WriteTag(hmiGroupName + ".statusPemasakan", false);
            }

            // Jika terjadi error sensor, override status banner saja (tidak ada interupsi/shutdown proses)
            if (isSensorError) {
                statusText = txtSensorError;
            }

            // Tulis Banner Status ke HMI
            WriteTag(hmiGroupName + ".statusBanner", statusText);
        } 
        // --- KONDISI KOMUNIKASI DI-DISABLE MANUAL OLEH OPERATOR ---
        else {
            WriteTag(hmiGroupName + ".statusPemanasan", false);
            WriteTag(hmiGroupName + ".statusPemasakan", false);
            WriteTag(hmiGroupName + ".statusSelesai", false);
            WriteTag(hmiGroupName + ".statusBanner", txtDisabled);
        }
    }
}

// SIMULASI UJI COBA REAL-TIME OFFLINE & RECOVERY
console.log("=== SIMULASI UJI COBA DETEKSI OFFLINE & RECOVERY ===");

// 1. Detik 1: Semua berjalan normal
tickClock();
runMasterLoopScript();
console.log("\nDetik 1 (Koneksi Normal) -> Unit 30 Temp: " + ReadTag("SB30.temp")/10 + "C, State Masak: " + ReadTag("SB_30.statusPemasakan") + 
    ", Sisa Masak: " + ReadTag("SB_30.tampilDurasiAktual")
);

// 2. Detik 2: MCB Trip! (commStatus = false)
console.log("\n--- DETIK 2: GANGGUAN TERJADI! MCB TRIP / ALAT MATI ---");
SCADA_Database["SB30._commStatus"] = false;
tickClock();
runMasterLoopScript();
console.log("Detik 2 (Offline) -> Unit 30 CommStatus: " + ReadTag("SB30._commStatus") + 
    ", State Masak (Harus Off): " + ReadTag("SB_30.statusPemasakan") +
    ", Sisa Masak di Layar (Harus Tetap/Pause): " + ReadTag("SB_30.tampilDurasiAktual")
);

// 3. Detik 3: Masih dalam kondisi offline (Operator memindahkan produk)
tickClock();
runMasterLoopScript();
console.log("Detik 3 (Offline) -> Sisa Masak di Layar (Tetap Terjaga): " + ReadTag("SB_30.tampilDurasiAktual"));

// 4. Detik 4: Listrik Menyala / Perbaikan Selesai (commStatus = true)
console.log("\n--- DETIK 4: KONEKSI DILANJUTKAN (RECOVERY) ---");
SCADA_Database["SB30._commStatus"] = true;
tickClock();
runMasterLoopScript();
console.log("Detik 4 (Recovery) -> Unit 30 CommStatus: " + ReadTag("SB30._commStatus") + 
    ", State Masak (Harus Hidup Lagi): " + ReadTag("SB_30.statusPemasakan") +
    ", Sisa Masak (Harus Berkurang 1 detik dr 89s): " + ReadTag("SB_30.tampilDurasiAktual")
);

// 5. Menguji Unit 29 yang dinonaktifkan
console.log("\n--- PENGUJIAN UNIT 29 (NONAKTIF) ---");
console.log("Unit 29 isActive: " + ReadTag("SB_29.isActive") +
    "\n  _commOperation (Harus otomatis False): " + ReadTag("SB29._commOperation") +
    "\n  statusBanner (Harus COMM DISABLED): " + ReadTag("SB_29.statusBanner")
);

// 6. Menguji Sensor Error (temp >= 30000) pada Unit 30
console.log("\n--- DETIK 5: DETEKSI SENSOR ERROR (OPENLOOP / HHHH) PADA UNIT 30 ---");
SCADA_Database["SB30.temp"] = 32767; // set temp to error range
tickClock();
runMasterLoopScript();
console.log("Detik 5 (Sensor Error) -> Unit 30 Temp: " + ReadTag("SB30.temp") +
    "\n  runStop (Harus tetap False/RUN - Tidak boleh mati!): " + ReadTag("SB30.runStop") +
    "\n  statusPemasakan (Harus tetap True): " + ReadTag("SB_30.statusPemasakan") +
    "\n  statusBanner (Harus ERROR SENSOR): " + ReadTag("SB_30.statusBanner")
);
