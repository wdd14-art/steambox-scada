// Simulation of the Master Loop SCADA script with Offline / Recovery Handling

// 1. Mock SCADA Global Tags for time
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

// Mock HMI / SCADA database containing registered tags for Unit 29 and 30
var SCADA_Database = {
    // Sys Control
    "Sys_Control.maintenanceMode29": 0,
    "Sys_Control.maintenanceMode30": 0,

    // UNIT 29 - Disconnected by user (commOperation = false)
    "SB29._commOperation": false, // Operator manually turned off communication
    "SB29._commStatus": true,
    "SB29.runStop": false,
    "SB29.temp": 950,
    "SB_29.mode_preHeat": false,
    "SB_29.targetMenit": 5,
    "SB_29.sisaDetikMasak": 300,
    "SB_29.statusPemanasan": true, // Started in true state
    "SB_29.statusPemasakan": false,
    "SB_29.statusSelesai": false,

    // UNIT 30 - Running but will experience MCB Trip (commStatus goes false)
    "SB30._commOperation": true,
    "SB30._commStatus": true,
    "SB30.runStop": false,       // false = RUNNING
    "SB30.temp": 1002,          // 100.2 °C (boiling)
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
    "SB_30.tampilJamsSelesai": "11:47:30",
    "SB_30.tampilDurasiAktual": "00:01:30",
    "SB_30.tampilPemanasan": "00:00:15"
};

// SCADA Native APIs mock-up
function GetTagValue(tagName) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        return SCADA_Database[tagName];
    }
    throw new Error("SCADA RUNTIME EXCEPTION: Tag '" + tagName + "' is not registered in the database!");
}

