# DOKUMENTASI TRIAL PROJECT: SISTEM KONTROL STEAMBOX MANDIRI
## Pengembangan Sistem PC SCADA Haiwell & Pengendali Suhu Autonics TK4M
**Acuan Bahan Presentasi untuk Owner & Manajemen Pabrik**

---

## EXECUTIVE SUMMARY (RINGKASAN EKSEKUTIF)

Proyek ini bertujuan untuk mengotomatisasi kontrol suhu dan durasi memasak pada **30 Ruang Steambox** secara mandiri menggunakan **PC SCADA Runtime** dan **Autonics TK4M Controller** melalui komunikasi jaringan **Modbus TCP to RTU (ICP DAS Gateway)**. 

Desain sistem kontrol ini dirancang dengan berfokus pada dua pilar utama:
1.  **Reliabilitas OT Mutlak:** Sistem tidak bergantung pada koneksi internet/Wi-Fi luar ruangan, menjamin keselamatan proses memasak dari risiko jaringan mati.
2.  **Poka-Yoke (Anti-Salah Operasional):** Status banner pintar bertindak sebagai asisten pemandu bagi operator pabrik agar tidak salah langkah dalam menekan tombol, sekalipun operator awam komputer.

---

## 1. STRUKTUR DAN ARSITEKTUR DATABASE TAG HMI

Untuk menjaga efisiensi memori HMI SCADA dan kerapian struktur data, arsitektur database tag dibagi menjadi tiga kelompok utama:

### A. Tag Dinamis per Ruang (Di dalam Group `sb_1` s.d. `sb_30`)
Masing-masing dari 30 ruang Steambox memiliki penampung status mandiri di dalam group unitnya sendiri:
*   **`status_banner`** (STRING, panjang: 50): Menampilkan status rill dan instruksi bimbingan operator untuk unit bersangkutan (misalnya: `"STEAMBOX KOSONG"`, `"SIAP PEMANASAN..."`).
*   **`mode_preheat`** (BOOL): Sakelar penentu apakah unit sedang menjalankan pemanasan awal (Pre-heat) atau memasak resep (Cooking).
*   **`maintenance_mode`** (BOOL): Toggle HMI per unit untuk mengalihkan ke mode perbaikan manual. Jika bernilai `true`/`1`, seluruh logika otomatisasi skrip dilewati (*bypass*) agar teknisi dapat melakukan kontrol manual secara aman.
*   **`sensor_error`** (BOOL): Tag boolean penanda alarm jika sensor suhu bermasalah. Tag ini bernilai `true`/`1` jika suhu `>= 300.0 °C` (sensor putus/openloop) untuk memicu sirine alarm HMI atau log alarm.
*   **`reset`** (BOOL) — **[BARU/TAMBAHAN]**: Sakelar pemicu untuk melakukan reset parameter (Tugas Baru) per unit. Tombol ini dipisah sepenuhnya dari `status_kosong` untuk keandalan dan keamanan.
*   **`status_kosong`** (BOOL): Status penanda bahwa tangki kosong dan siap menerima perintah baru.
*   **`status_pemanasan`** (BOOL): Status penanda bahwa unit sedang dalam fase pemanasan (Heating).
*   **`status_pemasakan`** (BOOL): Status penanda bahwa unit sedang dalam fase mendidih/pemasakan (Boiling).
*   **`status_selesai`** (BOOL): Status penanda bahwa proses memasak atau pre-heat telah selesai.
*   **`suhu_awal` / `suhu_akhir`** (SHORT): Mencatat suhu awal saat tombol start ditekan dan suhu akhir saat proses masak selesai.

