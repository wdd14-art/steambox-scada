const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.text()); // To handle raw encrypted text bodies if sent

// Serve static HTML/JS files from public folder (e.g. custom Recipe Browser)
app.use(express.static(path.join(__dirname, "public")));

// Load Configuration
const configPath = path.join(__dirname, "config.json");
let config = {
  scadaHost: "http://127.0.0.1:8888",
  machineCode: "5751428633031624442",
  webapiKey: "1705119a5c2ec5e3",
  iv: "abc1234567890efg",
  port: 3000
};

if (fs.existsSync(configPath)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config = { ...config, ...fileConfig };
    console.log("Loaded configuration from config.json");
  } catch (err) {
    console.error("Error reading config.json, using default configurations:", err.message);
  }
}

// AES-128-CBC Encryption Helper
function encrypt(text, key, iv) {
  if (typeof key !== "string" || key.length !== 16) {
    throw new Error("Key must be a 16-character string.");
  }
  if (typeof iv !== "string" || iv.length !== 16) {
    throw new Error("IV must be a 16-character string.");
  }
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

// AES-128-CBC Decryption Helper
function decrypt(encryptedHex, key, iv) {
  if (typeof key !== "string" || key.length !== 16) {
    throw new Error("Key must be a 16-character string.");
  }
  if (typeof iv !== "string" || iv.length !== 16) {
    throw new Error("IV must be a 16-character string.");
  }
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Log formatting helper
function getTimestamp() {
  return new Date().toISOString();
}

// Uptime tracking
const startTime = Date.now();

// 1. Health and Status Endpoint
app.get("/status", (req, res) => {
  const maskedKey = config.webapiKey.substring(0, 3) + "****" + config.webapiKey.substring(config.webapiKey.length - 3);
  res.json({
    success: true,
    server: "Haiwell WebAPI Local Encryption Engine",
    uptime: `${Math.floor((Date.now() - startTime) / 1000)} seconds`,
    config: {
      scadaHost: config.scadaHost,
      machineCode: config.machineCode,
      webapiKeyMasked: maskedKey,
      iv: config.iv,
      port: config.port
    }
  });
});

// 2. Encryption Endpoint (Utility)
app.post("/api/encrypt", (req, res) => {
  try {
    const rawData = typeof req.body === "object" ? JSON.stringify(req.body) : req.body;
    if (!rawData) {
      return res.status(400).json({ success: false, error: "No data provided to encrypt" });
    }
    const encrypted = encrypt(rawData, config.webapiKey, config.iv);
    res.json({ success: true, encrypted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Decryption Endpoint (Utility)
app.post("/api/decrypt", (req, res) => {
  try {
    let encryptedText = "";
    if (typeof req.body === "object") {
      encryptedText = req.body.encrypted;
    } else if (typeof req.body === "string") {
      encryptedText = req.body;
    }

    if (!encryptedText) {
      return res.status(400).json({ success: false, error: "No encrypted string provided" });
    }

    const decryptedStr = decrypt(encryptedText.trim(), config.webapiKey, config.iv);
    let decryptedJSON;
    try {
      decryptedJSON = JSON.parse(decryptedStr);
    } catch {
      decryptedJSON = decryptedStr; // Fallback to raw string if it's not JSON
    }

    res.json({ success: true, decrypted: decryptedJSON });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Get SCADA device time
async function getScadaDeviceTime() {
  try {
    const response = await axios.get(`${config.scadaHost}/api/getTime`, { timeout: 3000 });
    if (response.data && response.data.result && response.data.result.data) {
      return response.data.result.data;
    }
  } catch (err) {
    console.warn(`[${getTimestamp()}] Warning: Failed to get SCADA time from device. Using local system time.`, err.message);
  }
  return Date.now();
}

// Helper: Decrypt response body if encrypted
function parseScadaResponse(responseData) {
  if (typeof responseData === "string") {
    const trimmed = responseData.trim();
    // Check if it looks like a hex string
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      try {
        const decrypted = decrypt(trimmed, config.webapiKey, config.iv);
        return JSON.parse(decrypted);
      } catch (err) {
        console.error(`[${getTimestamp()}] Error decrypting SCADA response:`, err.message);
        return { success: false, error: "Failed to decrypt response", raw: trimmed };
      }
    }
  }
  return responseData;
}

// 4. Relay tags read request to SCADA
app.post("/api/scada/read", async (req, res) => {
  const { groupTag, tags, timeout } = req.body;

  if (!groupTag || !tags) {
    return res.status(400).json({ success: false, error: "Missing groupTag or tags in request body" });
  }

  try {
    // 1. Get SCADA time (either from SCADA or fallback to server time)
    const deviceTime = await getScadaDeviceTime();

    // 2. Build parameters
    const params = {
      machineCode: config.machineCode,
      groupTag,
      tags,
      time: String(deviceTime),
      timeout: timeout || 0
    };

    // 3. Encrypt payload
    const jsonStr = JSON.stringify(params);
    const encryptedPayload = encrypt(jsonStr, config.webapiKey, config.iv);

    console.log(`[${getTimestamp()}] RELAY READ -> Target: ${config.scadaHost}/api/datagroup/getTagsValue`);
    console.log(`[${getTimestamp()}] Payload:`, JSON.stringify(params));

    // 4. Send encrypted payload to SCADA WebAPI
    const scadaRes = await axios.post(
      `${config.scadaHost}/api/datagroup/getTagsValue`,
      encryptedPayload,
      {
        headers: { "Content-Type": "text/plain" },
        timeout: 5000
      }
    );

    // 5. Parse and decrypt the response
    const finalResult = parseScadaResponse(scadaRes.data);
    res.json({ success: true, scadaResponse: finalResult });

  } catch (err) {
    console.error(`[${getTimestamp()}] Error during SCADA Read relay:`, err.message);
    res.status(500).json({
      success: false,
      error: "SCADA communication failure",
      details: err.response ? scadaRes.data : err.message
    });
  }
});

// 5. Relay tags write request to SCADA
app.post("/api/scada/write", async (req, res) => {
  const { groupTag, tags, timeout } = req.body;

  if (!groupTag || !tags) {
    return res.status(400).json({ success: false, error: "Missing groupTag or tags in request body" });
  }

  try {
    // 1. Get SCADA time
    const deviceTime = await getScadaDeviceTime();

    // 2. Build parameters
    const params = {
      machineCode: config.machineCode,
      groupTag,
      tags,
      time: String(deviceTime),
      timeout: timeout || 0
    };

    // 3. Encrypt payload
    const jsonStr = JSON.stringify(params);
    const encryptedPayload = encrypt(jsonStr, config.webapiKey, config.iv);

    console.log(`[${getTimestamp()}] RELAY WRITE -> Target: ${config.scadaHost}/api/datagroup/setTagsValue`);
    console.log(`[${getTimestamp()}] Payload:`, JSON.stringify(params));

    // 4. Send encrypted payload to SCADA WebAPI
    const scadaRes = await axios.post(
      `${config.scadaHost}/api/datagroup/setTagsValue`,
      encryptedPayload,
      {
        headers: { "Content-Type": "text/plain" },
        timeout: 5000
      }
    );

    // 5. Parse and decrypt the response
    const finalResult = parseScadaResponse(scadaRes.data);
    res.json({ success: true, scadaResponse: finalResult });

  } catch (err) {
    console.error(`[${getTimestamp()}] Error during SCADA Write relay:`, err.message);
    res.status(500).json({
      success: false,
      error: "SCADA communication failure",
      details: err.response ? scadaRes.data : err.message
    });
  }
});

// 6. Push Receiver Endpoint (Listen for SCADA active pushes)
app.post("/api/push-receiver", (req, res) => {
  try {
    let payload = req.body;
    let isEncrypted = false;

    // Check if the body is a raw encrypted hex string
    if (typeof payload === "string") {
      const trimmed = payload.trim();
      if (/^[0-9a-fA-F]+$/.test(trimmed)) {
        try {
          const decrypted = decrypt(trimmed, config.webapiKey, config.iv);
          payload = JSON.parse(decrypted);
          isEncrypted = true;
        } catch (err) {
          console.error(`[${getTimestamp()}] Push Receiver: Failed to decrypt string payload:`, err.message);
        }
      }
    }

    console.log(`[${getTimestamp()}] PUSH RECEIVED (Encrypted: ${isEncrypted}):`, JSON.stringify(payload, null, 2));

    // Return success to SCADA
    res.json({ success: true, received: true });
  } catch (err) {
    console.error(`[${getTimestamp()}] Push Receiver: Exception:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(config.port, () => {
  console.log(`=============================================================`);
  console.log(` Haiwell WebAPI Encryption Server running on port ${config.port}`);
  console.log(` Target SCADA Device: ${config.scadaHost}`);
  console.log(` Machine Code: ${config.machineCode}`);
  console.log(` Status: http://localhost:${config.port}/status`);
  console.log(`=============================================================`);
});