function SetTagValue(tagName, value) {
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

    var activeUnits = [29, 30]; 

    for (var k = 0; k < activeUnits.length; k++) {
        var i = activeUnits[k];

        var deviceName = "SB" + i;
        var hmiGroupName = "SB_" + i;

        // Cek Keaktifan Polling dari HMI
        var commOperation = GetTagValue(deviceName + "._commOperation");
        
        if (commOperation === true) {
            
            // Cek Status Hubungan Fisik Modbus
            var commStatus = GetTagValue(deviceName + "._commStatus");
            
            // --- KONDISI ONLINE (KONEKSI NORMAL) ---
            if (commStatus === true) {
                var maintenance_aktif = GetTagValue("Sys_Control.maintenanceMode" + i) || 0;
                var Run_status = GetTagValue(deviceName + ".runStop"); 
                var raw_pv = GetTagValue(deviceName + ".temp") || 0;

                var modePreHeat = GetTagValue(hmiGroupName + ".mode_preHeat") || false;
                var target = GetTagValue(hmiGroupName + ".targetMenit") || 0;
                var adjust = GetTagValue(hmiGroupName + ".adjustMenit") || 0;
                var sisa = GetTagValue(hmiGroupName + ".sisaDetikMasak") || 0;
                var pemanasan = GetTagValue(hmiGroupName + ".totalDetikPemanasan") || 0;
                var fStart = GetTagValue(hmiGroupName + ".flagInitStart") || 0;
                var fMasak = GetTagValue(hmiGroupName + ".flagInitMasak") || 0;

                var bit_kosong = GetTagValue(hmiGroupName + ".statusKosong") || false;
                var bit_pemanasan = GetTagValue(hmiGroupName + ".statusPemanasan") || false;
                var bit_pemasakan = GetTagValue(hmiGroupName + ".statusPemasakan") || false;
                var bit_selesai = GetTagValue(hmiGroupName + ".statusSelesai") || false;

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
                            SetTagValue(hmiGroupName + ".targetMenit", 0);
                            SetTagValue(hmiGroupName + ".adjustMenit", 0);

                            SetTagValue(hmiGroupName + ".tampilJamMulai", "00:00:00");
                            SetTagValue(hmiGroupName + ".tampilJamMasak", "00:00:00");
                            SetTagValue(hmiGroupName + ".tampilJamsSelesai", "00:00:00");
                            SetTagValue(hmiGroupName + ".tampilDurasiAktual", "00:00:00");
                            SetTagValue(hmiGroupName + ".tampilPemanasan", "00:00:00");
                        }
                    } 
                    else if (Run_status === false) {
                        bit_kosong = false;
                        bit_selesai = false;

                        // MODE PRE-HEAT
                        if (modePreHeat === true) {
                            bit_pemanasan = true;
                            bit_pemasakan = false;

                            if (fStart === 0) {
                                SetTagValue(hmiGroupName + ".tampilJamMulai", waktuSekarangString);
                                SetTagValue(hmiGroupName + ".tampilJamMasak", "--:--:--");
                                SetTagValue(hmiGroupName + ".tampilJamsSelesai", "--:--:--");
                                SetTagValue(hmiGroupName + ".tampilDurasiAktual", "--:--:--");
                                fStart = 1;
                                pemanasan = 0;
                            }

                            pemanasan = pemanasan + 1;
                            hPre = Math.floor(pemanasan / 3600);
                            mPre = Math.floor((pemanasan % 3600) / 60);
                            sPre = pemanasan % 60;
                            SetTagValue(hmiGroupName + ".tampilPemanasan", ("0" + hPre).slice(-2) + ":" + ("0" + mPre).slice(-2) + ":" + ("0" + sPre).slice(-2));

                            if (raw_pv > 1000) {
                                Run_status = true; 
                                bit_selesai = true;
                                bit_pemanasan = false;
                                SetTagValue(hmiGroupName + ".mode_preHeat", false);
                                fStart = 0;
                            }
                        } 
                        // MODE MEMASAK RESEP
                        else {
                            if (fStart === 0) {
                                SetTagValue(hmiGroupName + ".tampilJamMulai", waktuSekarangString);
                                SetTagValue(hmiGroupName + ".tampilJamMasak", "--:--:--");
                                SetTagValue(hmiGroupName + ".tampilJamsSelesai", "--:--:--");
                                fStart = 1;
                                sisa = target * 60;
                                pemanasan = 0;
                                fMasak = 0;
                            }

                            if (adjust !== 0) {
                                sisa = sisa + (adjust * 60);
                                if (sisa < 0) { sisa = 0; }
                                adjust = 0;
                                SetTagValue(hmiGroupName + ".adjustMenit", 0);
                            }

                            if (raw_pv < 1000) {
                                bit_pemanasan = true;
                                bit_pemasakan = false;
                                pemanasan = pemanasan + 1;

                                hPre = Math.floor(pemanasan / 3600);
                                mPre = Math.floor((pemanasan % 3600) / 60);
                                sPre = pemanasan % 60;
                                SetTagValue(hmiGroupName + ".tampilPemanasan", ("0" + hPre).slice(-2) + ":" + ("0" + mPre).slice(-2) + ":" + ("0" + sPre).slice(-2));

                                hAct = Math.floor(sisa / 3600);
                                mAct = Math.floor((sisa % 3600) / 60);
                                sAct = sisa % 60;
                                SetTagValue(hmiGroupName + ".tampilDurasiAktual", ("0" + hAct).slice(-2) + ":" + ("0" + mAct).slice(-2) + ":" + ("0" + sAct).slice(-2));

                                est = (totalDetikSekarang + sisa) % 86400;
                                hEst = Math.floor(est / 3600);
                                mEst = Math.floor((est % 3600) / 60);
                                sEst = est % 60;
                                SetTagValue(hmiGroupName + ".tampilJamsSelesai", ("0" + hEst).slice(-2) + ":" + ("0" + mEst).slice(-2) + ":" + ("0" + sEst).slice(-2));
                            }
                            else if (raw_pv >= 1000) {
                                bit_pemanasan = false;
                                bit_pemasakan = true;

                                if (fMasak === 0) {
                                    SetTagValue(hmiGroupName + ".tampilJamMasak", waktuSekarangString);
                                    fMasak = 1;
                                }

                                if (sisa > 0) { sisa = sisa - 1; }

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
                                SetTagValue(hmiGroupName + ".tampilDurasiAktual", ("0" + hAct).slice(-2) + ":" + ("0" + mAct).slice(-2) + ":" + ("0" + sAct).slice(-2));

                                est = (totalDetikSekarang + sisa) % 86400;
                                hEst = Math.floor(est / 3600);
                                mEst = Math.floor((est % 3600) / 60);
                                sEst = est % 60;
                                SetTagValue(hmiGroupName + ".tampilJamsSelesai", ("0" + hEst).slice(-2) + ":" + ("0" + mEst).slice(-2) + ":" + ("0" + sEst).slice(-2));
                            }
                        }
                    }

                    // Write Back
                    SetTagValue(deviceName + ".runStop", Run_status);
                    SetTagValue(hmiGroupName + ".statusKosong", bit_kosong);
                    SetTagValue(hmiGroupName + ".statusPemanasan", bit_pemanasan);
                    SetTagValue(hmiGroupName + ".statusPemasakan", bit_pemasakan);
                    SetTagValue(hmiGroupName + ".statusSelesai", bit_selesai);
                    SetTagValue(hmiGroupName + ".sisaDetikMasak", sisa);
                    SetTagValue(hmiGroupName + ".totalDetikPemanasan", pemanasan);
                    SetTagValue(hmiGroupName + ".flagInitStart", fStart);
                    SetTagValue(hmiGroupName + ".flagInitMasak", fMasak);
                }
            }
            // --- KONDISI OFFLINE (GANGGUAN KOMUNIKASI / MCB TRIP) ---
            else {
                // Matikan indikator status visual segera di layar
                SetTagValue(hmiGroupName + ".statusPemanasan", false);
                SetTagValue(hmiGroupName + ".statusPemasakan", false);
            }
        } 
        // --- KONDISI KOMUNIKASI DI-DISABLE MANUAL OLEH OPERATOR ---
        else {
            SetTagValue(hmiGroupName + ".statusPemanasan", false);
            SetTagValue(hmiGroupName + ".statusPemasakan", false);
            SetTagValue(hmiGroupName + ".statusSelesai", false);
        }
    }
}

