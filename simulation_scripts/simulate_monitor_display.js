// Simulation of the HMI Outdoor Display: Top 5 Steamboxes Finishing Soon

// Mock Database
var SCADA_Database = {
    // Registered Monitor Tags
    "Sys_Control.monitor_room_1": "", "Sys_Control.monitor_sisa_1": "", "Sys_Control.monitor_selesai_1": "",
    "Sys_Control.monitor_room_2": "", "Sys_Control.monitor_sisa_2": "", "Sys_Control.monitor_selesai_2": "",
    "Sys_Control.monitor_room_3": "", "Sys_Control.monitor_sisa_3": "", "Sys_Control.monitor_selesai_3": "",
    "Sys_Control.monitor_room_4": "", "Sys_Control.monitor_sisa_4": "", "Sys_Control.monitor_selesai_4": "",
    "Sys_Control.monitor_room_5": "", "Sys_Control.monitor_sisa_5": "", "Sys_Control.monitor_selesai_5": "",

    // Steambox 1 - Cooking, 45 seconds left
    "SB1._commOperation": true, "SB1._commStatus": true, "SB1.runStop": false,
    "SB_1.targetMenit": 10, "SB_1.sisaDetikMasak": 45, "SB_1.statusPemasakan": true,
    "SB_1.tampilDurasiAktual": "00:00:45", "SB_1.tampilJamsSelesai": "11:47:20",

    // Steambox 5 - Cooking, 15 seconds left (Finishing first!)
    "SB5._commOperation": true, "SB5._commStatus": true, "SB5.runStop": false,
    "SB_5.targetMenit": 5, "SB_5.sisaDetikMasak": 15, "SB_5.statusPemasakan": true,
    "SB_5.tampilDurasiAktual": "00:00:15", "SB_5.tampilJamsSelesai": "11:46:50",

    // Steambox 12 - Preheat mode (Should NOT be in cooking list)
    "SB12._commOperation": true, "SB12._commStatus": true, "SB12.runStop": false,
    "SB_12.targetMenit": 0, "SB_12.sisaDetikMasak": 0, "SB_12.statusPemasakan": false, // preheat

    // Steambox 16 - Cooking, 300 seconds left
    "SB16._commOperation": true, "SB16._commStatus": true, "SB16.runStop": false,
    "SB_16.targetMenit": 15, "SB_16.sisaDetikMasak": 300, "SB_16.statusPemasakan": true,
    "SB_16.tampilDurasiAktual": "00:05:00", "SB_16.tampilJamsSelesai": "11:51:35",

    // Steambox 22 - Offline (Should NOT be in list)
    "SB22._commOperation": true, "SB22._commStatus": false, "SB22.runStop": false,
    "SB_22.targetMenit": 10, "SB_22.sisaDetikMasak": 120, "SB_22.statusPemasakan": false,

    // Steambox 29 - Cooking, 90 seconds left
    "SB29._commOperation": true, "SB29._commStatus": true, "SB29.runStop": false,
    "SB_29.targetMenit": 10, "SB_29.sisaDetikMasak": 90, "SB_29.statusPemasakan": true,
    "SB_29.tampilDurasiAktual": "00:01:30", "SB_29.tampilJamsSelesai": "11:48:05",

    // Steambox 30 - Cooking, 180 seconds left
    "SB30._commOperation": true, "SB30._commStatus": true, "SB30.runStop": false,
    "SB_30.targetMenit": 10, "SB_30.sisaDetikMasak": 180, "SB_30.statusPemasakan": true,
    "SB_30.tampilDurasiAktual": "00:03:00", "SB_30.tampilJamsSelesai": "11:49:35"
};

function ReadTag(tagName) {
    if (SCADA_Database.hasOwnProperty(tagName)) return SCADA_Database[tagName];
    throw new Error("Tag not found: " + tagName);
}

function WriteTag(tagName, value) {
    if (SCADA_Database.hasOwnProperty(tagName)) {
        SCADA_Database[tagName] = value;
        return;
    }
    throw new Error("Tag not found: " + tagName);
}

// Logic to sort and display Top 5 soon-to-finish rooms
function updateOutdoorDisplay() {
    var activeUnits = [1, 5, 12, 16, 22, 29, 30]; // All registered units
    var runningRooms = [];

    // 1. Kumpulkan semua unit yang sedang memasak (statusPemasakan === true)
    for (var k = 0; k < activeUnits.length; k++) {
        var i = activeUnits[k];
        var deviceName = "SB" + i;
        var hmiGroupName = "SB_" + i;

        var commOperation = ReadTag(deviceName + "._commOperation");
        if (commOperation === true) {
            var commStatus = ReadTag(deviceName + "._commStatus");
            if (commStatus === true) {
                var isPemasakan = ReadTag(hmiGroupName + ".statusPemasakan") || false;
                var sisaDetik = ReadTag(hmiGroupName + ".sisaDetikMasak") || 0;

                // Hanya masukkan unit yang statusnya sedang MEMASAK dan sisa waktu > 0
                if (isPemasakan === true && sisaDetik > 0) {
                    runningRooms.push({
                        name: "Steambox " + i,
                        sisa: sisaDetik,
                        tampilSisa: ReadTag(hmiGroupName + ".tampilDurasiAktual"),
                        tampilSelesai: ReadTag(hmiGroupName + ".tampilJamsSelesai")
                    });
                }
            }
        }
    }

    // 2. Sortir array berdasarkan sisaDetik ASC (terkecil/paling cepat selesai berada paling atas)
    runningRooms.sort(function(a, b) {
        return a.sisa - b.sisa;
    });

    // 3. Tulis data 5 teratas ke monitor luar ruangan
    for (var r = 1; r <= 5; r++) {
        if (r - 1 < runningRooms.length) {
            var room = runningRooms[r - 1];
            WriteTag("Sys_Control.monitor_room_" + r, room.name);
            WriteTag("Sys_Control.monitor_sisa_" + r, room.tampilSisa);
            WriteTag("Sys_Control.monitor_selesai_" + r, room.tampilSelesai);
        } else {
            // Jika unit memasak kurang dari 5, kosongkan sisanya
            WriteTag("Sys_Control.monitor_room_" + r, "--");
            WriteTag("Sys_Control.monitor_sisa_" + r, "--:--:--");
            WriteTag("Sys_Control.monitor_selesai_" + r, "--:--:--");
        }
    }
}

// Jalankan logika sorting
updateOutdoorDisplay();

// Tampilkan hasil di terminal
console.log("=== TOP 5 STEAMBOX AKAN SEGERA SELESAI ===");
for (var r = 1; r <= 5; r++) {
    console.log("Rank " + r + " -> " + 
        ReadTag("Sys_Control.monitor_room_" + r) + " | Sisa: " +
        ReadTag("Sys_Control.monitor_sisa_" + r) + " | Estimasi Selesai: " +
        ReadTag("Sys_Control.monitor_selesai_" + r)
    );
}
