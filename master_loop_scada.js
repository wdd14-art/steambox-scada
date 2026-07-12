// ============================================================================
// SYSTEM KONTROL MASTER STEAMBOX & MONITOR OUTDOOR (30 UNIT)
// Trigger: Timer 1 Detik (1000ms)
// ============================================================================

// 1. Ekstrak Waktu Sistem (Format HH:MM:SS)
var waktuSekarangString = ("0" + ($Hour || 0)).slice(-2) + ":" + ("0" + ($Minute || 0)).slice(-2) + ":" + ("0" + ($Second || 0)).slice(-2);
var totalDetikSekarang = (($Hour || 0) * 3600) + (($Minute || 0) * 60) + ($Second || 0);

// 2. Ambil Kustomisasi Teks Status dari HMI (dengan nama variabel yang sesuai database HMI)
var txtKosong = $Sys_Control.txt_status_kosong || "TANGKI KOSONG - SIAP MEMULAI";
var txtPreheat = $Sys_Control.txt_status_preheat || "SEDANG PRE-HEAT (PEMANASAN)";
var txtPemanasan = $Sys_Control.txt_status_pemanasan || "MENUNGGU MENDIDIH (< 100 C)";
var txtPemasakan = $Sys_Control.txt_status_pemasakan || "SEDANG MEMASAK (MENDIDIH)";
var txtSelesai = $Sys_Control.txt_status_selesai || "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI";
var txtMaintenance = $Sys_Control.txt_status_maintenance || "MODE MAINTENANCE (KONTROL MANUAL)";
var txtOffline = $Sys_Control.txt_status_offline || "KONEKSI OFFLINE (MCB TRIP/ALAT MATI)";
var txtDisabled = $Sys_Control.txt_status_disable || "KOMUNIKASI UNIT DINONAKTIFKAN";
var txtSensorError = $Sys_Control.txt_status_sensor_error || "ERROR SENSOR (OPENLOOP/HHHH)";
var tempErrorLimit = 30000; // Menggunakan konstanta lokal untuk mencegah error tag limit

// Array penampung unit yang sedang memasak untuk sistem monitor luar ruangan
var runningRooms = [];

// Helper functions
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

