# DOKUMENTASI RESMI & ARSITEKTUR INTEGRASI OT-IT
## Sistem Kontrol Steambox SCADA (30 Unit) - PT SIAP

Dokumen ini adalah acuan utama (*handbook*) untuk pengembangan, pemeliharaan, serta integrasi data antara **Operational Technology (OT)** pabrik dengan **Information Technology (IT)** menggunakan Jembatan Enkripsi Node.js.

---

## 1. Peta File & Struktur Folder Proyek (Organized Layout)

Untuk kemudahan pemeliharaan, folder proyek `Demo2_hp_SB16` telah dirapikan ke dalam struktur berikut:

```text
d:\Project\PTSIAP\Haiwell\Runtime\Demo2_hp_SB16\
│
├── master_loop_scada.js         <-- [PRODUKSI] Skrip kalkulasi utama 30 unit (isi = v15 terbaru)
├── master_loop_scada_v15.js     <-- [BACKUP] Versi terbaru (stabil untuk kalkulasi & perbaikan waktu)
├── transfer_data_selesai_sb1.txt <-- [TRIAL] Skrip event transfer data khusus Unit 1
├── Trf_Resep_v3.txt             <-- [PRODUKSI] Skrip transfer resep masakan ke HMI
├── run_api_server.bat           <-- [STARTUP] Menjalankan server Node.js di layar Command Prompt
├── start_pm2.bat                <-- [STARTUP] Menjalankan server Node.js sebagai PM2 process
│
├── nodejs/                      <-- [MIDDLEWARE] Folder server Node.js jembatan enkripsi LAN
│   ├── engine.js                <-- Kode utama server jembatan enkripsi LAN
│   ├── config.json              <-- File konfigurasi (scadaHost, machineCode, webapiKey, iv, port)
│   └── package.json
│
├── history/                     <-- [BACKUP HISTORIS] Folder penyimpanan versi skrip lama (v3 s.d v14)
├── tag_exports_csv/             <-- [BACKUP TAG] File ekspor CSV database tag HMI SCADA
├── media_resources/             <-- [ASSETS] Foto screenshot antarmuka & video rekaman hasil pengujian
│
├── DOKUMENTASI_TRIAL_PROJECT_STEAMBOX.md <-- Dokumen topologi & workflow detail
├── dokumentasi_perjalanan_proyek_scada.md <-- Dokumen panduan utama (File Ini)
└── laporan_sistem_scada_steambox.md
```

---

## 2. Aturan Emas JavaScript Haiwell SCADA (Source of Truth)

Setiap pengembang atau AI Agent wajib mematuhi aturan strict ini saat menyunting kode JavaScript HMI Haiwell SCADA:

1.  **Selalu Gunakan Simbol `$` untuk Tag Fisik:**
    *   Interaksi baca/tulis variabel HMI wajib ditulis langsung menggunakan notasi `$` (contoh: `$sb_1.target_menit = 10;`).
    *   *Dilarang keras* menggunakan `Variable.GetValue` or `Variable.SetValue` kecuali untuk resep dinamis yang memiliki tanda titik (seperti `$recipe_kode.1`).
2.  **Jangan Gunakan Operator Penugasan Gabungan pada Tag HMI (`$`):**
    *   *Dilarang keras:* `$sb_1.sisa_detik_masak -= 1;` atau `$sb_1.sisa_detik_masak++;` (menyebabkan *SyntaxError* karena diterjemahkan preprosesor menjadi `Variable.GetById(ID) += 1` yang merupakan bad assignment).
    *   *Wajib ditulis:* `$sb_1.sisa_detik_masak = $sb_1.sisa_detik_masak - 1;`
3.  **Perbandingan Strict Boolean HMI (`===`):**
    *   Tag Boolean HMI dibaca sebagai `true/false` di JavaScript. Membandingkannya secara langsung dengan `1` atau `0` menggunakan `===` akan selalu menghasilkan `false`.
    *   *Wajib menggunakan casting:* `if (Number($sb_1.run_stop) === 1)` atau `if (Number($sb_1.status_selesai) === 0)`.
4.  **Deklarasi Variabel Eksplisit (`var`):**
    *   Haiwell SCADA menggunakan JavaScript *strict mode*. Semua variabel bantu lokal wajib dideklarasikan secara eksplisit menggunakan kata kunci `var` (contoh: `var scale_up_1 = 0;`). Jika tidak, kompilasi akan gagal dengan error `[variable] is not defined`.