// SIMULASI UJI COBA REAL-TIME OFFLINE & RECOVERY
console.log("=== SIMULASI UJI COBA DETEKSI OFFLINE & RECOVERY ===");

// 1. Detik 1: Semua berjalan normal
tickClock();
runMasterLoopScript();
console.log("\nDetik 1 (Koneksi Normal) -> Unit 30 Temp: " + GetTagValue("SB30.temp")/10 + "C, State Masak: " + GetTagValue("SB_30.statusPemasakan") + 
    ", Sisa Masak: " + GetTagValue("SB_30.tampilDurasiAktual")
);

// 2. Detik 2: MCB Trip! (commStatus = false)
console.log("\n--- DETIK 2: GANGGUAN TERJADI! MCB TRIP / ALAT MATI ---");
SCADA_Database["SB30._commStatus"] = false;
tickClock();
runMasterLoopScript();
console.log("Detik 2 (Offline) -> Unit 30 CommStatus: " + GetTagValue("SB30._commStatus") + 
    ", State Masak (Harus Off): " + GetTagValue("SB_30.statusPemasakan") +
    ", Sisa Masak di Layar (Harus Tetap/Pause): " + GetTagValue("SB_30.tampilDurasiAktual")
);

// 3. Detik 3: Masih dalam kondisi offline (Operator memindahkan produk)
tickClock();
runMasterLoopScript();
console.log("Detik 3 (Offline) -> Sisa Masak di Layar (Tetap Terjaga): " + GetTagValue("SB_30.tampilDurasiAktual"));

// 4. Detik 4: Listrik Menyala / Perbaikan Selesai (commStatus = true)
console.log("\n--- DETIK 4: KONEKSI DILANJUTKAN (RECOVERY) ---");
SCADA_Database["SB30._commStatus"] = true;
tickClock();
runMasterLoopScript();
console.log("Detik 4 (Recovery) -> Unit 30 CommStatus: " + GetTagValue("SB30._commStatus") + 
    ", State Masak (Harus Hidup Lagi): " + GetTagValue("SB_30.statusPemasakan") +
    ", Sisa Masak (Harus Berkurang 1 detik dr 89s): " + GetTagValue("SB_30.tampilDurasiAktual")
);

// 5. Menguji Unit 29 yang di-disable manual oleh operator
console.log("\n--- PENGUJIAN UNIT 29 (COMMUNICATION DISABLED) ---");
console.log("Unit 29 _commOperation: " + GetTagValue("SB29._commOperation") +
    ", State Pemanasan (Harus Off): " + GetTagValue("SB_29.statusPemanasan")
);
