"""
Fix bug: tampil_jam_selesai count-up saat proses selesai (sisa=0)
Diterapkan ke SEMUA unit SB1-SB30 di blok STOPPED (run_stop===1)
Aturan: hanya fix baris di blok STOPPED (indented 24 spasi), bukan di RUNNING (indented 28 spasi)

Pola bug (di blok STOPPED):
    if ($sb_N.flag_init_masak === 1) {
        $sb_N.tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, activeSisa_N);
    }

Fix:
    if ($sb_N.flag_init_masak === 1 && activeSisa_N > 0) { // [v17 FIX] Guard: cegah count-up jam_selesai saat sisa=0
        $sb_N.tampil_jam_selesai = getEstimasiSelesai(totalDetikSekarang, activeSisa_N);
    }

Baris target (STOPPED block, 24 spasi indent):
  SB1:  179
  SB2:  460  <- sudah difix sebelumnya
  SB3:  741
  SB4:  1022
  SB5:  1303
  SB6:  1584
  SB7:  1865
  SB8:  2146
  SB9:  2427
  SB10: 2708
  SB11: 2989
  SB12: 3270
  SB13: 3551
  SB14: 3832
  SB15: 4113
  SB16: 4394
  SB17: 4675
  SB18: 4956
  SB19: 5237
  SB20: 5518
  SB21: 5799
  SB22: 6080
  SB23: 6361
  SB24: 6642
  SB25: 6923
  SB26: 7204
  SB27: 7485
  SB28: 7766
  SB29: 8047
  SB30: 8328
"""

import re
import sys

# Baris target (1-based) yang ada di blok STOPPED - semua kecuali SB2 (460) yang sudah fix
# SB2 sudah fix di line 460
STOPPED_BUG_LINES_1BASED = [
    179,   # SB1
    # 460 - SB2 sudah difix
    741,   # SB3
    1022,  # SB4
    1303,  # SB5
    1584,  # SB6
    1865,  # SB7
    2146,  # SB8
    2427,  # SB9
    2708,  # SB10
    2989,  # SB11
    3270,  # SB12
    3551,  # SB13
    3832,  # SB14
    4113,  # SB15
    4394,  # SB16
    4675,  # SB17
    4956,  # SB18
    5237,  # SB19
    5518,  # SB20
    5799,  # SB21
    6080,  # SB22
    6361,  # SB23
    6642,  # SB24
    6923,  # SB25
    7204,  # SB26
    7485,  # SB27
    7766,  # SB28
    8047,  # SB29
    8328,  # SB30
]

INFILE  = r"backup_skrip_lama\master_loop_scada_v17.js"
OUTFILE = r"backup_skrip_lama\master_loop_scada_v17.js"

with open(INFILE, 'r', encoding='utf-16-le') as f:
    lines = f.readlines()

total_lines = len(lines)
fixed_count = 0
skipped = []

for lineno in STOPPED_BUG_LINES_1BASED:
    idx = lineno - 1  # convert to 0-based
    if idx >= total_lines:
        print(f"[SKIP] Line {lineno} melebihi panjang file ({total_lines})")
        skipped.append(lineno)
        continue

    line = lines[idx]

    # Pattern: flag_init_masak === 1) { tanpa guard activeSisa
    # Match: "if ($sb_N.flag_init_masak === 1) {"
    # Pastikan BELUM ada guard activeSisa
    if 'flag_init_masak === 1)' in line and 'activeSisa' not in line:
        # Extract unit number dari tag name
        m = re.search(r'\$sb_(\d+)\.flag_init_masak', line)
        if m:
            unit = m.group(1)
            old_cond = f'flag_init_masak === 1) {{'
            new_cond = f'flag_init_masak === 1 && activeSisa_{unit} > 0) {{ // [v17 FIX] Guard: cegah count-up jam_selesai saat sisa=0'
            lines[idx] = line.replace(old_cond, new_cond)
            print(f"[FIXED] Line {lineno} (SB{unit}): guard activeSisa_{unit} > 0 ditambahkan")
            fixed_count += 1
        else:
            print(f"[WARN]  Line {lineno}: pattern ditemukan tapi unit number tidak bisa diekstrak")
            skipped.append(lineno)
    elif 'flag_init_masak === 1' in line and 'activeSisa' in line:
        print(f"[SKIP]  Line {lineno}: sudah ada guard activeSisa (tidak perlu difix)")
    else:
        print(f"[WARN]  Line {lineno}: konten tidak sesuai ekspektasi: {line.rstrip()}")
        skipped.append(lineno)

# Tulis kembali ke file
with open(OUTFILE, 'w', encoding='utf-16-le') as f:
    f.writelines(lines)

print(f"\n{'='*60}")
print(f"SELESAI: {fixed_count} baris difix dari {len(STOPPED_BUG_LINES_1BASED)} target")
if skipped:
    print(f"SKIP/WARN: {len(skipped)} baris - {skipped}")
print(f"Output: {OUTFILE}")
