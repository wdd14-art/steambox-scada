// Simulation of the Master Loop with Dynamic HMI Status Banner

var $Hour = 11;
var $Minute = 46;
var $Second = 35;

var SCADA_Database = {
    "Sys_Control.maintenanceMode30": 0,
    "SB30._commOperation": true,
    "SB30._commStatus": true,
    "SB30.runStop": true, // Stopped initially
    "SB30.temp": 950,
    "SB_30.targetMenit": 2,
    "SB_30.adjustMenit": 0,
    "SB_30.sisaDetikMasak": 0,
    "SB_30.totalDetikPemanasan": 0,
    "SB_30.flagInitStart": 0,
    "SB_30.flagInitMasak": 0,
    "SB_30.statusKosong": true, // empty tank
    "SB_30.statusPemanasan": false,
    "SB_30.statusPemasakan": false,
    "SB_30.statusSelesai": false,
    
    // The Status Banner Tag (String)
    "SB_30.statusBanner": ""
};

function GetTagValue(tagName) {
    if (SCADA_Database.hasOwnProperty(tagName)) return SCADA_Database[tagName];
    throw new Error("Tag not found: " + tagName);
}

function SetTagValue(tagName, value) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        SCADA_Database[tagName] = value;
        return;
    }
    throw new Error("Tag not found: " + tagName);
}

