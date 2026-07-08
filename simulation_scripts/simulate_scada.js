// Simulation of Haiwell SCADA JavaScript Engine for Unit 16
// This script mocks the SCADA environment and runs the user's code cycle-by-cycle.

// 1. Mock SCADA Global Tags
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

var $Sys_Control = {
    Maintenance_Mode_16: 0
};

var $SB16 = {
    _commStatus: true,
    Run: false, // false means RUNNING/ACTIVE in user's logic
    temp: 950   // 95.0 °C
};

var $SB_16 = {
    target_menit: 2,           // 2 minutes target
    adjust_menit: 0,
    sisa_detik_masak: 0,
    total_detik_pemanasan: 0,
    flag_init_start: 0,
    flag_init_masak: 0,
    status_kosong: false,
    status_pemanasan: false,
    status_pemasakan: false,
    status_selesai: false,
    tampil_jam_mulai: "00:00:00",
    tampil_jam_masak: "00:00:00",
    tampil_estimasi_selesai: "00:00:00",
    tampil_durasi_actual: "00:00:00",
    tampil_pemanasan: "00:00:00"
};

// Helper function to tick clock by 1 second
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

// Function containing the exact SCADA script to be tested
function runScadaScript() {
    // ============================================================
    // EKSTRAK DATA JAM SISTEM (GLOBAL UNTUK KEDUA UNIT)
    // ============================================================
    var waktuSekarangString = ("0" + $Hour).slice(-2) + ":" + ("0" + $Minute).slice(-2) + ":" + ("0" + $Second).slice(-2);
    var totalDetikSekarang = ($Hour * 3600) + ($Minute * 60) + $Second;

    // ============================================================
    // 💥 BLOK PROTOTYPE UNIT 16 (REVISED SUKSES) 💥
    // ============================================================
    if ($SB16._commStatus === true) {

        // 1. ISOLASI INPUT TAG DATA REGISTER UNIT 16
        var maintenance_aktif_16 = $Sys_Control.Maintenance_Mode_16; 
        var Run_status_16 = $SB16.Run; 
        var raw_pv_16 = $SB16.temp;              

        var target16 = $SB_16.target_menit;
        var adjust16 = $SB_16.adjust_menit;
        var sisa16 = $SB_16.sisa_detik_masak;
        var pemanasan16 = $SB_16.total_detik_pemanasan;
        var fStart16 = $SB_16.flag_init_start;
        var fMasak16 = $SB_16.flag_init_masak;

        var bit_kosong_16 = $SB_16.status_kosong;
        var bit_pemanasan_16 = $SB_16.status_pemanasan;
        var bit_pemasakan_16 = $SB_16.status_pemasakan;
        var bit_selesai_16 = $SB_16.status_selesai;

        // Deklarasi variabel internal waktu Unit 16
        var hPre_16 = 0; var mPre_16 = 0; var sPre_16 = 0;
        var hAct_16 = 0; var mAct_16 = 0; var sAct_16 = 0;
        var est16 = 0; var hEst_16 = 0; var mEst_16 = 0; var sEst_16 = 0;
        var targetStandarMenit_16 = 0; var koreksiWaktuMenit_16 = 0; var totalDurasiMasakMenit_16 = 0; var limitTargetBaruDetik_16 = 0;

        // Jalankan logika jika Maintenance tidak aktif
        if (maintenance_aktif_16 !== 1) {

            if (Run_status_16 === true) {
                bit_pemanasan_16 = false;
                bit_pemasakan_16 = false;

                if (bit_kosong_16 === true) {
                    bit_selesai_16 = false;
                    fStart16 = 0;
                    fMasak16 = 0;
                    pemanasan16 = 0;
                    sisa16 = 0;
                    $SB_16.target_menit = 0; 
                    $SB_16.adjust_menit = 0; 

                    $SB_16.tampil_jam_mulai = "00:00:00";
                    $SB_16.tampil_jam_masak = "00:00:00";
                    $SB_16.tampil_estimasi_selesai = "00:00:00";
                    $SB_16.tampil_durasi_actual = "00:00:00";
                    $SB_16.tampil_pemanasan = "00:00:00";
                }
            } 
            else if (Run_status_16 === false) {
                bit_kosong_16 = false;  
                bit_selesai_16 = false; 

                if (target16 > 0) {
                    if (raw_pv_16 < 1000) {
                        bit_pemanasan_16 = true;
                        bit_pemasakan_16 = false;
                    }
                } else {
                    bit_pemanasan_16 = false;
                    bit_pemasakan_16 = false;
                }
            }

            if (Run_status_16 === false) {

                if (target16 === 0) {
                    if (raw_pv_16 < 1000) {
                        pemanasan16 = pemanasan16 + 1; 
                        
                        hPre_16 = Math.floor(pemanasan16 / 3600);
                        mPre_16 = Math.floor((pemanasan16 % 3600) / 60);
                        sPre_16 = pemanasan16 % 60;
                        $SB_16.tampil_pemanasan = ("0" + hPre_16).slice(-2) + ":" + ("0" + mPre_16).slice(-2) + ":" + ("0" + sPre_16).slice(-2);
                    }
                    else if (raw_pv_16 >= 1000) {
                        Run_status_16 = true;   
                        bit_selesai_16 = true;     
                    }
                }

                if (bit_pemanasan_16 === true || bit_pemasakan_16 === true) {

                    if (fStart16 === 0) {
                        $SB_16.tampil_jam_mulai = waktuSekarangString;
                        $SB_16.tampil_jam_masak = "--:--:--";
                        $SB_16.tampil_estimasi_selesai = "--:--:--";
                        fStart16 = 1;
                        sisa16 = target16 * 60; 
                        adjust16 = 0;
                    }

                    if (adjust16 !== 0) {
                        sisa16 = sisa16 + (adjust16 * 60);
                        if (sisa16 < 0) { sisa16 = 0; }
                        adjust16 = 0;
                        $SB_16.adjust_menit = 0;
                    }

                    if (raw_pv_16 < 1000) {
                        bit_pemanasan_16 = true;
                        bit_pemasakan_16 = false;
                        
                        pemanasan16 = pemanasan16 + 1; 
                        
                        hPre_16 = Math.floor(pemanasan16 / 3600);
                        mPre_16 = Math.floor((pemanasan16 % 3600) / 60);
                        sPre_16 = pemanasan16 % 60;
                        $SB_16.tampil_pemanasan = ("0" + hPre_16).slice(-2) + ":" + ("0" + mPre_16).slice(-2) + ":" + ("0" + sPre_16).slice(-2);
                        
                        hAct_16 = Math.floor(sisa16 / 3600);
                        mAct_16 = Math.floor((sisa16 % 3600) / 60);
                        sAct_16 = sisa16 % 60;
                        $SB_16.tampil_durasi_actual = ("0" + hAct_16).slice(-2) + ":" + ("0" + mAct_16).slice(-2) + ":" + ("0" + sAct_16).slice(-2);
                        
                        est16 = totalDetikSekarang + sisa16;
                        if (est16 >= 86400) { est16 = est16 - 86400; }
                        
                        hEst_16 = Math.floor(est16 / 3600);
                        mEst_16 = Math.floor((est16 % 3600) / 60);
                        sEst_16 = est16 % 60;
                        $SB_16.tampil_estimasi_selesai = ("0" + hEst_16).slice(-2) + ":" + ("0" + mEst_16).slice(-2) + ":" + ("0" + sEst_16).slice(-2);
                        
                        fMasak16 = 0; 
                    }

                    if (raw_pv_16 >= 1000) {
                        bit_pemanasan_16 = false;
                        bit_pemasakan_16 = true;
                        
                        if (fMasak16 === 0) {
                            $SB_16.tampil_jam_masak = waktuSekarangString;
                            fMasak16 = 1;
                        }
                        
                        if (sisa16 > 0) { 
                            sisa16 = sisa16 - 1; 
                        }
                        
                        if (sisa16 <= 0) {
                            sisa16 = 0;
                            Run_status_16 = true;  
                            bit_pemasakan_16 = false;
                            bit_selesai_16 = true;     
                        }
                        
                        hAct_16 = Math.floor(sisa16 / 3600);
                        mAct_16 = Math.floor((sisa16 % 3600) / 60);
                        sAct_16 = sisa16 % 60;
                        $SB_16.tampil_durasi_actual = ("0" + hAct_16).slice(-2) + ":" + ("0" + mAct_16).slice(-2) + ":" + ("0" + sAct_16).slice(-2);
                        
                        targetStandarMenit_16 = $SB_16.target_menit;
                        koreksiWaktuMenit_16 = $SB_16.adjust_menit;
                        totalDurasiMasakMenit_16 = targetStandarMenit_16 + koreksiWaktuMenit_16;
                        if (totalDurasiMasakMenit_16 < 0) { totalDurasiMasakMenit_16 = 0; }
                        limitTargetBaruDetik_16 = totalDurasiMasakMenit_16 * 60;
                        
                        est16 = totalDetikSekarang + sisa16;
                        if (est16 >= 86400) { est16 = est16 - 86400; }
                        
                        hEst_16 = Math.floor(est16 / 3600);
                        mEst_16 = Math.floor((est16 % 3600) / 60);
                        sEst_16 = est16 % 60;
                        $SB_16.tampil_estimasi_selesai = ("0" + hEst_16).slice(-2) + ":" + ("0" + mEst_16).slice(-2) + ":" + ("0" + sEst_16).slice(-2);
                    }
                }
            }

            // Write Back Unit 16
            $SB16.Run = Run_status_16; 
            $SB_16.status_kosong = bit_kosong_16;
            $SB_16.status_pemanasan = bit_pemanasan_16;
            $SB_16.status_pemasakan = bit_pemasakan_16;
            $SB_16.status_selesai = bit_selesai_16;
            $SB_16.sisa_detik_masak = sisa16;
            $SB_16.total_detik_pemanasan = pemanasan16;
            $SB_16.flag_init_start = fStart16;
            $SB_16.flag_init_masak = fMasak16;
        }
    }
}