### B. Tag Hardware & Komunikasi Modbus (Di dalam Device `sb1` s.d. `sb30`)
Tag fisik ini terhubung langsung ke register internal Autonics TK4M melalui Modbus RTU:
*   **`_commStatus`** (BOOL): Status koneksi fisik Modbus antara PC SCADA dengan controller Autonics di lapangan (1 = Terhubung/Online, 0 = Terputus/Offline).
*   **`_commOperation`** (BOOL): Sakelar polling komunikasi Modbus serial. HMI secara otomatis mematikan tag ini (`false`/`0`) saat startup untuk unit yang tidak aktif agar menghemat bandwidth RS485 dan menghindari error timeout.
*   **`temp`** (SHORT): Nilai pembacaan suhu aktual dari Autonics (Nilai raw, 1000 = 100.0 °C).
    *   **Diagnostik Sensor Error:** Skrip secara otomatis mendeteksi jika pembacaan `temp` bernilai **`>= 30000`** (setara dengan suhu **`>= 300.0 °C`**). Ini mendeteksi kondisi sensor rusak/putus (*Open-loop* atau batas atas *HHHH*).
    *   **Filosofi Pengendalian Aman:** Ketika sensor error terdeteksi, SCADA **tidak mengirimkan perintah STOP** ke Autonics. Pihak Autonics TK4M yang secara mandiri akan mempertahankan kondisi kerja pemanas terakhir demi melindungi kematangan produk yang sedang berjalan. SCADA hanya bertindak sebagai media informasi yang menampilkan pesan error sensor di layar untuk memandu tindakan pencegahan teknisi.
*   **`run_stop`** (BOOL): Perintah kerja heater Autonics (0 = RUN/Pemanas Menyala, 1 = STOP/Pemanas Mati).

### C. Tag Teks Kustom Global (Di dalam Group `Sys_Control`)
Untuk memudahkan pengaturan teks banner, teks kustomisasi disimpan secara **global** di dalam group `Sys_Control`. Anda **hanya perlu mengisi teks ini sekali saja**, dan seluruh 30 unit Steambox akan merujuk pada format teks kustom yang sama secara otomatis:
*   **`txt_status_kosong`** (STRING) -> Default: `"STEAMBOX KOSONG"`
*   **`txt_status_preheat`** (STRING) -> Default: `"SEDANG PEMANASAN"`
*   **`txt_status_pemanasan`** (STRING) -> Default: `"MENUNGGU MENDIDIH (< 100 C)"`
*   **`txt_status_pemasakan`** (STRING) -> Default: `"SEDANG MEMASAK (MENDIDIH)"`
*   **`txt_status_selesai`** (STRING) -> Default: `"PROSES SELESAI - SILAKAN KOSONGKAN TANGKI"`
*   **`txt_status_maintenance`** (STRING) -> Default: `"MODE MAINTENANCE (KONTROL MANUAL)"`
*   **`txt_status_disable`** (STRING) -> Default: `"UNIT TIDAK DIPAKAI"`
*   **`txt_status_offline`** (STRING) -> Default: `"KONEKSI OFFLINE (MCB TRIP/ALAT MATI)"`
*   **`txt_status_sensor_error`** (STRING) -> Default: `"ERROR SENSOR (OPENLOOP/HHHH)"`
*   **`txt_selesai_preheat`** (STRING) -> Default: `"PEMANASAN SELESAI - STEAMBOX SIAP UNTUK PEMASAKAN"`
*   **`txt_siap_preheat`** (STRING) -> Default: `"SIAP PEMANASAN - SILAKAN TEKAN START"`
*   **`txt_siap_cooking`** (STRING) -> Default: `"RESEP TERPASANG - SILAKAN TEKAN START"`
*   **`txt_preheat_paused`** (STRING) -> Default: `"PRE-HEAT DIHENTIKAN (PAUSED)"`
*   **`txt_status_paused`** (STRING) -> Default: `"MESIN BERHENTI (PAUSED)"`

---

## 2. WORKFLOW PROSES PRODUKSI STEAMBOX (10 TAHAP POKA-YOKE)

Skrip otomatisasi dan visualisasi banner dirancang dengan sangat disiplin untuk memandu operator melalui **10 tahap siklus produksi**:

