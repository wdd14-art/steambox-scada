// Simulation of the DYNAMIC loop using Variable.GetValue & Variable.SetValue
// Trigger: Timer 1 Detik (1000ms)

// 1. Mock SCADA Global System Variables
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

var SCADA_Database = {
    // UNIT 29 - Disconnected by user
    "sb_29.is_active": false,
    "sb29._commOperation": false,
    "sb29._commStatus": true,
    "sb29.runStop": false,
    "sb29.temp": 950,
    "sb_29.maintenance_mode": 0,
    "sb_29.target_menit": 5,
    "sb_29.adjust_menit": 0,
    "sb_29.sisa_detik_masak": 300,
    "sb_29.total_detik_pemanasan": 0,
    "sb_29.flag_init_start": 0,
    "sb_29.flag_init_masak": 0,
    "sb_29.status_kosong": false,
    "sb_29.status_pemanasan": true,
    "sb_29.status_pemasakan": false,
    "sb_29.status_selesai": false,
    "sb_29.tampil_jam_mulai": "00:00:00",
    "sb_29.tampil_jam_masak": "00:00:00",
    "sb_29.tampil_jam_selesai": "00:00:00",
    "sb_29.tampil_durasi_actual": "00:05:00",
    "sb_29.tampil_pemanasan": "00:00:00",
    "sb_29.status_banner": "",

    // UNIT 30 - Running
    "sb_30.is_active": true,
    "sb30._commOperation": true,
    "sb30._commStatus": true,
    "sb30.runStop": false,       // false = RUNNING
    "sb30.temp": 1002,          // 100.2 C
    "sb_30.maintenance_mode": 0,
    "sb_30.target_menit": 2,      // 2 minutes target
    "sb_30.adjust_menit": 0,
    "sb_30.sisa_detik_masak": 90,  // 90 seconds remaining (00:01:30)
    "sb_30.total_detik_pemanasan": 15,
    "sb_30.flag_init_start": 1,
    "sb_30.flag_init_masak": 1,
    "sb_30.status_kosong": false,
    "sb_30.status_pemanasan": false,
    "sb_30.status_pemasakan": true,
    "sb_30.status_selesai": false,
    "sb_30.tampil_jam_mulai": "11:46:00",
    "sb_30.tampil_jam_masak": "11:46:15",
    "sb_30.tampil_jam_selesai": "11:47:30",
    "sb_30.tampil_durasi_actual": "00:01:30",
    "sb_30.tampil_pemanasan": "00:00:15",
    "sb_30.status_banner": ""
};

// Initialize all 30 rooms on global scope
for (var i = 1; i <= 30; i++) {
    var dev = "sb" + i;
    var grp = "sb_" + i;
    if (!SCADA_Database.hasOwnProperty(grp + ".is_active")) {
        SCADA_Database[grp + ".is_active"] = false;
        SCADA_Database[dev + "._commOperation"] = false;
        SCADA_Database[dev + "._commStatus"] = true;
        SCADA_Database[dev + ".runStop"] = true;
        SCADA_Database[dev + ".temp"] = 250;
        SCADA_Database[grp + ".maintenance_mode"] = 0;
        SCADA_Database[grp + ".target_menit"] = 0;
        SCADA_Database[grp + ".adjust_menit"] = 0;
        SCADA_Database[grp + ".sisa_detik_masak"] = 0;
        SCADA_Database[grp + ".total_detik_pemanasan"] = 0;
        SCADA_Database[grp + ".flag_init_start"] = 0;
        SCADA_Database[grp + ".flag_init_masak"] = 0;
        SCADA_Database[grp + ".status_kosong"] = false;
        SCADA_Database[grp + ".status_pemanasan"] = false;
        SCADA_Database[grp + ".status_pemasakan"] = false;
        SCADA_Database[grp + ".status_selesai"] = false;
        SCADA_Database[grp + ".tampil_jam_mulai"] = "00:00:00";
        SCADA_Database[grp + ".tampil_jam_masak"] = "00:00:00";
        SCADA_Database[grp + ".tampil_jam_selesai"] = "00:00:00";
        SCADA_Database[grp + ".tampil_durasi_actual"] = "00:00:00";
        SCADA_Database[grp + ".tampil_pemanasan"] = "00:00:00";
        SCADA_Database[grp + ".status_banner"] = "";
    }
}