// 2. RUN SIMULATION SCENARIO
console.log("=== SIMULASI SIKLUS PROSES UNIT 16 ===");

// Tahap 1: Pemanasan (Suhu 95.0C, target 2 menit)
console.log("\n--- TAHAP 1: Pemanasan (Suhu 95.0 C, Target 2 Menit) ---");
for (var i = 1; i <= 3; i++) {
    tickClock();
    runScadaScript();
    console.log("Detik " + i + " -> Temp: " + $SB16.temp/10 + "C, State: " + 
        ($SB_16.status_pemanasan ? "PEMASANAN" : "IDLE") + 
        ", Jam Mulai: " + $SB_16.tampil_jam_mulai +
        ", Jam Masak: " + $SB_16.tampil_jam_masak +
        ", Sisa Masak: " + $SB_16.tampil_durasi_actual +
        ", Estimasi Selesai: " + $SB_16.tampil_estimasi_selesai +
        ", Durasi Pemanasan: " + $SB_16.tampil_pemanasan
    );
}

// Tahap 2: Suhu naik menyentuh 100.0C (Mulai Memasak)
console.log("\n--- TAHAP 2: Suhu menyentuh 100.0 C (Mulai Memasak) ---");
$SB16.temp = 1005; // 100.5C
for (var i = 4; i <= 6; i++) {
    tickClock();
    runScadaScript();
    console.log("Detik " + i + " -> Temp: " + $SB16.temp/10 + "C, State: " + 
        ($SB_16.status_pemasakan ? "MEMASAK" : "IDLE") + 
        ", Jam Mulai: " + $SB_16.tampil_jam_mulai +
        ", Jam Masak: " + $SB_16.tampil_jam_masak + // Perhatikan jika jam masak berubah-ubah!
        ", Sisa Masak: " + $SB_16.tampil_durasi_actual +
        ", Estimasi Selesai: " + $SB_16.tampil_estimasi_selesai
    );
}

