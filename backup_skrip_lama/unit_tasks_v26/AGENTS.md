# Source of Truth: Aturan Pengkodean JavaScript Haiwell Cloud SCADA

Dokumen ini adalah acuan utama dan aturan ketat (*behavioral rules*) untuk pengembangan dan penyuntingan skrip JavaScript di lingkungan Haiwell Cloud SCADA PC Runtime pada proyek ini. **Semua AI Agent wajib mematuhi aturan ini tanpa pengecualian.**

---

## 1. Aturan Emas: Penulisan Tag Langsung (Direct Tag Writing)

*   **ATURAN UTAMA:** **Selalu gunakan penulisan tag langsung menggunakan simbol `$`** (misalnya `$sb_1.target_menit`, `$Sys_Control.txt_status_kosong`) untuk semua interaksi baca/tulis variabel.
*   **LARANGAN:** Jangan menggunakan fungsi dinamis `Variable.GetValue("tag_name")` atau `Variable.SetValue("tag_name", value)` kecuali untuk variabel resep bertanda desimal/titik (seperti `recipe_kode.1`) yang tidak dapat diproses preprosesor JavaScript biasa.
*   **ALASAN:** Haiwell SCADA memindai simbol `$` saat fase kompilasi untuk mengikat (*binding*) alamat variabel secara fisik. Penggunaan string dinamis menyebabkan tag tidak terikat (*unbound*) di runtime, sehingga nilainya blank/kosong.

---

## 2. Pembatasan Operasi Matematika Tag HMI (`$`)

*   **ATURAN UTAMA:** **Jangan pernah gunakan operator penugasan gabungan (`+=`, `-=`) atau increment/decrement (`++`, `--`) langsung pada variabel berawalan `$`.**
*   **ALASAN:** Preprosesor Haiwell menerjemahkan `$tag` menjadi fungsi `Variable.GetById(ID)`. Menulis `$tag += 1` akan diterjemahkan menjadi `Variable.GetById(ID) += 1` yang merupakan *SyntaxError* di JavaScript (Bad assignment).
*   **CONTOH PENULISAN YANG BENAR:**
    *   *Salah:* `$sb_1.total_detik_pemanasan += 1;`
    *   *Benar:* `$sb_1.total_detik_pemanasan = $sb_1.total_detik_pemanasan + 1;`
    *   *Salah:* `$sb_1.sisa_detik_masak -= 1;`
    *   *Benar:* `$sb_1.sisa_detik_masak = $sb_1.sisa_detik_masak - 1;`

---

## 3. Penulisan Variabel Kelompok Resep (`recipe_kode.X`)

*   **ATURAN UTAMA:** Kelompok tag resep dinamis yang memiliki tanda titik diikuti nomor unit (seperti `$recipe_kode.1`, `$recipe_nama.29`) **wajib ditulis secara langsung menggunakan notasi dot statis dengan simbol `$`** (misalnya: `$recipe_kode.1 = $recipe.kode;`).
*   **LARANGAN:** Jangan menggunakan fungsi `Variable.SetValue("recipe_kode.1", ...)` karena tidak terikat (unbound) secara fisik dan menyebabkan kegagalan transfer data resep.
*   **ALASAN:** Preprosesor Haiwell SCADA memproses simbol `$` dan seluruh nama tag (termasuk titik dan nomor unit seperti `$recipe_kode.1`) sebelum kode JavaScript dikompilasi oleh parser standar. Oleh karena itu, notasi dot langsung ini 100% didukung, berhasil dikompilasi, dan terbukti sukses melakukan transfer data resep secara fisik.


---

## 4. Filosofi Poka-Yoke & Integrasi Status Banner

Seluruh skrip harus mendukung panduan operasional Poka-Yoke untuk operator pabrik melalui status banner kustom. Status banner harus selalu merujuk pada variabel `$Sys_Control` agar dapat diedit dari layar HMI, dengan fallback string default di skrip:

1.  **Standby / Kosong:** `$Sys_Control.txt_status_kosong || "STEAMBOX KOSONG"`
2.  **Siap Pre-heat:** `$Sys_Control.txt_siap_preheat || "SIAP PEMANASAN - SILAKAN TEKAN START"`
3.  **Sedang Pre-heat:** `$Sys_Control.txt_status_preheat || "SEDANG PEMANASAN"`
4.  **Pre-heat Selesai:** `$Sys_Control.txt_selesai_preheat || "PEMANASAN SELESAI - STEAMBOX SIAP UNTUK PEMASAKAN"`
5.  **Resep Terpasang (Siap Cooking):** `$Sys_Control.txt_siap_cooking || "RESEP TERPASANG - SILAKAN TEKAN START"`
6.  **Sedang Memasak:** `$Sys_Control.txt_status_pemasakan || "SEDANG MEMASAK (MENDIDIH)"`
7.  **Selesai Memasak:** `$Sys_Control.txt_status_selesai || "PROSES SELESAI - SILAKAN KOSONGKAN TANGKI"`

