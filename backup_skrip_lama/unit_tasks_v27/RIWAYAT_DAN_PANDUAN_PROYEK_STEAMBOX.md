# DOKUMEN ARSIP MASTER & RIWAYAT PENGEMBANGAN STEAMBOX SCADA 30 UNIT

**Proyek:** PT. SIAP - System Control & Monitoring Outdoor Steambox (30 Unit)  
**Tanggal Arsip Master:** 22 Juli 2026  
**Platform SCADA:** Haiwell Cloud SCADA PC Runtime v3  
**Status Produksi:** **VERSI v38 - DYNAMIC RECIPE SYNC & SAFE MEMORY ENGINE (LULUS UJI HARDWARE PHYSICAL)**  
**Target Komponen Utama:** Web Box Display Component di HMI Page 5 SCADA Runtime  
**URL Fixed Path Web Box Display:** `http://127.0.0.1:8888/project/dashboard.html`  
**URL Akses Remote Wi-Fi (HP / Laptop):** `http://192.168.20.23:8888/project/dashboard.html`

---

## 1. RANGKUMAN RIWAYAT LENGKAP & MILESTONE PENGEMBANGAN

### Milestone 1: Latar Belakang & Visi Utama
- **Masalah:** Antarmuka (UI) native bawaan Haiwell SCADA terlampau kaku (*rigid*).
- **Visi Solusi:** Memanfaatkan komponen **Web Box Display** pada Page 5 HMI SCADA PC Runtime untuk memuat UI modern kustom (`dashboard.html`), yang menyajikan dashboard responsif 30 unit Steambox, kartu indikator warna, status banner otomatis, dan Recipe Browser popup.

### Milestone 2: Dual Engine Variable Resolver (`dashboard.js`)
- Menggabungkan 2 jalur akses memori:
  1. **Mode PC Runtime Web Box Display:** Membaca `window.parent.variables` langsung dari memori RAM PC C++/Qt Runtime (Delay 0ms, data langsung bergerak).
  2. **Mode Remote Wi-Fi HP Android:** Menggunakan Socket.io listening event `return var to browser` & handshake `conn`.

### Milestone 3: Pengujian Fisik Hardware #1 (`test1.mp4`)
- **Hasil:**
  - Angka suhu aktual pada termometer hardware digital (104.3°C / 105.2°C) 100% presisi & bergerak serentak dengan UI Web Box Display!
  - Tombol **START (RUN)** / **STOP**, **MODE PREHEAT / COOKING**, dan **RESET** berfungsi 100% akurat mengontrol PLC.
  - Status banner berubah warna hijau terang **`SEDANG MEMASAK (MENDIDIH)`** & timer counter berjalan presisi.

### Milestone 4: Diagnosa Bug Memori v36 & Solusi Read-Only
- **Masalah v35:** Direct object property mutation (`tagObj.Value = rawVal`) sempat merusak tabel binding C++ SCADA di RAM.
- **Solusi v36:** Membaca memori secara murni **READ-ONLY**, dan mengeksekusi penulisan perintah tombol **HANYA melalui fungsi resmi Haiwell SCADA**:
  `window.parent.Variable.SetById(tagId, rawVal);`
  `window.parent.Variable.SetValue(tagName, rawVal);`

### Milestone 5: Pengujian Fisik Hardware #2 (`test2.mp4`) & Penyempurnaan v38
- **Solusi Popup Native:** Menghapus panggilan `Window.PopSubByNo(120)` agar setelah impor resep selesai, popup native Haiwell tidak lagi muncul rangkap.
- **Dynamic SCADA Recipe Scanner:** Menggantikan data resep dummy awal dengan pemindai dinamis (`renderMasterRecipeList`) yang membaca resep asli dari Haiwell (`sbmk`, `sbmp`, `ghj`), serta mendukung penyimpanan resep kustom baru oleh operator ke `localStorage`.
- **String Trolly Input:** Mengubah input dropdown Tipe Trolly menjadi kolom isian bebas (`<input type="text">`) agar operator bebas mengetik teks kustom (misal: `rapat`, `longgar`, `1`, dll.).

---

## 2. PEMETAAN TAG FISIK & ID COMPILED SCADA (30 UNIT STEAMBOX)