// 3. Loop Dinamis untuk 30 unit Steambox
for (var i = 1; i <= 30; i++) {
    var dev = "sb" + i;
    var grp = "sb_" + i;

    // Baca status keaktifan unit dari HMI
    var is_active = Variable.GetValue(grp + ".is_active") === true;

    // Bypass polling jika unit dinonaktifkan
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

    // Pastikan polling aktif jika unit diaktifkan
    if (Variable.GetValue(dev + "._commOperation") !== true) {
        Variable.SetValue(dev + "._commOperation", true);
    }

    // Jika komunikasi online, jalankan logika utama
    if (Variable.GetValue(dev + "._commStatus") === true) {
        var raw_pv = Variable.GetValue(dev + ".temp") || 0;
        var isSensorError = (raw_pv >= tempErrorLimit);
        
        // Baca status mode pemeliharaan
        var maintenance_mode = Variable.GetValue(grp + ".maintenance_mode");

        if (maintenance_mode !== 1) {
            var runStop = Variable.GetValue(dev + ".runStop");

            if (runStop === true) { // MESIN STOPPED / PAUSED / STANDBY
                if (Variable.GetValue(grp + ".status_pemanasan") !== false) {
                    Variable.SetValue(grp + ".status_pemanasan", false);
                }
                if (Variable.GetValue(grp + ".status_pemasakan") !== false) {
                    Variable.SetValue(grp + ".status_pemasakan", false);
                }
                if (Variable.GetValue(grp + ".flag_init_start") !== 0) {
                    Variable.SetValue(grp + ".flag_init_start", 0);
                }

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
                    
                    // Reset data detail resep/produk untuk unit ini
                    Variable.SetValue("recipe_kode." + i, "");
                    Variable.SetValue("recipe_nama." + i, "--");
                    Variable.SetValue("recipe_versi." + i, 0);
                    Variable.SetValue("recipe_warna." + i, "");
                    Variable.SetValue("recipe_qty." + i, 0);
                    Variable.SetValue("recipe_batch." + i, 0);
                    Variable.SetValue("recipe_trolly." + i, "");

                    Variable.SetValue(grp + ".status_banner", txtKosong);
                    Variable.SetValue(grp + ".status_kosong", false); // autoclear
                } else if (Variable.GetValue(grp + ".status_selesai") === true) {
                    if (Variable.GetValue(grp + ".status_banner") !== txtSelesai) {
                        Variable.SetValue(grp + ".status_banner", txtSelesai);
                    }
                } else {
                    if (Variable.GetValue(grp + ".status_banner") !== "MESIN BERHENTI (PAUSED)") {
                        Variable.SetValue(grp + ".status_banner", "MESIN BERHENTI (PAUSED)");
                    }
                }
            } else { // MESIN RUNNING (runStop === false)
                if (Variable.GetValue(grp + ".status_kosong") !== false) {
                    Variable.SetValue(grp + ".status_kosong", false);
                }
                if (Variable.GetValue(grp + ".status_selesai") !== false) {
                    Variable.SetValue(grp + ".status_selesai", false);
                }

                var target_menit = Variable.GetValue(grp + ".target_menit") || 0;

                if (target_menit === 0) { // MODE PRE-HEAT
                    if (Variable.GetValue(grp + ".status_pemanasan") !== true) {
                        Variable.SetValue(grp + ".status_pemanasan", true);
                    }
                    if (Variable.GetValue(grp + ".status_pemasakan") !== false) {
                        Variable.SetValue(grp + ".status_pemasakan", false);
                    }
                    if (Variable.GetValue(grp + ".status_banner") !== txtPreheat) {
                        Variable.SetValue(grp + ".status_banner", txtPreheat);
                    }

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
                        Variable.SetValue(dev + ".runStop", true); // Kirim perintah STOP
                        Variable.SetValue(grp + ".status_selesai", true);
                        Variable.SetValue(grp + ".status_pemanasan", false);
                        Variable.SetValue(grp + ".flag_init_start", 0);
                        Variable.SetValue(grp + ".suhu_akhir", raw_pv);
                    }
                } else { // MODE COOKING
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
                        if (sisa_detik_masak < 0) {
                            sisa_detik_masak = 0;
                        }
                        Variable.SetValue(grp + ".sisa_detik_masak", sisa_detik_masak);
                        
                        var perubahan_waktu = (Variable.GetValue(grp + ".perubahan_waktu") || 0) + adjust_menit;
                        Variable.SetValue(grp + ".perubahan_waktu", perubahan_waktu);
                        Variable.SetValue(grp + ".adjust_menit", 0);
                    }

                    if (raw_pv < 1000) { // Fase Pemanasan Masak
                        if (Variable.GetValue(grp + ".status_pemanasan") !== true) {
                            Variable.SetValue(grp + ".status_pemanasan", true);
                        }
                        if (Variable.GetValue(grp + ".status_pemasakan") !== false) {
                            Variable.SetValue(grp + ".status_pemasakan", false);
                        }
                        if (Variable.GetValue(grp + ".status_banner") !== txtPemanasan) {
                            Variable.SetValue(grp + ".status_banner", txtPemanasan);
                        }

                        var total_detik_pemanasan = (Variable.GetValue(grp + ".total_detik_pemanasan") || 0) + 1;
                        Variable.SetValue(grp + ".total_detik_pemanasan", total_detik_pemanasan);
                        Variable.SetValue(grp + ".tampil_pemanasan", formatTime(total_detik_pemanasan));
                        
                        var tampil_durasi_actual = formatTime(sisa_detik_masak);
                        Variable.SetValue(grp + ".tampil_durasi_actual", tampil_durasi_actual);
                        
                        var tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, sisa_detik_masak);
                        Variable.SetValue(grp + ".tampil_jam_selesai", tampil_jam_selesai);
                    } else { // Fase Memasak (Mendidih)
                        if (Variable.GetValue(grp + ".status_pemanasan") !== false) {
                            Variable.SetValue(grp + ".status_pemanasan", false);
                        }
                        if (Variable.GetValue(grp + ".status_pemasakan") !== true) {
                            Variable.SetValue(grp + ".status_pemasakan", true);
                        }
                        if (Variable.GetValue(grp + ".status_banner") !== txtPemasakan) {
                            Variable.SetValue(grp + ".status_banner", txtPemasakan);
                        }

                        var flag_init_masak = Variable.GetValue(grp + ".flag_init_masak") || 0;
                        if (flag_init_masak === 0) {
                            Variable.SetValue(grp + ".tampil_jam_masak", waktuSekarangString);
                            Variable.SetValue(grp + ".flag_init_masak", 1);
                        }

                        if (sisa_detik_masak > 0) {
                            sisa_detik_masak = sisa_detik_masak - 1;
                        }
                        Variable.SetValue(grp + ".sisa_detik_masak", sisa_detik_masak);

                        if (sisa_detik_masak <= 0) {
                            sisa_detik_masak = 0;
                            Variable.SetValue(dev + ".runStop", true); // Kirim perintah STOP
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
            if (Variable.GetValue(grp + ".status_banner") !== txtMaintenance) {
                Variable.SetValue(grp + ".status_banner", txtMaintenance);
            }
        }

        if (isSensorError) {
            if (Variable.GetValue(grp + ".status_banner") !== txtSensorError) {
                Variable.SetValue(grp + ".status_banner", txtSensorError);
            }
        }
    } else {
        if (Variable.GetValue(grp + ".status_banner") !== txtOffline) {
            Variable.SetValue(grp + ".status_banner", txtOffline);
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
    }
}

// 4. Sorting Monitor Luar (Top 5)
runningRooms.sort(function(a, b) {
    return a.sisa - b.sisa;
});

for (var r = 1; r <= 5; r++) {
    var tagRoom = "Sys_Control.monitor_room_" + r;
    var tagSisa = "Sys_Control.monitor_sisa_" + r;
    var tagSelesai = "Sys_Control.monitor_selesai_" + r;

    if (r - 1 < runningRooms.length) {
        var room = runningRooms[r - 1];
        if (Variable.GetValue(tagRoom) !== room.name) {
            Variable.SetValue(tagRoom, room.name);
        }
        if (Variable.GetValue(tagSisa) !== room.tampilSisa) {
            Variable.SetValue(tagSisa, room.tampilSisa);
        }
        if (Variable.GetValue(tagSelesai) !== room.tampilSelesai) {
            Variable.SetValue(tagSelesai, room.tampilSelesai);
        }
    } else {
        if (Variable.GetValue(tagRoom) !== "--") {
            Variable.SetValue(tagRoom, "--");
        }
        if (Variable.GetValue(tagSisa) !== "--:--:--") {
            Variable.SetValue(tagSisa, "--:--:--");
        }
        if (Variable.GetValue(tagSelesai) !== "--:--:--") {
            Variable.SetValue(tagSelesai, "--:--:--");
        }
    }
}
