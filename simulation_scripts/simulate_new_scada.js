// Simulation of updated Haiwell SCADA JavaScript Engine for Unit 16
// This script simulates the new workflow, including Pre-heat and Cooking Modes.

// 1. Mock SCADA Global Tags
var $Hour = 11;
var $Minute = 46;
var $Second = 35;

var $Sys_Control = {
    maintenanceMode16: 0
};

var $SB16 = {
    temp: 950,        // 95.0 °C
    tempSet: 1000,    // 100.0 °C target
    runStop: true,    // true means STOPPED, false means RUNNING
    nozlle1: false,
    nozzle2: false
};

var $SB_16 = {
    mode_preHeat: false,      // false = Cooking Mode, true = Preheat Mode
    targetMenit: 2,           // 2 minutes target
    adjustMenit: 0,
    sisaDetikMasak: 0,
    totalDetikPemanasan: 0,
    flagInitStart: 0,
    flagInitMasak: 0,
    tampilJamMulai: "00:00:00",
    tampilJamMasak: "00:00:00",
    tampilJamsSelesai: "00:00:00",
    tampilPemanasan: "00:00:00",
    tampilDurasiAktual: "00:00:00",
    statusKosong: false,
    statusPemanasan: false,
    statusPemasakan: false,
    statusSelesai: false
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
    // SYSTEM TIME EXTRACTION
    // ============================================================
    var waktuSekarangString = ("0" + $Hour).slice(-2) + ":" + ("0" + $Minute).slice(-2) + ":" + ("0" + $Second).slice(-2);
    var totalDetikSekarang = ($Hour * 3600) + ($Minute * 60) + $Second;

    // ============================================================
    // LOGIKA UNIT 16
    // ============================================================
    
    // 1. ISOLASI INPUT TAG DATA REGISTER (Mencegah overhead baca tag)
    var maintenance_aktif_16 = $Sys_Control.maintenanceMode16; 
    var Run_status_16 = $SB16.runStop; // true = STOPPED, false = RUNNING
    var raw_pv_16 = $SB16.temp;              

    // Sanitasi input internal tag untuk mencegah bug NaN
    var modePreHeat_16 = $SB_16.mode_preHeat || false;
    var target16 = $SB_16.targetMenit || 0;
    var adjust16 = $SB_16.adjustMenit || 0;
    var sisa16 = $SB_16.sisaDetikMasak || 0;
    var pemanasan16 = $SB_16.totalDetikPemanasan || 0;
    var fStart16 = $SB_16.flagInitStart || 0;
    var fMasak16 = $SB_16.flagInitMasak || 0;

    var bit_kosong_16 = $SB_16.statusKosong || false;
    var bit_pemanasan_16 = $SB_16.statusPemanasan || false;
    var bit_pemasakan_16 = $SB_16.statusPemasakan || false;
    var bit_selesai_16 = $SB_16.statusSelesai || false;

    // Deklarasi variabel internal waktu Unit 16
    var hPre_16 = 0; var mPre_16 = 0; var sPre_16 = 0;
    var hAct_16 = 0; var mAct_16 = 0; var sAct_16 = 0;
    var est16 = 0; var hEst_16 = 0; var mEst_16 = 0; var sEst_16 = 0;

    // Jalankan logika jika Maintenance tidak aktif
    if (maintenance_aktif_16 !== 1) {

        // --- KONDISI MESIN STOPPED (runStop === true) ---
        if (Run_status_16 === true) {
            bit_pemanasan_16 = false;
            bit_pemasakan_16 = false;
            fStart16 = 0; // Reset flag start agar bisa trigger ulang ketika start ditekan

            // Reset total jika tombol kosong diaktifkan
            if (bit_kosong_16 === true) {
                bit_selesai_16 = false;
                fStart16 = 0;
                fMasak16 = 0;
                pemanasan16 = 0;
                sisa16 = 0;
                $SB_16.targetMenit = 0; 
                $SB_16.adjustMenit = 0; 

                $SB_16.tampilJamMulai = "00:00:00";
                $SB_16.tampilJamMasak = "00:00:00";
                $SB_16.tampilJamsSelesai = "00:00:00";
                $SB_16.tampilDurasiAktual = "00:00:00";
                $SB_16.tampilPemanasan = "00:00:00";
            }
        } 
        
        // --- KONDISI MESIN RUNNING (runStop === false) ---
        else if (Run_status_16 === false) {
            bit_kosong_16 = false;  
            bit_selesai_16 = false; 

            // ==========================================
            // MODE A: PEMANASAN HARIAN (PREHEAT)
            // ==========================================
            if (modePreHeat_16 === true) {
                bit_pemanasan_16 = true;
                bit_pemasakan_16 = false;

                // Catat jam mulai preheat saat pertama kali start
                if (fStart16 === 0) {
                    $SB_16.tampilJamMulai = waktuSekarangString;
                    $SB_16.tampilJamMasak = "--:--:--";
                    $SB_16.tampilJamsSelesai = "--:--:--";
                    $SB_16.tampilDurasiAktual = "--:--:--";
                    fStart16 = 1;
                    pemanasan16 = 0;
                }

                // Hitung maju durasi pemanasan
                pemanasan16 = pemanasan16 + 1;
                
                hPre_16 = Math.floor(pemanasan16 / 3600);
                mPre_16 = Math.floor((pemanasan16 % 3600) / 60);
                sPre_16 = pemanasan16 % 60;
                $SB_16.tampilPemanasan = ("0" + hPre_16).slice(-2) + ":" + ("0" + mPre_16).slice(-2) + ":" + ("0" + sPre_16).slice(-2);

                // Selesai preheat jika suhu > 1000
                if (raw_pv_16 > 1000) {
                    Run_status_16 = true;        // Kirim perintah STOP (runStop = true/1)
                    bit_selesai_16 = true;
                    bit_pemanasan_16 = false;
                    $SB_16.mode_preHeat = false; // Matikan mode preheat otomatis
                    fStart16 = 0;                // Reset flag segera
                }
            } 
            
            // ==========================================
            // MODE B: PEMASAKAN RESEP
            // ==========================================
            else {
                // Inisialisasi awal saat tombol start ditekan
                if (fStart16 === 0) {
                    $SB_16.tampilJamMulai = waktuSekarangString;
                    $SB_16.tampilJamMasak = "--:--:--";
                    $SB_16.tampilJamsSelesai = "--:--:--";
                    fStart16 = 1;
                    sisa16 = target16 * 60; 
                    pemanasan16 = 0;
                    fMasak16 = 0; // Reset flag penanda waktu masuk masak pertama kali
                }

                // Fitur Koreksi Waktu (Adjust Waktu)
                if (adjust16 !== 0) {
                    sisa16 = sisa16 + (adjust16 * 60);
                    if (sisa16 < 0) { sisa16 = 0; }
                    adjust16 = 0;
                    $SB_16.adjustMenit = 0; // Clear HMI input
                }

                // Sub-Fase 1: Suhu belum mendidih (Pemanasan Pemasakan)
                if (raw_pv_16 < 1000) {
                    bit_pemanasan_16 = true;
                    bit_pemasakan_16 = false;
                    
                    pemanasan16 = pemanasan16 + 1; // Hitung durasi pemanasan
                    
                    hPre_16 = Math.floor(pemanasan16 / 3600);
                    mPre_16 = Math.floor((pemanasan16 % 3600) / 60);
                    sPre_16 = pemanasan16 % 60;
                    $SB_16.tampilPemanasan = ("0" + hPre_16).slice(-2) + ":" + ("0" + mPre_16).slice(-2) + ":" + ("0" + sPre_16).slice(-2);
                    
                    // Tampilkan sisa masak (tetap utuh selama pemanasan)
                    hAct_16 = Math.floor(sisa16 / 3600);
                    mAct_16 = Math.floor((sisa16 % 3600) / 60);
                    sAct_16 = sisa16 % 60;
                    $SB_16.tampilDurasiAktual = ("0" + hAct_16).slice(-2) + ":" + ("0" + mAct_16).slice(-2) + ":" + ("0" + sAct_16).slice(-2);
                    
                    // Hitung Estimasi Selesai (Waktu sekarang + sisa masak)
                    est16 = (totalDetikSekarang + sisa16) % 86400; // FIX BUG WRAP AROUND
                    hEst_16 = Math.floor(est16 / 3600);
                    mEst_16 = Math.floor((est16 % 3600) / 60);
                    sEst_16 = est16 % 60;
                    $SB_16.tampilJamsSelesai = ("0" + hEst_16).slice(-2) + ":" + ("0" + mEst_16).slice(-2) + ":" + ("0" + sEst_16).slice(-2);
                }

                // Sub-Fase 2: Suhu sudah mendidih (Proses Memasak)
                else if (raw_pv_16 >= 1000) {
                    bit_pemanasan_16 = false;
                    bit_pemasakan_16 = true;
                    
                    // Catat Jam Masak hanya satu kali di awal masak
                    if (fMasak16 === 0) {
                        $SB_16.tampilJamMasak = waktuSekarangString;
                        fMasak16 = 1; // Mengunci agar jam masak tidak berubah jika suhu naik turun
                    }
                    
                    // Hitung mundur sisa detik masak
                    if (sisa16 > 0) { 
                        sisa16 = sisa16 - 1; 
                    }
                    
                    // Deteksi selesai masak
                    if (sisa16 <= 0) {
                        sisa16 = 0;
                        Run_status_16 = true;       // Kirim perintah STOP (runStop = true/1)
                        bit_pemasakan_16 = false;
                        bit_selesai_16 = true;
                        fStart16 = 0;               // Reset flag segera
                        fMasak16 = 0;               // Reset flag segera
                    }
                    
                    hAct_16 = Math.floor(sisa16 / 3600);
                    mAct_16 = Math.floor((sisa16 % 3600) / 60);
                    sAct_16 = sisa16 % 60;
                    $SB_16.tampilDurasiAktual = ("0" + hAct_16).slice(-2) + ":" + ("0" + mAct_16).slice(-2) + ":" + ("0" + sAct_16).slice(-2);
                    
                    // Hitung Estimasi Selesai (Waktu sekarang + sisa masak)
                    est16 = (totalDetikSekarang + sisa16) % 86400; // FIX BUG WRAP AROUND
                    hEst_16 = Math.floor(est16 / 3600);
                    mEst_16 = Math.floor((est16 % 3600) / 60);
                    sEst_16 = est16 % 60;
                    $SB_16.tampilJamsSelesai = ("0" + hEst_16).slice(-2) + ":" + ("0" + mEst_16).slice(-2) + ":" + ("0" + sEst_16).slice(-2);
                }
            }
        }

        // 3. WRITE BACK KE TAG REGISTER (Menyimpan status)
        $SB16.runStop = Run_status_16; 
        $SB_16.statusKosong = bit_kosong_16;
        $SB_16.statusPemanasan = bit_pemanasan_16;
        $SB_16.statusPemasakan = bit_pemasakan_16;
        $SB_16.statusSelesai = bit_selesai_16;
        $SB_16.sisaDetikMasak = sisa16;
        $SB_16.totalDetikPemanasan = pemanasan16;
        $SB_16.flagInitStart = fStart16;
        $SB_16.flagInitMasak = fMasak16;
    }
}