// Add global controls
var $Sys_Control = {
    txt_kosong: "TANGKI KOSONG - SIAP MEMULAI",
    txt_preheat: "SEDANG PRE-HEAT (PEMANASAN)",
    txt_pemanasan: "MENUNGGU MENDIDIH (< 100 C)",
    txt_pemasakan: "SEDANG MEMASAK (MENDIDIH)",
    txt_selesai: "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI",
    txt_maintenance: "MODE MAINTENANCE (KONTROL MANUAL)",
    txt_offline: "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)",
    txt_disabled: "KOMUNIKASI UNIT DINONAKTIFKAN",
    txt_sensor_error: "ERROR SENSOR (OPENLOOP/HHHH)",
    temp_error_limit: 30000,
    monitor_room_1: "", monitor_sisa_1: "", monitor_selesai_1: "",
    monitor_room_2: "", monitor_sisa_2: "", monitor_selesai_2: "",
    monitor_room_3: "", monitor_sisa_3: "", monitor_selesai_3: "",
    monitor_room_4: "", monitor_sisa_4: "", monitor_selesai_4: "",
    monitor_room_5: "", monitor_sisa_5: "", monitor_selesai_5: ""
};

function ReadTag(tagName) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        return SCADA_Database[tagName];
    }
    throw new Error("Tag '" + tagName + "' is not registered!");
}

function WriteTag(tagName, value) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        SCADA_Database[tagName] = value;
    } else if (tagName.indexOf("Sys_Control.") === 0) {
        var key = tagName.substring(12);
        $Sys_Control[key] = value;
    } else {
        throw new Error("Cannot write to unregistered tag '" + tagName + "'!");
    }
}

var Variable = {
    GetValue: function(name) {
        return ReadTag(name);
    },
    SetValue: function(name, value) {
        WriteTag(name, value);
    }
};

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