```mermaid
flowchart TD
    T1[1. Startup / Cek Modbus] -->|commOperation = 1 & commStatus = 1| T2[2. Standby Kosong]
    T2 -->|Pencet Tombol Preheat| T3[3. Siap Preheat]
    T3 -->|Tekan START HMI| T4[4. Sedang Preheat]
    T4 -->|Suhu > 100 C| T5[5. Preheat Selesai]
    T5 -->|Pencet Tugas Baru / Reset| T6[6. Tangki Kosong/Bersih]
    T6 -->|Pilih & Transfer Resep| T7[7. Resep Terpasang]
    T7 -->|Tekan START HMI| T8[8. Pemanasan Cooking]
    T8 -->|Suhu > 100 C| T9[9. Proses Memasak/Boiling]
    T9 -->|Durasi Habis| T10[10. Memasak Selesai]
    T10 -->|Pencet Tugas Baru / Reset| T6
```

### Penjelasan Detil Tiap Tahap:

#### Tahap 1: Startup & Proteksi Komunikasi (`_commOperation` vs `_commStatus`)
*   Jika unit dinonaktifkan (`_commOperation = 0`), status banner terkunci menampilkan **`txt_status_disable`** (`"UNIT TIDAK DIPAKAI"`). Polling Modbus ke Autonics dihentikan sepenuhnya demi efisiensi bandwidth kabel serial.
*   Jika unit diaktifkan (`_commOperation = 1`), skrip secara otomatis memantau koneksi Modbus:
    *   Jika `_commStatus = 0` (Disconnected): Banner menampilkan **`txt_status_offline`** (`"KONEKSI OFFLINE (MCB TRIP/ALAT MATI)"`).
    *   Jika `_commStatus = 1` (Connected): Status banner langsung terhubung ke status operasional unit. Jika unit baru menyala tanpa tugas, banner menampilkan **`txt_status_kosong`** (`"STEAMBOX KOSONG"`) dan mengatur bit `status_kosong = 1`.

#### Tahap 2: Persiapan Preheat
*   Pukul 06:45, operator mengaktifkan mode preheat harian (sakelar `$sb_i.mode_preheat` bernilai `true`/`1`).
*   Selama mesin masih berhenti (`run_stop = 1`), status banner membimbing operator dengan menampilkan **`txt_status_siap_preheat`** (`"SIAP PEMANASAN - SILAKAN TEKAN START"`).

#### Tahap 3: Proses Preheat Berjalan
*   Operator menekan tombol START (mengubah `run_stop` menjadi `0`/RUN).
*   Siklus preheat berjalan:
    *   Pemanas menyala, `status_pemanasan = true`, status banner menampilkan **`txt_status_preheat`** (`"SEDANG PEMANASAN"`).
    *   Durasi pemanasan dihitung maju (*count-up*) dan ditampilkan di kolom pemanasan.
    *   **Keamanan Tampilan:** Seluruh jam proses (`jam_mulai`, `jam_masak`, `jam_selesai`) dan `durasi_aktual` dikunci menampilkan tanda strip **`"--:--:--"`** atau **`"--"`** karena ini adalah fase preheat, bukan memasak produk.

#### Tahap 4: Akhir Siklus Preheat (Mati Otomatis)
*   Suhu sensor Autonics menyentuh batas **`> 100.0 °C`** (nilai register Modbus `> 1000`).
*   Skrip langsung memutus pemanas secara otomatis dengan mengirimkan perintah `$sb{i}.run_stop = 1` (STOP), mematikan `status_pemanasan = false`, dan menyalakan bit `status_selesai = true`.
*   Status banner menampilkan **`txt_status_selesai_preheat`** (`"PEMANASAN SELESAI - STEAMBOX SIAP UNTUK PEMASAKAN"`).