---

## 5. Perbandingan Ketat Tipe Data HMI (`===`)

*   **ATURAN UTAMA:** Untuk semua variabel HMI tipe Boolean (`BOOL` seperti `run_stop` atau `_commStatus`) yang dibandingkan secara strict (`===`) dengan `1` atau `0`, **wajib di-cast menggunakan fungsi `Number()`** (misalnya `Number($sb1.run_stop) === 1`).
*   **LARANGAN PENGGUNAAN `==`:** Compiler/linter SCADA melarang keras operator perbandingan longgar `==` untuk nilai `0` atau `1`. Perbandingan seperti `run_stop == 0` akan menghasilkan error `Use '===' to compare with '0'`.
*   **ALASAN:** Nilai boolean HMI dibaca sebagai `true`/`false` di JavaScript. Membandingkannya secara langsung menggunakan `$tag === 1` atau `$tag === 0` akan selalu menghasilkan `false` karena perbedaan tipe data (Boolean vs Number).
*   **CONTOH PENULISAN YANG BENAR:**
    *   *Salah:* `if ($sb1.run_stop === 1)`
    *   *Benar:* `if (Number($sb1.run_stop) === 1)`
    *   *Salah:* `if ($sb1.run_stop === 0)`
    *   *Benar:* `if (Number($sb1.run_stop) === 0)`
    *   *Salah:* `if ($sb1.run_stop == 0)`

---

## 6. Deklarasi Variabel Eksplisit (`var`)

*   **ATURAN UTAMA:** Semua variabel baru wajib dideklarasikan secara eksplisit menggunakan kata kunci **`var`**. Jangan pernah melakukan deklarasi implisit (misalnya `scale_up_1 = ...` tanpa deklarasi `var` terlebih dahulu).
*   **KHUSUS VARIABEL BANTU (`scale_up_X`):** Semua variabel pembantu kalkulasi (seperti `scale_up_1` s.d. `scale_up_30`) wajib dideklarasikan secara eksplisit dengan `var` di awal cakupan blok unit sebelum digunakan dalam ekspresi atau penugasan (contoh: `var scale_up_1 = 0;`).
*   **ALASAN:** Compiler Haiwell SCADA menerapkan JavaScript mode ketat (*strict mode*). Penggunaan variabel tanpa deklarasi kata kunci `var` akan menyebabkan kegagalan kompilasi dengan pesan error `[variable] is not defined`.

---

## 7. Manajemen Versi Berkas Skrip (No Overwrite)

*   **ATURAN UTAMA:** Ketika terjadi perbaikan bug, penyesuaian logika, atau perubahan fitur baru pada skrip, **AI Agent dilarang keras menimpa (overwrite) berkas skrip versi sebelumnya yang sudah ada.**
*   **PROSEDUR:** AI Agent wajib menduplikasi berkas tersebut dan menyimpannya sebagai berkas baru dengan penambahan versi di akhir nama berkas secara urut (misalnya: `Trf_Resep_v2.txt`, `Trf_Resep_v3.txt`, dst.).
*   **TUJUAN:** Menjaga keutuhan riwayat kerja (*version control*) agar operator HMI dapat membandingkan berkas atau memilih versi yang stabil jika terjadi kendala integrasi baru.

---

## 8. Format Berkas Skrip untuk Integrasi (No .hwExport)

*   **ATURAN UTAMA:** AI Agent hanya diperbolehkan membuat berkas baru dalam format teks mentah (**`.txt`** atau **`.js`**). **Dilarang keras membuat atau memperbarui berkas berkekstensi `.hwExport`.**
*   **ALASAN:** Proses impor berkas `.hwExport` yang berisi naskah sangat panjang (seperti master loop yang mencapai ~7000 baris) membutuhkan waktu pemrosesan yang sangat lama di editor SCADA Haiwell. Menggunakan format `.txt` atau `.js` memungkinkan operator melakukan salin-tempel (*copy-paste*) kode secara instan dan cepat.