// ============================================================
// SIMULATION RUNNER
// ============================================================
console.log("=== SIMULASI WORKFLOW UNIT 16 ===");

// TEST SCENARIO 1: PRE-HEAT MODE
console.log("\n>>> SKENARIO 1: MODE PRE-HEAT HARIAN <<<");
$SB_16.mode_preHeat = true;
$SB16.runStop = false; // Tekan START (0 / false)
$SB16.temp = 950;      // 95.0C

for (var i = 1; i <= 3; i++) {
    tickClock();
    runScadaScript();
    console.log("Siklus Preheat " + i + " -> Temp: " + $SB16.temp/10 + "C, runStop: " + $SB16.runStop +
        ", State Pemanasan: " + $SB_16.statusPemanasan +
        ", Jam Mulai: " + $SB_16.tampilJamMulai +
        ", Durasi Pemanasan: " + $SB_16.tampilPemanasan +
        ", Selesai: " + $SB_16.statusSelesai
    );
}

// Suhu mencapai 100.5C (Preheat selesai)
console.log("\nSuhu melebihi 100C...");
$SB16.temp = 1005;
tickClock();
runScadaScript();
console.log("Setelah Temp > 100C -> runStop: " + $SB16.runStop + 
    ", State Pemanasan: " + $SB_16.statusPemanasan + 
    ", mode_preHeat: " + $SB_16.mode_preHeat + 
    ", Selesai: " + $SB_16.statusSelesai
);

