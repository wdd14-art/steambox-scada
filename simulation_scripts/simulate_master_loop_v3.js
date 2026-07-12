// Simulation of OPTIMIZED Haiwell SCADA JavaScript Engine using literal $ variables
// Trigger: Timer 1 Detik (1000ms)

// 1. Mock SCADA Global System Variables
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

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
    
    // Slot Monitor Luar
    monitor_room_1: "", monitor_sisa_1: "", monitor_selesai_1: "",
    monitor_room_2: "", monitor_sisa_2: "", monitor_selesai_2: "",
    monitor_room_3: "", monitor_sisa_3: "", monitor_selesai_3: "",
    monitor_room_4: "", monitor_sisa_4: "", monitor_selesai_4: "",
    monitor_room_5: "", monitor_sisa_5: "", monitor_selesai_5: ""
};

// Initialize all 30 rooms on global scope for Node.js resolution
for (var i = 1; i <= 30; i++) {
    global["$sb" + i] = {
        runStop: true,
        temp: 950, // 95.0 C
        _commOperation: true,
        _commStatus: true
    };
    global["$sb_" + i] = {
        is_active: i === 30, // Unit 30 active for primary testing
        target_menit: 2,
        adjust_menit: 0,
        sisa_detik_masak: 90, // 90 seconds
        total_detik_pemanasan: 0,
        flag_init_start: 1,
        flag_init_masak: 0,
        suhu_awal: 0,
        suhu_akhir: 0,
        perubahan_waktu: 0,
        status_kosong: false,
        status_pemanasan: false,
        status_pemasakan: true,
        status_selesai: false,
        status_banner: "",
        tampil_jam_mulai: "11:45:00",
        tampil_jam_masak: "11:46:00",
        tampil_jam_selesai: "11:47:30",
        tampil_durasi_actual: "00:01:30",
        tampil_pemanasan: "00:00:00"
    };
}

// Array for outdoor monitor sorting
var runningRooms = [];

// Helper functions (defined globally in HMI script)
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

function prosesUnit(u, id, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang) {
    // We already know the unit is active (checked outside function)
    if (u._commOperation !== true) u._commOperation = true;

    if (u._commOperation === true) {
        if (u._commStatus === true) {
            var raw_pv = u.temp || 0;
            var isSensorError = (raw_pv >= tempErrorLimit);
            
            if (u.maintenance_mode !== 1) {
                // --- A. KONDISI MESIN STOPPED / STANDBY / PAUSE (runStop === true) ---
                if (u.runStop === true) {
                    u.status_pemanasan = false;
                    u.status_pemasakan = false;
                    u.flag_init_start = 0;

                    if (u.status_kosong === true) {
                        u.status_selesai = false;
                        u.flag_init_start = 0;
                        u.flag_init_masak = 0;
                        u.total_detik_pemanasan = 0;
                        u.sisa_detik_masak = 0;
                        u.target_menit = 0;
                        u.adjust_menit = 0;
                        u.tampil_jam_mulai = "00:00:00";
                        u.tampil_jam_masak = "00:00:00";
                        u.tampil_jam_selesai = "00:00:00";
                        u.tampil_durasi_actual = "00:00:00";
                        u.tampil_pemanasan = "00:00:00";
                        u.suhu_awal = 0;
                        u.suhu_akhir = 0;
                        u.perubahan_waktu = 0;
                        u.status_banner = txtKosong;
                        u.status_kosong = false; // autoclear
                    } else if (u.status_selesai === true) {
                        u.status_banner = txtSelesai;
                    } else {
                        u.status_banner = "MESIN BERHENTI (PAUSED)";
                    }
                } 
                // --- B. KONDISI MESIN RUNNING (runStop === false) ---
                else {
                    u.status_kosong = false;
                    u.status_selesai = false;

                    // MODE PRE-HEAT HARIAN (Jika resep kosong / target = 0)
                    if (u.target_menit === 0) {
                        u.status_pemanasan = true;
                        u.status_pemasakan = false;
                        u.status_banner = txtPreheat;

                        if (u.flag_init_start === 0) {
                            u.tampil_jam_mulai = waktuSekarangString;
                            u.tampil_jam_masak = "--:--:--";
                            u.tampil_jam_selesai = "--:--:--";
                            u.tampil_durasi_actual = "--:--:--";
                            u.flag_init_start = 1;
                            u.total_detik_pemanasan = 0;
                            u.suhu_awal = raw_pv;
                        }

                        u.total_detik_pemanasan = u.total_detik_pemanasan + 1;
                        u.tampil_pemanasan = formatTime(u.total_detik_pemanasan);

                        if (raw_pv > 1000) {
                            u.runStop = true; // Kirim perintah STOP
                            u.status_selesai = true;
                            u.status_pemanasan = false;
                            u.flag_init_start = 0;
                            u.suhu_akhir = raw_pv;
                        }
                    } 
                    // MODE PEMASAKAN RESEP (Jika target > 0)
                    else {
                        if (u.flag_init_start === 0) {
                            u.tampil_jam_mulai = waktuSekarangString;
                            u.tampil_jam_masak = "--:--:--";
                            u.tampil_jam_selesai = "--:--:--";
                            u.flag_init_start = 1;
                            u.sisa_detik_masak = u.target_menit * 60;
                            u.total_detik_pemanasan = 0;
                            u.flag_init_masak = 0;
                            u.suhu_awal = raw_pv;
                        }

                        // Fitur Koreksi Waktu (Adjust +/-)
                        if (u.adjust_menit !== 0) {
                            u.sisa_detik_masak = u.sisa_detik_masak + (u.adjust_menit * 60);
                            if (u.sisa_detik_masak < 0) {
                                u.sisa_detik_masak = 0;
                            }
                            u.perubahan_waktu = u.perubahan_waktu + u.adjust_menit;
                            u.adjust_menit = 0;
                        }

                        // Fase B1: Suhu Belum Mendidih (Pemanasan Awal Masak)
                        if (raw_pv < 1000) {
                            u.status_pemanasan = true;
                            u.status_pemasakan = false;
                            u.status_banner = txtPemanasan;
                            u.total_detik_pemanasan = u.total_detik_pemanasan + 1;

                            u.tampil_pemanasan = formatTime(u.total_detik_pemanasan);
                            u.tampil_durasi_actual = formatTime(u.sisa_detik_masak);
                            u.tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, u.sisa_detik_masak);
                        }
                        // Fase B2: Suhu Mendidih (Proses Memasak Berjalan)
                        else {
                            u.status_pemanasan = false;
                            u.status_pemasakan = true;
                            u.status_banner = txtPemasakan;

                            if (u.flag_init_masak === 0) {
                                u.tampil_jam_masak = waktuSekarangString;
                                u.flag_init_masak = 1;
                            }

                            if (u.sisa_detik_masak > 0) {
                                u.sisa_detik_masak = u.sisa_detik_masak - 1;
                            }

                            if (u.sisa_detik_masak <= 0) {
                                u.sisa_detik_masak = 0;
                                u.runStop = true; // Kirim perintah STOP
                                u.status_pemasakan = false;
                                u.status_selesai = true;
                                u.flag_init_start = 0;
                                u.flag_init_masak = 0;
                                u.suhu_akhir = raw_pv;
                            }

                            u.tampil_durasi_actual = formatTime(u.sisa_detik_masak);
                            u.tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, u.sisa_detik_masak);

                            runningRooms.push({
                                name: "Steambox " + id,
                                sisa: u.sisa_detik_masak,
                                tampilSisa: u.tampil_durasi_actual,
                                tampilSelesai: u.tampil_jam_selesai
                            });
                        }
                    }
                }
            } else {
                u.status_banner = txtMaintenance;
            }

            if (isSensorError) {
                u.status_banner = txtSensorError;
            }
        } else {
            u.status_banner = txtOffline;
            u.status_pemanasan = false;
            u.status_pemasakan = false;
        }
    }
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

