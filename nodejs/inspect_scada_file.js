const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'master_loop_scada_v16_bug_sb2_jam_selesai.js');
const buf = fs.readFileSync(file);
const txt = buf.toString('utf16le');
console.log(txt.slice(0, 3000));