Berdasarkan hasil kompilasi fisik SCADA (`hasil_compile_unit_1.txt` & `hasil_compile_master.txt`):

| Komponen Perintah UI | Register SCADA Fisik | ID Tag Compiled (Unit 1) | Perilaku & Nilai Parameter |
| :--- | :--- | :--- | :--- |
| **START (RUN) / STOP** | `$sb1.runstop` / `$sb1.run_stop` | **ID `627`** | **`0`** = **RUN** (Proses Berjalan)<br>**`1`** = **STOP** (Proses Berhenti/Paused) |
| **MODE PREHEAT / COOKING** | `$sb_1_mode_preheat` / `$sb_1.mode_preheat` | **ID `1198`** | **`1`** (true) = **PREHEAT** (Pemanasan Tangki)<br>**`0`** (false) = **COOKING** (Pemasakan Produk) |
| **RESET** | `$sb_1.reset` | **ID `1196`** | Pulse Momentary **`1`** (true) -> Reset timer & status unit |
| **TRANSFER RESEP** | `$sb_1.trf_resep` | **ID `1205`** | Pulse Momentary **`1`** -> Mentrigger transfer resep ke unit |
| **PILIH UNIT RESEP** | `$recipe.pilih_steambox` | **ID `1203`** | `1` s.d. `30` (ID Unit Steambox yang dipilih) |
| **TAG RESEP DETIL** | `$recipe_kode.1`, `$recipe_nama.1`, `$recipe_versi.1`, `$recipe_warna.1`, `$recipe_qty.1`, `$recipe_trolly.1`, `$recipe_batch.1`, `$sb_1.target_menit` | Notasi Dot Statis | Menyimpan nilai detil resep terpasang per unit |
| **STATUS BANNER** | `$sb_1.status_banner` | **ID `1210`** | String status hasil evaluasi State Machine SCADA Script |

---

## 3. ATURAN PENGKODEAN KETAT SCADA (`AGENTS.MD`)

1. **Direct Tag Writing (`$`):** Wajib menggunakan simbol `$` langsung di SCADA scripts (`$sb_1.target_menit`).
2. **No Operator Gabungan:** Dilarang `$tag += 1` atau `$tag--`. Wajib `$tag = $tag + 1`.
3. **Strict Mode Casting:** Perbandingan boolean HMI wajib di-cast menggunakan `Number()` (contoh: `if (Number($sb1.run_stop) === 0)`).
4. **Explicit `var` Declaration:** Semua variabel pembantu wajib dideklarasikan dengan kata kunci `var` (`var scale_up_1 = 0;`).
5. **No Overwrite Policy & Versioning:** Setiap perbaikan disimpan berurutan di `backup_skrip_lama\unit_tasks_v27\`.
6. **No `.hwExport` Format:** Seluruh file integrasi berformat mentah `.txt` / `.js` / `.html` / `.css`.

---

## 4. PANDUAN PENAMBAHAN 30 UNIT & MIGRASI PC SERVER PABRIK

### A. Penambahan Unit Bertahap (1 s.d. 30 Unit):
- **0% Coding Needed!** File `dashboard.html` & `dashboard.js` v38 **SUDAH MEMILIKI STRUKTUR DYNAMIC 30 UNIT**.
- Unit yang belum dipasang di pabrik akan otomatis berstatus **`UNIT TIDAK DIPAKAI`** (Tampilan rapi).
- Saat Unit 3, 4, dst. dipasang & di-binding di Haiwell SCADA, UI Web Box Display **akan otomatis aktif dan sinkron sendiri tanpa mengedit kode!**

### B. Migrasi ke PC Server Produksi:
1. Salin 3 file utama (`dashboard.html`, `dashboard.js`, `dashboard.css`) dari folder `nodejs\public\` ke:  
   📁 `C:\Program Files (x86)\Haiwell\HaiwellScada3\Resources\app\webserver\public\project\`
2. Buka Haiwell SCADA Editor Page 5, set properti Web Box Display **Fixed Path**:  
   👉 `http://127.0.0.1:8888/project/dashboard.html`
3. Restart SCADA Runtime -> Sistem langsung 100% aktif & berproduksi!

---

*Dokumen Arsip Master ini disusun & diperbarui secara permanen oleh Antigravity AI Assistant.*