5.  **Manajemen Versi Berkas Skrip (No Overwrite):**
    *   Jangan menimpa skrip versi lama. Selalu simpan perubahan dengan menduplikasi dan menambahkan penomoran versi berurutan di akhir nama file (misal: `master_loop_scada_v15.js`).
6.  **Format Integrasi Berkas (.txt atau .js):**
    *   Hindari mengimpor skrip panjang menggunakan ekstensi `.hwExport` karena memakan waktu lama di editor HMI. Gunakan format `.txt` or `.js` agar operator dapat langsung menyalin-tempel (*copy-paste*) kode secara instan.

---

## 3. Desain Jembatan Enkripsi LAN Node.js

Sistem WebAPI lokal milik Haiwell PC Runtime secara ketat mewajibkan enkripsi **AES-128-CBC** untuk semua data transaksi lokal LAN. Untuk menghubungkan SCADA lokal (OT) ke server cloud monitoring Laravel (IT), kita meletakkan aplikasi **Bridge Node.js** di `localhost:3000` sebagai perantara.

### Kunci Enkripsi & IV Bawaan:
*   **Algoritma:** AES-128-CBC
*   **Initialization Vector (IV) Default Haiwell:** `"abc1234567890efg"` (16 karakter / 128-bit).
*   **Private Key (webapiKey):** `1705119a5c2ec5e3` (didapat dari konfigurasi HMI SCADA).
*   **Machine Code:** `5751428633031624442` (didapat dari PC Runtime).

---

## 4. Desain Global Trigger Log & Buffer Data

Untuk mencatat riwayat produksi dari 30 unit Steambox menggunakan **satu endpoint WebAPI** dan **satu Data Group** saja di HMI:

1.  **Shared Buffer (`data_group_master`):**
    Sebuah group variabel internal di HMI bernama `data_group_master` bertindak sebagai buffer penampung data sementara untuk unit yang baru saja selesai.
2.  **Global Trigger (`Sys_Control.trigger_log`):**
    *   Sebuah variabel global tipe `BOOL` bernama `Sys_Control.trigger_log` digunakan sebagai pemicu (Trigger Record) pada Data Group `Log_Steambox` di HMI (dengan kondisi trigger: **`OFF -> ON`**).
    *   Ketika unit `i` selesai memasak, Master Loop akan:
        1. Menyalin seluruh parameter proses unit `i` ke `data_group_master`.
        2. Mengubah `$Sys_Control.trigger_log = true;` untuk memicu penyimpanan data group dan push WebAPI ke Node.js.
    *   Pada putaran detik berikutnya (tick berikutnya), Master Loop secara otomatis mematikan trigger kembali ke `false`:
        ```javascript
        if ($Sys_Control.trigger_log) {
            $Sys_Control.trigger_log = false;
        }
        ```

---

## 5. Bug Sinkronisasi 1 Detik & Solusi Variabel Lokal

### Gejala Masalah:
Saat melakukan transfer data pada detik penyelesaian, data waktu aktual yang terkirim ke JSON adalah `59 detik`, padahal target masak adalah `1 menit` (60 detik) dan tampilan HMI sudah tepat menunjukkan `01:00`.

### Penyebab (Race Condition):
HMI SCADA mengantre proses komitmen data ke database tag (*buffered write*). Ketika perintah `$sb_1.status_selesai = true` dijalankan, Event Script langsung terpicu seketika untuk menyalin data. Namun, memori HMI belum sempat menuliskan nilai final `"00:01:00"` ke tag `$sb_1.durasi_aktual_up` (masih bernilai `"00:00:59"`), sehingga nilai lama yang belum sinkron ikut ter-copy ke database master.

### Solusi Permanen di `v15`:
Kita memotong dependensi pembacaan tag dengan menggunakan **Variabel Lokal**. Nilai final dihitung dan disimpan dalam variabel lokal JavaScript terlebih dahulu, kemudian langsung ditulis serentak ke tag unit dan tag buffer:
```javascript
var finalDurasiUpStr = formatTime(((target_menit + perubahan_waktu) * 60));
$sb_1.durasi_aktual_up = finalDurasiUpStr;
$data_group_master.durasi_aktual = finalDurasiUpStr; // Ditulis langsung dari variabel lokal, 100% sinkron
```

---

## 6. Panduan Migrasi ke PC Server Pabrik (Windows Service PM2)