function runMasterLoopScript() {
    var waktuSekarangString = ("0" + $Hour).slice(-2) + ":" + ("0" + $Minute).slice(-2) + ":" + ("0" + $Second).slice(-2);
    var totalDetikSekarang = ($Hour * 3600) + ($Minute * 60) + $Second;

    var activeUnits = [30]; 

    for (var k = 0; k < activeUnits.length; k++) {
        var i = activeUnits[k];
        var deviceName = "SB" + i;
        var hmiGroupName = "SB_" + i;

        var commOperation = GetTagValue(deviceName + "._commOperation");
        
        // --- DEKLARASI VARIABEL BANNER STATUS ---
        var statusText = "";

        if (commOperation === true) {
            var commStatus = GetTagValue(deviceName + "._commStatus");
            
            if (commStatus === true) {
                var maintenance_aktif = GetTagValue("Sys_Control.maintenanceMode" + i) || 0;
                var Run_status = GetTagValue(deviceName + ".runStop"); 
                var raw_pv = GetTagValue(deviceName + ".temp") || 0;

                var target = GetTagValue(hmiGroupName + ".targetMenit") || 0;
                var sisa = GetTagValue(hmiGroupName + ".sisaDetikMasak") || 0;
                var pemanasan = GetTagValue(hmiGroupName + ".totalDetikPemanasan") || 0;
                var fStart = GetTagValue(hmiGroupName + ".flagInitStart") || 0;
                var fMasak = GetTagValue(hmiGroupName + ".flagInitMasak") || 0;

                var bit_kosong = GetTagValue(hmiGroupName + ".statusKosong") || false;
                var bit_pemanasan = GetTagValue(hmiGroupName + ".statusPemanasan") || false;
                var bit_pemasakan = GetTagValue(hmiGroupName + ".statusPemasakan") || false;
                var bit_selesai = GetTagValue(hmiGroupName + ".statusSelesai") || false;

                if (maintenance_aktif !== 1) {
                    
                    if (Run_status === true) {
                        bit_pemanasan = false;
                        bit_pemasakan = false;
                        fStart = 0;

                        if (bit_kosong === true) {
                            bit_selesai = false;
                            sisa = 0;
                            pemanasan = 0;
                            // Set Banner State: Ready / Idle
                            statusText = "TANGKI KOSONG - SIAP MEMULAI";
                        } else if (bit_selesai === true) {
                            // Set Banner State: Finished
                            statusText = "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
                        } else {
                            // Set Banner State: Manually Paused
                            statusText = "MESIN BERHENTI (PAUSED)";
                        }
                    } 
                    else if (Run_status === false) {
                        bit_kosong = false;
                        bit_selesai = false;

                        // MODE PRE-HEAT (target === 0)
                        if (target === 0) {
                            bit_pemanasan = true;
                            bit_pemasakan = false;
                            
                            statusText = "SEDANG PRE-HEAT (PEMANASAN)";

                            if (fStart === 0) { fStart = 1; pemanasan = 0; }
                            pemanasan = pemanasan + 1;

                            if (raw_pv > 1000) {
                                Run_status = true; 
                                bit_selesai = true;
                                fStart = 0;
                            }
                        } 
                        // MODE MEMASAK RESEP
                        else {
                            if (fStart === 0) { fStart = 1; sisa = target * 60; fMasak = 0; }

                            if (raw_pv < 1000) {
                                bit_pemanasan = true;
                                bit_pemasakan = false;
                                pemanasan = pemanasan + 1;
                                
                                // Set Banner State: Heating during cooking
                                statusText = "MENUNGGU MENDIDIH (< 100 C)";
                            }
                            else if (raw_pv >= 1000) {
                                bit_pemanasan = false;
                                bit_pemasakan = true;

                                if (fMasak === 0) fMasak = 1;
                                if (sisa > 0) sisa = sisa - 1;

                                // Set Banner State: Cooking
                                statusText = "SEDANG MEMASAK (MENDIDIH)";

                                if (sisa <= 0) {
                                    sisa = 0;
                                    Run_status = true; 
                                    bit_pemasakan = false;
                                    bit_selesai = true;
                                    fStart = 0;
                                    fMasak = 0;
                                }
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
                } else {
                    // MAINTENANCE ACTIVE
                    statusText = "MODE MAINTENANCE (KONTROL MANUAL)";
                }
            } else {
                // OFFLINE
                statusText = "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
                SetTagValue(hmiGroupName + ".statusPemanasan", false);
                SetTagValue(hmiGroupName + ".statusPemasakan", false);
            }
        } else {
            // DISABLED
            statusText = "KOMUNIKASI UNIT DINONAKTIFKAN";
            SetTagValue(hmiGroupName + ".statusPemanasan", false);
            SetTagValue(hmiGroupName + ".statusPemasakan", false);
            SetTagValue(hmiGroupName + ".statusSelesai", false);
        }

        // TULIS TEXT KE BANNER HMI
        SetTagValue(hmiGroupName + ".statusBanner", statusText);
    }
}

// SIMULASI BERBAGAI KONDISI BANNER
console.log("=== PENGUJIAN BANNER STATUS DINAMIS ===");

// 1. Kondisi Idle / Kosong
runMasterLoopScript();
console.log("Kondisi 1 (Idle): " + GetTagValue("SB_30.statusBanner"));

// 2. Kondisi Preheat
SCADA_Database["SB30.runStop"] = false;
SCADA_Database["SB_30.targetMenit"] = 0; // Preheat
runMasterLoopScript();
console.log("Kondisi 2 (Preheat): " + GetTagValue("SB_30.statusBanner"));

// 3. Kondisi Menunggu Mendidih saat Masak
SCADA_Database["SB_30.targetMenit"] = 2; // Memasak
SCADA_Database["SB30.temp"] = 980; // < 100C
runMasterLoopScript();
console.log("Kondisi 3 (Heating Cook): " + GetTagValue("SB_30.statusBanner"));

// 4. Kondisi Memasak Mendidih
SCADA_Database["SB30.temp"] = 1005; // >= 100C
runMasterLoopScript();
console.log("Kondisi 4 (Cooking): " + GetTagValue("SB_30.statusBanner"));

// 5. Kondisi Maintenance
SCADA_Database["Sys_Control.maintenanceMode30"] = 1;
runMasterLoopScript();
console.log("Kondisi 5 (Maintenance): " + GetTagValue("SB_30.statusBanner"));

// 6. Kondisi Offline
SCADA_Database["Sys_Control.maintenanceMode30"] = 0;
SCADA_Database["SB30._commStatus"] = false;
runMasterLoopScript();
console.log("Kondisi 6 (Offline): " + GetTagValue("SB_30.statusBanner"));
