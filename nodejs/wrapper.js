const axios = require("axios");

const config = {
  engineBaseUrl: "http://localhost:3000",
  readGroupTag: "Group_Process",
  writeGroupTag: "Group_Process",
  pollingIntervalMs: 500,
  timeoutMs: 5000,
  tags: ["temp", "runstop"],
  confirmWriteWithReadback: true
};

const state = {
  lastReadAt: null,
  lastWriteAt: null,
  lastValues: {},
  consecutiveErrors: 0
};

function normalizeRunstop(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (text === "false" || text === "0" || text === "run") return false;
  if (text === "true" || text === "1" || text === "stop") return true;
  return null;
}

function shouldSendStopCommand(readValues) {
  const temp = Number(readValues.temp);
  const runstop = normalizeRunstop(readValues.runstop);

  if (Number.isNaN(temp)) {
    return false;
  }
  if (runstop === null) {
    return false;
  }

  return temp > 1000 && runstop === false;
}

function buildReadPayload() {
  return {
    groupTag: config.readGroupTag,
    tags: config.tags,
    timeout: config.timeoutMs / 1000
  };
}

async function readScada() {
  const url = `${config.engineBaseUrl}/api/scada/read`;
  const payload = buildReadPayload();
  const response = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: config.timeoutMs
  });
  return response.data;
}

async function writeScada(tags) {
  const url = `${config.engineBaseUrl}/api/scada/write`;
  const response = await axios.post(url, {
    groupTag: config.writeGroupTag,
    tags,
    timeout: config.timeoutMs / 1000
  }, {
    headers: { "Content-Type": "application/json" },
    timeout: config.timeoutMs
  });
  return response.data;
}

function mapResultData(resultArray) {
  const map = {};
  if (!Array.isArray(resultArray)) return map;
  resultArray.forEach((item) => {
    if (item && typeof item.name === "string") {
      map[item.name] = item.value;
    }
  });
  return map;
}

async function doCycle() {
  try {
    const readResponse = await readScada();
    state.lastReadAt = Date.now();
    state.consecutiveErrors = 0;

    if (!readResponse.success) {
      console.error("Read failed:", readResponse);
      return;
    }

    const readData = mapResultData(readResponse.scadaResponse?.result?.data || []);
    state.lastValues = readData;

    const runstopValue = readData.runstop;
    const tempValue = readData.temp;
    console.log(`[wrapper] read temp=${tempValue} runstop=${runstopValue}`);

    if (shouldSendStopCommand(readData)) {
      console.log("[wrapper] condition met: temp > 1000 and runstop is running. Sending stop command.");
      const writeResult = await writeScada({ runstop: 1 });
      state.lastWriteAt = Date.now();
      console.log("[wrapper] write result:", writeResult);

      if (config.confirmWriteWithReadback) {
        const confirmResponse = await readScada();
        const confirmData = mapResultData(confirmResponse.scadaResponse?.result?.data || []);
        console.log("[wrapper] readback after write:", confirmData);
      }
    }
  } catch (error) {
    state.consecutiveErrors += 1;
    console.error("[wrapper] cycle error:", error.message || error);
  }
}

function startLoop() {
  console.log(`[wrapper] starting poll loop every ${config.pollingIntervalMs}ms`);
  doCycle();
  setInterval(doCycle, config.pollingIntervalMs);
}

startLoop();