// THE DYNAMIC MASTER LOOP
function runDynamicMasterLoop() {
    var waktuSekarangString = ("0" + ($Hour || 0)).slice(-2) + ":" + ("0" + ($Minute || 0)).slice(-2) + ":" + ("0" + ($Second || 0)).slice(-2);
    var totalDetikSekarang = (($Hour || 0) * 3600) + (($Minute || 0) * 60) + ($Second || 0);

    var txtKosong = $Sys_Control.txt_kosong || "TANGKI KOSONG - SIAP MEMULAI";
    var txtPreheat = $Sys_Control.txt_preheat || "SEDANG PRE-HEAT (PEMANASAN)";
    var txtPemanasan = $Sys_Control.txt_pemanasan || "MENUNGGU MENDIDIH (< 100 C)";
    var txtPemasakan = $Sys_Control.txt_pemasakan || "SEDANG MEMASAK (MENDIDIH)";
    var txtSelesai = $Sys_Control.txt_selesai || "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
    var txtMaintenance = $Sys_Control.txt_maintenance || "MODE MAINTENANCE (KONTROL MANUAL)";
    var txtOffline = $Sys_Control.txt_offline || "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
    var txtDisabled = $Sys_Control.txt_disabled || "KOMUNIKASI UNIT DINONAKTIFKAN";
    var txtSensorError = $Sys_Control.txt_sensor_error || "ERROR SENSOR (OPENLOOP/HHHH)";
    var tempErrorLimit = $Sys_Control.temp_error_limit || 30000;

    var runningRooms = [];

    function formatTime(totalSeconds) {
        var h = Math.floor(totalSeconds / 3600);
        var m = Math.floor((totalSeconds % 3600) / 60);
        var s = totalSeconds % 60;
        return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + s).slice(-2);
    }

    function getEstimasiSelesai(totalDetikSekarang, sisa) {
        var est = (totalDetikSekarang + sisa) % 86400;
        var he = Math.floor(est / 3600);
        var me = Math.floor((est % 3600) / 60);
        var se = est % 60;
        return ("0" + he).slice(-2) + ":" + ("0" + me).slice(-2) + ":" + ("0" + se).slice(-2);
    }

    for (var i = 1; i <= 30; i++) {
        var dev = "sb" + i;
        var grp = "sb_" + i;

        var is_active = Variable.GetValue(grp + ".is_active") === true;

        if (!is_active) {
            if (Variable.GetValue(dev + "._commOperation") !== false) {
                Variable.SetValue(dev + "._commOperation", false);
            }
            if (Variable.GetValue(grp + ".status_banner") !== txtDisabled) {
                Variable.SetValue(grp + ".status_banner", txtDisabled);
            }
            if (Variable.GetValue(grp + ".status_pemanasan") !== false) {
                Variable.SetValue(grp + ".status_pemanasan", false);
            }
            if (Variable.GetValue(grp + ".status_pemasakan") !== false) {
                Variable.SetValue(grp + ".status_pemasakan", false);
            }
            if (Variable.GetValue(grp + ".status_selesai") !== false) {
                Variable.SetValue(grp + ".status_selesai", false);
            }
            continue;
        }

        if (Variable.GetValue(dev + "._commOperation") !== true) {
            Variable.SetValue(dev + "._commOperation", true);
        }

        if (Variable.GetValue(dev + "._commStatus") === true) {
            var raw_pv = Variable.GetValue(dev + ".temp") || 0;
            var isSensorError = (raw_pv >= tempErrorLimit);
            var maintenance_mode = Variable.GetValue(grp + ".maintenance_mode");

            if (maintenance_mode !== 1) {
                var runStop = Variable.GetValue(dev + ".runStop");

                if (runStop === true) {
                    Variable.SetValue(grp + ".status_pemanasan", false);
                    Variable.SetValue(grp + ".status_pemasakan", false);
                    Variable.SetValue(grp + ".flag_init_start", 0);

                    if (Variable.GetValue(grp + ".status_kosong") === true) {
                        Variable.SetValue(grp + ".status_selesai", false);
                        Variable.SetValue(grp + ".flag_init_start", 0);
                        Variable.SetValue(grp + ".flag_init_masak", 0);
                        Variable.SetValue(grp + ".total_detik_pemanasan", 0);
                        Variable.SetValue(grp + ".sisa_detik_masak", 0);
                        Variable.SetValue(grp + ".target_menit", 0);
                        Variable.SetValue(grp + ".adjust_menit", 0);
                        Variable.SetValue(grp + ".tampil_jam_mulai", "00:00:00");
                        Variable.SetValue(grp + ".tampil_jam_masak", "00:00:00");
                        Variable.SetValue(grp + ".tampil_jam_selesai", "00:00:00");
                        Variable.SetValue(grp + ".tampil_durasi_actual", "00:00:00");
                        Variable.SetValue(grp + ".tampil_pemanasan", "00:00:00");
                        Variable.SetValue(grp + ".suhu_awal", 0);
                        Variable.SetValue(grp + ".suhu_akhir", 0);
                        Variable.SetValue(grp + ".perubahan_waktu", 0);
                        Variable.SetValue(grp + ".status_banner", txtKosong);
                        Variable.SetValue(grp + ".status_kosong", false);
                    } else if (Variable.GetValue(grp + ".status_selesai") === true) {
                        Variable.SetValue(grp + ".status_banner", txtSelesai);
                    } else {
                        Variable.SetValue(grp + ".status_banner", "MESIN BERHENTI (PAUSED)");
                    }
                } else {
                    Variable.SetValue(grp + ".status_kosong", false);
                    Variable.SetValue(grp + ".status_selesai", false);

                    var target_menit = Variable.GetValue(grp + ".target_menit") || 0;

                    if (target_menit === 0) {
                        Variable.SetValue(grp + ".status_pemanasan", true);
                        Variable.SetValue(grp + ".status_pemasakan", false);
                        Variable.SetValue(grp + ".status_banner", txtPreheat);

                        var flag_init_start = Variable.GetValue(grp + ".flag_init_start") || 0;
                        if (flag_init_start === 0) {
                            Variable.SetValue(grp + ".tampil_jam_mulai", waktuSekarangString);
                            Variable.SetValue(grp + ".tampil_jam_masak", "--:--:--");
                            Variable.SetValue(grp + ".tampil_jam_selesai", "--:--:--");
                            Variable.SetValue(grp + ".tampil_durasi_actual", "--:--:--");
                            Variable.SetValue(grp + ".flag_init_start", 1);
                            Variable.SetValue(grp + ".total_detik_pemanasan", 0);
                            Variable.SetValue(grp + ".suhu_awal", raw_pv);
                        }

                        var total_detik_pemanasan = (Variable.GetValue(grp + ".total_detik_pemanasan") || 0) + 1;
                        Variable.SetValue(grp + ".total_detik_pemanasan", total_detik_pemanasan);
                        Variable.SetValue(grp + ".tampil_pemanasan", formatTime(total_detik_pemanasan));

                        if (raw_pv > 1000) {
                            Variable.SetValue(dev + ".runStop", true);
                            Variable.SetValue(grp + ".status_selesai", true);
                            Variable.SetValue(grp + ".status_pemanasan", false);
                            Variable.SetValue(grp + ".flag_init_start", 0);
                            Variable.SetValue(grp + ".suhu_akhir", raw_pv);
                        }
                    } else {
                        var flag_init_start = Variable.GetValue(grp + ".flag_init_start") || 0;
                        var sisa_detik_masak = Variable.GetValue(grp + ".sisa_detik_masak") || 0;

                        if (flag_init_start === 0) {
                            Variable.SetValue(grp + ".tampil_jam_mulai", waktuSekarangString);
                            Variable.SetValue(grp + ".tampil_jam_masak", "--:--:--");
                            Variable.SetValue(grp + ".tampil_jam_selesai", "--:--:--");
                            Variable.SetValue(grp + ".flag_init_start", 1);
                            sisa_detik_masak = target_menit * 60;
                            Variable.SetValue(grp + ".sisa_detik_masak", sisa_detik_masak);
                            Variable.SetValue(grp + ".total_detik_pemanasan", 0);
                            Variable.SetValue(grp + ".flag_init_masak", 0);
                            Variable.SetValue(grp + ".suhu_awal", raw_pv);
                        }

                        var adjust_menit = Variable.GetValue(grp + ".adjust_menit") || 0;
                        if (adjust_menit !== 0) {
                            sisa_detik_masak = sisa_detik_masak + (adjust_menit * 60);
                            if (sisa_detik_masak < 0) sisa_detik_masak = 0;
                            Variable.SetValue(grp + ".sisa_detik_masak", sisa_detik_masak);
                            
                            var perubahan_waktu = (Variable.GetValue(grp + ".perubahan_waktu") || 0) + adjust_menit;
                            Variable.SetValue(grp + ".perubahan_waktu", perubahan_waktu);
                            Variable.SetValue(grp + ".adjust_menit", 0);
                        }

                        if (raw_pv < 1000) {
                            Variable.SetValue(grp + ".status_pemanasan", true);
                            Variable.SetValue(grp + ".status_pemasakan", false);
                            Variable.SetValue(grp + ".status_banner", txtPemanasan);

                            var total_detik_pemanasan = (Variable.GetValue(grp + ".total_detik_pemanasan") || 0) + 1;
                            Variable.SetValue(grp + ".total_detik_pemanasan", total_detik_pemanasan);
                            Variable.SetValue(grp + ".tampil_pemanasan", formatTime(total_detik_pemanasan));
                            
                            var tampil_durasi_actual = formatTime(sisa_detik_masak);
                            Variable.SetValue(grp + ".tampil_durasi_actual", tampil_durasi_actual);
                            
                            var tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, sisa_detik_masak);
                            Variable.SetValue(grp + ".tampil_jam_selesai", tampil_jam_selesai);
                        } else {
                            Variable.SetValue(grp + ".status_pemanasan", false);
                            Variable.SetValue(grp + ".status_pemasakan", true);
                            Variable.SetValue(grp + ".status_banner", txtPemasakan);

                            var flag_init_masak = Variable.GetValue(grp + ".flag_init_masak") || 0;
                            if (flag_init_masak === 0) {
                                Variable.SetValue(grp + ".tampil_jam_masak", waktuSekarangString);
                                Variable.SetValue(grp + ".flag_init_masak", 1);
                            }

                            if (sisa_detik_masak > 0) sisa_detik_masak = sisa_detik_masak - 1;
                            Variable.SetValue(grp + ".sisa_detik_masak", sisa_detik_masak);

                            if (sisa_detik_masak <= 0) {
                                sisa_detik_masak = 0;
                                Variable.SetValue(dev + ".runStop", true);
                                Variable.SetValue(grp + ".status_pemasakan", false);
                                Variable.SetValue(grp + ".status_selesai", true);
                                Variable.SetValue(grp + ".flag_init_start", 0);
                                Variable.SetValue(grp + ".flag_init_masak", 0);
                                Variable.SetValue(grp + ".suhu_akhir", raw_pv);
                            }

                            var tampil_durasi_actual = formatTime(sisa_detik_masak);
                            Variable.SetValue(grp + ".tampil_durasi_actual", tampil_durasi_actual);
                            
                            var tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, sisa_detik_masak);
                            Variable.SetValue(grp + ".tampil_jam_selesai", tampil_jam_selesai);

                            runningRooms.push({
                                name: "Steambox " + i,
                                sisa: sisa_detik_masak,
                                tampilSisa: tampil_durasi_actual,
                                tampilSelesai: tampil_jam_selesai
                            });
                        }
                    }
                }
            } else {
                Variable.SetValue(grp + ".status_banner", txtMaintenance);
            }
            if (isSensorError) {
                Variable.SetValue(grp + ".status_banner", txtSensorError);
            }
        } else {
            Variable.SetValue(grp + ".status_banner", txtOffline);
            Variable.SetValue(grp + ".status_pemanasan", false);
            Variable.SetValue(grp + ".status_pemasakan", false);
            Variable.SetValue(grp + ".status_selesai", false);
        }
    }

    // 4. Sorting Monitor Luar (Top 5)
    runningRooms.sort(function(a, b) {
        return a.sisa - b.sisa;
    });

    for (var r = 1; r <= 5; r++) {
        if (r - 1 < runningRooms.length) {
            var room = runningRooms[r - 1];
            if ($Sys_Control["monitor_room_" + r] !== room.name) $Sys_Control["monitor_room_" + r] = room.name;
            if ($Sys_Control["monitor_sisa_" + r] !== room.tampilSisa) $Sys_Control["monitor_sisa_" + r] = room.tampilSisa;
            if ($Sys_Control["monitor_selesai_" + r] !== room.tampilSelesai) $Sys_Control["monitor_selesai_" + r] = room.tampilSelesai;
        } else {
            if ($Sys_Control["monitor_room_" + r] !== "--") $Sys_Control["monitor_room_" + r] = "--";
            if ($Sys_Control["monitor_sisa_" + r] !== "--:--:--") $Sys_Control["monitor_sisa_" + r] = "--:--:--";
            if ($Sys_Control["monitor_selesai_" + r] !== "--:--:--") $Sys_Control["monitor_selesai_" + r] = "--:--:--";
        }
    }
}