Ikuti langkah-langkah di bawah ini untuk memindahkan aplikasi jembatan Node.js ke PC Server Pabrik agar berjalan otomatis saat mati listrik / restart:

### Langkah 1: Pengaturan Awal di PC Server Pabrik
1.  Salin seluruh folder proyek `Demo2_hp_SB16` ke drive PC Server Pabrik (misal: `D:\Project\PTSIAP\Haiwell\Runtime\Demo2_hp_SB16`).
2.  Buka proyek tersebut di Haiwell editor pada PC Server.
3.  Buka menu **Data reporting server** -> pilih **WEB API** -> klik Edit:
    *   Catat **Machine Code** baru yang tertera (unik per komputer).
    *   Catat/buat **Private Key** baru.
4.  Buka menu **Data group** -> pilih **Log_Steambox** -> klik Edit:
    *   Isi kolom **`API subpath`** dengan: `/api/push-receiver`
5.  Kembali ke menu edit **WEB API** di Data reporting server:
    *   Isi kolom **`API main path`** dengan alamat Node.js lokal: `http://127.0.0.1:3000`

### Langkah 2: Konfigurasi `config.json` Node.js
1.  Buka folder `D:\Project\PTSIAP\Haiwell\Runtime\Demo2_hp_SB16\nodejs`.
2.  Klik kanan file **`config.json`** -> pilih **Open With** -> **Notepad**.
3.  Perbarui nilai `machineCode` dan `webapiKey` sesuai kode baru yang dicatat pada Langkah 1:
    ```json
    {
      "scadaHost": "http://127.0.0.1:8888",
      "machineCode": "MASUKKAN_MACHINE_CODE_BARU_DI_SINI",
      "webapiKey": "MASUKKAN_PRIVATE_KEY_BARU_DI_SINI",
      "iv": "abc1234567890efg",
      "port": 3000
    }
    ```
4.  Simpan dan tutup file Notepad.

### Langkah 3: Setup Auto Startup sebagai Windows Service
Agar Node.js otomatis berjalan di background saat PC menyala tanpa harus ada user yang login:
1.  Buka Command Prompt (CMD) Windows sebagai **Administrator**.
2.  Ketik perintah berikut untuk menginstal paket startup PM2 global:
    ```bash
    npm install -g pm2-windows-startup
    ```
3.  Aktifkan integrasi Windows Service:
    ```bash
    pm2-startup install
    ```
4.  Masuk ke folder `nodejs` proyek Anda di CMD:
    ```bash
    cd /d D:\Project\PTSIAP\Haiwell\Runtime\Demo2_hp_SB16\nodejs
    ```
5.  Daftarkan dan jalankan server jembatan Node.js ke PM2:
    ```bash
    pm2 start engine.js --name "haiwell-engine"
    ```
6.  Simpan konfigurasi proses agar dijalankan kembali saat PC restart / pulih dari mati listrik:
    ```bash
    pm2 save
    ```

---

## 7. Protokol Integrasi Laravel IT & Contoh Payload JSON

Berikut adalah panduan bagi tim IT Laravel untuk memetakan database dan endpoint API mereka:

### Metode HTTP & URL Endpoint:
*   **Method:** `POST`
*   **Contoh Payload JSON Bersih (Terkirim dari Node.js ke Laravel):**
    ```json
    {
      "DataArray": [
        {
          "_terminalTime": "2026-07-17 01:21:21.080",
          "_groupTag": "logProduksi",
          "no_steambox": "1",
          "kode": "sbmk",
          "nama": "surya",
          "versi": "1",
          "batch": "1",
          "warna": "kuning",
          "qty": "135",
          "trolly": "rapat",
          "durasi": "1",
          "mulai": "01:20:06",
          "durasi_pemanasan": "00:00:15",
          "jam_masak": "01:20:22",
          "durasi_aktual": "00:01:00",
          "jam_selesai": "01:21:21",
          "perubahan_waktu": "0",
          "suhu_awal": "990",
          "suhu_akhir": "1062",
          "status": "SUCCESS"
        }
      ],
      "Count": 1
    }
    ```

### Yang Harus Diminta dari Tim IT Laravel:
1.  **URL API Endpoint:** (Contoh: `https://sigap.suryagroup.app/api/receive-log`).
2.  **API Authorization Header/Token (Jika Ada):** Token pengaman (seperti Bearer Token) untuk otentikasi.
    *URL ini nantinya dimasukkan ke dalam config Node.js untuk mem-forward log produksi.*
