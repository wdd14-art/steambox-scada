// Simulation of updated Haiwell SCADA JavaScript Engine using literal $ variables
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
    // 1. Sync Modbus Polling
    if (u.is_active) {
        if (u._commOperation !== true) u._commOperation = true;
    } else {
        if (u._commOperation !== false) u._commOperation = false;
        u.status_banner = txtDisabled;
        u.status_pemanasan = false;
        u.status_pemasakan = false;
        u.status_selesai = false;
        return;
    }

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
    var u1 = { is_active: $sb_1.is_active, _commOperation: $sb1._commOperation, _commStatus: $sb1._commStatus, maintenance_mode: $sb_1.maintenance_mode, runStop: $sb1.runStop, temp: $sb1.temp, target_menit: $sb_1.target_menit, adjust_menit: $sb_1.adjust_menit, sisa_detik_masak: $sb_1.sisa_detik_masak, total_detik_pemanasan: $sb_1.total_detik_pemanasan, flag_init_start: $sb_1.flag_init_start, flag_init_masak: $sb_1.flag_init_masak, suhu_awal: $sb_1.suhu_awal, suhu_akhir: $sb_1.suhu_akhir, perubahan_waktu: $sb_1.perubahan_waktu, status_kosong: $sb_1.status_kosong, status_pemanasan: $sb_1.status_pemanasan, status_pemasakan: $sb_1.status_pemasakan, status_selesai: $sb_1.status_selesai, status_banner: $sb_1.status_banner, tampil_jam_mulai: $sb_1.tampil_jam_mulai, tampil_jam_masak: $sb_1.tampil_jam_masak, tampil_jam_selesai: $sb_1.tampil_jam_selesai, tampil_durasi_actual: $sb_1.tampil_durasi_actual, tampil_pemanasan: $sb_1.tampil_pemanasan };
    prosesUnit(u1, 1, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb1._commOperation = u1._commOperation; $sb_1.status_banner = u1.status_banner; $sb_1.status_pemanasan = u1.status_pemanasan; $sb_1.status_pemasakan = u1.status_pemasakan; $sb_1.status_selesai = u1.status_selesai; $sb_1.status_kosong = u1.status_kosong; $sb_1.target_menit = u1.target_menit; $sb_1.adjust_menit = u1.adjust_menit; $sb_1.sisa_detik_masak = u1.sisa_detik_masak; $sb_1.total_detik_pemanasan = u1.total_detik_pemanasan; $sb_1.flag_init_start = u1.flag_init_start; $sb_1.flag_init_masak = u1.flag_init_masak; $sb_1.suhu_awal = u1.suhu_awal; $sb_1.suhu_akhir = u1.suhu_akhir; $sb_1.perubahan_waktu = u1.perubahan_waktu; $sb_1.tampil_jam_mulai = u1.tampil_jam_mulai; $sb_1.tampil_jam_masak = u1.tampil_jam_masak; $sb_1.tampil_jam_selesai = u1.tampil_jam_selesai; $sb_1.tampil_durasi_actual = u1.tampil_durasi_actual; $sb_1.tampil_pemanasan = u1.tampil_pemanasan; $sb1.runStop = u1.runStop;

    // Unit 2
    var u2 = { is_active: $sb_2.is_active, _commOperation: $sb2._commOperation, _commStatus: $sb2._commStatus, maintenance_mode: $sb_2.maintenance_mode, runStop: $sb2.runStop, temp: $sb2.temp, target_menit: $sb_2.target_menit, adjust_menit: $sb_2.adjust_menit, sisa_detik_masak: $sb_2.sisa_detik_masak, total_detik_pemanasan: $sb_2.total_detik_pemanasan, flag_init_start: $sb_2.flag_init_start, flag_init_masak: $sb_2.flag_init_masak, suhu_awal: $sb_2.suhu_awal, suhu_akhir: $sb_2.suhu_akhir, perubahan_waktu: $sb_2.perubahan_waktu, status_kosong: $sb_2.status_kosong, status_pemanasan: $sb_2.status_pemanasan, status_pemasakan: $sb_2.status_pemasakan, status_selesai: $sb_2.status_selesai, status_banner: $sb_2.status_banner, tampil_jam_mulai: $sb_2.tampil_jam_mulai, tampil_jam_masak: $sb_2.tampil_jam_masak, tampil_jam_selesai: $sb_2.tampil_jam_selesai, tampil_durasi_actual: $sb_2.tampil_durasi_actual, tampil_pemanasan: $sb_2.tampil_pemanasan };
    prosesUnit(u2, 2, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb2._commOperation = u2._commOperation; $sb_2.status_banner = u2.status_banner; $sb_2.status_pemanasan = u2.status_pemanasan; $sb_2.status_pemasakan = u2.status_pemasakan; $sb_2.status_selesai = u2.status_selesai; $sb_2.status_kosong = u2.status_kosong; $sb_2.target_menit = u2.target_menit; $sb_2.adjust_menit = u2.adjust_menit; $sb_2.sisa_detik_masak = u2.sisa_detik_masak; $sb_2.total_detik_pemanasan = u2.total_detik_pemanasan; $sb_2.flag_init_start = u2.flag_init_start; $sb_2.flag_init_masak = u2.flag_init_masak; $sb_2.suhu_awal = u2.suhu_awal; $sb_2.suhu_akhir = u2.suhu_akhir; $sb_2.perubahan_waktu = u2.perubahan_waktu; $sb_2.tampil_jam_mulai = u2.tampil_jam_mulai; $sb_2.tampil_jam_masak = u2.tampil_jam_masak; $sb_2.tampil_jam_selesai = u2.tampil_jam_selesai; $sb_2.tampil_durasi_actual = u2.tampil_durasi_actual; $sb_2.tampil_pemanasan = u2.tampil_pemanasan; $sb2.runStop = u2.runStop;

    // Unit 3
    var u3 = { is_active: $sb_3.is_active, _commOperation: $sb3._commOperation, _commStatus: $sb3._commStatus, maintenance_mode: $sb_3.maintenance_mode, runStop: $sb3.runStop, temp: $sb3.temp, target_menit: $sb_3.target_menit, adjust_menit: $sb_3.adjust_menit, sisa_detik_masak: $sb_3.sisa_detik_masak, total_detik_pemanasan: $sb_3.total_detik_pemanasan, flag_init_start: $sb_3.flag_init_start, flag_init_masak: $sb_3.flag_init_masak, suhu_awal: $sb_3.suhu_awal, suhu_akhir: $sb_3.suhu_akhir, perubahan_waktu: $sb_3.perubahan_waktu, status_kosong: $sb_3.status_kosong, status_pemanasan: $sb_3.status_pemanasan, status_pemasakan: $sb_3.status_pemasakan, status_selesai: $sb_3.status_selesai, status_banner: $sb_3.status_banner, tampil_jam_mulai: $sb_3.tampil_jam_mulai, tampil_jam_masak: $sb_3.tampil_jam_masak, tampil_jam_selesai: $sb_3.tampil_jam_selesai, tampil_durasi_actual: $sb_3.tampil_durasi_actual, tampil_pemanasan: $sb_3.tampil_pemanasan };
    prosesUnit(u3, 3, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb3._commOperation = u3._commOperation; $sb_3.status_banner = u3.status_banner; $sb_3.status_pemanasan = u3.status_pemanasan; $sb_3.status_pemasakan = u3.status_pemasakan; $sb_3.status_selesai = u3.status_selesai; $sb_3.status_kosong = u3.status_kosong; $sb_3.target_menit = u3.target_menit; $sb_3.adjust_menit = u3.adjust_menit; $sb_3.sisa_detik_masak = u3.sisa_detik_masak; $sb_3.total_detik_pemanasan = u3.total_detik_pemanasan; $sb_3.flag_init_start = u3.flag_init_start; $sb_3.flag_init_masak = u3.flag_init_masak; $sb_3.suhu_awal = u3.suhu_awal; $sb_3.suhu_akhir = u3.suhu_akhir; $sb_3.perubahan_waktu = u3.perubahan_waktu; $sb_3.tampil_jam_mulai = u3.tampil_jam_mulai; $sb_3.tampil_jam_masak = u3.tampil_jam_masak; $sb_3.tampil_jam_selesai = u3.tampil_jam_selesai; $sb_3.tampil_durasi_actual = u3.tampil_durasi_actual; $sb_3.tampil_pemanasan = u3.tampil_pemanasan; $sb3.runStop = u3.runStop;

    // Unit 4
    var u4 = { is_active: $sb_4.is_active, _commOperation: $sb4._commOperation, _commStatus: $sb4._commStatus, maintenance_mode: $sb_4.maintenance_mode, runStop: $sb4.runStop, temp: $sb4.temp, target_menit: $sb_4.target_menit, adjust_menit: $sb_4.adjust_menit, sisa_detik_masak: $sb_4.sisa_detik_masak, total_detik_pemanasan: $sb_4.total_detik_pemanasan, flag_init_start: $sb_4.flag_init_start, flag_init_masak: $sb_4.flag_init_masak, suhu_awal: $sb_4.suhu_awal, suhu_akhir: $sb_4.suhu_akhir, perubahan_waktu: $sb_4.perubahan_waktu, status_kosong: $sb_4.status_kosong, status_pemanasan: $sb_4.status_pemanasan, status_pemasakan: $sb_4.status_pemasakan, status_selesai: $sb_4.status_selesai, status_banner: $sb_4.status_banner, tampil_jam_mulai: $sb_4.tampil_jam_mulai, tampil_jam_masak: $sb_4.tampil_jam_masak, tampil_jam_selesai: $sb_4.tampil_jam_selesai, tampil_durasi_actual: $sb_4.tampil_durasi_actual, tampil_pemanasan: $sb_4.tampil_pemanasan };
    prosesUnit(u4, 4, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb4._commOperation = u4._commOperation; $sb_4.status_banner = u4.status_banner; $sb_4.status_pemanasan = u4.status_pemanasan; $sb_4.status_pemasakan = u4.status_pemasakan; $sb_4.status_selesai = u4.status_selesai; $sb_4.status_kosong = u4.status_kosong; $sb_4.target_menit = u4.target_menit; $sb_4.adjust_menit = u4.adjust_menit; $sb_4.sisa_detik_masak = u4.sisa_detik_masak; $sb_4.total_detik_pemanasan = u4.total_detik_pemanasan; $sb_4.flag_init_start = u4.flag_init_start; $sb_4.flag_init_masak = u4.flag_init_masak; $sb_4.suhu_awal = u4.suhu_awal; $sb_4.suhu_akhir = u4.suhu_akhir; $sb_4.perubahan_waktu = u4.perubahan_waktu; $sb_4.tampil_jam_mulai = u4.tampil_jam_mulai; $sb_4.tampil_jam_masak = u4.tampil_jam_masak; $sb_4.tampil_jam_selesai = u4.tampil_jam_selesai; $sb_4.tampil_durasi_actual = u4.tampil_durasi_actual; $sb_4.tampil_pemanasan = u4.tampil_pemanasan; $sb4.runStop = u4.runStop;

    // Unit 5
    var u5 = { is_active: $sb_5.is_active, _commOperation: $sb5._commOperation, _commStatus: $sb5._commStatus, maintenance_mode: $sb_5.maintenance_mode, runStop: $sb5.runStop, temp: $sb5.temp, target_menit: $sb_5.target_menit, adjust_menit: $sb_5.adjust_menit, sisa_detik_masak: $sb_5.sisa_detik_masak, total_detik_pemanasan: $sb_5.total_detik_pemanasan, flag_init_start: $sb_5.flag_init_start, flag_init_masak: $sb_5.flag_init_masak, suhu_awal: $sb_5.suhu_awal, suhu_akhir: $sb_5.suhu_akhir, perubahan_waktu: $sb_5.perubahan_waktu, status_kosong: $sb_5.status_kosong, status_pemanasan: $sb_5.status_pemanasan, status_pemasakan: $sb_5.status_pemasakan, status_selesai: $sb_5.status_selesai, status_banner: $sb_5.status_banner, tampil_jam_mulai: $sb_5.tampil_jam_mulai, tampil_jam_masak: $sb_5.tampil_jam_masak, tampil_jam_selesai: $sb_5.tampil_jam_selesai, tampil_durasi_actual: $sb_5.tampil_durasi_actual, tampil_pemanasan: $sb_5.tampil_pemanasan };
    prosesUnit(u5, 5, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb5._commOperation = u5._commOperation; $sb_5.status_banner = u5.status_banner; $sb_5.status_pemanasan = u5.status_pemanasan; $sb_5.status_pemasakan = u5.status_pemasakan; $sb_5.status_selesai = u5.status_selesai; $sb_5.status_kosong = u5.status_kosong; $sb_5.target_menit = u5.target_menit; $sb_5.adjust_menit = u5.adjust_menit; $sb_5.sisa_detik_masak = u5.sisa_detik_masak; $sb_5.total_detik_pemanasan = u5.total_detik_pemanasan; $sb_5.flag_init_start = u5.flag_init_start; $sb_5.flag_init_masak = u5.flag_init_masak; $sb_5.suhu_awal = u5.suhu_awal; $sb_5.suhu_akhir = u5.suhu_akhir; $sb_5.perubahan_waktu = u5.perubahan_waktu; $sb_5.tampil_jam_mulai = u5.tampil_jam_mulai; $sb_5.tampil_jam_masak = u5.tampil_jam_masak; $sb_5.tampil_jam_selesai = u5.tampil_jam_selesai; $sb_5.tampil_durasi_actual = u5.tampil_durasi_actual; $sb_5.tampil_pemanasan = u5.tampil_pemanasan; $sb5.runStop = u5.runStop;

    // Unit 6
    var u6 = { is_active: $sb_6.is_active, _commOperation: $sb6._commOperation, _commStatus: $sb6._commStatus, maintenance_mode: $sb_6.maintenance_mode, runStop: $sb6.runStop, temp: $sb6.temp, target_menit: $sb_6.target_menit, adjust_menit: $sb_6.adjust_menit, sisa_detik_masak: $sb_6.sisa_detik_masak, total_detik_pemanasan: $sb_6.total_detik_pemanasan, flag_init_start: $sb_6.flag_init_start, flag_init_masak: $sb_6.flag_init_masak, suhu_awal: $sb_6.suhu_awal, suhu_akhir: $sb_6.suhu_akhir, perubahan_waktu: $sb_6.perubahan_waktu, status_kosong: $sb_6.status_kosong, status_pemanasan: $sb_6.status_pemanasan, status_pemasakan: $sb_6.status_pemasakan, status_selesai: $sb_6.status_selesai, status_banner: $sb_6.status_banner, tampil_jam_mulai: $sb_6.tampil_jam_mulai, tampil_jam_masak: $sb_6.tampil_jam_masak, tampil_jam_selesai: $sb_6.tampil_jam_selesai, tampil_durasi_actual: $sb_6.tampil_durasi_actual, tampil_pemanasan: $sb_6.tampil_pemanasan };
    prosesUnit(u6, 6, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb6._commOperation = u6._commOperation; $sb_6.status_banner = u6.status_banner; $sb_6.status_pemanasan = u6.status_pemanasan; $sb_6.status_pemasakan = u6.status_pemasakan; $sb_6.status_selesai = u6.status_selesai; $sb_6.status_kosong = u6.status_kosong; $sb_6.target_menit = u6.target_menit; $sb_6.adjust_menit = u6.adjust_menit; $sb_6.sisa_detik_masak = u6.sisa_detik_masak; $sb_6.total_detik_pemanasan = u6.total_detik_pemanasan; $sb_6.flag_init_start = u6.flag_init_start; $sb_6.flag_init_masak = u6.flag_init_masak; $sb_6.suhu_awal = u6.suhu_awal; $sb_6.suhu_akhir = u6.suhu_akhir; $sb_6.perubahan_waktu = u6.perubahan_waktu; $sb_6.tampil_jam_mulai = u6.tampil_jam_mulai; $sb_6.tampil_jam_masak = u6.tampil_jam_masak; $sb_6.tampil_jam_selesai = u6.tampil_jam_selesai; $sb_6.tampil_durasi_actual = u6.tampil_durasi_actual; $sb_6.tampil_pemanasan = u6.tampil_pemanasan; $sb6.runStop = u6.runStop;

    // Unit 7
    var u7 = { is_active: $sb_7.is_active, _commOperation: $sb7._commOperation, _commStatus: $sb7._commStatus, maintenance_mode: $sb_7.maintenance_mode, runStop: $sb7.runStop, temp: $sb7.temp, target_menit: $sb_7.target_menit, adjust_menit: $sb_7.adjust_menit, sisa_detik_masak: $sb_7.sisa_detik_masak, total_detik_pemanasan: $sb_7.total_detik_pemanasan, flag_init_start: $sb_7.flag_init_start, flag_init_masak: $sb_7.flag_init_masak, suhu_awal: $sb_7.suhu_awal, suhu_akhir: $sb_7.suhu_akhir, perubahan_waktu: $sb_7.perubahan_waktu, status_kosong: $sb_7.status_kosong, status_pemanasan: $sb_7.status_pemanasan, status_pemasakan: $sb_7.status_pemasakan, status_selesai: $sb_7.status_selesai, status_banner: $sb_7.status_banner, tampil_jam_mulai: $sb_7.tampil_jam_mulai, tampil_jam_masak: $sb_7.tampil_jam_masak, tampil_jam_selesai: $sb_7.tampil_jam_selesai, tampil_durasi_actual: $sb_7.tampil_durasi_actual, tampil_pemanasan: $sb_7.tampil_pemanasan };
    prosesUnit(u7, 7, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb7._commOperation = u7._commOperation; $sb_7.status_banner = u7.status_banner; $sb_7.status_pemanasan = u7.status_pemanasan; $sb_7.status_pemasakan = u7.status_pemasakan; $sb_7.status_selesai = u7.status_selesai; $sb_7.status_kosong = u7.status_kosong; $sb_7.target_menit = u7.target_menit; $sb_7.adjust_menit = u7.adjust_menit; $sb_7.sisa_detik_masak = u7.sisa_detik_masak; $sb_7.total_detik_pemanasan = u7.total_detik_pemanasan; $sb_7.flag_init_start = u7.flag_init_start; $sb_7.flag_init_masak = u7.flag_init_masak; $sb_7.suhu_awal = u7.suhu_awal; $sb_7.suhu_akhir = u7.suhu_akhir; $sb_7.perubahan_waktu = u7.perubahan_waktu; $sb_7.tampil_jam_mulai = u7.tampil_jam_mulai; $sb_7.tampil_jam_masak = u7.tampil_jam_masak; $sb_7.tampil_jam_selesai = u7.tampil_jam_selesai; $sb_7.tampil_durasi_actual = u7.tampil_durasi_actual; $sb_7.tampil_pemanasan = u7.tampil_pemanasan; $sb7.runStop = u7.runStop;

    // Unit 8
    var u8 = { is_active: $sb_8.is_active, _commOperation: $sb8._commOperation, _commStatus: $sb8._commStatus, maintenance_mode: $sb_8.maintenance_mode, runStop: $sb8.runStop, temp: $sb8.temp, target_menit: $sb_8.target_menit, adjust_menit: $sb_8.adjust_menit, sisa_detik_masak: $sb_8.sisa_detik_masak, total_detik_pemanasan: $sb_8.total_detik_pemanasan, flag_init_start: $sb_8.flag_init_start, flag_init_masak: $sb_8.flag_init_masak, suhu_awal: $sb_8.suhu_awal, suhu_akhir: $sb_8.suhu_akhir, perubahan_waktu: $sb_8.perubahan_waktu, status_kosong: $sb_8.status_kosong, status_pemanasan: $sb_8.status_pemanasan, status_pemasakan: $sb_8.status_pemasakan, status_selesai: $sb_8.status_selesai, status_banner: $sb_8.status_banner, tampil_jam_mulai: $sb_8.tampil_jam_mulai, tampil_jam_masak: $sb_8.tampil_jam_masak, tampil_jam_selesai: $sb_8.tampil_jam_selesai, tampil_durasi_actual: $sb_8.tampil_durasi_actual, tampil_pemanasan: $sb_8.tampil_pemanasan };
    prosesUnit(u8, 8, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb8._commOperation = u8._commOperation; $sb_8.status_banner = u8.status_banner; $sb_8.status_pemanasan = u8.status_pemanasan; $sb_8.status_pemasakan = u8.status_pemasakan; $sb_8.status_selesai = u8.status_selesai; $sb_8.status_kosong = u8.status_kosong; $sb_8.target_menit = u8.target_menit; $sb_8.adjust_menit = u8.adjust_menit; $sb_8.sisa_detik_masak = u8.sisa_detik_masak; $sb_8.total_detik_pemanasan = u8.total_detik_pemanasan; $sb_8.flag_init_start = u8.flag_init_start; $sb_8.flag_init_masak = u8.flag_init_masak; $sb_8.suhu_awal = u8.suhu_awal; $sb_8.suhu_akhir = u8.suhu_akhir; $sb_8.perubahan_waktu = u8.perubahan_waktu; $sb_8.tampil_jam_mulai = u8.tampil_jam_mulai; $sb_8.tampil_jam_masak = u8.tampil_jam_masak; $sb_8.tampil_jam_selesai = u8.tampil_jam_selesai; $sb_8.tampil_durasi_actual = u8.tampil_durasi_actual; $sb_8.tampil_pemanasan = u8.tampil_pemanasan; $sb8.runStop = u8.runStop;

    // Unit 9
    var u9 = { is_active: $sb_9.is_active, _commOperation: $sb9._commOperation, _commStatus: $sb9._commStatus, maintenance_mode: $sb_9.maintenance_mode, runStop: $sb9.runStop, temp: $sb9.temp, target_menit: $sb_9.target_menit, adjust_menit: $sb_9.adjust_menit, sisa_detik_masak: $sb_9.sisa_detik_masak, total_detik_pemanasan: $sb_9.total_detik_pemanasan, flag_init_start: $sb_9.flag_init_start, flag_init_masak: $sb_9.flag_init_masak, suhu_awal: $sb_9.suhu_awal, suhu_akhir: $sb_9.suhu_akhir, perubahan_waktu: $sb_9.perubahan_waktu, status_kosong: $sb_9.status_kosong, status_pemanasan: $sb_9.status_pemanasan, status_pemasakan: $sb_9.status_pemasakan, status_selesai: $sb_9.status_selesai, status_banner: $sb_9.status_banner, tampil_jam_mulai: $sb_9.tampil_jam_mulai, tampil_jam_masak: $sb_9.tampil_jam_masak, tampil_jam_selesai: $sb_9.tampil_jam_selesai, tampil_durasi_actual: $sb_9.tampil_durasi_actual, tampil_pemanasan: $sb_9.tampil_pemanasan };
    prosesUnit(u9, 9, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb9._commOperation = u9._commOperation; $sb_9.status_banner = u9.status_banner; $sb_9.status_pemanasan = u9.status_pemanasan; $sb_9.status_pemasakan = u9.status_pemasakan; $sb_9.status_selesai = u9.status_selesai; $sb_9.status_kosong = u9.status_kosong; $sb_9.target_menit = u9.target_menit; $sb_9.adjust_menit = u9.adjust_menit; $sb_9.sisa_detik_masak = u9.sisa_detik_masak; $sb_9.total_detik_pemanasan = u9.total_detik_pemanasan; $sb_9.flag_init_start = u9.flag_init_start; $sb_9.flag_init_masak = u9.flag_init_masak; $sb_9.suhu_awal = u9.suhu_awal; $sb_9.suhu_akhir = u9.suhu_akhir; $sb_9.perubahan_waktu = u9.perubahan_waktu; $sb_9.tampil_jam_mulai = u9.tampil_jam_mulai; $sb_9.tampil_jam_masak = u9.tampil_jam_masak; $sb_9.tampil_jam_selesai = u9.tampil_jam_selesai; $sb_9.tampil_durasi_actual = u9.tampil_durasi_actual; $sb_9.tampil_pemanasan = u9.tampil_pemanasan; $sb9.runStop = u9.runStop;

    // Unit 10
    var u10 = { is_active: $sb_10.is_active, _commOperation: $sb10._commOperation, _commStatus: $sb10._commStatus, maintenance_mode: $sb_10.maintenance_mode, runStop: $sb10.runStop, temp: $sb10.temp, target_menit: $sb_10.target_menit, adjust_menit: $sb_10.adjust_menit, sisa_detik_masak: $sb_10.sisa_detik_masak, total_detik_pemanasan: $sb_10.total_detik_pemanasan, flag_init_start: $sb_10.flag_init_start, flag_init_masak: $sb_10.flag_init_masak, suhu_awal: $sb_10.suhu_awal, suhu_akhir: $sb_10.suhu_akhir, perubahan_waktu: $sb_10.perubahan_waktu, status_kosong: $sb_10.status_kosong, status_pemanasan: $sb_10.status_pemanasan, status_pemasakan: $sb_10.status_pemasakan, status_selesai: $sb_10.status_selesai, status_banner: $sb_10.status_banner, tampil_jam_mulai: $sb_10.tampil_jam_mulai, tampil_jam_masak: $sb_10.tampil_jam_masak, tampil_jam_selesai: $sb_10.tampil_jam_selesai, tampil_durasi_actual: $sb_10.tampil_durasi_actual, tampil_pemanasan: $sb_10.tampil_pemanasan };
    prosesUnit(u10, 10, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb10._commOperation = u10._commOperation; $sb_10.status_banner = u10.status_banner; $sb_10.status_pemanasan = u10.status_pemanasan; $sb_10.status_pemasakan = u10.status_pemasakan; $sb_10.status_selesai = u10.status_selesai; $sb_10.status_kosong = u10.status_kosong; $sb_10.target_menit = u10.target_menit; $sb_10.adjust_menit = u10.adjust_menit; $sb_10.sisa_detik_masak = u10.sisa_detik_masak; $sb_10.total_detik_pemanasan = u10.total_detik_pemanasan; $sb_10.flag_init_start = u10.flag_init_start; $sb_10.flag_init_masak = u10.flag_init_masak; $sb_10.suhu_awal = u10.suhu_awal; $sb_10.suhu_akhir = u10.suhu_akhir; $sb_10.perubahan_waktu = u10.perubahan_waktu; $sb_10.tampil_jam_mulai = u10.tampil_jam_mulai; $sb_10.tampil_jam_masak = u10.tampil_jam_masak; $sb_10.tampil_jam_selesai = u10.tampil_jam_selesai; $sb_10.tampil_durasi_actual = u10.tampil_durasi_actual; $sb_10.tampil_pemanasan = u10.tampil_pemanasan; $sb10.runStop = u10.runStop;

    // Unit 11
    var u11 = { is_active: $sb_11.is_active, _commOperation: $sb11._commOperation, _commStatus: $sb11._commStatus, maintenance_mode: $sb_11.maintenance_mode, runStop: $sb11.runStop, temp: $sb11.temp, target_menit: $sb_11.target_menit, adjust_menit: $sb_11.adjust_menit, sisa_detik_masak: $sb_11.sisa_detik_masak, total_detik_pemanasan: $sb_11.total_detik_pemanasan, flag_init_start: $sb_11.flag_init_start, flag_init_masak: $sb_11.flag_init_masak, suhu_awal: $sb_11.suhu_awal, suhu_akhir: $sb_11.suhu_akhir, perubahan_waktu: $sb_11.perubahan_waktu, status_kosong: $sb_11.status_kosong, status_pemanasan: $sb_11.status_pemanasan, status_pemasakan: $sb_11.status_pemasakan, status_selesai: $sb_11.status_selesai, status_banner: $sb_11.status_banner, tampil_jam_mulai: $sb_11.tampil_jam_mulai, tampil_jam_masak: $sb_11.tampil_jam_masak, tampil_jam_selesai: $sb_11.tampil_jam_selesai, tampil_durasi_actual: $sb_11.tampil_durasi_actual, tampil_pemanasan: $sb_11.tampil_pemanasan };
    prosesUnit(u11, 11, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb11._commOperation = u11._commOperation; $sb_11.status_banner = u11.status_banner; $sb_11.status_pemanasan = u11.status_pemanasan; $sb_11.status_pemasakan = u11.status_pemasakan; $sb_11.status_selesai = u11.status_selesai; $sb_11.status_kosong = u11.status_kosong; $sb_11.target_menit = u11.target_menit; $sb_11.adjust_menit = u11.adjust_menit; $sb_11.sisa_detik_masak = u11.sisa_detik_masak; $sb_11.total_detik_pemanasan = u11.total_detik_pemanasan; $sb_11.flag_init_start = u11.flag_init_start; $sb_11.flag_init_masak = u11.flag_init_masak; $sb_11.suhu_awal = u11.suhu_awal; $sb_11.suhu_akhir = u11.suhu_akhir; $sb_11.perubahan_waktu = u11.perubahan_waktu; $sb_11.tampil_jam_mulai = u11.tampil_jam_mulai; $sb_11.tampil_jam_masak = u11.tampil_jam_masak; $sb_11.tampil_jam_selesai = u11.tampil_jam_selesai; $sb_11.tampil_durasi_actual = u11.tampil_durasi_actual; $sb_11.tampil_pemanasan = u11.tampil_pemanasan; $sb11.runStop = u11.runStop;

    // Unit 12
    var u12 = { is_active: $sb_12.is_active, _commOperation: $sb12._commOperation, _commStatus: $sb12._commStatus, maintenance_mode: $sb_12.maintenance_mode, runStop: $sb12.runStop, temp: $sb12.temp, target_menit: $sb_12.target_menit, adjust_menit: $sb_12.adjust_menit, sisa_detik_masak: $sb_12.sisa_detik_masak, total_detik_pemanasan: $sb_12.total_detik_pemanasan, flag_init_start: $sb_12.flag_init_start, flag_init_masak: $sb_12.flag_init_masak, suhu_awal: $sb_12.suhu_awal, suhu_akhir: $sb_12.suhu_akhir, perubahan_waktu: $sb_12.perubahan_waktu, status_kosong: $sb_12.status_kosong, status_pemanasan: $sb_12.status_pemanasan, status_pemasakan: $sb_12.status_pemasakan, status_selesai: $sb_12.status_selesai, status_banner: $sb_12.status_banner, tampil_jam_mulai: $sb_12.tampil_jam_mulai, tampil_jam_masak: $sb_12.tampil_jam_masak, tampil_jam_selesai: $sb_12.tampil_jam_selesai, tampil_durasi_actual: $sb_12.tampil_durasi_actual, tampil_pemanasan: $sb_12.tampil_pemanasan };
    prosesUnit(u12, 12, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb12._commOperation = u12._commOperation; $sb_12.status_banner = u12.status_banner; $sb_12.status_pemanasan = u12.status_pemanasan; $sb_12.status_pemasakan = u12.status_pemasakan; $sb_12.status_selesai = u12.status_selesai; $sb_12.status_kosong = u12.status_kosong; $sb_12.target_menit = u12.target_menit; $sb_12.adjust_menit = u12.adjust_menit; $sb_12.sisa_detik_masak = u12.sisa_detik_masak; $sb_12.total_detik_pemanasan = u12.total_detik_pemanasan; $sb_12.flag_init_start = u12.flag_init_start; $sb_12.flag_init_masak = u12.flag_init_masak; $sb_12.suhu_awal = u12.suhu_awal; $sb_12.suhu_akhir = u12.suhu_akhir; $sb_12.perubahan_waktu = u12.perubahan_waktu; $sb_12.tampil_jam_mulai = u12.tampil_jam_mulai; $sb_12.tampil_jam_masak = u12.tampil_jam_masak; $sb_12.tampil_jam_selesai = u12.tampil_jam_selesai; $sb_12.tampil_durasi_actual = u12.tampil_durasi_actual; $sb_12.tampil_pemanasan = u12.tampil_pemanasan; $sb12.runStop = u12.runStop;

    // Unit 13
    var u13 = { is_active: $sb_13.is_active, _commOperation: $sb13._commOperation, _commStatus: $sb13._commStatus, maintenance_mode: $sb_13.maintenance_mode, runStop: $sb13.runStop, temp: $sb13.temp, target_menit: $sb_13.target_menit, adjust_menit: $sb_13.adjust_menit, sisa_detik_masak: $sb_13.sisa_detik_masak, total_detik_pemanasan: $sb_13.total_detik_pemanasan, flag_init_start: $sb_13.flag_init_start, flag_init_masak: $sb_13.flag_init_masak, suhu_awal: $sb_13.suhu_awal, suhu_akhir: $sb_13.suhu_akhir, perubahan_waktu: $sb_13.perubahan_waktu, status_kosong: $sb_13.status_kosong, status_pemanasan: $sb_13.status_pemanasan, status_pemasakan: $sb_13.status_pemasakan, status_selesai: $sb_13.status_selesai, status_banner: $sb_13.status_banner, tampil_jam_mulai: $sb_13.tampil_jam_mulai, tampil_jam_masak: $sb_13.tampil_jam_masak, tampil_jam_selesai: $sb_13.tampil_jam_selesai, tampil_durasi_actual: $sb_13.tampil_durasi_actual, tampil_pemanasan: $sb_13.tampil_pemanasan };
    prosesUnit(u13, 13, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb13._commOperation = u13._commOperation; $sb_13.status_banner = u13.status_banner; $sb_13.status_pemanasan = u13.status_pemanasan; $sb_13.status_pemasakan = u13.status_pemasakan; $sb_13.status_selesai = u13.status_selesai; $sb_13.status_kosong = u13.status_kosong; $sb_13.target_menit = u13.target_menit; $sb_13.adjust_menit = u13.adjust_menit; $sb_13.sisa_detik_masak = u13.sisa_detik_masak; $sb_13.total_detik_pemanasan = u13.total_detik_pemanasan; $sb_13.flag_init_start = u13.flag_init_start; $sb_13.flag_init_masak = u13.flag_init_masak; $sb_13.suhu_awal = u13.suhu_awal; $sb_13.suhu_akhir = u13.suhu_akhir; $sb_13.perubahan_waktu = u13.perubahan_waktu; $sb_13.tampil_jam_mulai = u13.tampil_jam_mulai; $sb_13.tampil_jam_masak = u13.tampil_jam_masak; $sb_13.tampil_jam_selesai = u13.tampil_jam_selesai; $sb_13.tampil_durasi_actual = u13.tampil_durasi_actual; $sb_13.tampil_pemanasan = u13.tampil_pemanasan; $sb13.runStop = u13.runStop;

    // Unit 14
    var u14 = { is_active: $sb_14.is_active, _commOperation: $sb14._commOperation, _commStatus: $sb14._commStatus, maintenance_mode: $sb_14.maintenance_mode, runStop: $sb14.runStop, temp: $sb14.temp, target_menit: $sb_14.target_menit, adjust_menit: $sb_14.adjust_menit, sisa_detik_masak: $sb_14.sisa_detik_masak, total_detik_pemanasan: $sb_14.total_detik_pemanasan, flag_init_start: $sb_14.flag_init_start, flag_init_masak: $sb_14.flag_init_masak, suhu_awal: $sb_14.suhu_awal, suhu_akhir: $sb_14.suhu_akhir, perubahan_waktu: $sb_14.perubahan_waktu, status_kosong: $sb_14.status_kosong, status_pemanasan: $sb_14.status_pemanasan, status_pemasakan: $sb_14.status_pemasakan, status_selesai: $sb_14.status_selesai, status_banner: $sb_14.status_banner, tampil_jam_mulai: $sb_14.tampil_jam_mulai, tampil_jam_masak: $sb_14.tampil_jam_masak, tampil_jam_selesai: $sb_14.tampil_jam_selesai, tampil_durasi_actual: $sb_14.tampil_durasi_actual, tampil_pemanasan: $sb_14.tampil_pemanasan };
    prosesUnit(u14, 14, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb14._commOperation = u14._commOperation; $sb_14.status_banner = u14.status_banner; $sb_14.status_pemanasan = u14.status_pemanasan; $sb_14.status_pemasakan = u14.status_pemasakan; $sb_14.status_selesai = u14.status_selesai; $sb_14.status_kosong = u14.status_kosong; $sb_14.target_menit = u14.target_menit; $sb_14.adjust_menit = u14.adjust_menit; $sb_14.sisa_detik_masak = u14.sisa_detik_masak; $sb_14.total_detik_pemanasan = u14.total_detik_pemanasan; $sb_14.flag_init_start = u14.flag_init_start; $sb_14.flag_init_masak = u14.flag_init_masak; $sb_14.suhu_awal = u14.suhu_awal; $sb_14.suhu_akhir = u14.suhu_akhir; $sb_14.perubahan_waktu = u14.perubahan_waktu; $sb_14.tampil_jam_mulai = u14.tampil_jam_mulai; $sb_14.tampil_jam_masak = u14.tampil_jam_masak; $sb_14.tampil_jam_selesai = u14.tampil_jam_selesai; $sb_14.tampil_durasi_actual = u14.tampil_durasi_actual; $sb_14.tampil_pemanasan = u14.tampil_pemanasan; $sb14.runStop = u14.runStop;

    // Unit 15
    var u15 = { is_active: $sb_15.is_active, _commOperation: $sb15._commOperation, _commStatus: $sb15._commStatus, maintenance_mode: $sb_15.maintenance_mode, runStop: $sb15.runStop, temp: $sb15.temp, target_menit: $sb_15.target_menit, adjust_menit: $sb_15.adjust_menit, sisa_detik_masak: $sb_15.sisa_detik_masak, total_detik_pemanasan: $sb_15.total_detik_pemanasan, flag_init_start: $sb_15.flag_init_start, flag_init_masak: $sb_15.flag_init_masak, suhu_awal: $sb_15.suhu_awal, suhu_akhir: $sb_15.suhu_akhir, perubahan_waktu: $sb_15.perubahan_waktu, status_kosong: $sb_15.status_kosong, status_pemanasan: $sb_15.status_pemanasan, status_pemasakan: $sb_15.status_pemasakan, status_selesai: $sb_15.status_selesai, status_banner: $sb_15.status_banner, tampil_jam_mulai: $sb_15.tampil_jam_mulai, tampil_jam_masak: $sb_15.tampil_jam_masak, tampil_jam_selesai: $sb_15.tampil_jam_selesai, tampil_durasi_actual: $sb_15.tampil_durasi_actual, tampil_pemanasan: $sb_15.tampil_pemanasan };
    prosesUnit(u15, 15, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb15._commOperation = u15._commOperation; $sb_15.status_banner = u15.status_banner; $sb_15.status_pemanasan = u15.status_pemanasan; $sb_15.status_pemasakan = u15.status_pemasakan; $sb_15.status_selesai = u15.status_selesai; $sb_15.status_kosong = u15.status_kosong; $sb_15.target_menit = u15.target_menit; $sb_15.adjust_menit = u15.adjust_menit; $sb_15.sisa_detik_masak = u15.sisa_detik_masak; $sb_15.total_detik_pemanasan = u15.total_detik_pemanasan; $sb_15.flag_init_start = u15.flag_init_start; $sb_15.flag_init_masak = u15.flag_init_masak; $sb_15.suhu_awal = u15.suhu_awal; $sb_15.suhu_akhir = u15.suhu_akhir; $sb_15.perubahan_waktu = u15.perubahan_waktu; $sb_15.tampil_jam_mulai = u15.tampil_jam_mulai; $sb_15.tampil_jam_masak = u15.tampil_jam_masak; $sb_15.tampil_jam_selesai = u15.tampil_jam_selesai; $sb_15.tampil_durasi_actual = u15.tampil_durasi_actual; $sb_15.tampil_pemanasan = u15.tampil_pemanasan; $sb15.runStop = u15.runStop;

    // Unit 16
    var u16 = { is_active: $sb_16.is_active, _commOperation: $sb16._commOperation, _commStatus: $sb16._commStatus, maintenance_mode: $sb_16.maintenance_mode, runStop: $sb16.runStop, temp: $sb16.temp, target_menit: $sb_16.target_menit, adjust_menit: $sb_16.adjust_menit, sisa_detik_masak: $sb_16.sisa_detik_masak, total_detik_pemanasan: $sb_16.total_detik_pemanasan, flag_init_start: $sb_16.flag_init_start, flag_init_masak: $sb_16.flag_init_masak, suhu_awal: $sb_16.suhu_awal, suhu_akhir: $sb_16.suhu_akhir, perubahan_waktu: $sb_16.perubahan_waktu, status_kosong: $sb_16.status_kosong, status_pemanasan: $sb_16.status_pemanasan, status_pemasakan: $sb_16.status_pemasakan, status_selesai: $sb_16.status_selesai, status_banner: $sb_16.status_banner, tampil_jam_mulai: $sb_16.tampil_jam_mulai, tampil_jam_masak: $sb_16.tampil_jam_masak, tampil_jam_selesai: $sb_16.tampil_jam_selesai, tampil_durasi_actual: $sb_16.tampil_durasi_actual, tampil_pemanasan: $sb_16.tampil_pemanasan };
    prosesUnit(u16, 16, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb16._commOperation = u16._commOperation; $sb_16.status_banner = u16.status_banner; $sb_16.status_pemanasan = u16.status_pemanasan; $sb_16.status_pemasakan = u16.status_pemasakan; $sb_16.status_selesai = u16.status_selesai; $sb_16.status_kosong = u16.status_kosong; $sb_16.target_menit = u16.target_menit; $sb_16.adjust_menit = u16.adjust_menit; $sb_16.sisa_detik_masak = u16.sisa_detik_masak; $sb_16.total_detik_pemanasan = u16.total_detik_pemanasan; $sb_16.flag_init_start = u16.flag_init_start; $sb_16.flag_init_masak = u16.flag_init_masak; $sb_16.suhu_awal = u16.suhu_awal; $sb_16.suhu_akhir = u16.suhu_akhir; $sb_16.perubahan_waktu = u16.perubahan_waktu; $sb_16.tampil_jam_mulai = u16.tampil_jam_mulai; $sb_16.tampil_jam_masak = u16.tampil_jam_masak; $sb_16.tampil_jam_selesai = u16.tampil_jam_selesai; $sb_16.tampil_durasi_actual = u16.tampil_durasi_actual; $sb_16.tampil_pemanasan = u16.tampil_pemanasan; $sb16.runStop = u16.runStop;

    // Unit 17
    var u17 = { is_active: $sb_17.is_active, _commOperation: $sb17._commOperation, _commStatus: $sb17._commStatus, maintenance_mode: $sb_17.maintenance_mode, runStop: $sb17.runStop, temp: $sb17.temp, target_menit: $sb_17.target_menit, adjust_menit: $sb_17.adjust_menit, sisa_detik_masak: $sb_17.sisa_detik_masak, total_detik_pemanasan: $sb_17.total_detik_pemanasan, flag_init_start: $sb_17.flag_init_start, flag_init_masak: $sb_17.flag_init_masak, suhu_awal: $sb_17.suhu_awal, suhu_akhir: $sb_17.suhu_akhir, perubahan_waktu: $sb_17.perubahan_waktu, status_kosong: $sb_17.status_kosong, status_pemanasan: $sb_17.status_pemanasan, status_pemasakan: $sb_17.status_pemasakan, status_selesai: $sb_17.status_selesai, status_banner: $sb_17.status_banner, tampil_jam_mulai: $sb_17.tampil_jam_mulai, tampil_jam_masak: $sb_17.tampil_jam_masak, tampil_jam_selesai: $sb_17.tampil_jam_selesai, tampil_durasi_actual: $sb_17.tampil_durasi_actual, tampil_pemanasan: $sb_17.tampil_pemanasan };
    prosesUnit(u17, 17, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb17._commOperation = u17._commOperation; $sb_17.status_banner = u17.status_banner; $sb_17.status_pemanasan = u17.status_pemanasan; $sb_17.status_pemasakan = u17.status_pemasakan; $sb_17.status_selesai = u17.status_selesai; $sb_17.status_kosong = u17.status_kosong; $sb_17.target_menit = u17.target_menit; $sb_17.adjust_menit = u17.adjust_menit; $sb_17.sisa_detik_masak = u17.sisa_detik_masak; $sb_17.total_detik_pemanasan = u17.total_detik_pemanasan; $sb_17.flag_init_start = u17.flag_init_start; $sb_17.flag_init_masak = u17.flag_init_masak; $sb_17.suhu_awal = u17.suhu_awal; $sb_17.suhu_akhir = u17.suhu_akhir; $sb_17.perubahan_waktu = u17.perubahan_waktu; $sb_17.tampil_jam_mulai = u17.tampil_jam_mulai; $sb_17.tampil_jam_masak = u17.tampil_jam_masak; $sb_17.tampil_jam_selesai = u17.tampil_jam_selesai; $sb_17.tampil_durasi_actual = u17.tampil_durasi_actual; $sb_17.tampil_pemanasan = u17.tampil_pemanasan; $sb17.runStop = u17.runStop;

    // Unit 18
    var u18 = { is_active: $sb_18.is_active, _commOperation: $sb18._commOperation, _commStatus: $sb18._commStatus, maintenance_mode: $sb_18.maintenance_mode, runStop: $sb18.runStop, temp: $sb18.temp, target_menit: $sb_18.target_menit, adjust_menit: $sb_18.adjust_menit, sisa_detik_masak: $sb_18.sisa_detik_masak, total_detik_pemanasan: $sb_18.total_detik_pemanasan, flag_init_start: $sb_18.flag_init_start, flag_init_masak: $sb_18.flag_init_masak, suhu_awal: $sb_18.suhu_awal, suhu_akhir: $sb_18.suhu_akhir, perubahan_waktu: $sb_18.perubahan_waktu, status_kosong: $sb_18.status_kosong, status_pemanasan: $sb_18.status_pemanasan, status_pemasakan: $sb_18.status_pemasakan, status_selesai: $sb_18.status_selesai, status_banner: $sb_18.status_banner, tampil_jam_mulai: $sb_18.tampil_jam_mulai, tampil_jam_masak: $sb_18.tampil_jam_masak, tampil_jam_selesai: $sb_18.tampil_jam_selesai, tampil_durasi_actual: $sb_18.tampil_durasi_actual, tampil_pemanasan: $sb_18.tampil_pemanasan };
    prosesUnit(u18, 18, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb18._commOperation = u18._commOperation; $sb_18.status_banner = u18.status_banner; $sb_18.status_pemanasan = u18.status_pemanasan; $sb_18.status_pemasakan = u18.status_pemasakan; $sb_18.status_selesai = u18.status_selesai; $sb_18.status_kosong = u18.status_kosong; $sb_18.target_menit = u18.target_menit; $sb_18.adjust_menit = u18.adjust_menit; $sb_18.sisa_detik_masak = u18.sisa_detik_masak; $sb_18.total_detik_pemanasan = u18.total_detik_pemanasan; $sb_18.flag_init_start = u18.flag_init_start; $sb_18.flag_init_masak = u18.flag_init_masak; $sb_18.suhu_awal = u18.suhu_awal; $sb_18.suhu_akhir = u18.suhu_akhir; $sb_18.perubahan_waktu = u18.perubahan_waktu; $sb_18.tampil_jam_mulai = u18.tampil_jam_mulai; $sb_18.tampil_jam_masak = u18.tampil_jam_masak; $sb_18.tampil_jam_selesai = u18.tampil_jam_selesai; $sb_18.tampil_durasi_actual = u18.tampil_durasi_actual; $sb_18.tampil_pemanasan = u18.tampil_pemanasan; $sb18.runStop = u18.runStop;

    // Unit 19
    var u19 = { is_active: $sb_19.is_active, _commOperation: $sb19._commOperation, _commStatus: $sb19._commStatus, maintenance_mode: $sb_19.maintenance_mode, runStop: $sb19.runStop, temp: $sb19.temp, target_menit: $sb_19.target_menit, adjust_menit: $sb_19.adjust_menit, sisa_detik_masak: $sb_19.sisa_detik_masak, total_detik_pemanasan: $sb_19.total_detik_pemanasan, flag_init_start: $sb_19.flag_init_start, flag_init_masak: $sb_19.flag_init_masak, suhu_awal: $sb_19.suhu_awal, suhu_akhir: $sb_19.suhu_akhir, perubahan_waktu: $sb_19.perubahan_waktu, status_kosong: $sb_19.status_kosong, status_pemanasan: $sb_19.status_pemanasan, status_pemasakan: $sb_19.status_pemasakan, status_selesai: $sb_19.status_selesai, status_banner: $sb_19.status_banner, tampil_jam_mulai: $sb_19.tampil_jam_mulai, tampil_jam_masak: $sb_19.tampil_jam_masak, tampil_jam_selesai: $sb_19.tampil_jam_selesai, tampil_durasi_actual: $sb_19.tampil_durasi_actual, tampil_pemanasan: $sb_19.tampil_pemanasan };
    prosesUnit(u19, 19, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb19._commOperation = u19._commOperation; $sb_19.status_banner = u19.status_banner; $sb_19.status_pemanasan = u19.status_pemanasan; $sb_19.status_pemasakan = u19.status_pemasakan; $sb_19.status_selesai = u19.status_selesai; $sb_19.status_kosong = u19.status_kosong; $sb_19.target_menit = u19.target_menit; $sb_19.adjust_menit = u19.adjust_menit; $sb_19.sisa_detik_masak = u19.sisa_detik_masak; $sb_19.total_detik_pemanasan = u19.total_detik_pemanasan; $sb_19.flag_init_start = u19.flag_init_start; $sb_19.flag_init_masak = u19.flag_init_masak; $sb_19.suhu_awal = u19.suhu_awal; $sb_19.suhu_akhir = u19.suhu_akhir; $sb_19.perubahan_waktu = u19.perubahan_waktu; $sb_19.tampil_jam_mulai = u19.tampil_jam_mulai; $sb_19.tampil_jam_masak = u19.tampil_jam_masak; $sb_19.tampil_jam_selesai = u19.tampil_jam_selesai; $sb_19.tampil_durasi_actual = u19.tampil_durasi_actual; $sb_19.tampil_pemanasan = u19.tampil_pemanasan; $sb19.runStop = u19.runStop;

    // Unit 20
    var u20 = { is_active: $sb_20.is_active, _commOperation: $sb20._commOperation, _commStatus: $sb20._commStatus, maintenance_mode: $sb_20.maintenance_mode, runStop: $sb20.runStop, temp: $sb20.temp, target_menit: $sb_20.target_menit, adjust_menit: $sb_20.adjust_menit, sisa_detik_masak: $sb_20.sisa_detik_masak, total_detik_pemanasan: $sb_20.total_detik_pemanasan, flag_init_start: $sb_20.flag_init_start, flag_init_masak: $sb_20.flag_init_masak, suhu_awal: $sb_20.suhu_awal, suhu_akhir: $sb_20.suhu_akhir, perubahan_waktu: $sb_20.perubahan_waktu, status_kosong: $sb_20.status_kosong, status_pemanasan: $sb_20.status_pemanasan, status_pemasakan: $sb_20.status_pemasakan, status_selesai: $sb_20.status_selesai, status_banner: $sb_20.status_banner, tampil_jam_mulai: $sb_20.tampil_jam_mulai, tampil_jam_masak: $sb_20.tampil_jam_masak, tampil_jam_selesai: $sb_20.tampil_jam_selesai, tampil_durasi_actual: $sb_20.tampil_durasi_actual, tampil_pemanasan: $sb_20.tampil_pemanasan };
    prosesUnit(u20, 20, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb20._commOperation = u20._commOperation; $sb_20.status_banner = u20.status_banner; $sb_20.status_pemanasan = u20.status_pemanasan; $sb_20.status_pemasakan = u20.status_pemasakan; $sb_20.status_selesai = u20.status_selesai; $sb_20.status_kosong = u20.status_kosong; $sb_20.target_menit = u20.target_menit; $sb_20.adjust_menit = u20.adjust_menit; $sb_20.sisa_detik_masak = u20.sisa_detik_masak; $sb_20.total_detik_pemanasan = u20.total_detik_pemanasan; $sb_20.flag_init_start = u20.flag_init_start; $sb_20.flag_init_masak = u20.flag_init_masak; $sb_20.suhu_awal = u20.suhu_awal; $sb_20.suhu_akhir = u20.suhu_akhir; $sb_20.perubahan_waktu = u20.perubahan_waktu; $sb_20.tampil_jam_mulai = u20.tampil_jam_mulai; $sb_20.tampil_jam_masak = u20.tampil_jam_masak; $sb_20.tampil_jam_selesai = u20.tampil_jam_selesai; $sb_20.tampil_durasi_actual = u20.tampil_durasi_actual; $sb_20.tampil_pemanasan = u20.tampil_pemanasan; $sb20.runStop = u20.runStop;

    // Unit 21
    var u21 = { is_active: $sb_21.is_active, _commOperation: $sb21._commOperation, _commStatus: $sb21._commStatus, maintenance_mode: $sb_21.maintenance_mode, runStop: $sb21.runStop, temp: $sb21.temp, target_menit: $sb_21.target_menit, adjust_menit: $sb_21.adjust_menit, sisa_detik_masak: $sb_21.sisa_detik_masak, total_detik_pemanasan: $sb_21.total_detik_pemanasan, flag_init_start: $sb_21.flag_init_start, flag_init_masak: $sb_21.flag_init_masak, suhu_awal: $sb_21.suhu_awal, suhu_akhir: $sb_21.suhu_akhir, perubahan_waktu: $sb_21.perubahan_waktu, status_kosong: $sb_21.status_kosong, status_pemanasan: $sb_21.status_pemanasan, status_pemasakan: $sb_21.status_pemasakan, status_selesai: $sb_21.status_selesai, status_banner: $sb_21.status_banner, tampil_jam_mulai: $sb_21.tampil_jam_mulai, tampil_jam_masak: $sb_21.tampil_jam_masak, tampil_jam_selesai: $sb_21.tampil_jam_selesai, tampil_durasi_actual: $sb_21.tampil_durasi_actual, tampil_pemanasan: $sb_21.tampil_pemanasan };
    prosesUnit(u21, 21, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb21._commOperation = u21._commOperation; $sb_21.status_banner = u21.status_banner; $sb_21.status_pemanasan = u21.status_pemanasan; $sb_21.status_pemasakan = u21.status_pemasakan; $sb_21.status_selesai = u21.status_selesai; $sb_21.status_kosong = u21.status_kosong; $sb_21.target_menit = u21.target_menit; $sb_21.adjust_menit = u21.adjust_menit; $sb_21.sisa_detik_masak = u21.sisa_detik_masak; $sb_21.total_detik_pemanasan = u21.total_detik_pemanasan; $sb_21.flag_init_start = u21.flag_init_start; $sb_21.flag_init_masak = u21.flag_init_masak; $sb_21.suhu_awal = u21.suhu_awal; $sb_21.suhu_akhir = u21.suhu_akhir; $sb_21.perubahan_waktu = u21.perubahan_waktu; $sb_21.tampil_jam_mulai = u21.tampil_jam_mulai; $sb_21.tampil_jam_masak = u21.tampil_jam_masak; $sb_21.tampil_jam_selesai = u21.tampil_jam_selesai; $sb_21.tampil_durasi_actual = u21.tampil_durasi_actual; $sb_21.tampil_pemanasan = u21.tampil_pemanasan; $sb21.runStop = u21.runStop;

    // Unit 22
    var u22 = { is_active: $sb_22.is_active, _commOperation: $sb22._commOperation, _commStatus: $sb22._commStatus, maintenance_mode: $sb_22.maintenance_mode, runStop: $sb22.runStop, temp: $sb22.temp, target_menit: $sb_22.target_menit, adjust_menit: $sb_22.adjust_menit, sisa_detik_masak: $sb_22.sisa_detik_masak, total_detik_pemanasan: $sb_22.total_detik_pemanasan, flag_init_start: $sb_22.flag_init_start, flag_init_masak: $sb_22.flag_init_masak, suhu_awal: $sb_22.suhu_awal, suhu_akhir: $sb_22.suhu_akhir, perubahan_waktu: $sb_22.perubahan_waktu, status_kosong: $sb_22.status_kosong, status_pemanasan: $sb_22.status_pemanasan, status_pemasakan: $sb_22.status_pemasakan, status_selesai: $sb_22.status_selesai, status_banner: $sb_22.status_banner, tampil_jam_mulai: $sb_22.tampil_jam_mulai, tampil_jam_masak: $sb_22.tampil_jam_masak, tampil_jam_selesai: $sb_22.tampil_jam_selesai, tampil_durasi_actual: $sb_22.tampil_durasi_actual, tampil_pemanasan: $sb_22.tampil_pemanasan };
    prosesUnit(u22, 22, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb22._commOperation = u22._commOperation; $sb_22.status_banner = u22.status_banner; $sb_22.status_pemanasan = u22.status_pemanasan; $sb_22.status_pemasakan = u22.status_pemasakan; $sb_22.status_selesai = u22.status_selesai; $sb_22.status_kosong = u22.status_kosong; $sb_22.target_menit = u22.target_menit; $sb_22.adjust_menit = u22.adjust_menit; $sb_22.sisa_detik_masak = u22.sisa_detik_masak; $sb_22.total_detik_pemanasan = u22.total_detik_pemanasan; $sb_22.flag_init_start = u22.flag_init_start; $sb_22.flag_init_masak = u22.flag_init_masak; $sb_22.suhu_awal = u22.suhu_awal; $sb_22.suhu_akhir = u22.suhu_akhir; $sb_22.perubahan_waktu = u22.perubahan_waktu; $sb_22.tampil_jam_mulai = u22.tampil_jam_mulai; $sb_22.tampil_jam_masak = u22.tampil_jam_masak; $sb_22.tampil_jam_selesai = u22.tampil_jam_selesai; $sb_22.tampil_durasi_actual = u22.tampil_durasi_actual; $sb_22.tampil_pemanasan = u22.tampil_pemanasan; $sb22.runStop = u22.runStop;

    // Unit 23
    var u23 = { is_active: $sb_23.is_active, _commOperation: $sb23._commOperation, _commStatus: $sb23._commStatus, maintenance_mode: $sb_23.maintenance_mode, runStop: $sb23.runStop, temp: $sb23.temp, target_menit: $sb_23.target_menit, adjust_menit: $sb_23.adjust_menit, sisa_detik_masak: $sb_23.sisa_detik_masak, total_detik_pemanasan: $sb_23.total_detik_pemanasan, flag_init_start: $sb_23.flag_init_start, flag_init_masak: $sb_23.flag_init_masak, suhu_awal: $sb_23.suhu_awal, suhu_akhir: $sb_23.suhu_akhir, perubahan_waktu: $sb_23.perubahan_waktu, status_kosong: $sb_23.status_kosong, status_pemanasan: $sb_23.status_pemanasan, status_pemasakan: $sb_23.status_pemasakan, status_selesai: $sb_23.status_selesai, status_banner: $sb_23.status_banner, tampil_jam_mulai: $sb_23.tampil_jam_mulai, tampil_jam_masak: $sb_23.tampil_jam_masak, tampil_jam_selesai: $sb_23.tampil_jam_selesai, tampil_durasi_actual: $sb_23.tampil_durasi_actual, tampil_pemanasan: $sb_23.tampil_pemanasan };
    prosesUnit(u23, 23, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb23._commOperation = u23._commOperation; $sb_23.status_banner = u23.status_banner; $sb_23.status_pemanasan = u23.status_pemanasan; $sb_23.status_pemasakan = u23.status_pemasakan; $sb_23.status_selesai = u23.status_selesai; $sb_23.status_kosong = u23.status_kosong; $sb_23.target_menit = u23.target_menit; $sb_23.adjust_menit = u23.adjust_menit; $sb_23.sisa_detik_masak = u23.sisa_detik_masak; $sb_23.total_detik_pemanasan = u23.total_detik_pemanasan; $sb_23.flag_init_start = u23.flag_init_start; $sb_23.flag_init_masak = u23.flag_init_masak; $sb_23.suhu_awal = u23.suhu_awal; $sb_23.suhu_akhir = u23.suhu_akhir; $sb_23.perubahan_waktu = u23.perubahan_waktu; $sb_23.tampil_jam_mulai = u23.tampil_jam_mulai; $sb_23.tampil_jam_masak = u23.tampil_jam_masak; $sb_23.tampil_jam_selesai = u23.tampil_jam_selesai; $sb_23.tampil_durasi_actual = u23.tampil_durasi_actual; $sb_23.tampil_pemanasan = u23.tampil_pemanasan; $sb23.runStop = u23.runStop;

    // Unit 24
    var u24 = { is_active: $sb_24.is_active, _commOperation: $sb24._commOperation, _commStatus: $sb24._commStatus, maintenance_mode: $sb_24.maintenance_mode, runStop: $sb24.runStop, temp: $sb24.temp, target_menit: $sb_24.target_menit, adjust_menit: $sb_24.adjust_menit, sisa_detik_masak: $sb_24.sisa_detik_masak, total_detik_pemanasan: $sb_24.total_detik_pemanasan, flag_init_start: $sb_24.flag_init_start, flag_init_masak: $sb_24.flag_init_masak, suhu_awal: $sb_24.suhu_awal, suhu_akhir: $sb_24.suhu_akhir, perubahan_waktu: $sb_24.perubahan_waktu, status_kosong: $sb_24.status_kosong, status_pemanasan: $sb_24.status_pemanasan, status_pemasakan: $sb_24.status_pemasakan, status_selesai: $sb_24.status_selesai, status_banner: $sb_24.status_banner, tampil_jam_mulai: $sb_24.tampil_jam_mulai, tampil_jam_masak: $sb_24.tampil_jam_masak, tampil_jam_selesai: $sb_24.tampil_jam_selesai, tampil_durasi_actual: $sb_24.tampil_durasi_actual, tampil_pemanasan: $sb_24.tampil_pemanasan };
    prosesUnit(u24, 24, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb24._commOperation = u24._commOperation; $sb_24.status_banner = u24.status_banner; $sb_24.status_pemanasan = u24.status_pemanasan; $sb_24.status_pemasakan = u24.status_pemasakan; $sb_24.status_selesai = u24.status_selesai; $sb_24.status_kosong = u24.status_kosong; $sb_24.target_menit = u24.target_menit; $sb_24.adjust_menit = u24.adjust_menit; $sb_24.sisa_detik_masak = u24.sisa_detik_masak; $sb_24.total_detik_pemanasan = u24.total_detik_pemanasan; $sb_24.flag_init_start = u24.flag_init_start; $sb_24.flag_init_masak = u24.flag_init_masak; $sb_24.suhu_awal = u24.suhu_awal; $sb_24.suhu_akhir = u24.suhu_akhir; $sb_24.perubahan_waktu = u24.perubahan_waktu; $sb_24.tampil_jam_mulai = u24.tampil_jam_mulai; $sb_24.tampil_jam_masak = u24.tampil_jam_masak; $sb_24.tampil_jam_selesai = u24.tampil_jam_selesai; $sb_24.tampil_durasi_actual = u24.tampil_durasi_actual; $sb_24.tampil_pemanasan = u24.tampil_pemanasan; $sb24.runStop = u24.runStop;

    // Unit 25
    var u25 = { is_active: $sb_25.is_active, _commOperation: $sb25._commOperation, _commStatus: $sb25._commStatus, maintenance_mode: $sb_25.maintenance_mode, runStop: $sb25.runStop, temp: $sb25.temp, target_menit: $sb_25.target_menit, adjust_menit: $sb_25.adjust_menit, sisa_detik_masak: $sb_25.sisa_detik_masak, total_detik_pemanasan: $sb_25.total_detik_pemanasan, flag_init_start: $sb_25.flag_init_start, flag_init_masak: $sb_25.flag_init_masak, suhu_awal: $sb_25.suhu_awal, suhu_akhir: $sb_25.suhu_akhir, perubahan_waktu: $sb_25.perubahan_waktu, status_kosong: $sb_25.status_kosong, status_pemanasan: $sb_25.status_pemanasan, status_pemasakan: $sb_25.status_pemasakan, status_selesai: $sb_25.status_selesai, status_banner: $sb_25.status_banner, tampil_jam_mulai: $sb_25.tampil_jam_mulai, tampil_jam_masak: $sb_25.tampil_jam_masak, tampil_jam_selesai: $sb_25.tampil_jam_selesai, tampil_durasi_actual: $sb_25.tampil_durasi_actual, tampil_pemanasan: $sb_25.tampil_pemanasan };
    prosesUnit(u25, 25, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb25._commOperation = u25._commOperation; $sb_25.status_banner = u25.status_banner; $sb_25.status_pemanasan = u25.status_pemanasan; $sb_25.status_pemasakan = u25.status_pemasakan; $sb_25.status_selesai = u25.status_selesai; $sb_25.status_kosong = u25.status_kosong; $sb_25.target_menit = u25.target_menit; $sb_25.adjust_menit = u25.adjust_menit; $sb_25.sisa_detik_masak = u25.sisa_detik_masak; $sb_25.total_detik_pemanasan = u25.total_detik_pemanasan; $sb_25.flag_init_start = u25.flag_init_start; $sb_25.flag_init_masak = u25.flag_init_masak; $sb_25.suhu_awal = u25.suhu_awal; $sb_25.suhu_akhir = u25.suhu_akhir; $sb_25.perubahan_waktu = u25.perubahan_waktu; $sb_25.tampil_jam_mulai = u25.tampil_jam_mulai; $sb_25.tampil_jam_masak = u25.tampil_jam_masak; $sb_25.tampil_jam_selesai = u25.tampil_jam_selesai; $sb_25.tampil_durasi_actual = u25.tampil_durasi_actual; $sb_25.tampil_pemanasan = u25.tampil_pemanasan; $sb25.runStop = u25.runStop;

    // Unit 26
    var u26 = { is_active: $sb_26.is_active, _commOperation: $sb26._commOperation, _commStatus: $sb26._commStatus, maintenance_mode: $sb_26.maintenance_mode, runStop: $sb26.runStop, temp: $sb26.temp, target_menit: $sb_26.target_menit, adjust_menit: $sb_26.adjust_menit, sisa_detik_masak: $sb_26.sisa_detik_masak, total_detik_pemanasan: $sb_26.total_detik_pemanasan, flag_init_start: $sb_26.flag_init_start, flag_init_masak: $sb_26.flag_init_masak, suhu_awal: $sb_26.suhu_awal, suhu_akhir: $sb_26.suhu_akhir, perubahan_waktu: $sb_26.perubahan_waktu, status_kosong: $sb_26.status_kosong, status_pemanasan: $sb_26.status_pemanasan, status_pemasakan: $sb_26.status_pemasakan, status_selesai: $sb_26.status_selesai, status_banner: $sb_26.status_banner, tampil_jam_mulai: $sb_26.tampil_jam_mulai, tampil_jam_masak: $sb_26.tampil_jam_masak, tampil_jam_selesai: $sb_26.tampil_jam_selesai, tampil_durasi_actual: $sb_26.tampil_durasi_actual, tampil_pemanasan: $sb_26.tampil_pemanasan };
    prosesUnit(u26, 26, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb26._commOperation = u26._commOperation; $sb_26.status_banner = u26.status_banner; $sb_26.status_pemanasan = u26.status_pemanasan; $sb_26.status_pemasakan = u26.status_pemasakan; $sb_26.status_selesai = u26.status_selesai; $sb_26.status_kosong = u26.status_kosong; $sb_26.target_menit = u26.target_menit; $sb_26.adjust_menit = u26.adjust_menit; $sb_26.sisa_detik_masak = u26.sisa_detik_masak; $sb_26.total_detik_pemanasan = u26.total_detik_pemanasan; $sb_26.flag_init_start = u26.flag_init_start; $sb_26.flag_init_masak = u26.flag_init_masak; $sb_26.suhu_awal = u26.suhu_awal; $sb_26.suhu_akhir = u26.suhu_akhir; $sb_26.perubahan_waktu = u26.perubahan_waktu; $sb_26.tampil_jam_mulai = u26.tampil_jam_mulai; $sb_26.tampil_jam_masak = u26.tampil_jam_masak; $sb_26.tampil_jam_selesai = u26.tampil_jam_selesai; $sb_26.tampil_durasi_actual = u26.tampil_durasi_actual; $sb_26.tampil_pemanasan = u26.tampil_pemanasan; $sb26.runStop = u26.runStop;

    // Unit 27
    var u27 = { is_active: $sb_27.is_active, _commOperation: $sb27._commOperation, _commStatus: $sb27._commStatus, maintenance_mode: $sb_27.maintenance_mode, runStop: $sb27.runStop, temp: $sb27.temp, target_menit: $sb_27.target_menit, adjust_menit: $sb_27.adjust_menit, sisa_detik_masak: $sb_27.sisa_detik_masak, total_detik_pemanasan: $sb_27.total_detik_pemanasan, flag_init_start: $sb_27.flag_init_start, flag_init_masak: $sb_27.flag_init_masak, suhu_awal: $sb_27.suhu_awal, suhu_akhir: $sb_27.suhu_akhir, perubahan_waktu: $sb_27.perubahan_waktu, status_kosong: $sb_27.status_kosong, status_pemanasan: $sb_27.status_pemanasan, status_pemasakan: $sb_27.status_pemasakan, status_selesai: $sb_27.status_selesai, status_banner: $sb_27.status_banner, tampil_jam_mulai: $sb_27.tampil_jam_mulai, tampil_jam_masak: $sb_27.tampil_jam_masak, tampil_jam_selesai: $sb_27.tampil_jam_selesai, tampil_durasi_actual: $sb_27.tampil_durasi_actual, tampil_pemanasan: $sb_27.tampil_pemanasan };
    prosesUnit(u27, 27, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb27._commOperation = u27._commOperation; $sb_27.status_banner = u27.status_banner; $sb_27.status_pemanasan = u27.status_pemanasan; $sb_27.status_pemasakan = u27.status_pemasakan; $sb_27.status_selesai = u27.status_selesai; $sb_27.status_kosong = u27.status_kosong; $sb_27.target_menit = u27.target_menit; $sb_27.adjust_menit = u27.adjust_menit; $sb_27.sisa_detik_masak = u27.sisa_detik_masak; $sb_27.total_detik_pemanasan = u27.total_detik_pemanasan; $sb_27.flag_init_start = u27.flag_init_start; $sb_27.flag_init_masak = u27.flag_init_masak; $sb_27.suhu_awal = u27.suhu_awal; $sb_27.suhu_akhir = u27.suhu_akhir; $sb_27.perubahan_waktu = u27.perubahan_waktu; $sb_27.tampil_jam_mulai = u27.tampil_jam_mulai; $sb_27.tampil_jam_masak = u27.tampil_jam_masak; $sb_27.tampil_jam_selesai = u27.tampil_jam_selesai; $sb_27.tampil_durasi_actual = u27.tampil_durasi_actual; $sb_27.tampil_pemanasan = u27.tampil_pemanasan; $sb27.runStop = u27.runStop;

    // Unit 28
    var u28 = { is_active: $sb_28.is_active, _commOperation: $sb28._commOperation, _commStatus: $sb28._commStatus, maintenance_mode: $sb_28.maintenance_mode, runStop: $sb28.runStop, temp: $sb28.temp, target_menit: $sb_28.target_menit, adjust_menit: $sb_28.adjust_menit, sisa_detik_masak: $sb_28.sisa_detik_masak, total_detik_pemanasan: $sb_28.total_detik_pemanasan, flag_init_start: $sb_28.flag_init_start, flag_init_masak: $sb_28.flag_init_masak, suhu_awal: $sb_28.suhu_awal, suhu_akhir: $sb_28.suhu_akhir, perubahan_waktu: $sb_28.perubahan_waktu, status_kosong: $sb_28.status_kosong, status_pemanasan: $sb_28.status_pemanasan, status_pemasakan: $sb_28.status_pemasakan, status_selesai: $sb_28.status_selesai, status_banner: $sb_28.status_banner, tampil_jam_mulai: $sb_28.tampil_jam_mulai, tampil_jam_masak: $sb_28.tampil_jam_masak, tampil_jam_selesai: $sb_28.tampil_jam_selesai, tampil_durasi_actual: $sb_28.tampil_durasi_actual, tampil_pemanasan: $sb_28.tampil_pemanasan };
    prosesUnit(u28, 28, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb28._commOperation = u28._commOperation; $sb_28.status_banner = u28.status_banner; $sb_28.status_pemanasan = u28.status_pemanasan; $sb_28.status_pemasakan = u28.status_pemasakan; $sb_28.status_selesai = u28.status_selesai; $sb_28.status_kosong = u28.status_kosong; $sb_28.target_menit = u28.target_menit; $sb_28.adjust_menit = u28.adjust_menit; $sb_28.sisa_detik_masak = u28.sisa_detik_masak; $sb_28.total_detik_pemanasan = u28.total_detik_pemanasan; $sb_28.flag_init_start = u28.flag_init_start; $sb_28.flag_init_masak = u28.flag_init_masak; $sb_28.suhu_awal = u28.suhu_awal; $sb_28.suhu_akhir = u28.suhu_akhir; $sb_28.perubahan_waktu = u28.perubahan_waktu; $sb_28.tampil_jam_mulai = u28.tampil_jam_mulai; $sb_28.tampil_jam_masak = u28.tampil_jam_masak; $sb_28.tampil_jam_selesai = u28.tampil_jam_selesai; $sb_28.tampil_durasi_actual = u28.tampil_durasi_actual; $sb_28.tampil_pemanasan = u28.tampil_pemanasan; $sb28.runStop = u28.runStop;

    // Unit 29
    var u29 = { is_active: $sb_29.is_active, _commOperation: $sb29._commOperation, _commStatus: $sb29._commStatus, maintenance_mode: $sb_29.maintenance_mode, runStop: $sb29.runStop, temp: $sb29.temp, target_menit: $sb_29.target_menit, adjust_menit: $sb_29.adjust_menit, sisa_detik_masak: $sb_29.sisa_detik_masak, total_detik_pemanasan: $sb_29.total_detik_pemanasan, flag_init_start: $sb_29.flag_init_start, flag_init_masak: $sb_29.flag_init_masak, suhu_awal: $sb_29.suhu_awal, suhu_akhir: $sb_29.suhu_akhir, perubahan_waktu: $sb_29.perubahan_waktu, status_kosong: $sb_29.status_kosong, status_pemanasan: $sb_29.status_pemanasan, status_pemasakan: $sb_29.status_pemasakan, status_selesai: $sb_29.status_selesai, status_banner: $sb_29.status_banner, tampil_jam_mulai: $sb_29.tampil_jam_mulai, tampil_jam_masak: $sb_29.tampil_jam_masak, tampil_jam_selesai: $sb_29.tampil_jam_selesai, tampil_durasi_actual: $sb_29.tampil_durasi_actual, tampil_pemanasan: $sb_29.tampil_pemanasan };
    prosesUnit(u29, 29, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb29._commOperation = u29._commOperation; $sb_29.status_banner = u29.status_banner; $sb_29.status_pemanasan = u29.status_pemanasan; $sb_29.status_pemasakan = u29.status_pemasakan; $sb_29.status_selesai = u29.status_selesai; $sb_29.status_kosong = u29.status_kosong; $sb_29.target_menit = u29.target_menit; $sb_29.adjust_menit = u29.adjust_menit; $sb_29.sisa_detik_masak = u29.sisa_detik_masak; $sb_29.total_detik_pemanasan = u29.total_detik_pemanasan; $sb_29.flag_init_start = u29.flag_init_start; $sb_29.flag_init_masak = u29.flag_init_masak; $sb_29.suhu_awal = u29.suhu_awal; $sb_29.suhu_akhir = u29.suhu_akhir; $sb_29.perubahan_waktu = u29.perubahan_waktu; $sb_29.tampil_jam_mulai = u29.tampil_jam_mulai; $sb_29.tampil_jam_masak = u29.tampil_jam_masak; $sb_29.tampil_jam_selesai = u29.tampil_jam_selesai; $sb_29.tampil_durasi_actual = u29.tampil_durasi_actual; $sb_29.tampil_pemanasan = u29.tampil_pemanasan; $sb29.runStop = u29.runStop;

    // Unit 30
    var u30 = { is_active: $sb_30.is_active, _commOperation: $sb30._commOperation, _commStatus: $sb30._commStatus, maintenance_mode: $sb_30.maintenance_mode, runStop: $sb30.runStop, temp: $sb30.temp, target_menit: $sb_30.target_menit, adjust_menit: $sb_30.adjust_menit, sisa_detik_masak: $sb_30.sisa_detik_masak, total_detik_pemanasan: $sb_30.total_detik_pemanasan, flag_init_start: $sb_30.flag_init_start, flag_init_masak: $sb_30.flag_init_masak, suhu_awal: $sb_30.suhu_awal, suhu_akhir: $sb_30.suhu_akhir, perubahan_waktu: $sb_30.perubahan_waktu, status_kosong: $sb_30.status_kosong, status_pemanasan: $sb_30.status_pemanasan, status_pemasakan: $sb_30.status_pemasakan, status_selesai: $sb_30.status_selesai, status_banner: $sb_30.status_banner, tampil_jam_mulai: $sb_30.tampil_jam_mulai, tampil_jam_masak: $sb_30.tampil_jam_masak, tampil_jam_selesai: $sb_30.tampil_jam_selesai, tampil_durasi_actual: $sb_30.tampil_durasi_actual, tampil_pemanasan: $sb_30.tampil_pemanasan };
    prosesUnit(u30, 30, txtKosong, txtPreheat, txtPemanasan, txtPemasakan, txtSelesai, txtMaintenance, txtOffline, txtDisabled, txtSensorError, tempErrorLimit, waktuSekarangString, totalDetikSekarang);
    $sb30._commOperation = u30._commOperation; $sb_30.status_banner = u30.status_banner; $sb_30.status_pemanasan = u30.status_pemanasan; $sb_30.status_pemasakan = u30.status_pemasakan; $sb_30.status_selesai = u30.status_selesai; $sb_30.status_kosong = u30.status_kosong; $sb_30.target_menit = u30.target_menit; $sb_30.adjust_menit = u30.adjust_menit; $sb_30.sisa_detik_masak = u30.sisa_detik_masak; $sb_30.total_detik_pemanasan = u30.total_detik_pemanasan; $sb_30.flag_init_start = u30.flag_init_start; $sb_30.flag_init_masak = u30.flag_init_masak; $sb_30.suhu_awal = u30.suhu_awal; $sb_30.suhu_akhir = u30.suhu_akhir; $sb_30.perubahan_waktu = u30.perubahan_waktu; $sb_30.tampil_jam_mulai = u30.tampil_jam_mulai; $sb_30.tampil_jam_masak = u30.tampil_jam_masak; $sb_30.tampil_jam_selesai = u30.tampil_jam_selesai; $sb_30.tampil_durasi_actual = u30.tampil_durasi_actual; $sb_30.tampil_pemanasan = u30.tampil_pemanasan; $sb30.runStop = u30.runStop;


    // Sorting Logic
    runningRooms.sort(function(a, b) {
        return a.sisa - b.sisa;
    });

    // Write to 5 slots
    for (var r = 1; r <= 5; r++) {
        if (r - 1 < runningRooms.length) {
            var room = runningRooms[r - 1];
            $Sys_Control["monitor_room_" + r] = room.name;
            $Sys_Control["monitor_sisa_" + r] = room.tampilSisa;
            $Sys_Control["monitor_selesai_" + r] = room.tampilSelesai;
        } else {
            $Sys_Control["monitor_room_" + r] = "--";
            $Sys_Control["monitor_sisa_" + r] = "--:--:--";
            $Sys_Control["monitor_selesai_" + r] = "--:--:--";
        }
    }
}

// RUN SIMULATION TESTS
console.log("=== SIMULASI UJI COBA DETEKSI OFFLINE & RECOVERY (V2) ===");

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

// 5. Test inactive unit 29
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