// RUN SIMULATION TESTS
console.log("=== SIMULASI UJI COBA DYNAMIC MASTER LOOP (V4) ===");

// 1. Detik 1: Normal
SCADA_Database["sb30.runStop"] = false; // RUNNING
tickClock();
runDynamicMasterLoop();
console.log("\nDetik 1 (Koneksi Normal) -> Unit 30 Temp: " + SCADA_Database["sb30.temp"]/10 + "C, State Masak: " + SCADA_Database["sb_30.status_pemasakan"] + 
    ", Sisa Masak: " + SCADA_Database["sb_30.tampil_durasi_actual"]
);

// 2. Detik 2: Offline
console.log("\n--- DETIK 2: GANGGUAN TERJADI! MCB TRIP / ALAT MATI ---");
SCADA_Database["sb30._commStatus"] = false;
tickClock();
runDynamicMasterLoop();
console.log("Detik 2 (Offline) -> Unit 30 CommStatus: " + SCADA_Database["sb30._commStatus"] + 
    ", State Masak (Harus Off): " + SCADA_Database["sb_30.status_pemasakan"] +
    ", Sisa Masak di Layar (Harus Tetap/Pause): " + SCADA_Database["sb_30.tampil_durasi_actual"]
);

// 3. Detik 3: Still offline
tickClock();
runDynamicMasterLoop();
console.log("Detik 3 (Offline) -> Sisa Masak di Layar (Tetap Terjaga): " + SCADA_Database["sb_30.tampil_durasi_actual"]);