#### Tahap 5: Tugas Baru / Pencucian Tangki (Standalone Reset)
*   Operator memasukkan produk/adonan makanan baru ke ruang Steambox.
*   Operator menekan tombol **"Tugas Baru / Reset"** yang memicu sakelar `$sb_i.reset = true`.
*   Skrip mendeteksi sinyal reset dan langsung membersihkan memori sistem secara menyeluruh:
    *   Mematikan mode preheat (`mode_preheat = false`).
    *   Mengatur `status_kosong = true` dan mematikan `status_selesai = false`.
    *   Meriset semua jam proses (`jam_mulai`, `jam_masak`, `jam_selesai`) kembali ke **`"--:--:--"`**.
    *   Meriset seluruh durasi pemanasan, durasi aktual, perubahan waktu, suhu awal/akhir ke `0` atau `"--"`.
    *   Membersihkan data resep master yang terpasang di memori (`recipe_kode` dikosongkan, `recipe_nama` kembali ke `"--"`).
    *   Mengembalikan status banner ke **`txt_status_kosong`** (`"STEAMBOX KOSONG"`).
    *   Mematikan kembali trigger tombol `$sb_i.reset = false`.

#### Tahap 6: Transfer Resep Masakan
*   Operator memilih menu resep di layar HMI dan menekan tombol "Transfer Resep".
*   Skrip transfer resep menyalin seluruh informasi resep ke memori unit dan langsung mengatur banner ke **`txt_status_siap_cooking`** (`"RESEP TERPASANG - SILAKAN TEKAN START"`). Bit `status_kosong` otomatis mati karena tangki sekarang sudah memiliki tugas produksi.

#### Tahap 7: Mulai Proses Memasak (Cooking)
*   Operator menekan tombol START (mengubah `run_stop` menjadi `0`/RUN).
*   Skrip mendeteksi permulaan masak dan **mencatat Jam Mulai tepat sekali** (`tampil_jam_mulai = waktuSekarangString`).
*   Sisa detik masak diisi penuh dari target menit resep, dan jam selesai diestimasi secara dinamis.

#### Tahap 8: Fase Pemanasan Cooking (< 100 C)
*   Selama suhu tangki masih di bawah **`100.0 °C`** (Modbus `temp < 1000`):
    *   `status_pemanasan = true` dan `status_pemasakan = false`.
    *   Status banner menampilkan **`txt_status_pemanasan`** (`"MENUNGGU MENDIDIH (< 100 C)"`).
    *   Durasi pemanasan memasak dihitung maju dan sisa waktu masak ditampilkan menghitung mundur.

#### Tahap 9: Fase Pemasakan Mendidih / Boiling (>= 100 C)
*   Suhu tangki menyentuh dan melewati batas mendidih **`>= 100.0 °C`** (Modbus `temp >= 1000`):
    *   `status_pemanasan = false` dan `status_pemasakan = true`.
    *   Status banner menampilkan **`txt_status_pemasakan`** (`"SEDANG MEMASAK (MENDIDIH)"`).
    *   **Pencatatan Sekali:** Skrip mencatat Jam Masak (`tampil_jam_masak`) tepat sekali saat transisi masuk ke fase boiling.
    *   Durasi aktual (`sisa_detik_masak`) mulai menghitung mundur per detik dan sisa waktu monitor luar diperbarui secara dinamis.
    *   **Perubahan Waktu:** Jika operator melakukan penambahan/pengurangan waktu di HMI (`adjust_menit`), sisa detik masak langsung dikompensasi dan perkiraan jam selesai masak langsung mengikuti secara dinamis.

#### Tahap 10: Akhir Proses Memasak (Selesai Batch)
*   Durasi aktual memasak habis menyentuh angka `0`.
*   Skrip langsung memutus pemanas Autonics dengan mengirim perintah `$sb{i}.run_stop = 1` (STOP), mematikan `status_pemasakan = false`, dan menyalakan bit `status_selesai = true`.
*   Suhu akhir aktual dicatat dan status banner menampilkan **`txt_status_selesai`** (`"PROSES SELILESAS - SILAKAN KOSONGKAN TANGKI"`).
*   Siklus kembali ke Tahap 5 saat operator menekan tombol Tugas Baru untuk batch berikutnya.