// Tahap 3: Suhu turun kembali ke 98.0C (Fluktuasi Suhu)
console.log("\n--- TAHAP 3: Suhu turun kembali ke 98.0 C (Suhu Fluktuatif) ---");
$SB16.temp = 980; // 98.0C
for (var i = 7; i <= 9; i++) {
    tickClock();
    runScadaScript();
    console.log("Detik " + i + " -> Temp: " + $SB16.temp/10 + "C, State: " + 
        ($SB_16.status_pemanasan ? "PEMANSAN KEMBALI" : "IDLE") + 
        ", Jam Mulai: " + $SB_16.tampil_jam_mulai +
        ", Jam Masak: " + $SB_16.tampil_jam_masak + // Perhatikan jam masak disini!
        ", Sisa Masak: " + $SB_16.tampil_durasi_actual +
        ", Estimasi Selesai: " + $SB_16.tampil_estimasi_selesai
    );
}

// Tahap 4: Suhu naik lagi ke 100.0C (Mulai Memasak Lagi)
console.log("\n--- TAHAP 4: Suhu naik lagi ke 100.0 C ---");
$SB16.temp = 1005; // 100.5C
for (var i = 10; i <= 11; i++) {
    tickClock();
    runScadaScript();
    console.log("Detik " + i + " -> Temp: " + $SB16.temp/10 + "C, State: " + 
        ($SB_16.status_pemasakan ? "MEMASAK" : "IDLE") + 
        ", Jam Mulai: " + $SB_16.tampil_jam_mulai +
        ", Jam Masak: " + $SB_16.tampil_jam_masak + // SIFAT BUG TERBUKTI: Jam Masak bergeser!
        ", Sisa Masak: " + $SB_16.tampil_durasi_actual +
        ", Estimasi Selesai: " + $SB_16.tampil_estimasi_selesai
    );
}

// Tahap 5: Simulasi NaN (Jika salah satu tag undefined)
console.log("\n--- TAHAP 5: Simulasi Nilai Undefined pada HMI (Startup/Koneksi Putus) ---");
$SB_16.sisa_detik_masak = undefined; // Tag bernilai undefined/null
tickClock();
try {
    runScadaScript();
    console.log("Hasil sisa_detik_masak setelah undefined: " + $SB_16.sisa_detik_masak);
    console.log("Tampilan sisa waktu masak (DURASI ACTUAL): " + $SB_16.tampil_durasi_actual);
} catch (e) {
    console.log("Crash detected: " + e.message);
}