// 4. Detik 4: Recovery
console.log("\n--- DETIK 4: KONEKSI DILANJUTKAN (RECOVERY) ---");
SCADA_Database["sb30._commStatus"] = true;
tickClock();
runDynamicMasterLoop();
console.log("Detik 4 (Recovery) -> Unit 30 CommStatus: " + SCADA_Database["sb30._commStatus"] + 
    ", State Masak (Harus Hidup Lagi): " + SCADA_Database["sb_30.status_pemasakan"] +
    ", Sisa Masak (Harus Berkurang 1 detik dr 89s): " + SCADA_Database["sb_30.tampil_durasi_actual"]
);

// 5. Test inactive unit 29
console.log("\n--- PENGUJIAN UNIT 29 (NONAKTIF) ---");
console.log("Unit 29 isActive: " + SCADA_Database["sb_29.is_active"] +
    "\n  _commOperation (Harus otomatis False): " + SCADA_Database["sb29._commOperation"] +
    "\n  statusBanner (Harus COMM DISABLED): " + SCADA_Database["sb_29.status_banner"]
);

// 6. Test Sensor Error on Unit 30
console.log("\n--- DETIK 5: DETEKSI SENSOR ERROR (OPENLOOP / HHHH) PADA UNIT 30 ---");
SCADA_Database["sb30.temp"] = 32767;
tickClock();
runDynamicMasterLoop();
console.log("Detik 5 (Sensor Error) -> Unit 30 Temp: " + SCADA_Database["sb30.temp"] +
    "\n  runStop (Harus tetap False/RUN - Tidak boleh mati!): " + SCADA_Database["sb30.runStop"] +
    "\n  status_pemasakan (Harus tetap True): " + SCADA_Database["sb_30.status_pemasakan"] +
    "\n  status_banner (Harus ERROR SENSOR): " + SCADA_Database["sb_30.status_banner"]
);