// TEST SCENARIO 2: COOKING MODE (PEMASAKAN)
console.log("\n>>> SKENARIO 2: MODE PEMASAKAN RESEP (Target 2 Menit) <<<");
$SB_16.mode_preHeat = false; // Matikan preheat, masuk mode masak
$SB_16.targetMenit = 2;      // Masukkan target 2 menit dari resep
$SB16.runStop = false;       // Tekan START (0 / false)
$SB16.temp = 980;            // Suhu 98.0C (Tahap pemanasan awal memasak)

for (var i = 1; i <= 2; i++) {
    tickClock();
    runScadaScript();
    console.log("Siklus Masak " + i + " (Pemanasan) -> Temp: " + $SB16.temp/10 + "C, runStop: " + $SB16.runStop +
        ", Pemasakan: " + $SB_16.statusPemasakan +
        ", Pemanasan: " + $SB_16.statusPemanasan +
        ", Jam Mulai: " + $SB_16.tampilJamMulai +
        ", Sisa Masak: " + $SB_16.tampilDurasiAktual +
        ", Estimasi Selesai: " + $SB_16.tampilJamsSelesai
    );
}

// Suhu mencapai 100.2C (Mulai mendidih & hitung mundur)
console.log("\nSuhu mendidih (temp >= 1000)...");
$SB16.temp = 1002;
for (var i = 3; i <= 5; i++) {
    tickClock();
    runScadaScript();
    console.log("Siklus Masak " + i + " (Mendidih) -> Temp: " + $SB16.temp/10 + "C, runStop: " + $SB16.runStop +
        ", Pemasakan: " + $SB_16.statusPemasakan +
        ", Pemanasan: " + $SB_16.statusPemanasan +
        ", Jam Masak: " + $SB_16.tampilJamMasak +
        ", Sisa Masak: " + $SB_16.tampilDurasiAktual +
        ", Estimasi Selesai: " + $SB_16.tampilJamsSelesai
    );
}