function runMasterLoopScript() {
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

    runningRooms = [];
    // Unit 1
    if ($sb_1.is_active) {
        var u1 = { is_active: true, _commOperation: $sb1._commOperation, _commStatus: $sb1._commStatus, maintenance_mode: $sb_1.maintenance_mode, runStop: $sb1.runStop, temp: $sb1.temp, target_menit: $sb_1.target_menit, adjust_menit: $sb_1.adjust_menit, sisa_detik_masak: $sb_1.sisa_detik_masak, total_detik_pemanasan: $sb_1.total_detik_pemanasan, flag_init_start: $sb_1.flag_init_start, flag_init_masak: $sb_1.flag_init_masak, suhu_awal: $sb_1.suhu_awal, suhu_akhir: $sb_1.suhu_akhir, perubahan_waktu: $sb_1.perubahan_waktu, status_kosong: $sb_1.status_kosong, status_pemanasan: $sb_1.status_pemanasan, status_pemasakan: $sb_1.status_pemasakan, status_selesai: $sb_1.status_selesai, status_banner: $sb_1.status_banner, tampil_jam_mulai: $sb_1.tampil_jam_mulai, tampil_jam_masak: $sb_1.tampil_jam_masak, tampil_jam_selesai: $sb_1.tampil_jam_selesai, tampil_durasi_actual: $sb_1.tampil_durasi_actual, tampil_pemanasan: $sb_1.tampil_pemanasan };
        prosesUnit(u1, 1, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb1._commOperation !== u1._commOperation) $sb1._commOperation = u1._commOperation;
        if ($sb_1.status_banner !== u1.status_banner) $sb_1.status_banner = u1.status_banner;
        if ($sb_1.status_pemanasan !== u1.status_pemanasan) $sb_1.status_pemanasan = u1.status_pemanasan;
        if ($sb_1.status_pemasakan !== u1.status_pemasakan) $sb_1.status_pemasakan = u1.status_pemasakan;
        if ($sb_1.status_selesai !== u1.status_selesai) $sb_1.status_selesai = u1.status_selesai;
        if ($sb_1.status_kosong !== u1.status_kosong) $sb_1.status_kosong = u1.status_kosong;
        if ($sb_1.target_menit !== u1.target_menit) $sb_1.target_menit = u1.target_menit;
        if ($sb_1.adjust_menit !== u1.adjust_menit) $sb_1.adjust_menit = u1.adjust_menit;
        if ($sb_1.sisa_detik_masak !== u1.sisa_detik_masak) $sb_1.sisa_detik_masak = u1.sisa_detik_masak;
        if ($sb_1.total_detik_pemanasan !== u1.total_detik_pemanasan) $sb_1.total_detik_pemanasan = u1.total_detik_pemanasan;
        if ($sb_1.flag_init_start !== u1.flag_init_start) $sb_1.flag_init_start = u1.flag_init_start;
        if ($sb_1.flag_init_masak !== u1.flag_init_masak) $sb_1.flag_init_masak = u1.flag_init_masak;
        if ($sb_1.suhu_awal !== u1.suhu_awal) $sb_1.suhu_awal = u1.suhu_awal;
        if ($sb_1.suhu_akhir !== u1.suhu_akhir) $sb_1.suhu_akhir = u1.suhu_akhir;
        if ($sb_1.perubahan_waktu !== u1.perubahan_waktu) $sb_1.perubahan_waktu = u1.perubahan_waktu;
        if ($sb_1.tampil_jam_mulai !== u1.tampil_jam_mulai) $sb_1.tampil_jam_mulai = u1.tampil_jam_mulai;
        if ($sb_1.tampil_jam_masak !== u1.tampil_jam_masak) $sb_1.tampil_jam_masak = u1.tampil_jam_masak;
        if ($sb_1.tampil_jam_selesai !== u1.tampil_jam_selesai) $sb_1.tampil_jam_selesai = u1.tampil_jam_selesai;
        if ($sb_1.tampil_durasi_actual !== u1.tampil_durasi_actual) $sb_1.tampil_durasi_actual = u1.tampil_durasi_actual;
        if ($sb_1.tampil_pemanasan !== u1.tampil_pemanasan) $sb_1.tampil_pemanasan = u1.tampil_pemanasan;
        if ($sb1.runStop !== u1.runStop) $sb1.runStop = u1.runStop;
    } else {
        if ($sb1._commOperation !== false) {
            $sb1._commOperation = false;
            $sb_1.status_banner = txtDisabled;
            $sb_1.status_pemanasan = false;
            $sb_1.status_pemasakan = false;
            $sb_1.status_selesai = false;
        }
    }

    // Unit 2
    if ($sb_2.is_active) {
        var u2 = { is_active: true, _commOperation: $sb2._commOperation, _commStatus: $sb2._commStatus, maintenance_mode: $sb_2.maintenance_mode, runStop: $sb2.runStop, temp: $sb2.temp, target_menit: $sb_2.target_menit, adjust_menit: $sb_2.adjust_menit, sisa_detik_masak: $sb_2.sisa_detik_masak, total_detik_pemanasan: $sb_2.total_detik_pemanasan, flag_init_start: $sb_2.flag_init_start, flag_init_masak: $sb_2.flag_init_masak, suhu_awal: $sb_2.suhu_awal, suhu_akhir: $sb_2.suhu_akhir, perubahan_waktu: $sb_2.perubahan_waktu, status_kosong: $sb_2.status_kosong, status_pemanasan: $sb_2.status_pemanasan, status_pemasakan: $sb_2.status_pemasakan, status_selesai: $sb_2.status_selesai, status_banner: $sb_2.status_banner, tampil_jam_mulai: $sb_2.tampil_jam_mulai, tampil_jam_masak: $sb_2.tampil_jam_masak, tampil_jam_selesai: $sb_2.tampil_jam_selesai, tampil_durasi_actual: $sb_2.tampil_durasi_actual, tampil_pemanasan: $sb_2.tampil_pemanasan };
        prosesUnit(u2, 2, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb2._commOperation !== u2._commOperation) $sb2._commOperation = u2._commOperation;
        if ($sb_2.status_banner !== u2.status_banner) $sb_2.status_banner = u2.status_banner;
        if ($sb_2.status_pemanasan !== u2.status_pemanasan) $sb_2.status_pemanasan = u2.status_pemanasan;
        if ($sb_2.status_pemasakan !== u2.status_pemasakan) $sb_2.status_pemasakan = u2.status_pemasakan;
        if ($sb_2.status_selesai !== u2.status_selesai) $sb_2.status_selesai = u2.status_selesai;
        if ($sb_2.status_kosong !== u2.status_kosong) $sb_2.status_kosong = u2.status_kosong;
        if ($sb_2.target_menit !== u2.target_menit) $sb_2.target_menit = u2.target_menit;
        if ($sb_2.adjust_menit !== u2.adjust_menit) $sb_2.adjust_menit = u2.adjust_menit;
        if ($sb_2.sisa_detik_masak !== u2.sisa_detik_masak) $sb_2.sisa_detik_masak = u2.sisa_detik_masak;
        if ($sb_2.total_detik_pemanasan !== u2.total_detik_pemanasan) $sb_2.total_detik_pemanasan = u2.total_detik_pemanasan;
        if ($sb_2.flag_init_start !== u2.flag_init_start) $sb_2.flag_init_start = u2.flag_init_start;
        if ($sb_2.flag_init_masak !== u2.flag_init_masak) $sb_2.flag_init_masak = u2.flag_init_masak;
        if ($sb_2.suhu_awal !== u2.suhu_awal) $sb_2.suhu_awal = u2.suhu_awal;
        if ($sb_2.suhu_akhir !== u2.suhu_akhir) $sb_2.suhu_akhir = u2.suhu_akhir;
        if ($sb_2.perubahan_waktu !== u2.perubahan_waktu) $sb_2.perubahan_waktu = u2.perubahan_waktu;
        if ($sb_2.tampil_jam_mulai !== u2.tampil_jam_mulai) $sb_2.tampil_jam_mulai = u2.tampil_jam_mulai;
        if ($sb_2.tampil_jam_masak !== u2.tampil_jam_masak) $sb_2.tampil_jam_masak = u2.tampil_jam_masak;
        if ($sb_2.tampil_jam_selesai !== u2.tampil_jam_selesai) $sb_2.tampil_jam_selesai = u2.tampil_jam_selesai;
        if ($sb_2.tampil_durasi_actual !== u2.tampil_durasi_actual) $sb_2.tampil_durasi_actual = u2.tampil_durasi_actual;
        if ($sb_2.tampil_pemanasan !== u2.tampil_pemanasan) $sb_2.tampil_pemanasan = u2.tampil_pemanasan;
        if ($sb2.runStop !== u2.runStop) $sb2.runStop = u2.runStop;
    } else {
        if ($sb2._commOperation !== false) {
            $sb2._commOperation = false;
            $sb_2.status_banner = txtDisabled;
            $sb_2.status_pemanasan = false;
            $sb_2.status_pemasakan = false;
            $sb_2.status_selesai = false;
        }
    }

    // Unit 3
    if ($sb_3.is_active) {
        var u3 = { is_active: true, _commOperation: $sb3._commOperation, _commStatus: $sb3._commStatus, maintenance_mode: $sb_3.maintenance_mode, runStop: $sb3.runStop, temp: $sb3.temp, target_menit: $sb_3.target_menit, adjust_menit: $sb_3.adjust_menit, sisa_detik_masak: $sb_3.sisa_detik_masak, total_detik_pemanasan: $sb_3.total_detik_pemanasan, flag_init_start: $sb_3.flag_init_start, flag_init_masak: $sb_3.flag_init_masak, suhu_awal: $sb_3.suhu_awal, suhu_akhir: $sb_3.suhu_akhir, perubahan_waktu: $sb_3.perubahan_waktu, status_kosong: $sb_3.status_kosong, status_pemanasan: $sb_3.status_pemanasan, status_pemasakan: $sb_3.status_pemasakan, status_selesai: $sb_3.status_selesai, status_banner: $sb_3.status_banner, tampil_jam_mulai: $sb_3.tampil_jam_mulai, tampil_jam_masak: $sb_3.tampil_jam_masak, tampil_jam_selesai: $sb_3.tampil_jam_selesai, tampil_durasi_actual: $sb_3.tampil_durasi_actual, tampil_pemanasan: $sb_3.tampil_pemanasan };
        prosesUnit(u3, 3, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb3._commOperation !== u3._commOperation) $sb3._commOperation = u3._commOperation;
        if ($sb_3.status_banner !== u3.status_banner) $sb_3.status_banner = u3.status_banner;
        if ($sb_3.status_pemanasan !== u3.status_pemanasan) $sb_3.status_pemanasan = u3.status_pemanasan;
        if ($sb_3.status_pemasakan !== u3.status_pemasakan) $sb_3.status_pemasakan = u3.status_pemasakan;
        if ($sb_3.status_selesai !== u3.status_selesai) $sb_3.status_selesai = u3.status_selesai;
        if ($sb_3.status_kosong !== u3.status_kosong) $sb_3.status_kosong = u3.status_kosong;
        if ($sb_3.target_menit !== u3.target_menit) $sb_3.target_menit = u3.target_menit;
        if ($sb_3.adjust_menit !== u3.adjust_menit) $sb_3.adjust_menit = u3.adjust_menit;
        if ($sb_3.sisa_detik_masak !== u3.sisa_detik_masak) $sb_3.sisa_detik_masak = u3.sisa_detik_masak;
        if ($sb_3.total_detik_pemanasan !== u3.total_detik_pemanasan) $sb_3.total_detik_pemanasan = u3.total_detik_pemanasan;
        if ($sb_3.flag_init_start !== u3.flag_init_start) $sb_3.flag_init_start = u3.flag_init_start;
        if ($sb_3.flag_init_masak !== u3.flag_init_masak) $sb_3.flag_init_masak = u3.flag_init_masak;
        if ($sb_3.suhu_awal !== u3.suhu_awal) $sb_3.suhu_awal = u3.suhu_awal;
        if ($sb_3.suhu_akhir !== u3.suhu_akhir) $sb_3.suhu_akhir = u3.suhu_akhir;
        if ($sb_3.perubahan_waktu !== u3.perubahan_waktu) $sb_3.perubahan_waktu = u3.perubahan_waktu;
        if ($sb_3.tampil_jam_mulai !== u3.tampil_jam_mulai) $sb_3.tampil_jam_mulai = u3.tampil_jam_mulai;
        if ($sb_3.tampil_jam_masak !== u3.tampil_jam_masak) $sb_3.tampil_jam_masak = u3.tampil_jam_masak;
        if ($sb_3.tampil_jam_selesai !== u3.tampil_jam_selesai) $sb_3.tampil_jam_selesai = u3.tampil_jam_selesai;
        if ($sb_3.tampil_durasi_actual !== u3.tampil_durasi_actual) $sb_3.tampil_durasi_actual = u3.tampil_durasi_actual;
        if ($sb_3.tampil_pemanasan !== u3.tampil_pemanasan) $sb_3.tampil_pemanasan = u3.tampil_pemanasan;
        if ($sb3.runStop !== u3.runStop) $sb3.runStop = u3.runStop;
    } else {
        if ($sb3._commOperation !== false) {
            $sb3._commOperation = false;
            $sb_3.status_banner = txtDisabled;
            $sb_3.status_pemanasan = false;
            $sb_3.status_pemasakan = false;
            $sb_3.status_selesai = false;
        }
    }

    // Unit 4
    if ($sb_4.is_active) {
        var u4 = { is_active: true, _commOperation: $sb4._commOperation, _commStatus: $sb4._commStatus, maintenance_mode: $sb_4.maintenance_mode, runStop: $sb4.runStop, temp: $sb4.temp, target_menit: $sb_4.target_menit, adjust_menit: $sb_4.adjust_menit, sisa_detik_masak: $sb_4.sisa_detik_masak, total_detik_pemanasan: $sb_4.total_detik_pemanasan, flag_init_start: $sb_4.flag_init_start, flag_init_masak: $sb_4.flag_init_masak, suhu_awal: $sb_4.suhu_awal, suhu_akhir: $sb_4.suhu_akhir, perubahan_waktu: $sb_4.perubahan_waktu, status_kosong: $sb_4.status_kosong, status_pemanasan: $sb_4.status_pemanasan, status_pemasakan: $sb_4.status_pemasakan, status_selesai: $sb_4.status_selesai, status_banner: $sb_4.status_banner, tampil_jam_mulai: $sb_4.tampil_jam_mulai, tampil_jam_masak: $sb_4.tampil_jam_masak, tampil_jam_selesai: $sb_4.tampil_jam_selesai, tampil_durasi_actual: $sb_4.tampil_durasi_actual, tampil_pemanasan: $sb_4.tampil_pemanasan };
        prosesUnit(u4, 4, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb4._commOperation !== u4._commOperation) $sb4._commOperation = u4._commOperation;
        if ($sb_4.status_banner !== u4.status_banner) $sb_4.status_banner = u4.status_banner;
        if ($sb_4.status_pemanasan !== u4.status_pemanasan) $sb_4.status_pemanasan = u4.status_pemanasan;
        if ($sb_4.status_pemasakan !== u4.status_pemasakan) $sb_4.status_pemasakan = u4.status_pemasakan;
        if ($sb_4.status_selesai !== u4.status_selesai) $sb_4.status_selesai = u4.status_selesai;
        if ($sb_4.status_kosong !== u4.status_kosong) $sb_4.status_kosong = u4.status_kosong;
        if ($sb_4.target_menit !== u4.target_menit) $sb_4.target_menit = u4.target_menit;
        if ($sb_4.adjust_menit !== u4.adjust_menit) $sb_4.adjust_menit = u4.adjust_menit;
        if ($sb_4.sisa_detik_masak !== u4.sisa_detik_masak) $sb_4.sisa_detik_masak = u4.sisa_detik_masak;
        if ($sb_4.total_detik_pemanasan !== u4.total_detik_pemanasan) $sb_4.total_detik_pemanasan = u4.total_detik_pemanasan;
        if ($sb_4.flag_init_start !== u4.flag_init_start) $sb_4.flag_init_start = u4.flag_init_start;
        if ($sb_4.flag_init_masak !== u4.flag_init_masak) $sb_4.flag_init_masak = u4.flag_init_masak;
        if ($sb_4.suhu_awal !== u4.suhu_awal) $sb_4.suhu_awal = u4.suhu_awal;
        if ($sb_4.suhu_akhir !== u4.suhu_akhir) $sb_4.suhu_akhir = u4.suhu_akhir;
        if ($sb_4.perubahan_waktu !== u4.perubahan_waktu) $sb_4.perubahan_waktu = u4.perubahan_waktu;
        if ($sb_4.tampil_jam_mulai !== u4.tampil_jam_mulai) $sb_4.tampil_jam_mulai = u4.tampil_jam_mulai;
        if ($sb_4.tampil_jam_masak !== u4.tampil_jam_masak) $sb_4.tampil_jam_masak = u4.tampil_jam_masak;
        if ($sb_4.tampil_jam_selesai !== u4.tampil_jam_selesai) $sb_4.tampil_jam_selesai = u4.tampil_jam_selesai;
        if ($sb_4.tampil_durasi_actual !== u4.tampil_durasi_actual) $sb_4.tampil_durasi_actual = u4.tampil_durasi_actual;
        if ($sb_4.tampil_pemanasan !== u4.tampil_pemanasan) $sb_4.tampil_pemanasan = u4.tampil_pemanasan;
        if ($sb4.runStop !== u4.runStop) $sb4.runStop = u4.runStop;
    } else {
        if ($sb4._commOperation !== false) {
            $sb4._commOperation = false;
            $sb_4.status_banner = txtDisabled;
            $sb_4.status_pemanasan = false;
            $sb_4.status_pemasakan = false;
            $sb_4.status_selesai = false;
        }
    }

    // Unit 5
    if ($sb_5.is_active) {
        var u5 = { is_active: true, _commOperation: $sb5._commOperation, _commStatus: $sb5._commStatus, maintenance_mode: $sb_5.maintenance_mode, runStop: $sb5.runStop, temp: $sb5.temp, target_menit: $sb_5.target_menit, adjust_menit: $sb_5.adjust_menit, sisa_detik_masak: $sb_5.sisa_detik_masak, total_detik_pemanasan: $sb_5.total_detik_pemanasan, flag_init_start: $sb_5.flag_init_start, flag_init_masak: $sb_5.flag_init_masak, suhu_awal: $sb_5.suhu_awal, suhu_akhir: $sb_5.suhu_akhir, perubahan_waktu: $sb_5.perubahan_waktu, status_kosong: $sb_5.status_kosong, status_pemanasan: $sb_5.status_pemanasan, status_pemasakan: $sb_5.status_pemasakan, status_selesai: $sb_5.status_selesai, status_banner: $sb_5.status_banner, tampil_jam_mulai: $sb_5.tampil_jam_mulai, tampil_jam_masak: $sb_5.tampil_jam_masak, tampil_jam_selesai: $sb_5.tampil_jam_selesai, tampil_durasi_actual: $sb_5.tampil_durasi_actual, tampil_pemanasan: $sb_5.tampil_pemanasan };
        prosesUnit(u5, 5, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb5._commOperation !== u5._commOperation) $sb5._commOperation = u5._commOperation;
        if ($sb_5.status_banner !== u5.status_banner) $sb_5.status_banner = u5.status_banner;
        if ($sb_5.status_pemanasan !== u5.status_pemanasan) $sb_5.status_pemanasan = u5.status_pemanasan;
        if ($sb_5.status_pemasakan !== u5.status_pemasakan) $sb_5.status_pemasakan = u5.status_pemasakan;
        if ($sb_5.status_selesai !== u5.status_selesai) $sb_5.status_selesai = u5.status_selesai;
        if ($sb_5.status_kosong !== u5.status_kosong) $sb_5.status_kosong = u5.status_kosong;
        if ($sb_5.target_menit !== u5.target_menit) $sb_5.target_menit = u5.target_menit;
        if ($sb_5.adjust_menit !== u5.adjust_menit) $sb_5.adjust_menit = u5.adjust_menit;
        if ($sb_5.sisa_detik_masak !== u5.sisa_detik_masak) $sb_5.sisa_detik_masak = u5.sisa_detik_masak;
        if ($sb_5.total_detik_pemanasan !== u5.total_detik_pemanasan) $sb_5.total_detik_pemanasan = u5.total_detik_pemanasan;
        if ($sb_5.flag_init_start !== u5.flag_init_start) $sb_5.flag_init_start = u5.flag_init_start;
        if ($sb_5.flag_init_masak !== u5.flag_init_masak) $sb_5.flag_init_masak = u5.flag_init_masak;
        if ($sb_5.suhu_awal !== u5.suhu_awal) $sb_5.suhu_awal = u5.suhu_awal;
        if ($sb_5.suhu_akhir !== u5.suhu_akhir) $sb_5.suhu_akhir = u5.suhu_akhir;
        if ($sb_5.perubahan_waktu !== u5.perubahan_waktu) $sb_5.perubahan_waktu = u5.perubahan_waktu;
        if ($sb_5.tampil_jam_mulai !== u5.tampil_jam_mulai) $sb_5.tampil_jam_mulai = u5.tampil_jam_mulai;
        if ($sb_5.tampil_jam_masak !== u5.tampil_jam_masak) $sb_5.tampil_jam_masak = u5.tampil_jam_masak;
        if ($sb_5.tampil_jam_selesai !== u5.tampil_jam_selesai) $sb_5.tampil_jam_selesai = u5.tampil_jam_selesai;
        if ($sb_5.tampil_durasi_actual !== u5.tampil_durasi_actual) $sb_5.tampil_durasi_actual = u5.tampil_durasi_actual;
        if ($sb_5.tampil_pemanasan !== u5.tampil_pemanasan) $sb_5.tampil_pemanasan = u5.tampil_pemanasan;
        if ($sb5.runStop !== u5.runStop) $sb5.runStop = u5.runStop;
    } else {
        if ($sb5._commOperation !== false) {
            $sb5._commOperation = false;
            $sb_5.status_banner = txtDisabled;
            $sb_5.status_pemanasan = false;
            $sb_5.status_pemasakan = false;
            $sb_5.status_selesai = false;
        }
    }

    // Unit 6
    if ($sb_6.is_active) {
        var u6 = { is_active: true, _commOperation: $sb6._commOperation, _commStatus: $sb6._commStatus, maintenance_mode: $sb_6.maintenance_mode, runStop: $sb6.runStop, temp: $sb6.temp, target_menit: $sb_6.target_menit, adjust_menit: $sb_6.adjust_menit, sisa_detik_masak: $sb_6.sisa_detik_masak, total_detik_pemanasan: $sb_6.total_detik_pemanasan, flag_init_start: $sb_6.flag_init_start, flag_init_masak: $sb_6.flag_init_masak, suhu_awal: $sb_6.suhu_awal, suhu_akhir: $sb_6.suhu_akhir, perubahan_waktu: $sb_6.perubahan_waktu, status_kosong: $sb_6.status_kosong, status_pemanasan: $sb_6.status_pemanasan, status_pemasakan: $sb_6.status_pemasakan, status_selesai: $sb_6.status_selesai, status_banner: $sb_6.status_banner, tampil_jam_mulai: $sb_6.tampil_jam_mulai, tampil_jam_masak: $sb_6.tampil_jam_masak, tampil_jam_selesai: $sb_6.tampil_jam_selesai, tampil_durasi_actual: $sb_6.tampil_durasi_actual, tampil_pemanasan: $sb_6.tampil_pemanasan };
        prosesUnit(u6, 6, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb6._commOperation !== u6._commOperation) $sb6._commOperation = u6._commOperation;
        if ($sb_6.status_banner !== u6.status_banner) $sb_6.status_banner = u6.status_banner;
        if ($sb_6.status_pemanasan !== u6.status_pemanasan) $sb_6.status_pemanasan = u6.status_pemanasan;
        if ($sb_6.status_pemasakan !== u6.status_pemasakan) $sb_6.status_pemasakan = u6.status_pemasakan;
        if ($sb_6.status_selesai !== u6.status_selesai) $sb_6.status_selesai = u6.status_selesai;
        if ($sb_6.status_kosong !== u6.status_kosong) $sb_6.status_kosong = u6.status_kosong;
        if ($sb_6.target_menit !== u6.target_menit) $sb_6.target_menit = u6.target_menit;
        if ($sb_6.adjust_menit !== u6.adjust_menit) $sb_6.adjust_menit = u6.adjust_menit;
        if ($sb_6.sisa_detik_masak !== u6.sisa_detik_masak) $sb_6.sisa_detik_masak = u6.sisa_detik_masak;
        if ($sb_6.total_detik_pemanasan !== u6.total_detik_pemanasan) $sb_6.total_detik_pemanasan = u6.total_detik_pemanasan;
        if ($sb_6.flag_init_start !== u6.flag_init_start) $sb_6.flag_init_start = u6.flag_init_start;
        if ($sb_6.flag_init_masak !== u6.flag_init_masak) $sb_6.flag_init_masak = u6.flag_init_masak;
        if ($sb_6.suhu_awal !== u6.suhu_awal) $sb_6.suhu_awal = u6.suhu_awal;
        if ($sb_6.suhu_akhir !== u6.suhu_akhir) $sb_6.suhu_akhir = u6.suhu_akhir;
        if ($sb_6.perubahan_waktu !== u6.perubahan_waktu) $sb_6.perubahan_waktu = u6.perubahan_waktu;
        if ($sb_6.tampil_jam_mulai !== u6.tampil_jam_mulai) $sb_6.tampil_jam_mulai = u6.tampil_jam_mulai;
        if ($sb_6.tampil_jam_masak !== u6.tampil_jam_masak) $sb_6.tampil_jam_masak = u6.tampil_jam_masak;
        if ($sb_6.tampil_jam_selesai !== u6.tampil_jam_selesai) $sb_6.tampil_jam_selesai = u6.tampil_jam_selesai;
        if ($sb_6.tampil_durasi_actual !== u6.tampil_durasi_actual) $sb_6.tampil_durasi_actual = u6.tampil_durasi_actual;
        if ($sb_6.tampil_pemanasan !== u6.tampil_pemanasan) $sb_6.tampil_pemanasan = u6.tampil_pemanasan;
        if ($sb6.runStop !== u6.runStop) $sb6.runStop = u6.runStop;
    } else {
        if ($sb6._commOperation !== false) {
            $sb6._commOperation = false;
            $sb_6.status_banner = txtDisabled;
            $sb_6.status_pemanasan = false;
            $sb_6.status_pemasakan = false;
            $sb_6.status_selesai = false;
        }
    }

    // Unit 7
    if ($sb_7.is_active) {
        var u7 = { is_active: true, _commOperation: $sb7._commOperation, _commStatus: $sb7._commStatus, maintenance_mode: $sb_7.maintenance_mode, runStop: $sb7.runStop, temp: $sb7.temp, target_menit: $sb_7.target_menit, adjust_menit: $sb_7.adjust_menit, sisa_detik_masak: $sb_7.sisa_detik_masak, total_detik_pemanasan: $sb_7.total_detik_pemanasan, flag_init_start: $sb_7.flag_init_start, flag_init_masak: $sb_7.flag_init_masak, suhu_awal: $sb_7.suhu_awal, suhu_akhir: $sb_7.suhu_akhir, perubahan_waktu: $sb_7.perubahan_waktu, status_kosong: $sb_7.status_kosong, status_pemanasan: $sb_7.status_pemanasan, status_pemasakan: $sb_7.status_pemasakan, status_selesai: $sb_7.status_selesai, status_banner: $sb_7.status_banner, tampil_jam_mulai: $sb_7.tampil_jam_mulai, tampil_jam_masak: $sb_7.tampil_jam_masak, tampil_jam_selesai: $sb_7.tampil_jam_selesai, tampil_durasi_actual: $sb_7.tampil_durasi_actual, tampil_pemanasan: $sb_7.tampil_pemanasan };
        prosesUnit(u7, 7, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb7._commOperation !== u7._commOperation) $sb7._commOperation = u7._commOperation;
        if ($sb_7.status_banner !== u7.status_banner) $sb_7.status_banner = u7.status_banner;
        if ($sb_7.status_pemanasan !== u7.status_pemanasan) $sb_7.status_pemanasan = u7.status_pemanasan;
        if ($sb_7.status_pemasakan !== u7.status_pemasakan) $sb_7.status_pemasakan = u7.status_pemasakan;
        if ($sb_7.status_selesai !== u7.status_selesai) $sb_7.status_selesai = u7.status_selesai;
        if ($sb_7.status_kosong !== u7.status_kosong) $sb_7.status_kosong = u7.status_kosong;
        if ($sb_7.target_menit !== u7.target_menit) $sb_7.target_menit = u7.target_menit;
        if ($sb_7.adjust_menit !== u7.adjust_menit) $sb_7.adjust_menit = u7.adjust_menit;
        if ($sb_7.sisa_detik_masak !== u7.sisa_detik_masak) $sb_7.sisa_detik_masak = u7.sisa_detik_masak;
        if ($sb_7.total_detik_pemanasan !== u7.total_detik_pemanasan) $sb_7.total_detik_pemanasan = u7.total_detik_pemanasan;
        if ($sb_7.flag_init_start !== u7.flag_init_start) $sb_7.flag_init_start = u7.flag_init_start;
        if ($sb_7.flag_init_masak !== u7.flag_init_masak) $sb_7.flag_init_masak = u7.flag_init_masak;
        if ($sb_7.suhu_awal !== u7.suhu_awal) $sb_7.suhu_awal = u7.suhu_awal;
        if ($sb_7.suhu_akhir !== u7.suhu_akhir) $sb_7.suhu_akhir = u7.suhu_akhir;
        if ($sb_7.perubahan_waktu !== u7.perubahan_waktu) $sb_7.perubahan_waktu = u7.perubahan_waktu;
        if ($sb_7.tampil_jam_mulai !== u7.tampil_jam_mulai) $sb_7.tampil_jam_mulai = u7.tampil_jam_mulai;
        if ($sb_7.tampil_jam_masak !== u7.tampil_jam_masak) $sb_7.tampil_jam_masak = u7.tampil_jam_masak;
        if ($sb_7.tampil_jam_selesai !== u7.tampil_jam_selesai) $sb_7.tampil_jam_selesai = u7.tampil_jam_selesai;
        if ($sb_7.tampil_durasi_actual !== u7.tampil_durasi_actual) $sb_7.tampil_durasi_actual = u7.tampil_durasi_actual;
        if ($sb_7.tampil_pemanasan !== u7.tampil_pemanasan) $sb_7.tampil_pemanasan = u7.tampil_pemanasan;
        if ($sb7.runStop !== u7.runStop) $sb7.runStop = u7.runStop;
    } else {
        if ($sb7._commOperation !== false) {
            $sb7._commOperation = false;
            $sb_7.status_banner = txtDisabled;
            $sb_7.status_pemanasan = false;
            $sb_7.status_pemasakan = false;
            $sb_7.status_selesai = false;
        }
    }

    // Unit 8
    if ($sb_8.is_active) {
        var u8 = { is_active: true, _commOperation: $sb8._commOperation, _commStatus: $sb8._commStatus, maintenance_mode: $sb_8.maintenance_mode, runStop: $sb8.runStop, temp: $sb8.temp, target_menit: $sb_8.target_menit, adjust_menit: $sb_8.adjust_menit, sisa_detik_masak: $sb_8.sisa_detik_masak, total_detik_pemanasan: $sb_8.total_detik_pemanasan, flag_init_start: $sb_8.flag_init_start, flag_init_masak: $sb_8.flag_init_masak, suhu_awal: $sb_8.suhu_awal, suhu_akhir: $sb_8.suhu_akhir, perubahan_waktu: $sb_8.perubahan_waktu, status_kosong: $sb_8.status_kosong, status_pemanasan: $sb_8.status_pemanasan, status_pemasakan: $sb_8.status_pemasakan, status_selesai: $sb_8.status_selesai, status_banner: $sb_8.status_banner, tampil_jam_mulai: $sb_8.tampil_jam_mulai, tampil_jam_masak: $sb_8.tampil_jam_masak, tampil_jam_selesai: $sb_8.tampil_jam_selesai, tampil_durasi_actual: $sb_8.tampil_durasi_actual, tampil_pemanasan: $sb_8.tampil_pemanasan };
        prosesUnit(u8, 8, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb8._commOperation !== u8._commOperation) $sb8._commOperation = u8._commOperation;
        if ($sb_8.status_banner !== u8.status_banner) $sb_8.status_banner = u8.status_banner;
        if ($sb_8.status_pemanasan !== u8.status_pemanasan) $sb_8.status_pemanasan = u8.status_pemanasan;
        if ($sb_8.status_pemasakan !== u8.status_pemasakan) $sb_8.status_pemasakan = u8.status_pemasakan;
        if ($sb_8.status_selesai !== u8.status_selesai) $sb_8.status_selesai = u8.status_selesai;
        if ($sb_8.status_kosong !== u8.status_kosong) $sb_8.status_kosong = u8.status_kosong;
        if ($sb_8.target_menit !== u8.target_menit) $sb_8.target_menit = u8.target_menit;
        if ($sb_8.adjust_menit !== u8.adjust_menit) $sb_8.adjust_menit = u8.adjust_menit;
        if ($sb_8.sisa_detik_masak !== u8.sisa_detik_masak) $sb_8.sisa_detik_masak = u8.sisa_detik_masak;
        if ($sb_8.total_detik_pemanasan !== u8.total_detik_pemanasan) $sb_8.total_detik_pemanasan = u8.total_detik_pemanasan;
        if ($sb_8.flag_init_start !== u8.flag_init_start) $sb_8.flag_init_start = u8.flag_init_start;
        if ($sb_8.flag_init_masak !== u8.flag_init_masak) $sb_8.flag_init_masak = u8.flag_init_masak;
        if ($sb_8.suhu_awal !== u8.suhu_awal) $sb_8.suhu_awal = u8.suhu_awal;
        if ($sb_8.suhu_akhir !== u8.suhu_akhir) $sb_8.suhu_akhir = u8.suhu_akhir;
        if ($sb_8.perubahan_waktu !== u8.perubahan_waktu) $sb_8.perubahan_waktu = u8.perubahan_waktu;
        if ($sb_8.tampil_jam_mulai !== u8.tampil_jam_mulai) $sb_8.tampil_jam_mulai = u8.tampil_jam_mulai;
        if ($sb_8.tampil_jam_masak !== u8.tampil_jam_masak) $sb_8.tampil_jam_masak = u8.tampil_jam_masak;
        if ($sb_8.tampil_jam_selesai !== u8.tampil_jam_selesai) $sb_8.tampil_jam_selesai = u8.tampil_jam_selesai;
        if ($sb_8.tampil_durasi_actual !== u8.tampil_durasi_actual) $sb_8.tampil_durasi_actual = u8.tampil_durasi_actual;
        if ($sb_8.tampil_pemanasan !== u8.tampil_pemanasan) $sb_8.tampil_pemanasan = u8.tampil_pemanasan;
        if ($sb8.runStop !== u8.runStop) $sb8.runStop = u8.runStop;
    } else {
        if ($sb8._commOperation !== false) {
            $sb8._commOperation = false;
            $sb_8.status_banner = txtDisabled;
            $sb_8.status_pemanasan = false;
            $sb_8.status_pemasakan = false;
            $sb_8.status_selesai = false;
        }
    }

    // Unit 9
    if ($sb_9.is_active) {
        var u9 = { is_active: true, _commOperation: $sb9._commOperation, _commStatus: $sb9._commStatus, maintenance_mode: $sb_9.maintenance_mode, runStop: $sb9.runStop, temp: $sb9.temp, target_menit: $sb_9.target_menit, adjust_menit: $sb_9.adjust_menit, sisa_detik_masak: $sb_9.sisa_detik_masak, total_detik_pemanasan: $sb_9.total_detik_pemanasan, flag_init_start: $sb_9.flag_init_start, flag_init_masak: $sb_9.flag_init_masak, suhu_awal: $sb_9.suhu_awal, suhu_akhir: $sb_9.suhu_akhir, perubahan_waktu: $sb_9.perubahan_waktu, status_kosong: $sb_9.status_kosong, status_pemanasan: $sb_9.status_pemanasan, status_pemasakan: $sb_9.status_pemasakan, status_selesai: $sb_9.status_selesai, status_banner: $sb_9.status_banner, tampil_jam_mulai: $sb_9.tampil_jam_mulai, tampil_jam_masak: $sb_9.tampil_jam_masak, tampil_jam_selesai: $sb_9.tampil_jam_selesai, tampil_durasi_actual: $sb_9.tampil_durasi_actual, tampil_pemanasan: $sb_9.tampil_pemanasan };
        prosesUnit(u9, 9, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb9._commOperation !== u9._commOperation) $sb9._commOperation = u9._commOperation;
        if ($sb_9.status_banner !== u9.status_banner) $sb_9.status_banner = u9.status_banner;
        if ($sb_9.status_pemanasan !== u9.status_pemanasan) $sb_9.status_pemanasan = u9.status_pemanasan;
        if ($sb_9.status_pemasakan !== u9.status_pemasakan) $sb_9.status_pemasakan = u9.status_pemasakan;
        if ($sb_9.status_selesai !== u9.status_selesai) $sb_9.status_selesai = u9.status_selesai;
        if ($sb_9.status_kosong !== u9.status_kosong) $sb_9.status_kosong = u9.status_kosong;
        if ($sb_9.target_menit !== u9.target_menit) $sb_9.target_menit = u9.target_menit;
        if ($sb_9.adjust_menit !== u9.adjust_menit) $sb_9.adjust_menit = u9.adjust_menit;
        if ($sb_9.sisa_detik_masak !== u9.sisa_detik_masak) $sb_9.sisa_detik_masak = u9.sisa_detik_masak;
        if ($sb_9.total_detik_pemanasan !== u9.total_detik_pemanasan) $sb_9.total_detik_pemanasan = u9.total_detik_pemanasan;
        if ($sb_9.flag_init_start !== u9.flag_init_start) $sb_9.flag_init_start = u9.flag_init_start;
        if ($sb_9.flag_init_masak !== u9.flag_init_masak) $sb_9.flag_init_masak = u9.flag_init_masak;
        if ($sb_9.suhu_awal !== u9.suhu_awal) $sb_9.suhu_awal = u9.suhu_awal;
        if ($sb_9.suhu_akhir !== u9.suhu_akhir) $sb_9.suhu_akhir = u9.suhu_akhir;
        if ($sb_9.perubahan_waktu !== u9.perubahan_waktu) $sb_9.perubahan_waktu = u9.perubahan_waktu;
        if ($sb_9.tampil_jam_mulai !== u9.tampil_jam_mulai) $sb_9.tampil_jam_mulai = u9.tampil_jam_mulai;
        if ($sb_9.tampil_jam_masak !== u9.tampil_jam_masak) $sb_9.tampil_jam_masak = u9.tampil_jam_masak;
        if ($sb_9.tampil_jam_selesai !== u9.tampil_jam_selesai) $sb_9.tampil_jam_selesai = u9.tampil_jam_selesai;
        if ($sb_9.tampil_durasi_actual !== u9.tampil_durasi_actual) $sb_9.tampil_durasi_actual = u9.tampil_durasi_actual;
        if ($sb_9.tampil_pemanasan !== u9.tampil_pemanasan) $sb_9.tampil_pemanasan = u9.tampil_pemanasan;
        if ($sb9.runStop !== u9.runStop) $sb9.runStop = u9.runStop;
    } else {
        if ($sb9._commOperation !== false) {
            $sb9._commOperation = false;
            $sb_9.status_banner = txtDisabled;
            $sb_9.status_pemanasan = false;
            $sb_9.status_pemasakan = false;
            $sb_9.status_selesai = false;
        }
    }

    // Unit 10
    if ($sb_10.is_active) {
        var u10 = { is_active: true, _commOperation: $sb10._commOperation, _commStatus: $sb10._commStatus, maintenance_mode: $sb_10.maintenance_mode, runStop: $sb10.runStop, temp: $sb10.temp, target_menit: $sb_10.target_menit, adjust_menit: $sb_10.adjust_menit, sisa_detik_masak: $sb_10.sisa_detik_masak, total_detik_pemanasan: $sb_10.total_detik_pemanasan, flag_init_start: $sb_10.flag_init_start, flag_init_masak: $sb_10.flag_init_masak, suhu_awal: $sb_10.suhu_awal, suhu_akhir: $sb_10.suhu_akhir, perubahan_waktu: $sb_10.perubahan_waktu, status_kosong: $sb_10.status_kosong, status_pemanasan: $sb_10.status_pemanasan, status_pemasakan: $sb_10.status_pemasakan, status_selesai: $sb_10.status_selesai, status_banner: $sb_10.status_banner, tampil_jam_mulai: $sb_10.tampil_jam_mulai, tampil_jam_masak: $sb_10.tampil_jam_masak, tampil_jam_selesai: $sb_10.tampil_jam_selesai, tampil_durasi_actual: $sb_10.tampil_durasi_actual, tampil_pemanasan: $sb_10.tampil_pemanasan };
        prosesUnit(u10, 10, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb10._commOperation !== u10._commOperation) $sb10._commOperation = u10._commOperation;
        if ($sb_10.status_banner !== u10.status_banner) $sb_10.status_banner = u10.status_banner;
        if ($sb_10.status_pemanasan !== u10.status_pemanasan) $sb_10.status_pemanasan = u10.status_pemanasan;
        if ($sb_10.status_pemasakan !== u10.status_pemasakan) $sb_10.status_pemasakan = u10.status_pemasakan;
        if ($sb_10.status_selesai !== u10.status_selesai) $sb_10.status_selesai = u10.status_selesai;
        if ($sb_10.status_kosong !== u10.status_kosong) $sb_10.status_kosong = u10.status_kosong;
        if ($sb_10.target_menit !== u10.target_menit) $sb_10.target_menit = u10.target_menit;
        if ($sb_10.adjust_menit !== u10.adjust_menit) $sb_10.adjust_menit = u10.adjust_menit;
        if ($sb_10.sisa_detik_masak !== u10.sisa_detik_masak) $sb_10.sisa_detik_masak = u10.sisa_detik_masak;
        if ($sb_10.total_detik_pemanasan !== u10.total_detik_pemanasan) $sb_10.total_detik_pemanasan = u10.total_detik_pemanasan;
        if ($sb_10.flag_init_start !== u10.flag_init_start) $sb_10.flag_init_start = u10.flag_init_start;
        if ($sb_10.flag_init_masak !== u10.flag_init_masak) $sb_10.flag_init_masak = u10.flag_init_masak;
        if ($sb_10.suhu_awal !== u10.suhu_awal) $sb_10.suhu_awal = u10.suhu_awal;
        if ($sb_10.suhu_akhir !== u10.suhu_akhir) $sb_10.suhu_akhir = u10.suhu_akhir;
        if ($sb_10.perubahan_waktu !== u10.perubahan_waktu) $sb_10.perubahan_waktu = u10.perubahan_waktu;
        if ($sb_10.tampil_jam_mulai !== u10.tampil_jam_mulai) $sb_10.tampil_jam_mulai = u10.tampil_jam_mulai;
        if ($sb_10.tampil_jam_masak !== u10.tampil_jam_masak) $sb_10.tampil_jam_masak = u10.tampil_jam_masak;
        if ($sb_10.tampil_jam_selesai !== u10.tampil_jam_selesai) $sb_10.tampil_jam_selesai = u10.tampil_jam_selesai;
        if ($sb_10.tampil_durasi_actual !== u10.tampil_durasi_actual) $sb_10.tampil_durasi_actual = u10.tampil_durasi_actual;
        if ($sb_10.tampil_pemanasan !== u10.tampil_pemanasan) $sb_10.tampil_pemanasan = u10.tampil_pemanasan;
        if ($sb10.runStop !== u10.runStop) $sb10.runStop = u10.runStop;
    } else {
        if ($sb10._commOperation !== false) {
            $sb10._commOperation = false;
            $sb_10.status_banner = txtDisabled;
            $sb_10.status_pemanasan = false;
            $sb_10.status_pemasakan = false;
            $sb_10.status_selesai = false;
        }
    }

    // Unit 11
    if ($sb_11.is_active) {
        var u11 = { is_active: true, _commOperation: $sb11._commOperation, _commStatus: $sb11._commStatus, maintenance_mode: $sb_11.maintenance_mode, runStop: $sb11.runStop, temp: $sb11.temp, target_menit: $sb_11.target_menit, adjust_menit: $sb_11.adjust_menit, sisa_detik_masak: $sb_11.sisa_detik_masak, total_detik_pemanasan: $sb_11.total_detik_pemanasan, flag_init_start: $sb_11.flag_init_start, flag_init_masak: $sb_11.flag_init_masak, suhu_awal: $sb_11.suhu_awal, suhu_akhir: $sb_11.suhu_akhir, perubahan_waktu: $sb_11.perubahan_waktu, status_kosong: $sb_11.status_kosong, status_pemanasan: $sb_11.status_pemanasan, status_pemasakan: $sb_11.status_pemasakan, status_selesai: $sb_11.status_selesai, status_banner: $sb_11.status_banner, tampil_jam_mulai: $sb_11.tampil_jam_mulai, tampil_jam_masak: $sb_11.tampil_jam_masak, tampil_jam_selesai: $sb_11.tampil_jam_selesai, tampil_durasi_actual: $sb_11.tampil_durasi_actual, tampil_pemanasan: $sb_11.tampil_pemanasan };
        prosesUnit(u11, 11, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb11._commOperation !== u11._commOperation) $sb11._commOperation = u11._commOperation;
        if ($sb_11.status_banner !== u11.status_banner) $sb_11.status_banner = u11.status_banner;
        if ($sb_11.status_pemanasan !== u11.status_pemanasan) $sb_11.status_pemanasan = u11.status_pemanasan;
        if ($sb_11.status_pemasakan !== u11.status_pemasakan) $sb_11.status_pemasakan = u11.status_pemasakan;
        if ($sb_11.status_selesai !== u11.status_selesai) $sb_11.status_selesai = u11.status_selesai;
        if ($sb_11.status_kosong !== u11.status_kosong) $sb_11.status_kosong = u11.status_kosong;
        if ($sb_11.target_menit !== u11.target_menit) $sb_11.target_menit = u11.target_menit;
        if ($sb_11.adjust_menit !== u11.adjust_menit) $sb_11.adjust_menit = u11.adjust_menit;
        if ($sb_11.sisa_detik_masak !== u11.sisa_detik_masak) $sb_11.sisa_detik_masak = u11.sisa_detik_masak;
        if ($sb_11.total_detik_pemanasan !== u11.total_detik_pemanasan) $sb_11.total_detik_pemanasan = u11.total_detik_pemanasan;
        if ($sb_11.flag_init_start !== u11.flag_init_start) $sb_11.flag_init_start = u11.flag_init_start;
        if ($sb_11.flag_init_masak !== u11.flag_init_masak) $sb_11.flag_init_masak = u11.flag_init_masak;
        if ($sb_11.suhu_awal !== u11.suhu_awal) $sb_11.suhu_awal = u11.suhu_awal;
        if ($sb_11.suhu_akhir !== u11.suhu_akhir) $sb_11.suhu_akhir = u11.suhu_akhir;
        if ($sb_11.perubahan_waktu !== u11.perubahan_waktu) $sb_11.perubahan_waktu = u11.perubahan_waktu;
        if ($sb_11.tampil_jam_mulai !== u11.tampil_jam_mulai) $sb_11.tampil_jam_mulai = u11.tampil_jam_mulai;
        if ($sb_11.tampil_jam_masak !== u11.tampil_jam_masak) $sb_11.tampil_jam_masak = u11.tampil_jam_masak;
        if ($sb_11.tampil_jam_selesai !== u11.tampil_jam_selesai) $sb_11.tampil_jam_selesai = u11.tampil_jam_selesai;
        if ($sb_11.tampil_durasi_actual !== u11.tampil_durasi_actual) $sb_11.tampil_durasi_actual = u11.tampil_durasi_actual;
        if ($sb_11.tampil_pemanasan !== u11.tampil_pemanasan) $sb_11.tampil_pemanasan = u11.tampil_pemanasan;
        if ($sb11.runStop !== u11.runStop) $sb11.runStop = u11.runStop;
    } else {
        if ($sb11._commOperation !== false) {
            $sb11._commOperation = false;
            $sb_11.status_banner = txtDisabled;
            $sb_11.status_pemanasan = false;
            $sb_11.status_pemasakan = false;
            $sb_11.status_selesai = false;
        }
    }

    // Unit 12
    if ($sb_12.is_active) {
        var u12 = { is_active: true, _commOperation: $sb12._commOperation, _commStatus: $sb12._commStatus, maintenance_mode: $sb_12.maintenance_mode, runStop: $sb12.runStop, temp: $sb12.temp, target_menit: $sb_12.target_menit, adjust_menit: $sb_12.adjust_menit, sisa_detik_masak: $sb_12.sisa_detik_masak, total_detik_pemanasan: $sb_12.total_detik_pemanasan, flag_init_start: $sb_12.flag_init_start, flag_init_masak: $sb_12.flag_init_masak, suhu_awal: $sb_12.suhu_awal, suhu_akhir: $sb_12.suhu_akhir, perubahan_waktu: $sb_12.perubahan_waktu, status_kosong: $sb_12.status_kosong, status_pemanasan: $sb_12.status_pemanasan, status_pemasakan: $sb_12.status_pemasakan, status_selesai: $sb_12.status_selesai, status_banner: $sb_12.status_banner, tampil_jam_mulai: $sb_12.tampil_jam_mulai, tampil_jam_masak: $sb_12.tampil_jam_masak, tampil_jam_selesai: $sb_12.tampil_jam_selesai, tampil_durasi_actual: $sb_12.tampil_durasi_actual, tampil_pemanasan: $sb_12.tampil_pemanasan };
        prosesUnit(u12, 12, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb12._commOperation !== u12._commOperation) $sb12._commOperation = u12._commOperation;
        if ($sb_12.status_banner !== u12.status_banner) $sb_12.status_banner = u12.status_banner;
        if ($sb_12.status_pemanasan !== u12.status_pemanasan) $sb_12.status_pemanasan = u12.status_pemanasan;
        if ($sb_12.status_pemasakan !== u12.status_pemasakan) $sb_12.status_pemasakan = u12.status_pemasakan;
        if ($sb_12.status_selesai !== u12.status_selesai) $sb_12.status_selesai = u12.status_selesai;
        if ($sb_12.status_kosong !== u12.status_kosong) $sb_12.status_kosong = u12.status_kosong;
        if ($sb_12.target_menit !== u12.target_menit) $sb_12.target_menit = u12.target_menit;
        if ($sb_12.adjust_menit !== u12.adjust_menit) $sb_12.adjust_menit = u12.adjust_menit;
        if ($sb_12.sisa_detik_masak !== u12.sisa_detik_masak) $sb_12.sisa_detik_masak = u12.sisa_detik_masak;
        if ($sb_12.total_detik_pemanasan !== u12.total_detik_pemanasan) $sb_12.total_detik_pemanasan = u12.total_detik_pemanasan;
        if ($sb_12.flag_init_start !== u12.flag_init_start) $sb_12.flag_init_start = u12.flag_init_start;
        if ($sb_12.flag_init_masak !== u12.flag_init_masak) $sb_12.flag_init_masak = u12.flag_init_masak;
        if ($sb_12.suhu_awal !== u12.suhu_awal) $sb_12.suhu_awal = u12.suhu_awal;
        if ($sb_12.suhu_akhir !== u12.suhu_akhir) $sb_12.suhu_akhir = u12.suhu_akhir;
        if ($sb_12.perubahan_waktu !== u12.perubahan_waktu) $sb_12.perubahan_waktu = u12.perubahan_waktu;
        if ($sb_12.tampil_jam_mulai !== u12.tampil_jam_mulai) $sb_12.tampil_jam_mulai = u12.tampil_jam_mulai;
        if ($sb_12.tampil_jam_masak !== u12.tampil_jam_masak) $sb_12.tampil_jam_masak = u12.tampil_jam_masak;
        if ($sb_12.tampil_jam_selesai !== u12.tampil_jam_selesai) $sb_12.tampil_jam_selesai = u12.tampil_jam_selesai;
        if ($sb_12.tampil_durasi_actual !== u12.tampil_durasi_actual) $sb_12.tampil_durasi_actual = u12.tampil_durasi_actual;
        if ($sb_12.tampil_pemanasan !== u12.tampil_pemanasan) $sb_12.tampil_pemanasan = u12.tampil_pemanasan;
        if ($sb12.runStop !== u12.runStop) $sb12.runStop = u12.runStop;
    } else {
        if ($sb12._commOperation !== false) {
            $sb12._commOperation = false;
            $sb_12.status_banner = txtDisabled;
            $sb_12.status_pemanasan = false;
            $sb_12.status_pemasakan = false;
            $sb_12.status_selesai = false;
        }
    }

    // Unit 13
    if ($sb_13.is_active) {
        var u13 = { is_active: true, _commOperation: $sb13._commOperation, _commStatus: $sb13._commStatus, maintenance_mode: $sb_13.maintenance_mode, runStop: $sb13.runStop, temp: $sb13.temp, target_menit: $sb_13.target_menit, adjust_menit: $sb_13.adjust_menit, sisa_detik_masak: $sb_13.sisa_detik_masak, total_detik_pemanasan: $sb_13.total_detik_pemanasan, flag_init_start: $sb_13.flag_init_start, flag_init_masak: $sb_13.flag_init_masak, suhu_awal: $sb_13.suhu_awal, suhu_akhir: $sb_13.suhu_akhir, perubahan_waktu: $sb_13.perubahan_waktu, status_kosong: $sb_13.status_kosong, status_pemanasan: $sb_13.status_pemanasan, status_pemasakan: $sb_13.status_pemasakan, status_selesai: $sb_13.status_selesai, status_banner: $sb_13.status_banner, tampil_jam_mulai: $sb_13.tampil_jam_mulai, tampil_jam_masak: $sb_13.tampil_jam_masak, tampil_jam_selesai: $sb_13.tampil_jam_selesai, tampil_durasi_actual: $sb_13.tampil_durasi_actual, tampil_pemanasan: $sb_13.tampil_pemanasan };
        prosesUnit(u13, 13, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb13._commOperation !== u13._commOperation) $sb13._commOperation = u13._commOperation;
        if ($sb_13.status_banner !== u13.status_banner) $sb_13.status_banner = u13.status_banner;
        if ($sb_13.status_pemanasan !== u13.status_pemanasan) $sb_13.status_pemanasan = u13.status_pemanasan;
        if ($sb_13.status_pemasakan !== u13.status_pemasakan) $sb_13.status_pemasakan = u13.status_pemasakan;
        if ($sb_13.status_selesai !== u13.status_selesai) $sb_13.status_selesai = u13.status_selesai;
        if ($sb_13.status_kosong !== u13.status_kosong) $sb_13.status_kosong = u13.status_kosong;
        if ($sb_13.target_menit !== u13.target_menit) $sb_13.target_menit = u13.target_menit;
        if ($sb_13.adjust_menit !== u13.adjust_menit) $sb_13.adjust_menit = u13.adjust_menit;
        if ($sb_13.sisa_detik_masak !== u13.sisa_detik_masak) $sb_13.sisa_detik_masak = u13.sisa_detik_masak;
        if ($sb_13.total_detik_pemanasan !== u13.total_detik_pemanasan) $sb_13.total_detik_pemanasan = u13.total_detik_pemanasan;
        if ($sb_13.flag_init_start !== u13.flag_init_start) $sb_13.flag_init_start = u13.flag_init_start;
        if ($sb_13.flag_init_masak !== u13.flag_init_masak) $sb_13.flag_init_masak = u13.flag_init_masak;
        if ($sb_13.suhu_awal !== u13.suhu_awal) $sb_13.suhu_awal = u13.suhu_awal;
        if ($sb_13.suhu_akhir !== u13.suhu_akhir) $sb_13.suhu_akhir = u13.suhu_akhir;
        if ($sb_13.perubahan_waktu !== u13.perubahan_waktu) $sb_13.perubahan_waktu = u13.perubahan_waktu;
        if ($sb_13.tampil_jam_mulai !== u13.tampil_jam_mulai) $sb_13.tampil_jam_mulai = u13.tampil_jam_mulai;
        if ($sb_13.tampil_jam_masak !== u13.tampil_jam_masak) $sb_13.tampil_jam_masak = u13.tampil_jam_masak;
        if ($sb_13.tampil_jam_selesai !== u13.tampil_jam_selesai) $sb_13.tampil_jam_selesai = u13.tampil_jam_selesai;
        if ($sb_13.tampil_durasi_actual !== u13.tampil_durasi_actual) $sb_13.tampil_durasi_actual = u13.tampil_durasi_actual;
        if ($sb_13.tampil_pemanasan !== u13.tampil_pemanasan) $sb_13.tampil_pemanasan = u13.tampil_pemanasan;
        if ($sb13.runStop !== u13.runStop) $sb13.runStop = u13.runStop;
    } else {
        if ($sb13._commOperation !== false) {
            $sb13._commOperation = false;
            $sb_13.status_banner = txtDisabled;
            $sb_13.status_pemanasan = false;
            $sb_13.status_pemasakan = false;
            $sb_13.status_selesai = false;
        }
    }

    // Unit 14
    if ($sb_14.is_active) {
        var u14 = { is_active: true, _commOperation: $sb14._commOperation, _commStatus: $sb14._commStatus, maintenance_mode: $sb_14.maintenance_mode, runStop: $sb14.runStop, temp: $sb14.temp, target_menit: $sb_14.target_menit, adjust_menit: $sb_14.adjust_menit, sisa_detik_masak: $sb_14.sisa_detik_masak, total_detik_pemanasan: $sb_14.total_detik_pemanasan, flag_init_start: $sb_14.flag_init_start, flag_init_masak: $sb_14.flag_init_masak, suhu_awal: $sb_14.suhu_awal, suhu_akhir: $sb_14.suhu_akhir, perubahan_waktu: $sb_14.perubahan_waktu, status_kosong: $sb_14.status_kosong, status_pemanasan: $sb_14.status_pemanasan, status_pemasakan: $sb_14.status_pemasakan, status_selesai: $sb_14.status_selesai, status_banner: $sb_14.status_banner, tampil_jam_mulai: $sb_14.tampil_jam_mulai, tampil_jam_masak: $sb_14.tampil_jam_masak, tampil_jam_selesai: $sb_14.tampil_jam_selesai, tampil_durasi_actual: $sb_14.tampil_durasi_actual, tampil_pemanasan: $sb_14.tampil_pemanasan };
        prosesUnit(u14, 14, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb14._commOperation !== u14._commOperation) $sb14._commOperation = u14._commOperation;
        if ($sb_14.status_banner !== u14.status_banner) $sb_14.status_banner = u14.status_banner;
        if ($sb_14.status_pemanasan !== u14.status_pemanasan) $sb_14.status_pemanasan = u14.status_pemanasan;
        if ($sb_14.status_pemasakan !== u14.status_pemasakan) $sb_14.status_pemasakan = u14.status_pemasakan;
        if ($sb_14.status_selesai !== u14.status_selesai) $sb_14.status_selesai = u14.status_selesai;
        if ($sb_14.status_kosong !== u14.status_kosong) $sb_14.status_kosong = u14.status_kosong;
        if ($sb_14.target_menit !== u14.target_menit) $sb_14.target_menit = u14.target_menit;
        if ($sb_14.adjust_menit !== u14.adjust_menit) $sb_14.adjust_menit = u14.adjust_menit;
        if ($sb_14.sisa_detik_masak !== u14.sisa_detik_masak) $sb_14.sisa_detik_masak = u14.sisa_detik_masak;
        if ($sb_14.total_detik_pemanasan !== u14.total_detik_pemanasan) $sb_14.total_detik_pemanasan = u14.total_detik_pemanasan;
        if ($sb_14.flag_init_start !== u14.flag_init_start) $sb_14.flag_init_start = u14.flag_init_start;
        if ($sb_14.flag_init_masak !== u14.flag_init_masak) $sb_14.flag_init_masak = u14.flag_init_masak;
        if ($sb_14.suhu_awal !== u14.suhu_awal) $sb_14.suhu_awal = u14.suhu_awal;
        if ($sb_14.suhu_akhir !== u14.suhu_akhir) $sb_14.suhu_akhir = u14.suhu_akhir;
        if ($sb_14.perubahan_waktu !== u14.perubahan_waktu) $sb_14.perubahan_waktu = u14.perubahan_waktu;
        if ($sb_14.tampil_jam_mulai !== u14.tampil_jam_mulai) $sb_14.tampil_jam_mulai = u14.tampil_jam_mulai;
        if ($sb_14.tampil_jam_masak !== u14.tampil_jam_masak) $sb_14.tampil_jam_masak = u14.tampil_jam_masak;
        if ($sb_14.tampil_jam_selesai !== u14.tampil_jam_selesai) $sb_14.tampil_jam_selesai = u14.tampil_jam_selesai;
        if ($sb_14.tampil_durasi_actual !== u14.tampil_durasi_actual) $sb_14.tampil_durasi_actual = u14.tampil_durasi_actual;
        if ($sb_14.tampil_pemanasan !== u14.tampil_pemanasan) $sb_14.tampil_pemanasan = u14.tampil_pemanasan;
        if ($sb14.runStop !== u14.runStop) $sb14.runStop = u14.runStop;
    } else {
        if ($sb14._commOperation !== false) {
            $sb14._commOperation = false;
            $sb_14.status_banner = txtDisabled;
            $sb_14.status_pemanasan = false;
            $sb_14.status_pemasakan = false;
            $sb_14.status_selesai = false;
        }
    }

    // Unit 15
    if ($sb_15.is_active) {
        var u15 = { is_active: true, _commOperation: $sb15._commOperation, _commStatus: $sb15._commStatus, maintenance_mode: $sb_15.maintenance_mode, runStop: $sb15.runStop, temp: $sb15.temp, target_menit: $sb_15.target_menit, adjust_menit: $sb_15.adjust_menit, sisa_detik_masak: $sb_15.sisa_detik_masak, total_detik_pemanasan: $sb_15.total_detik_pemanasan, flag_init_start: $sb_15.flag_init_start, flag_init_masak: $sb_15.flag_init_masak, suhu_awal: $sb_15.suhu_awal, suhu_akhir: $sb_15.suhu_akhir, perubahan_waktu: $sb_15.perubahan_waktu, status_kosong: $sb_15.status_kosong, status_pemanasan: $sb_15.status_pemanasan, status_pemasakan: $sb_15.status_pemasakan, status_selesai: $sb_15.status_selesai, status_banner: $sb_15.status_banner, tampil_jam_mulai: $sb_15.tampil_jam_mulai, tampil_jam_masak: $sb_15.tampil_jam_masak, tampil_jam_selesai: $sb_15.tampil_jam_selesai, tampil_durasi_actual: $sb_15.tampil_durasi_actual, tampil_pemanasan: $sb_15.tampil_pemanasan };
        prosesUnit(u15, 15, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb15._commOperation !== u15._commOperation) $sb15._commOperation = u15._commOperation;
        if ($sb_15.status_banner !== u15.status_banner) $sb_15.status_banner = u15.status_banner;
        if ($sb_15.status_pemanasan !== u15.status_pemanasan) $sb_15.status_pemanasan = u15.status_pemanasan;
        if ($sb_15.status_pemasakan !== u15.status_pemasakan) $sb_15.status_pemasakan = u15.status_pemasakan;
        if ($sb_15.status_selesai !== u15.status_selesai) $sb_15.status_selesai = u15.status_selesai;
        if ($sb_15.status_kosong !== u15.status_kosong) $sb_15.status_kosong = u15.status_kosong;
        if ($sb_15.target_menit !== u15.target_menit) $sb_15.target_menit = u15.target_menit;
        if ($sb_15.adjust_menit !== u15.adjust_menit) $sb_15.adjust_menit = u15.adjust_menit;
        if ($sb_15.sisa_detik_masak !== u15.sisa_detik_masak) $sb_15.sisa_detik_masak = u15.sisa_detik_masak;
        if ($sb_15.total_detik_pemanasan !== u15.total_detik_pemanasan) $sb_15.total_detik_pemanasan = u15.total_detik_pemanasan;
        if ($sb_15.flag_init_start !== u15.flag_init_start) $sb_15.flag_init_start = u15.flag_init_start;
        if ($sb_15.flag_init_masak !== u15.flag_init_masak) $sb_15.flag_init_masak = u15.flag_init_masak;
        if ($sb_15.suhu_awal !== u15.suhu_awal) $sb_15.suhu_awal = u15.suhu_awal;
        if ($sb_15.suhu_akhir !== u15.suhu_akhir) $sb_15.suhu_akhir = u15.suhu_akhir;
        if ($sb_15.perubahan_waktu !== u15.perubahan_waktu) $sb_15.perubahan_waktu = u15.perubahan_waktu;
        if ($sb_15.tampil_jam_mulai !== u15.tampil_jam_mulai) $sb_15.tampil_jam_mulai = u15.tampil_jam_mulai;
        if ($sb_15.tampil_jam_masak !== u15.tampil_jam_masak) $sb_15.tampil_jam_masak = u15.tampil_jam_masak;
        if ($sb_15.tampil_jam_selesai !== u15.tampil_jam_selesai) $sb_15.tampil_jam_selesai = u15.tampil_jam_selesai;
        if ($sb_15.tampil_durasi_actual !== u15.tampil_durasi_actual) $sb_15.tampil_durasi_actual = u15.tampil_durasi_actual;
        if ($sb_15.tampil_pemanasan !== u15.tampil_pemanasan) $sb_15.tampil_pemanasan = u15.tampil_pemanasan;
        if ($sb15.runStop !== u15.runStop) $sb15.runStop = u15.runStop;
    } else {
        if ($sb15._commOperation !== false) {
            $sb15._commOperation = false;
            $sb_15.status_banner = txtDisabled;
            $sb_15.status_pemanasan = false;
            $sb_15.status_pemasakan = false;
            $sb_15.status_selesai = false;
        }
    }

    // Unit 16
    if ($sb_16.is_active) {
        var u16 = { is_active: true, _commOperation: $sb16._commOperation, _commStatus: $sb16._commStatus, maintenance_mode: $sb_16.maintenance_mode, runStop: $sb16.runStop, temp: $sb16.temp, target_menit: $sb_16.target_menit, adjust_menit: $sb_16.adjust_menit, sisa_detik_masak: $sb_16.sisa_detik_masak, total_detik_pemanasan: $sb_16.total_detik_pemanasan, flag_init_start: $sb_16.flag_init_start, flag_init_masak: $sb_16.flag_init_masak, suhu_awal: $sb_16.suhu_awal, suhu_akhir: $sb_16.suhu_akhir, perubahan_waktu: $sb_16.perubahan_waktu, status_kosong: $sb_16.status_kosong, status_pemanasan: $sb_16.status_pemanasan, status_pemasakan: $sb_16.status_pemasakan, status_selesai: $sb_16.status_selesai, status_banner: $sb_16.status_banner, tampil_jam_mulai: $sb_16.tampil_jam_mulai, tampil_jam_masak: $sb_16.tampil_jam_masak, tampil_jam_selesai: $sb_16.tampil_jam_selesai, tampil_durasi_actual: $sb_16.tampil_durasi_actual, tampil_pemanasan: $sb_16.tampil_pemanasan };
        prosesUnit(u16, 16, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb16._commOperation !== u16._commOperation) $sb16._commOperation = u16._commOperation;
        if ($sb_16.status_banner !== u16.status_banner) $sb_16.status_banner = u16.status_banner;
        if ($sb_16.status_pemanasan !== u16.status_pemanasan) $sb_16.status_pemanasan = u16.status_pemanasan;
        if ($sb_16.status_pemasakan !== u16.status_pemasakan) $sb_16.status_pemasakan = u16.status_pemasakan;
        if ($sb_16.status_selesai !== u16.status_selesai) $sb_16.status_selesai = u16.status_selesai;
        if ($sb_16.status_kosong !== u16.status_kosong) $sb_16.status_kosong = u16.status_kosong;
        if ($sb_16.target_menit !== u16.target_menit) $sb_16.target_menit = u16.target_menit;
        if ($sb_16.adjust_menit !== u16.adjust_menit) $sb_16.adjust_menit = u16.adjust_menit;
        if ($sb_16.sisa_detik_masak !== u16.sisa_detik_masak) $sb_16.sisa_detik_masak = u16.sisa_detik_masak;
        if ($sb_16.total_detik_pemanasan !== u16.total_detik_pemanasan) $sb_16.total_detik_pemanasan = u16.total_detik_pemanasan;
        if ($sb_16.flag_init_start !== u16.flag_init_start) $sb_16.flag_init_start = u16.flag_init_start;
        if ($sb_16.flag_init_masak !== u16.flag_init_masak) $sb_16.flag_init_masak = u16.flag_init_masak;
        if ($sb_16.suhu_awal !== u16.suhu_awal) $sb_16.suhu_awal = u16.suhu_awal;
        if ($sb_16.suhu_akhir !== u16.suhu_akhir) $sb_16.suhu_akhir = u16.suhu_akhir;
        if ($sb_16.perubahan_waktu !== u16.perubahan_waktu) $sb_16.perubahan_waktu = u16.perubahan_waktu;
        if ($sb_16.tampil_jam_mulai !== u16.tampil_jam_mulai) $sb_16.tampil_jam_mulai = u16.tampil_jam_mulai;
        if ($sb_16.tampil_jam_masak !== u16.tampil_jam_masak) $sb_16.tampil_jam_masak = u16.tampil_jam_masak;
        if ($sb_16.tampil_jam_selesai !== u16.tampil_jam_selesai) $sb_16.tampil_jam_selesai = u16.tampil_jam_selesai;
        if ($sb_16.tampil_durasi_actual !== u16.tampil_durasi_actual) $sb_16.tampil_durasi_actual = u16.tampil_durasi_actual;
        if ($sb_16.tampil_pemanasan !== u16.tampil_pemanasan) $sb_16.tampil_pemanasan = u16.tampil_pemanasan;
        if ($sb16.runStop !== u16.runStop) $sb16.runStop = u16.runStop;
    } else {
        if ($sb16._commOperation !== false) {
            $sb16._commOperation = false;
            $sb_16.status_banner = txtDisabled;
            $sb_16.status_pemanasan = false;
            $sb_16.status_pemasakan = false;
            $sb_16.status_selesai = false;
        }
    }

    // Unit 17
    if ($sb_17.is_active) {
        var u17 = { is_active: true, _commOperation: $sb17._commOperation, _commStatus: $sb17._commStatus, maintenance_mode: $sb_17.maintenance_mode, runStop: $sb17.runStop, temp: $sb17.temp, target_menit: $sb_17.target_menit, adjust_menit: $sb_17.adjust_menit, sisa_detik_masak: $sb_17.sisa_detik_masak, total_detik_pemanasan: $sb_17.total_detik_pemanasan, flag_init_start: $sb_17.flag_init_start, flag_init_masak: $sb_17.flag_init_masak, suhu_awal: $sb_17.suhu_awal, suhu_akhir: $sb_17.suhu_akhir, perubahan_waktu: $sb_17.perubahan_waktu, status_kosong: $sb_17.status_kosong, status_pemanasan: $sb_17.status_pemanasan, status_pemasakan: $sb_17.status_pemasakan, status_selesai: $sb_17.status_selesai, status_banner: $sb_17.status_banner, tampil_jam_mulai: $sb_17.tampil_jam_mulai, tampil_jam_masak: $sb_17.tampil_jam_masak, tampil_jam_selesai: $sb_17.tampil_jam_selesai, tampil_durasi_actual: $sb_17.tampil_durasi_actual, tampil_pemanasan: $sb_17.tampil_pemanasan };
        prosesUnit(u17, 17, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb17._commOperation !== u17._commOperation) $sb17._commOperation = u17._commOperation;
        if ($sb_17.status_banner !== u17.status_banner) $sb_17.status_banner = u17.status_banner;
        if ($sb_17.status_pemanasan !== u17.status_pemanasan) $sb_17.status_pemanasan = u17.status_pemanasan;
        if ($sb_17.status_pemasakan !== u17.status_pemasakan) $sb_17.status_pemasakan = u17.status_pemasakan;
        if ($sb_17.status_selesai !== u17.status_selesai) $sb_17.status_selesai = u17.status_selesai;
        if ($sb_17.status_kosong !== u17.status_kosong) $sb_17.status_kosong = u17.status_kosong;
        if ($sb_17.target_menit !== u17.target_menit) $sb_17.target_menit = u17.target_menit;
        if ($sb_17.adjust_menit !== u17.adjust_menit) $sb_17.adjust_menit = u17.adjust_menit;
        if ($sb_17.sisa_detik_masak !== u17.sisa_detik_masak) $sb_17.sisa_detik_masak = u17.sisa_detik_masak;
        if ($sb_17.total_detik_pemanasan !== u17.total_detik_pemanasan) $sb_17.total_detik_pemanasan = u17.total_detik_pemanasan;
        if ($sb_17.flag_init_start !== u17.flag_init_start) $sb_17.flag_init_start = u17.flag_init_start;
        if ($sb_17.flag_init_masak !== u17.flag_init_masak) $sb_17.flag_init_masak = u17.flag_init_masak;
        if ($sb_17.suhu_awal !== u17.suhu_awal) $sb_17.suhu_awal = u17.suhu_awal;
        if ($sb_17.suhu_akhir !== u17.suhu_akhir) $sb_17.suhu_akhir = u17.suhu_akhir;
        if ($sb_17.perubahan_waktu !== u17.perubahan_waktu) $sb_17.perubahan_waktu = u17.perubahan_waktu;
        if ($sb_17.tampil_jam_mulai !== u17.tampil_jam_mulai) $sb_17.tampil_jam_mulai = u17.tampil_jam_mulai;
        if ($sb_17.tampil_jam_masak !== u17.tampil_jam_masak) $sb_17.tampil_jam_masak = u17.tampil_jam_masak;
        if ($sb_17.tampil_jam_selesai !== u17.tampil_jam_selesai) $sb_17.tampil_jam_selesai = u17.tampil_jam_selesai;
        if ($sb_17.tampil_durasi_actual !== u17.tampil_durasi_actual) $sb_17.tampil_durasi_actual = u17.tampil_durasi_actual;
        if ($sb_17.tampil_pemanasan !== u17.tampil_pemanasan) $sb_17.tampil_pemanasan = u17.tampil_pemanasan;
        if ($sb17.runStop !== u17.runStop) $sb17.runStop = u17.runStop;
    } else {
        if ($sb17._commOperation !== false) {
            $sb17._commOperation = false;
            $sb_17.status_banner = txtDisabled;
            $sb_17.status_pemanasan = false;
            $sb_17.status_pemasakan = false;
            $sb_17.status_selesai = false;
        }
    }

    // Unit 18
    if ($sb_18.is_active) {
        var u18 = { is_active: true, _commOperation: $sb18._commOperation, _commStatus: $sb18._commStatus, maintenance_mode: $sb_18.maintenance_mode, runStop: $sb18.runStop, temp: $sb18.temp, target_menit: $sb_18.target_menit, adjust_menit: $sb_18.adjust_menit, sisa_detik_masak: $sb_18.sisa_detik_masak, total_detik_pemanasan: $sb_18.total_detik_pemanasan, flag_init_start: $sb_18.flag_init_start, flag_init_masak: $sb_18.flag_init_masak, suhu_awal: $sb_18.suhu_awal, suhu_akhir: $sb_18.suhu_akhir, perubahan_waktu: $sb_18.perubahan_waktu, status_kosong: $sb_18.status_kosong, status_pemanasan: $sb_18.status_pemanasan, status_pemasakan: $sb_18.status_pemasakan, status_selesai: $sb_18.status_selesai, status_banner: $sb_18.status_banner, tampil_jam_mulai: $sb_18.tampil_jam_mulai, tampil_jam_masak: $sb_18.tampil_jam_masak, tampil_jam_selesai: $sb_18.tampil_jam_selesai, tampil_durasi_actual: $sb_18.tampil_durasi_actual, tampil_pemanasan: $sb_18.tampil_pemanasan };
        prosesUnit(u18, 18, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb18._commOperation !== u18._commOperation) $sb18._commOperation = u18._commOperation;
        if ($sb_18.status_banner !== u18.status_banner) $sb_18.status_banner = u18.status_banner;
        if ($sb_18.status_pemanasan !== u18.status_pemanasan) $sb_18.status_pemanasan = u18.status_pemanasan;
        if ($sb_18.status_pemasakan !== u18.status_pemasakan) $sb_18.status_pemasakan = u18.status_pemasakan;
        if ($sb_18.status_selesai !== u18.status_selesai) $sb_18.status_selesai = u18.status_selesai;
        if ($sb_18.status_kosong !== u18.status_kosong) $sb_18.status_kosong = u18.status_kosong;
        if ($sb_18.target_menit !== u18.target_menit) $sb_18.target_menit = u18.target_menit;
        if ($sb_18.adjust_menit !== u18.adjust_menit) $sb_18.adjust_menit = u18.adjust_menit;
        if ($sb_18.sisa_detik_masak !== u18.sisa_detik_masak) $sb_18.sisa_detik_masak = u18.sisa_detik_masak;
        if ($sb_18.total_detik_pemanasan !== u18.total_detik_pemanasan) $sb_18.total_detik_pemanasan = u18.total_detik_pemanasan;
        if ($sb_18.flag_init_start !== u18.flag_init_start) $sb_18.flag_init_start = u18.flag_init_start;
        if ($sb_18.flag_init_masak !== u18.flag_init_masak) $sb_18.flag_init_masak = u18.flag_init_masak;
        if ($sb_18.suhu_awal !== u18.suhu_awal) $sb_18.suhu_awal = u18.suhu_awal;
        if ($sb_18.suhu_akhir !== u18.suhu_akhir) $sb_18.suhu_akhir = u18.suhu_akhir;
        if ($sb_18.perubahan_waktu !== u18.perubahan_waktu) $sb_18.perubahan_waktu = u18.perubahan_waktu;
        if ($sb_18.tampil_jam_mulai !== u18.tampil_jam_mulai) $sb_18.tampil_jam_mulai = u18.tampil_jam_mulai;
        if ($sb_18.tampil_jam_masak !== u18.tampil_jam_masak) $sb_18.tampil_jam_masak = u18.tampil_jam_masak;
        if ($sb_18.tampil_jam_selesai !== u18.tampil_jam_selesai) $sb_18.tampil_jam_selesai = u18.tampil_jam_selesai;
        if ($sb_18.tampil_durasi_actual !== u18.tampil_durasi_actual) $sb_18.tampil_durasi_actual = u18.tampil_durasi_actual;
        if ($sb_18.tampil_pemanasan !== u18.tampil_pemanasan) $sb_18.tampil_pemanasan = u18.tampil_pemanasan;
        if ($sb18.runStop !== u18.runStop) $sb18.runStop = u18.runStop;
    } else {
        if ($sb18._commOperation !== false) {
            $sb18._commOperation = false;
            $sb_18.status_banner = txtDisabled;
            $sb_18.status_pemanasan = false;
            $sb_18.status_pemasakan = false;
            $sb_18.status_selesai = false;
        }
    }

    // Unit 19
    if ($sb_19.is_active) {
        var u19 = { is_active: true, _commOperation: $sb19._commOperation, _commStatus: $sb19._commStatus, maintenance_mode: $sb_19.maintenance_mode, runStop: $sb19.runStop, temp: $sb19.temp, target_menit: $sb_19.target_menit, adjust_menit: $sb_19.adjust_menit, sisa_detik_masak: $sb_19.sisa_detik_masak, total_detik_pemanasan: $sb_19.total_detik_pemanasan, flag_init_start: $sb_19.flag_init_start, flag_init_masak: $sb_19.flag_init_masak, suhu_awal: $sb_19.suhu_awal, suhu_akhir: $sb_19.suhu_akhir, perubahan_waktu: $sb_19.perubahan_waktu, status_kosong: $sb_19.status_kosong, status_pemanasan: $sb_19.status_pemanasan, status_pemasakan: $sb_19.status_pemasakan, status_selesai: $sb_19.status_selesai, status_banner: $sb_19.status_banner, tampil_jam_mulai: $sb_19.tampil_jam_mulai, tampil_jam_masak: $sb_19.tampil_jam_masak, tampil_jam_selesai: $sb_19.tampil_jam_selesai, tampil_durasi_actual: $sb_19.tampil_durasi_actual, tampil_pemanasan: $sb_19.tampil_pemanasan };
        prosesUnit(u19, 19, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb19._commOperation !== u19._commOperation) $sb19._commOperation = u19._commOperation;
        if ($sb_19.status_banner !== u19.status_banner) $sb_19.status_banner = u19.status_banner;
        if ($sb_19.status_pemanasan !== u19.status_pemanasan) $sb_19.status_pemanasan = u19.status_pemanasan;
        if ($sb_19.status_pemasakan !== u19.status_pemasakan) $sb_19.status_pemasakan = u19.status_pemasakan;
        if ($sb_19.status_selesai !== u19.status_selesai) $sb_19.status_selesai = u19.status_selesai;
        if ($sb_19.status_kosong !== u19.status_kosong) $sb_19.status_kosong = u19.status_kosong;
        if ($sb_19.target_menit !== u19.target_menit) $sb_19.target_menit = u19.target_menit;
        if ($sb_19.adjust_menit !== u19.adjust_menit) $sb_19.adjust_menit = u19.adjust_menit;
        if ($sb_19.sisa_detik_masak !== u19.sisa_detik_masak) $sb_19.sisa_detik_masak = u19.sisa_detik_masak;
        if ($sb_19.total_detik_pemanasan !== u19.total_detik_pemanasan) $sb_19.total_detik_pemanasan = u19.total_detik_pemanasan;
        if ($sb_19.flag_init_start !== u19.flag_init_start) $sb_19.flag_init_start = u19.flag_init_start;
        if ($sb_19.flag_init_masak !== u19.flag_init_masak) $sb_19.flag_init_masak = u19.flag_init_masak;
        if ($sb_19.suhu_awal !== u19.suhu_awal) $sb_19.suhu_awal = u19.suhu_awal;
        if ($sb_19.suhu_akhir !== u19.suhu_akhir) $sb_19.suhu_akhir = u19.suhu_akhir;
        if ($sb_19.perubahan_waktu !== u19.perubahan_waktu) $sb_19.perubahan_waktu = u19.perubahan_waktu;
        if ($sb_19.tampil_jam_mulai !== u19.tampil_jam_mulai) $sb_19.tampil_jam_mulai = u19.tampil_jam_mulai;
        if ($sb_19.tampil_jam_masak !== u19.tampil_jam_masak) $sb_19.tampil_jam_masak = u19.tampil_jam_masak;
        if ($sb_19.tampil_jam_selesai !== u19.tampil_jam_selesai) $sb_19.tampil_jam_selesai = u19.tampil_jam_selesai;
        if ($sb_19.tampil_durasi_actual !== u19.tampil_durasi_actual) $sb_19.tampil_durasi_actual = u19.tampil_durasi_actual;
        if ($sb_19.tampil_pemanasan !== u19.tampil_pemanasan) $sb_19.tampil_pemanasan = u19.tampil_pemanasan;
        if ($sb19.runStop !== u19.runStop) $sb19.runStop = u19.runStop;
    } else {
        if ($sb19._commOperation !== false) {
            $sb19._commOperation = false;
            $sb_19.status_banner = txtDisabled;
            $sb_19.status_pemanasan = false;
            $sb_19.status_pemasakan = false;
            $sb_19.status_selesai = false;
        }
    }

    // Unit 20
    if ($sb_20.is_active) {
        var u20 = { is_active: true, _commOperation: $sb20._commOperation, _commStatus: $sb20._commStatus, maintenance_mode: $sb_20.maintenance_mode, runStop: $sb20.runStop, temp: $sb20.temp, target_menit: $sb_20.target_menit, adjust_menit: $sb_20.adjust_menit, sisa_detik_masak: $sb_20.sisa_detik_masak, total_detik_pemanasan: $sb_20.total_detik_pemanasan, flag_init_start: $sb_20.flag_init_start, flag_init_masak: $sb_20.flag_init_masak, suhu_awal: $sb_20.suhu_awal, suhu_akhir: $sb_20.suhu_akhir, perubahan_waktu: $sb_20.perubahan_waktu, status_kosong: $sb_20.status_kosong, status_pemanasan: $sb_20.status_pemanasan, status_pemasakan: $sb_20.status_pemasakan, status_selesai: $sb_20.status_selesai, status_banner: $sb_20.status_banner, tampil_jam_mulai: $sb_20.tampil_jam_mulai, tampil_jam_masak: $sb_20.tampil_jam_masak, tampil_jam_selesai: $sb_20.tampil_jam_selesai, tampil_durasi_actual: $sb_20.tampil_durasi_actual, tampil_pemanasan: $sb_20.tampil_pemanasan };
        prosesUnit(u20, 20, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb20._commOperation !== u20._commOperation) $sb20._commOperation = u20._commOperation;
        if ($sb_20.status_banner !== u20.status_banner) $sb_20.status_banner = u20.status_banner;
        if ($sb_20.status_pemanasan !== u20.status_pemanasan) $sb_20.status_pemanasan = u20.status_pemanasan;
        if ($sb_20.status_pemasakan !== u20.status_pemasakan) $sb_20.status_pemasakan = u20.status_pemasakan;
        if ($sb_20.status_selesai !== u20.status_selesai) $sb_20.status_selesai = u20.status_selesai;
        if ($sb_20.status_kosong !== u20.status_kosong) $sb_20.status_kosong = u20.status_kosong;
        if ($sb_20.target_menit !== u20.target_menit) $sb_20.target_menit = u20.target_menit;
        if ($sb_20.adjust_menit !== u20.adjust_menit) $sb_20.adjust_menit = u20.adjust_menit;
        if ($sb_20.sisa_detik_masak !== u20.sisa_detik_masak) $sb_20.sisa_detik_masak = u20.sisa_detik_masak;
        if ($sb_20.total_detik_pemanasan !== u20.total_detik_pemanasan) $sb_20.total_detik_pemanasan = u20.total_detik_pemanasan;
        if ($sb_20.flag_init_start !== u20.flag_init_start) $sb_20.flag_init_start = u20.flag_init_start;
        if ($sb_20.flag_init_masak !== u20.flag_init_masak) $sb_20.flag_init_masak = u20.flag_init_masak;
        if ($sb_20.suhu_awal !== u20.suhu_awal) $sb_20.suhu_awal = u20.suhu_awal;
        if ($sb_20.suhu_akhir !== u20.suhu_akhir) $sb_20.suhu_akhir = u20.suhu_akhir;
        if ($sb_20.perubahan_waktu !== u20.perubahan_waktu) $sb_20.perubahan_waktu = u20.perubahan_waktu;
        if ($sb_20.tampil_jam_mulai !== u20.tampil_jam_mulai) $sb_20.tampil_jam_mulai = u20.tampil_jam_mulai;
        if ($sb_20.tampil_jam_masak !== u20.tampil_jam_masak) $sb_20.tampil_jam_masak = u20.tampil_jam_masak;
        if ($sb_20.tampil_jam_selesai !== u20.tampil_jam_selesai) $sb_20.tampil_jam_selesai = u20.tampil_jam_selesai;
        if ($sb_20.tampil_durasi_actual !== u20.tampil_durasi_actual) $sb_20.tampil_durasi_actual = u20.tampil_durasi_actual;
        if ($sb_20.tampil_pemanasan !== u20.tampil_pemanasan) $sb_20.tampil_pemanasan = u20.tampil_pemanasan;
        if ($sb20.runStop !== u20.runStop) $sb20.runStop = u20.runStop;
    } else {
        if ($sb20._commOperation !== false) {
            $sb20._commOperation = false;
            $sb_20.status_banner = txtDisabled;
            $sb_20.status_pemanasan = false;
            $sb_20.status_pemasakan = false;
            $sb_20.status_selesai = false;
        }
    }

    // Unit 21
    if ($sb_21.is_active) {
        var u21 = { is_active: true, _commOperation: $sb21._commOperation, _commStatus: $sb21._commStatus, maintenance_mode: $sb_21.maintenance_mode, runStop: $sb21.runStop, temp: $sb21.temp, target_menit: $sb_21.target_menit, adjust_menit: $sb_21.adjust_menit, sisa_detik_masak: $sb_21.sisa_detik_masak, total_detik_pemanasan: $sb_21.total_detik_pemanasan, flag_init_start: $sb_21.flag_init_start, flag_init_masak: $sb_21.flag_init_masak, suhu_awal: $sb_21.suhu_awal, suhu_akhir: $sb_21.suhu_akhir, perubahan_waktu: $sb_21.perubahan_waktu, status_kosong: $sb_21.status_kosong, status_pemanasan: $sb_21.status_pemanasan, status_pemasakan: $sb_21.status_pemasakan, status_selesai: $sb_21.status_selesai, status_banner: $sb_21.status_banner, tampil_jam_mulai: $sb_21.tampil_jam_mulai, tampil_jam_masak: $sb_21.tampil_jam_masak, tampil_jam_selesai: $sb_21.tampil_jam_selesai, tampil_durasi_actual: $sb_21.tampil_durasi_actual, tampil_pemanasan: $sb_21.tampil_pemanasan };
        prosesUnit(u21, 21, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb21._commOperation !== u21._commOperation) $sb21._commOperation = u21._commOperation;
        if ($sb_21.status_banner !== u21.status_banner) $sb_21.status_banner = u21.status_banner;
        if ($sb_21.status_pemanasan !== u21.status_pemanasan) $sb_21.status_pemanasan = u21.status_pemanasan;
        if ($sb_21.status_pemasakan !== u21.status_pemasakan) $sb_21.status_pemasakan = u21.status_pemasakan;
        if ($sb_21.status_selesai !== u21.status_selesai) $sb_21.status_selesai = u21.status_selesai;
        if ($sb_21.status_kosong !== u21.status_kosong) $sb_21.status_kosong = u21.status_kosong;
        if ($sb_21.target_menit !== u21.target_menit) $sb_21.target_menit = u21.target_menit;
        if ($sb_21.adjust_menit !== u21.adjust_menit) $sb_21.adjust_menit = u21.adjust_menit;
        if ($sb_21.sisa_detik_masak !== u21.sisa_detik_masak) $sb_21.sisa_detik_masak = u21.sisa_detik_masak;
        if ($sb_21.total_detik_pemanasan !== u21.total_detik_pemanasan) $sb_21.total_detik_pemanasan = u21.total_detik_pemanasan;
        if ($sb_21.flag_init_start !== u21.flag_init_start) $sb_21.flag_init_start = u21.flag_init_start;
        if ($sb_21.flag_init_masak !== u21.flag_init_masak) $sb_21.flag_init_masak = u21.flag_init_masak;
        if ($sb_21.suhu_awal !== u21.suhu_awal) $sb_21.suhu_awal = u21.suhu_awal;
        if ($sb_21.suhu_akhir !== u21.suhu_akhir) $sb_21.suhu_akhir = u21.suhu_akhir;
        if ($sb_21.perubahan_waktu !== u21.perubahan_waktu) $sb_21.perubahan_waktu = u21.perubahan_waktu;
        if ($sb_21.tampil_jam_mulai !== u21.tampil_jam_mulai) $sb_21.tampil_jam_mulai = u21.tampil_jam_mulai;
        if ($sb_21.tampil_jam_masak !== u21.tampil_jam_masak) $sb_21.tampil_jam_masak = u21.tampil_jam_masak;
        if ($sb_21.tampil_jam_selesai !== u21.tampil_jam_selesai) $sb_21.tampil_jam_selesai = u21.tampil_jam_selesai;
        if ($sb_21.tampil_durasi_actual !== u21.tampil_durasi_actual) $sb_21.tampil_durasi_actual = u21.tampil_durasi_actual;
        if ($sb_21.tampil_pemanasan !== u21.tampil_pemanasan) $sb_21.tampil_pemanasan = u21.tampil_pemanasan;
        if ($sb21.runStop !== u21.runStop) $sb21.runStop = u21.runStop;
    } else {
        if ($sb21._commOperation !== false) {
            $sb21._commOperation = false;
            $sb_21.status_banner = txtDisabled;
            $sb_21.status_pemanasan = false;
            $sb_21.status_pemasakan = false;
            $sb_21.status_selesai = false;
        }
    }

    // Unit 22
    if ($sb_22.is_active) {
        var u22 = { is_active: true, _commOperation: $sb22._commOperation, _commStatus: $sb22._commStatus, maintenance_mode: $sb_22.maintenance_mode, runStop: $sb22.runStop, temp: $sb22.temp, target_menit: $sb_22.target_menit, adjust_menit: $sb_22.adjust_menit, sisa_detik_masak: $sb_22.sisa_detik_masak, total_detik_pemanasan: $sb_22.total_detik_pemanasan, flag_init_start: $sb_22.flag_init_start, flag_init_masak: $sb_22.flag_init_masak, suhu_awal: $sb_22.suhu_awal, suhu_akhir: $sb_22.suhu_akhir, perubahan_waktu: $sb_22.perubahan_waktu, status_kosong: $sb_22.status_kosong, status_pemanasan: $sb_22.status_pemanasan, status_pemasakan: $sb_22.status_pemasakan, status_selesai: $sb_22.status_selesai, status_banner: $sb_22.status_banner, tampil_jam_mulai: $sb_22.tampil_jam_mulai, tampil_jam_masak: $sb_22.tampil_jam_masak, tampil_jam_selesai: $sb_22.tampil_jam_selesai, tampil_durasi_actual: $sb_22.tampil_durasi_actual, tampil_pemanasan: $sb_22.tampil_pemanasan };
        prosesUnit(u22, 22, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb22._commOperation !== u22._commOperation) $sb22._commOperation = u22._commOperation;
        if ($sb_22.status_banner !== u22.status_banner) $sb_22.status_banner = u22.status_banner;
        if ($sb_22.status_pemanasan !== u22.status_pemanasan) $sb_22.status_pemanasan = u22.status_pemanasan;
        if ($sb_22.status_pemasakan !== u22.status_pemasakan) $sb_22.status_pemasakan = u22.status_pemasakan;
        if ($sb_22.status_selesai !== u22.status_selesai) $sb_22.status_selesai = u22.status_selesai;
        if ($sb_22.status_kosong !== u22.status_kosong) $sb_22.status_kosong = u22.status_kosong;
        if ($sb_22.target_menit !== u22.target_menit) $sb_22.target_menit = u22.target_menit;
        if ($sb_22.adjust_menit !== u22.adjust_menit) $sb_22.adjust_menit = u22.adjust_menit;
        if ($sb_22.sisa_detik_masak !== u22.sisa_detik_masak) $sb_22.sisa_detik_masak = u22.sisa_detik_masak;
        if ($sb_22.total_detik_pemanasan !== u22.total_detik_pemanasan) $sb_22.total_detik_pemanasan = u22.total_detik_pemanasan;
        if ($sb_22.flag_init_start !== u22.flag_init_start) $sb_22.flag_init_start = u22.flag_init_start;
        if ($sb_22.flag_init_masak !== u22.flag_init_masak) $sb_22.flag_init_masak = u22.flag_init_masak;
        if ($sb_22.suhu_awal !== u22.suhu_awal) $sb_22.suhu_awal = u22.suhu_awal;
        if ($sb_22.suhu_akhir !== u22.suhu_akhir) $sb_22.suhu_akhir = u22.suhu_akhir;
        if ($sb_22.perubahan_waktu !== u22.perubahan_waktu) $sb_22.perubahan_waktu = u22.perubahan_waktu;
        if ($sb_22.tampil_jam_mulai !== u22.tampil_jam_mulai) $sb_22.tampil_jam_mulai = u22.tampil_jam_mulai;
        if ($sb_22.tampil_jam_masak !== u22.tampil_jam_masak) $sb_22.tampil_jam_masak = u22.tampil_jam_masak;
        if ($sb_22.tampil_jam_selesai !== u22.tampil_jam_selesai) $sb_22.tampil_jam_selesai = u22.tampil_jam_selesai;
        if ($sb_22.tampil_durasi_actual !== u22.tampil_durasi_actual) $sb_22.tampil_durasi_actual = u22.tampil_durasi_actual;
        if ($sb_22.tampil_pemanasan !== u22.tampil_pemanasan) $sb_22.tampil_pemanasan = u22.tampil_pemanasan;
        if ($sb22.runStop !== u22.runStop) $sb22.runStop = u22.runStop;
    } else {
        if ($sb22._commOperation !== false) {
            $sb22._commOperation = false;
            $sb_22.status_banner = txtDisabled;
            $sb_22.status_pemanasan = false;
            $sb_22.status_pemasakan = false;
            $sb_22.status_selesai = false;
        }
    }

    // Unit 23
    if ($sb_23.is_active) {
        var u23 = { is_active: true, _commOperation: $sb23._commOperation, _commStatus: $sb23._commStatus, maintenance_mode: $sb_23.maintenance_mode, runStop: $sb23.runStop, temp: $sb23.temp, target_menit: $sb_23.target_menit, adjust_menit: $sb_23.adjust_menit, sisa_detik_masak: $sb_23.sisa_detik_masak, total_detik_pemanasan: $sb_23.total_detik_pemanasan, flag_init_start: $sb_23.flag_init_start, flag_init_masak: $sb_23.flag_init_masak, suhu_awal: $sb_23.suhu_awal, suhu_akhir: $sb_23.suhu_akhir, perubahan_waktu: $sb_23.perubahan_waktu, status_kosong: $sb_23.status_kosong, status_pemanasan: $sb_23.status_pemanasan, status_pemasakan: $sb_23.status_pemasakan, status_selesai: $sb_23.status_selesai, status_banner: $sb_23.status_banner, tampil_jam_mulai: $sb_23.tampil_jam_mulai, tampil_jam_masak: $sb_23.tampil_jam_masak, tampil_jam_selesai: $sb_23.tampil_jam_selesai, tampil_durasi_actual: $sb_23.tampil_durasi_actual, tampil_pemanasan: $sb_23.tampil_pemanasan };
        prosesUnit(u23, 23, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb23._commOperation !== u23._commOperation) $sb23._commOperation = u23._commOperation;
        if ($sb_23.status_banner !== u23.status_banner) $sb_23.status_banner = u23.status_banner;
        if ($sb_23.status_pemanasan !== u23.status_pemanasan) $sb_23.status_pemanasan = u23.status_pemanasan;
        if ($sb_23.status_pemasakan !== u23.status_pemasakan) $sb_23.status_pemasakan = u23.status_pemasakan;
        if ($sb_23.status_selesai !== u23.status_selesai) $sb_23.status_selesai = u23.status_selesai;
        if ($sb_23.status_kosong !== u23.status_kosong) $sb_23.status_kosong = u23.status_kosong;
        if ($sb_23.target_menit !== u23.target_menit) $sb_23.target_menit = u23.target_menit;
        if ($sb_23.adjust_menit !== u23.adjust_menit) $sb_23.adjust_menit = u23.adjust_menit;
        if ($sb_23.sisa_detik_masak !== u23.sisa_detik_masak) $sb_23.sisa_detik_masak = u23.sisa_detik_masak;
        if ($sb_23.total_detik_pemanasan !== u23.total_detik_pemanasan) $sb_23.total_detik_pemanasan = u23.total_detik_pemanasan;
        if ($sb_23.flag_init_start !== u23.flag_init_start) $sb_23.flag_init_start = u23.flag_init_start;
        if ($sb_23.flag_init_masak !== u23.flag_init_masak) $sb_23.flag_init_masak = u23.flag_init_masak;
        if ($sb_23.suhu_awal !== u23.suhu_awal) $sb_23.suhu_awal = u23.suhu_awal;
        if ($sb_23.suhu_akhir !== u23.suhu_akhir) $sb_23.suhu_akhir = u23.suhu_akhir;
        if ($sb_23.perubahan_waktu !== u23.perubahan_waktu) $sb_23.perubahan_waktu = u23.perubahan_waktu;
        if ($sb_23.tampil_jam_mulai !== u23.tampil_jam_mulai) $sb_23.tampil_jam_mulai = u23.tampil_jam_mulai;
        if ($sb_23.tampil_jam_masak !== u23.tampil_jam_masak) $sb_23.tampil_jam_masak = u23.tampil_jam_masak;
        if ($sb_23.tampil_jam_selesai !== u23.tampil_jam_selesai) $sb_23.tampil_jam_selesai = u23.tampil_jam_selesai;
        if ($sb_23.tampil_durasi_actual !== u23.tampil_durasi_actual) $sb_23.tampil_durasi_actual = u23.tampil_durasi_actual;
        if ($sb_23.tampil_pemanasan !== u23.tampil_pemanasan) $sb_23.tampil_pemanasan = u23.tampil_pemanasan;
        if ($sb23.runStop !== u23.runStop) $sb23.runStop = u23.runStop;
    } else {
        if ($sb23._commOperation !== false) {
            $sb23._commOperation = false;
            $sb_23.status_banner = txtDisabled;
            $sb_23.status_pemanasan = false;
            $sb_23.status_pemasakan = false;
            $sb_23.status_selesai = false;
        }
    }

    // Unit 24
    if ($sb_24.is_active) {
        var u24 = { is_active: true, _commOperation: $sb24._commOperation, _commStatus: $sb24._commStatus, maintenance_mode: $sb_24.maintenance_mode, runStop: $sb24.runStop, temp: $sb24.temp, target_menit: $sb_24.target_menit, adjust_menit: $sb_24.adjust_menit, sisa_detik_masak: $sb_24.sisa_detik_masak, total_detik_pemanasan: $sb_24.total_detik_pemanasan, flag_init_start: $sb_24.flag_init_start, flag_init_masak: $sb_24.flag_init_masak, suhu_awal: $sb_24.suhu_awal, suhu_akhir: $sb_24.suhu_akhir, perubahan_waktu: $sb_24.perubahan_waktu, status_kosong: $sb_24.status_kosong, status_pemanasan: $sb_24.status_pemanasan, status_pemasakan: $sb_24.status_pemasakan, status_selesai: $sb_24.status_selesai, status_banner: $sb_24.status_banner, tampil_jam_mulai: $sb_24.tampil_jam_mulai, tampil_jam_masak: $sb_24.tampil_jam_masak, tampil_jam_selesai: $sb_24.tampil_jam_selesai, tampil_durasi_actual: $sb_24.tampil_durasi_actual, tampil_pemanasan: $sb_24.tampil_pemanasan };
        prosesUnit(u24, 24, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb24._commOperation !== u24._commOperation) $sb24._commOperation = u24._commOperation;
        if ($sb_24.status_banner !== u24.status_banner) $sb_24.status_banner = u24.status_banner;
        if ($sb_24.status_pemanasan !== u24.status_pemanasan) $sb_24.status_pemanasan = u24.status_pemanasan;
        if ($sb_24.status_pemasakan !== u24.status_pemasakan) $sb_24.status_pemasakan = u24.status_pemasakan;
        if ($sb_24.status_selesai !== u24.status_selesai) $sb_24.status_selesai = u24.status_selesai;
        if ($sb_24.status_kosong !== u24.status_kosong) $sb_24.status_kosong = u24.status_kosong;
        if ($sb_24.target_menit !== u24.target_menit) $sb_24.target_menit = u24.target_menit;
        if ($sb_24.adjust_menit !== u24.adjust_menit) $sb_24.adjust_menit = u24.adjust_menit;
        if ($sb_24.sisa_detik_masak !== u24.sisa_detik_masak) $sb_24.sisa_detik_masak = u24.sisa_detik_masak;
        if ($sb_24.total_detik_pemanasan !== u24.total_detik_pemanasan) $sb_24.total_detik_pemanasan = u24.total_detik_pemanasan;
        if ($sb_24.flag_init_start !== u24.flag_init_start) $sb_24.flag_init_start = u24.flag_init_start;
        if ($sb_24.flag_init_masak !== u24.flag_init_masak) $sb_24.flag_init_masak = u24.flag_init_masak;
        if ($sb_24.suhu_awal !== u24.suhu_awal) $sb_24.suhu_awal = u24.suhu_awal;
        if ($sb_24.suhu_akhir !== u24.suhu_akhir) $sb_24.suhu_akhir = u24.suhu_akhir;
        if ($sb_24.perubahan_waktu !== u24.perubahan_waktu) $sb_24.perubahan_waktu = u24.perubahan_waktu;
        if ($sb_24.tampil_jam_mulai !== u24.tampil_jam_mulai) $sb_24.tampil_jam_mulai = u24.tampil_jam_mulai;
        if ($sb_24.tampil_jam_masak !== u24.tampil_jam_masak) $sb_24.tampil_jam_masak = u24.tampil_jam_masak;
        if ($sb_24.tampil_jam_selesai !== u24.tampil_jam_selesai) $sb_24.tampil_jam_selesai = u24.tampil_jam_selesai;
        if ($sb_24.tampil_durasi_actual !== u24.tampil_durasi_actual) $sb_24.tampil_durasi_actual = u24.tampil_durasi_actual;
        if ($sb_24.tampil_pemanasan !== u24.tampil_pemanasan) $sb_24.tampil_pemanasan = u24.tampil_pemanasan;
        if ($sb24.runStop !== u24.runStop) $sb24.runStop = u24.runStop;
    } else {
        if ($sb24._commOperation !== false) {
            $sb24._commOperation = false;
            $sb_24.status_banner = txtDisabled;
            $sb_24.status_pemanasan = false;
            $sb_24.status_pemasakan = false;
            $sb_24.status_selesai = false;
        }
    }

    // Unit 25
    if ($sb_25.is_active) {
        var u25 = { is_active: true, _commOperation: $sb25._commOperation, _commStatus: $sb25._commStatus, maintenance_mode: $sb_25.maintenance_mode, runStop: $sb25.runStop, temp: $sb25.temp, target_menit: $sb_25.target_menit, adjust_menit: $sb_25.adjust_menit, sisa_detik_masak: $sb_25.sisa_detik_masak, total_detik_pemanasan: $sb_25.total_detik_pemanasan, flag_init_start: $sb_25.flag_init_start, flag_init_masak: $sb_25.flag_init_masak, suhu_awal: $sb_25.suhu_awal, suhu_akhir: $sb_25.suhu_akhir, perubahan_waktu: $sb_25.perubahan_waktu, status_kosong: $sb_25.status_kosong, status_pemanasan: $sb_25.status_pemanasan, status_pemasakan: $sb_25.status_pemasakan, status_selesai: $sb_25.status_selesai, status_banner: $sb_25.status_banner, tampil_jam_mulai: $sb_25.tampil_jam_mulai, tampil_jam_masak: $sb_25.tampil_jam_masak, tampil_jam_selesai: $sb_25.tampil_jam_selesai, tampil_durasi_actual: $sb_25.tampil_durasi_actual, tampil_pemanasan: $sb_25.tampil_pemanasan };
        prosesUnit(u25, 25, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb25._commOperation !== u25._commOperation) $sb25._commOperation = u25._commOperation;
        if ($sb_25.status_banner !== u25.status_banner) $sb_25.status_banner = u25.status_banner;
        if ($sb_25.status_pemanasan !== u25.status_pemanasan) $sb_25.status_pemanasan = u25.status_pemanasan;
        if ($sb_25.status_pemasakan !== u25.status_pemasakan) $sb_25.status_pemasakan = u25.status_pemasakan;
        if ($sb_25.status_selesai !== u25.status_selesai) $sb_25.status_selesai = u25.status_selesai;
        if ($sb_25.status_kosong !== u25.status_kosong) $sb_25.status_kosong = u25.status_kosong;
        if ($sb_25.target_menit !== u25.target_menit) $sb_25.target_menit = u25.target_menit;
        if ($sb_25.adjust_menit !== u25.adjust_menit) $sb_25.adjust_menit = u25.adjust_menit;
        if ($sb_25.sisa_detik_masak !== u25.sisa_detik_masak) $sb_25.sisa_detik_masak = u25.sisa_detik_masak;
        if ($sb_25.total_detik_pemanasan !== u25.total_detik_pemanasan) $sb_25.total_detik_pemanasan = u25.total_detik_pemanasan;
        if ($sb_25.flag_init_start !== u25.flag_init_start) $sb_25.flag_init_start = u25.flag_init_start;
        if ($sb_25.flag_init_masak !== u25.flag_init_masak) $sb_25.flag_init_masak = u25.flag_init_masak;
        if ($sb_25.suhu_awal !== u25.suhu_awal) $sb_25.suhu_awal = u25.suhu_awal;
        if ($sb_25.suhu_akhir !== u25.suhu_akhir) $sb_25.suhu_akhir = u25.suhu_akhir;
        if ($sb_25.perubahan_waktu !== u25.perubahan_waktu) $sb_25.perubahan_waktu = u25.perubahan_waktu;
        if ($sb_25.tampil_jam_mulai !== u25.tampil_jam_mulai) $sb_25.tampil_jam_mulai = u25.tampil_jam_mulai;
        if ($sb_25.tampil_jam_masak !== u25.tampil_jam_masak) $sb_25.tampil_jam_masak = u25.tampil_jam_masak;
        if ($sb_25.tampil_jam_selesai !== u25.tampil_jam_selesai) $sb_25.tampil_jam_selesai = u25.tampil_jam_selesai;
        if ($sb_25.tampil_durasi_actual !== u25.tampil_durasi_actual) $sb_25.tampil_durasi_actual = u25.tampil_durasi_actual;
        if ($sb_25.tampil_pemanasan !== u25.tampil_pemanasan) $sb_25.tampil_pemanasan = u25.tampil_pemanasan;
        if ($sb25.runStop !== u25.runStop) $sb25.runStop = u25.runStop;
    } else {
        if ($sb25._commOperation !== false) {
            $sb25._commOperation = false;
            $sb_25.status_banner = txtDisabled;
            $sb_25.status_pemanasan = false;
            $sb_25.status_pemasakan = false;
            $sb_25.status_selesai = false;
        }
    }

    // Unit 26
    if ($sb_26.is_active) {
        var u26 = { is_active: true, _commOperation: $sb26._commOperation, _commStatus: $sb26._commStatus, maintenance_mode: $sb_26.maintenance_mode, runStop: $sb26.runStop, temp: $sb26.temp, target_menit: $sb_26.target_menit, adjust_menit: $sb_26.adjust_menit, sisa_detik_masak: $sb_26.sisa_detik_masak, total_detik_pemanasan: $sb_26.total_detik_pemanasan, flag_init_start: $sb_26.flag_init_start, flag_init_masak: $sb_26.flag_init_masak, suhu_awal: $sb_26.suhu_awal, suhu_akhir: $sb_26.suhu_akhir, perubahan_waktu: $sb_26.perubahan_waktu, status_kosong: $sb_26.status_kosong, status_pemanasan: $sb_26.status_pemanasan, status_pemasakan: $sb_26.status_pemasakan, status_selesai: $sb_26.status_selesai, status_banner: $sb_26.status_banner, tampil_jam_mulai: $sb_26.tampil_jam_mulai, tampil_jam_masak: $sb_26.tampil_jam_masak, tampil_jam_selesai: $sb_26.tampil_jam_selesai, tampil_durasi_actual: $sb_26.tampil_durasi_actual, tampil_pemanasan: $sb_26.tampil_pemanasan };
        prosesUnit(u26, 26, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb26._commOperation !== u26._commOperation) $sb26._commOperation = u26._commOperation;
        if ($sb_26.status_banner !== u26.status_banner) $sb_26.status_banner = u26.status_banner;
        if ($sb_26.status_pemanasan !== u26.status_pemanasan) $sb_26.status_pemanasan = u26.status_pemanasan;
        if ($sb_26.status_pemasakan !== u26.status_pemasakan) $sb_26.status_pemasakan = u26.status_pemasakan;
        if ($sb_26.status_selesai !== u26.status_selesai) $sb_26.status_selesai = u26.status_selesai;
        if ($sb_26.status_kosong !== u26.status_kosong) $sb_26.status_kosong = u26.status_kosong;
        if ($sb_26.target_menit !== u26.target_menit) $sb_26.target_menit = u26.target_menit;
        if ($sb_26.adjust_menit !== u26.adjust_menit) $sb_26.adjust_menit = u26.adjust_menit;
        if ($sb_26.sisa_detik_masak !== u26.sisa_detik_masak) $sb_26.sisa_detik_masak = u26.sisa_detik_masak;
        if ($sb_26.total_detik_pemanasan !== u26.total_detik_pemanasan) $sb_26.total_detik_pemanasan = u26.total_detik_pemanasan;
        if ($sb_26.flag_init_start !== u26.flag_init_start) $sb_26.flag_init_start = u26.flag_init_start;
        if ($sb_26.flag_init_masak !== u26.flag_init_masak) $sb_26.flag_init_masak = u26.flag_init_masak;
        if ($sb_26.suhu_awal !== u26.suhu_awal) $sb_26.suhu_awal = u26.suhu_awal;
        if ($sb_26.suhu_akhir !== u26.suhu_akhir) $sb_26.suhu_akhir = u26.suhu_akhir;
        if ($sb_26.perubahan_waktu !== u26.perubahan_waktu) $sb_26.perubahan_waktu = u26.perubahan_waktu;
        if ($sb_26.tampil_jam_mulai !== u26.tampil_jam_mulai) $sb_26.tampil_jam_mulai = u26.tampil_jam_mulai;
        if ($sb_26.tampil_jam_masak !== u26.tampil_jam_masak) $sb_26.tampil_jam_masak = u26.tampil_jam_masak;
        if ($sb_26.tampil_jam_selesai !== u26.tampil_jam_selesai) $sb_26.tampil_jam_selesai = u26.tampil_jam_selesai;
        if ($sb_26.tampil_durasi_actual !== u26.tampil_durasi_actual) $sb_26.tampil_durasi_actual = u26.tampil_durasi_actual;
        if ($sb_26.tampil_pemanasan !== u26.tampil_pemanasan) $sb_26.tampil_pemanasan = u26.tampil_pemanasan;
        if ($sb26.runStop !== u26.runStop) $sb26.runStop = u26.runStop;
    } else {
        if ($sb26._commOperation !== false) {
            $sb26._commOperation = false;
            $sb_26.status_banner = txtDisabled;
            $sb_26.status_pemanasan = false;
            $sb_26.status_pemasakan = false;
            $sb_26.status_selesai = false;
        }
    }

    // Unit 27
    if ($sb_27.is_active) {
        var u27 = { is_active: true, _commOperation: $sb27._commOperation, _commStatus: $sb27._commStatus, maintenance_mode: $sb_27.maintenance_mode, runStop: $sb27.runStop, temp: $sb27.temp, target_menit: $sb_27.target_menit, adjust_menit: $sb_27.adjust_menit, sisa_detik_masak: $sb_27.sisa_detik_masak, total_detik_pemanasan: $sb_27.total_detik_pemanasan, flag_init_start: $sb_27.flag_init_start, flag_init_masak: $sb_27.flag_init_masak, suhu_awal: $sb_27.suhu_awal, suhu_akhir: $sb_27.suhu_akhir, perubahan_waktu: $sb_27.perubahan_waktu, status_kosong: $sb_27.status_kosong, status_pemanasan: $sb_27.status_pemanasan, status_pemasakan: $sb_27.status_pemasakan, status_selesai: $sb_27.status_selesai, status_banner: $sb_27.status_banner, tampil_jam_mulai: $sb_27.tampil_jam_mulai, tampil_jam_masak: $sb_27.tampil_jam_masak, tampil_jam_selesai: $sb_27.tampil_jam_selesai, tampil_durasi_actual: $sb_27.tampil_durasi_actual, tampil_pemanasan: $sb_27.tampil_pemanasan };
        prosesUnit(u27, 27, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb27._commOperation !== u27._commOperation) $sb27._commOperation = u27._commOperation;
        if ($sb_27.status_banner !== u27.status_banner) $sb_27.status_banner = u27.status_banner;
        if ($sb_27.status_pemanasan !== u27.status_pemanasan) $sb_27.status_pemanasan = u27.status_pemanasan;
        if ($sb_27.status_pemasakan !== u27.status_pemasakan) $sb_27.status_pemasakan = u27.status_pemasakan;
        if ($sb_27.status_selesai !== u27.status_selesai) $sb_27.status_selesai = u27.status_selesai;
        if ($sb_27.status_kosong !== u27.status_kosong) $sb_27.status_kosong = u27.status_kosong;
        if ($sb_27.target_menit !== u27.target_menit) $sb_27.target_menit = u27.target_menit;
        if ($sb_27.adjust_menit !== u27.adjust_menit) $sb_27.adjust_menit = u27.adjust_menit;
        if ($sb_27.sisa_detik_masak !== u27.sisa_detik_masak) $sb_27.sisa_detik_masak = u27.sisa_detik_masak;
        if ($sb_27.total_detik_pemanasan !== u27.total_detik_pemanasan) $sb_27.total_detik_pemanasan = u27.total_detik_pemanasan;
        if ($sb_27.flag_init_start !== u27.flag_init_start) $sb_27.flag_init_start = u27.flag_init_start;
        if ($sb_27.flag_init_masak !== u27.flag_init_masak) $sb_27.flag_init_masak = u27.flag_init_masak;
        if ($sb_27.suhu_awal !== u27.suhu_awal) $sb_27.suhu_awal = u27.suhu_awal;
        if ($sb_27.suhu_akhir !== u27.suhu_akhir) $sb_27.suhu_akhir = u27.suhu_akhir;
        if ($sb_27.perubahan_waktu !== u27.perubahan_waktu) $sb_27.perubahan_waktu = u27.perubahan_waktu;
        if ($sb_27.tampil_jam_mulai !== u27.tampil_jam_mulai) $sb_27.tampil_jam_mulai = u27.tampil_jam_mulai;
        if ($sb_27.tampil_jam_masak !== u27.tampil_jam_masak) $sb_27.tampil_jam_masak = u27.tampil_jam_masak;
        if ($sb_27.tampil_jam_selesai !== u27.tampil_jam_selesai) $sb_27.tampil_jam_selesai = u27.tampil_jam_selesai;
        if ($sb_27.tampil_durasi_actual !== u27.tampil_durasi_actual) $sb_27.tampil_durasi_actual = u27.tampil_durasi_actual;
        if ($sb_27.tampil_pemanasan !== u27.tampil_pemanasan) $sb_27.tampil_pemanasan = u27.tampil_pemanasan;
        if ($sb27.runStop !== u27.runStop) $sb27.runStop = u27.runStop;
    } else {
        if ($sb27._commOperation !== false) {
            $sb27._commOperation = false;
            $sb_27.status_banner = txtDisabled;
            $sb_27.status_pemanasan = false;
            $sb_27.status_pemasakan = false;
            $sb_27.status_selesai = false;
        }
    }

    // Unit 28
    if ($sb_28.is_active) {
        var u28 = { is_active: true, _commOperation: $sb28._commOperation, _commStatus: $sb28._commStatus, maintenance_mode: $sb_28.maintenance_mode, runStop: $sb28.runStop, temp: $sb28.temp, target_menit: $sb_28.target_menit, adjust_menit: $sb_28.adjust_menit, sisa_detik_masak: $sb_28.sisa_detik_masak, total_detik_pemanasan: $sb_28.total_detik_pemanasan, flag_init_start: $sb_28.flag_init_start, flag_init_masak: $sb_28.flag_init_masak, suhu_awal: $sb_28.suhu_awal, suhu_akhir: $sb_28.suhu_akhir, perubahan_waktu: $sb_28.perubahan_waktu, status_kosong: $sb_28.status_kosong, status_pemanasan: $sb_28.status_pemanasan, status_pemasakan: $sb_28.status_pemasakan, status_selesai: $sb_28.status_selesai, status_banner: $sb_28.status_banner, tampil_jam_mulai: $sb_28.tampil_jam_mulai, tampil_jam_masak: $sb_28.tampil_jam_masak, tampil_jam_selesai: $sb_28.tampil_jam_selesai, tampil_durasi_actual: $sb_28.tampil_durasi_actual, tampil_pemanasan: $sb_28.tampil_pemanasan };
        prosesUnit(u28, 28, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb28._commOperation !== u28._commOperation) $sb28._commOperation = u28._commOperation;
        if ($sb_28.status_banner !== u28.status_banner) $sb_28.status_banner = u28.status_banner;
        if ($sb_28.status_pemanasan !== u28.status_pemanasan) $sb_28.status_pemanasan = u28.status_pemanasan;
        if ($sb_28.status_pemasakan !== u28.status_pemasakan) $sb_28.status_pemasakan = u28.status_pemasakan;
        if ($sb_28.status_selesai !== u28.status_selesai) $sb_28.status_selesai = u28.status_selesai;
        if ($sb_28.status_kosong !== u28.status_kosong) $sb_28.status_kosong = u28.status_kosong;
        if ($sb_28.target_menit !== u28.target_menit) $sb_28.target_menit = u28.target_menit;
        if ($sb_28.adjust_menit !== u28.adjust_menit) $sb_28.adjust_menit = u28.adjust_menit;
        if ($sb_28.sisa_detik_masak !== u28.sisa_detik_masak) $sb_28.sisa_detik_masak = u28.sisa_detik_masak;
        if ($sb_28.total_detik_pemanasan !== u28.total_detik_pemanasan) $sb_28.total_detik_pemanasan = u28.total_detik_pemanasan;
        if ($sb_28.flag_init_start !== u28.flag_init_start) $sb_28.flag_init_start = u28.flag_init_start;
        if ($sb_28.flag_init_masak !== u28.flag_init_masak) $sb_28.flag_init_masak = u28.flag_init_masak;
        if ($sb_28.suhu_awal !== u28.suhu_awal) $sb_28.suhu_awal = u28.suhu_awal;
        if ($sb_28.suhu_akhir !== u28.suhu_akhir) $sb_28.suhu_akhir = u28.suhu_akhir;
        if ($sb_28.perubahan_waktu !== u28.perubahan_waktu) $sb_28.perubahan_waktu = u28.perubahan_waktu;
        if ($sb_28.tampil_jam_mulai !== u28.tampil_jam_mulai) $sb_28.tampil_jam_mulai = u28.tampil_jam_mulai;
        if ($sb_28.tampil_jam_masak !== u28.tampil_jam_masak) $sb_28.tampil_jam_masak = u28.tampil_jam_masak;
        if ($sb_28.tampil_jam_selesai !== u28.tampil_jam_selesai) $sb_28.tampil_jam_selesai = u28.tampil_jam_selesai;
        if ($sb_28.tampil_durasi_actual !== u28.tampil_durasi_actual) $sb_28.tampil_durasi_actual = u28.tampil_durasi_actual;
        if ($sb_28.tampil_pemanasan !== u28.tampil_pemanasan) $sb_28.tampil_pemanasan = u28.tampil_pemanasan;
        if ($sb28.runStop !== u28.runStop) $sb28.runStop = u28.runStop;
    } else {
        if ($sb28._commOperation !== false) {
            $sb28._commOperation = false;
            $sb_28.status_banner = txtDisabled;
            $sb_28.status_pemanasan = false;
            $sb_28.status_pemasakan = false;
            $sb_28.status_selesai = false;
        }
    }

    // Unit 29
    if ($sb_29.is_active) {
        var u29 = { is_active: true, _commOperation: $sb29._commOperation, _commStatus: $sb29._commStatus, maintenance_mode: $sb_29.maintenance_mode, runStop: $sb29.runStop, temp: $sb29.temp, target_menit: $sb_29.target_menit, adjust_menit: $sb_29.adjust_menit, sisa_detik_masak: $sb_29.sisa_detik_masak, total_detik_pemanasan: $sb_29.total_detik_pemanasan, flag_init_start: $sb_29.flag_init_start, flag_init_masak: $sb_29.flag_init_masak, suhu_awal: $sb_29.suhu_awal, suhu_akhir: $sb_29.suhu_akhir, perubahan_waktu: $sb_29.perubahan_waktu, status_kosong: $sb_29.status_kosong, status_pemanasan: $sb_29.status_pemanasan, status_pemasakan: $sb_29.status_pemasakan, status_selesai: $sb_29.status_selesai, status_banner: $sb_29.status_banner, tampil_jam_mulai: $sb_29.tampil_jam_mulai, tampil_jam_masak: $sb_29.tampil_jam_masak, tampil_jam_selesai: $sb_29.tampil_jam_selesai, tampil_durasi_actual: $sb_29.tampil_durasi_actual, tampil_pemanasan: $sb_29.tampil_pemanasan };
        prosesUnit(u29, 29, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb29._commOperation !== u29._commOperation) $sb29._commOperation = u29._commOperation;
        if ($sb_29.status_banner !== u29.status_banner) $sb_29.status_banner = u29.status_banner;
        if ($sb_29.status_pemanasan !== u29.status_pemanasan) $sb_29.status_pemanasan = u29.status_pemanasan;
        if ($sb_29.status_pemasakan !== u29.status_pemasakan) $sb_29.status_pemasakan = u29.status_pemasakan;
        if ($sb_29.status_selesai !== u29.status_selesai) $sb_29.status_selesai = u29.status_selesai;
        if ($sb_29.status_kosong !== u29.status_kosong) $sb_29.status_kosong = u29.status_kosong;
        if ($sb_29.target_menit !== u29.target_menit) $sb_29.target_menit = u29.target_menit;
        if ($sb_29.adjust_menit !== u29.adjust_menit) $sb_29.adjust_menit = u29.adjust_menit;
        if ($sb_29.sisa_detik_masak !== u29.sisa_detik_masak) $sb_29.sisa_detik_masak = u29.sisa_detik_masak;
        if ($sb_29.total_detik_pemanasan !== u29.total_detik_pemanasan) $sb_29.total_detik_pemanasan = u29.total_detik_pemanasan;
        if ($sb_29.flag_init_start !== u29.flag_init_start) $sb_29.flag_init_start = u29.flag_init_start;
        if ($sb_29.flag_init_masak !== u29.flag_init_masak) $sb_29.flag_init_masak = u29.flag_init_masak;
        if ($sb_29.suhu_awal !== u29.suhu_awal) $sb_29.suhu_awal = u29.suhu_awal;
        if ($sb_29.suhu_akhir !== u29.suhu_akhir) $sb_29.suhu_akhir = u29.suhu_akhir;
        if ($sb_29.perubahan_waktu !== u29.perubahan_waktu) $sb_29.perubahan_waktu = u29.perubahan_waktu;
        if ($sb_29.tampil_jam_mulai !== u29.tampil_jam_mulai) $sb_29.tampil_jam_mulai = u29.tampil_jam_mulai;
        if ($sb_29.tampil_jam_masak !== u29.tampil_jam_masak) $sb_29.tampil_jam_masak = u29.tampil_jam_masak;
        if ($sb_29.tampil_jam_selesai !== u29.tampil_jam_selesai) $sb_29.tampil_jam_selesai = u29.tampil_jam_selesai;
        if ($sb_29.tampil_durasi_actual !== u29.tampil_durasi_actual) $sb_29.tampil_durasi_actual = u29.tampil_durasi_actual;
        if ($sb_29.tampil_pemanasan !== u29.tampil_pemanasan) $sb_29.tampil_pemanasan = u29.tampil_pemanasan;
        if ($sb29.runStop !== u29.runStop) $sb29.runStop = u29.runStop;
    } else {
        if ($sb29._commOperation !== false) {
            $sb29._commOperation = false;
            $sb_29.status_banner = txtDisabled;
            $sb_29.status_pemanasan = false;
            $sb_29.status_pemasakan = false;
            $sb_29.status_selesai = false;
        }
    }

    // Unit 30
    if ($sb_30.is_active) {
        var u30 = { is_active: true, _commOperation: $sb30._commOperation, _commStatus: $sb30._commStatus, maintenance_mode: $sb_30.maintenance_mode, runStop: $sb30.runStop, temp: $sb30.temp, target_menit: $sb_30.target_menit, adjust_menit: $sb_30.adjust_menit, sisa_detik_masak: $sb_30.sisa_detik_masak, total_detik_pemanasan: $sb_30.total_detik_pemanasan, flag_init_start: $sb_30.flag_init_start, flag_init_masak: $sb_30.flag_init_masak, suhu_awal: $sb_30.suhu_awal, suhu_akhir: $sb_30.suhu_akhir, perubahan_waktu: $sb_30.perubahan_waktu, status_kosong: $sb_30.status_kosong, status_pemanasan: $sb_30.status_pemanasan, status_pemasakan: $sb_30.status_pemasakan, status_selesai: $sb_30.status_selesai, status_banner: $sb_30.status_banner, tampil_jam_mulai: $sb_30.tampil_jam_mulai, tampil_jam_masak: $sb_30.tampil_jam_masak, tampil_jam_selesai: $sb_30.tampil_jam_selesai, tampil_durasi_actual: $sb_30.tampil_durasi_actual, tampil_pemanasan: $sb_30.tampil_pemanasan };
        prosesUnit(u30, 30, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
        if ($sb30._commOperation !== u30._commOperation) $sb30._commOperation = u30._commOperation;
        if ($sb_30.status_banner !== u30.status_banner) $sb_30.status_banner = u30.status_banner;
        if ($sb_30.status_pemanasan !== u30.status_pemanasan) $sb_30.status_pemanasan = u30.status_pemanasan;
        if ($sb_30.status_pemasakan !== u30.status_pemasakan) $sb_30.status_pemasakan = u30.status_pemasakan;
        if ($sb_30.status_selesai !== u30.status_selesai) $sb_30.status_selesai = u30.status_selesai;
        if ($sb_30.status_kosong !== u30.status_kosong) $sb_30.status_kosong = u30.status_kosong;
        if ($sb_30.target_menit !== u30.target_menit) $sb_30.target_menit = u30.target_menit;
        if ($sb_30.adjust_menit !== u30.adjust_menit) $sb_30.adjust_menit = u30.adjust_menit;
        if ($sb_30.sisa_detik_masak !== u30.sisa_detik_masak) $sb_30.sisa_detik_masak = u30.sisa_detik_masak;
        if ($sb_30.total_detik_pemanasan !== u30.total_detik_pemanasan) $sb_30.total_detik_pemanasan = u30.total_detik_pemanasan;
        if ($sb_30.flag_init_start !== u30.flag_init_start) $sb_30.flag_init_start = u30.flag_init_start;
        if ($sb_30.flag_init_masak !== u30.flag_init_masak) $sb_30.flag_init_masak = u30.flag_init_masak;
        if ($sb_30.suhu_awal !== u30.suhu_awal) $sb_30.suhu_awal = u30.suhu_awal;
        if ($sb_30.suhu_akhir !== u30.suhu_akhir) $sb_30.suhu_akhir = u30.suhu_akhir;
        if ($sb_30.perubahan_waktu !== u30.perubahan_waktu) $sb_30.perubahan_waktu = u30.perubahan_waktu;
        if ($sb_30.tampil_jam_mulai !== u30.tampil_jam_mulai) $sb_30.tampil_jam_mulai = u30.tampil_jam_mulai;
        if ($sb_30.tampil_jam_masak !== u30.tampil_jam_masak) $sb_30.tampil_jam_masak = u30.tampil_jam_masak;
        if ($sb_30.tampil_jam_selesai !== u30.tampil_jam_selesai) $sb_30.tampil_jam_selesai = u30.tampil_jam_selesai;
        if ($sb_30.tampil_durasi_actual !== u30.tampil_durasi_actual) $sb_30.tampil_durasi_actual = u30.tampil_durasi_actual;
        if ($sb_30.tampil_pemanasan !== u30.tampil_pemanasan) $sb_30.tampil_pemanasan = u30.tampil_pemanasan;
        if ($sb30.runStop !== u30.runStop) $sb30.runStop = u30.runStop;
    } else {
        if ($sb30._commOperation !== false) {
            $sb30._commOperation = false;
            $sb_30.status_banner = txtDisabled;
            $sb_30.status_pemanasan = false;
            $sb_30.status_pemasakan = false;
            $sb_30.status_selesai = false;
        }
    }


    // Sorting Logic
    runningRooms.sort(function(a, b) {
        return a.sisa - b.sisa;
    });

    // Write to 5 slots (only write on change!)
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

// RUN SIMULATION TESTS FOR OPTIMIZED PATTERN
console.log("=== SIMULASI UJI COBA DETEKSI OFFLINE & RECOVERY (OPTIMIZED V3) ===");

// 1. Detik 1: Normal
global.$sb30.runStop = false; // RUNNING
tickClock();
runMasterLoopScript();
console.log("\nDetik 1 (Koneksi Normal) -> Unit 30 Temp: " + global.$sb30.temp/10 + "C, State Masak: " + global.$sb_30.status_pemasakan + 
    ", Sisa Masak: " + global.$sb_30.tampil_durasi_actual
);

// 2. Detik 2: Offline (commStatus = false)
console.log("\n--- DETIK 2: GANGGUAN TERJADI! MCB TRIP / ALAT MATI ---");
global.$sb30._commStatus = false;
tickClock();
runMasterLoopScript();
console.log("Detik 2 (Offline) -> Unit 30 CommStatus: " + global.$sb30._commStatus + 
    ", State Masak (Harus Off): " + global.$sb_30.status_pemasakan +
    ", Sisa Masak di Layar (Harus Tetap/Pause): " + global.$sb_30.tampil_durasi_actual
);

// 3. Detik 3: Still offline
tickClock();
runMasterLoopScript();
console.log("Detik 3 (Offline) -> Sisa Masak di Layar (Tetap Terjaga): " + global.$sb_30.tampil_durasi_actual);

// 4. Detik 4: Recovery (commStatus = true)
console.log("\n--- DETIK 4: KONEKSI DILANJUTKAN (RECOVERY) ---");
global.$sb30._commStatus = true;
tickClock();
runMasterLoopScript();
console.log("Detik 4 (Recovery) -> Unit 30 CommStatus: " + global.$sb30._commStatus + 
    ", State Masak (Harus Hidup Lagi): " + global.$sb_30.status_pemasakan +
    ", Sisa Masak (Harus Berkurang 1 detik dr 89s): " + global.$sb_30.tampil_durasi_actual
);

// 5. Test inactive unit 29 (should remain disabled and have commOperation = false)
console.log("\n--- PENGUJIAN UNIT 29 (NONAKTIF) ---");
console.log("Unit 29 isActive: " + global.$sb_29.is_active +
    "\n  _commOperation (Harus otomatis False): " + global.$sb29._commOperation +
    "\n  statusBanner (Harus COMM DISABLED): " + global.$sb_29.status_banner
);

// 6. Test Sensor Error on Unit 30
console.log("\n--- DETIK 5: DETEKSI SENSOR ERROR (OPENLOOP / HHHH) PADA UNIT 30 ---");
global.$sb30.temp = 32767;
tickClock();
runMasterLoopScript();
console.log("Detik 5 (Sensor Error) -> Unit 30 Temp: " + global.$sb30.temp +
    "\n  runStop (Harus tetap False/RUN - Tidak boleh mati!): " + global.$sb30.runStop +
    "\n  status_pemasakan (Harus tetap True): " + global.$sb_30.status_pemasakan +
    "\n  status_banner (Harus ERROR SENSOR): " + global.$sb_30.status_banner
);