// Suhu sempat turun (fluktuasi) ke 99.5C
console.log("\nSuhu turun fluktuasi ke 99.5C...");
$SB16.temp = 995;
for (var i = 6; i <= 7; i++) {
    tickClock();
    runScadaScript();
    console.log("Siklus Masak " + i + " (Fluktuasi) -> Temp: " + $SB16.temp/10 + "C, runStop: " + $SB16.runStop +
        ", Pemasakan: " + $SB_16.statusPemasakan +
        ", Pemanasan: " + $SB_16.statusPemanasan +
        ", Jam Masak (Harus Tetap): " + $SB_16.tampilJamMasak +
        ", Sisa Masak (Harus Pause): " + $SB_16.tampilDurasiAktual +
        ", Estimasi Selesai: " + $SB_16.tampilJamsSelesai
    );
}

// Masukkan Adjust waktu (+1 Menit) saat suhu turun
console.log("\nMasukkan Adjust +1 Menit saat suhu turun...");
$SB_16.adjustMenit = 1;
tickClock();
runScadaScript();
console.log("Setelah Adjust -> Sisa Masak: " + $SB_16.tampilDurasiAktual + 
    ", Estimasi Selesai: " + $SB_16.tampilJamsSelesai
);

// Suhu naik lagi ke 100.5C sampai selesai masak
console.log("\nSuhu naik lagi ke 100.5C...");
$SB16.temp = 1005;
while ($SB16.runStop === false) {
    tickClock();
    runScadaScript();
    console.log("Siklus Masak -> Temp: " + $SB16.temp/10 + "C, runStop: " + $SB16.runStop +
        ", Pemasakan: " + $SB_16.statusPemasakan +
        ", Jam Masak: " + $SB_16.tampilJamMasak +
        ", Sisa Masak: " + $SB_16.tampilDurasiAktual +
        ", Selesai: " + $SB_16.statusSelesai
    );
}
