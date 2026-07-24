const crypto = require("crypto");
const axios = require("axios");

class CustomEngine {
  constructor(config = {}) {
    this.config = {
      scadaHost: "http://127.0.0.1:8888",
      machineCode: "",
      webapiKey: "",
      iv: "",
      timeout: 5000,
      ...config
    };

    this.unitState = {};
    this.productionPlan = [];
    this.pendingWrites = {};
    this.logs = [];
  }

  addLog(message, level = "info") {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    this.logs.push(entry);
    if (this.logs.length > 200) {
      this.logs.shift();
    }
    return entry;
  }

  encrypt(text) {
    if (typeof text !== "string") {
      text = JSON.stringify(text);
    }
    if (typeof this.config.webapiKey !== "string" || this.config.webapiKey.length !== 16) {
      throw new Error("webapiKey must be a 16-character string.");
    }
    if (typeof this.config.iv !== "string" || this.config.iv.length !== 16) {
      throw new Error("iv must be a 16-character string.");
    }
    const cipher = crypto.createCipheriv(
      "aes-128-cbc",
      Buffer.from(this.config.webapiKey, "utf8"),
      Buffer.from(this.config.iv, "utf8")
    );
    cipher.setAutoPadding(true);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  decrypt(encryptedHex) {
    if (typeof this.config.webapiKey !== "string" || this.config.webapiKey.length !== 16) {
      throw new Error("webapiKey must be a 16-character string.");
    }
    if (typeof this.config.iv !== "string" || this.config.iv.length !== 16) {
      throw new Error("iv must be a 16-character string.");
    }
    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      Buffer.from(this.config.webapiKey, "utf8"),
      Buffer.from(this.config.iv, "utf8")
    );
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  parseScadaResponse(responseData) {
    if (typeof responseData === "string") {
      const trimmed = responseData.trim();
      if (/^[0-9a-fA-F]+$/.test(trimmed)) {
        try {
          const decrypted = this.decrypt(trimmed);
          return JSON.parse(decrypted);
        } catch (err) {
          this.addLog(`Failed to decrypt SCADA response: ${err.message}`, "error");
          return { success: false, error: "Failed to decrypt response", raw: trimmed };
        }
      }
    }
    return responseData;
  }

  buildEncryptedBody(payload) {
    return this.encrypt(payload);
  }

  async scadaRead(groupTag, tags, timeout = this.config.timeout) {
    const payload = {
      machineCode: this.config.machineCode,
      groupTag,
      tags,
      timeout
    };
    const encrypted = this.buildEncryptedBody(payload);
    const response = await axios.post(
      `${this.config.scadaHost}/api/datagroup/getTagsValue`,
      encrypted,
      {
        headers: { "Content-Type": "text/plain" },
        timeout
      }
    );
    return this.parseScadaResponse(response.data);
  }

  async scadaWrite(groupTag, tags, timeout = this.config.timeout) {
    const payload = {
      machineCode: this.config.machineCode,
      groupTag,
      tags,
      timeout
    };
    const encrypted = this.buildEncryptedBody(payload);
    const response = await axios.post(
      `${this.config.scadaHost}/api/datagroup/setTagsValue`,
      encrypted,
      {
        headers: { "Content-Type": "text/plain" },
        timeout
      }
    );
    return this.parseScadaResponse(response.data);
  }

  _extractUnitId(tagName) {
    const match = tagName.match(/(?:sb_?|recipe_)(\d+)|\.(\d+)$/i);
    if (match) {
      return match[1] || match[2];
    }
    return null;
  }

  updateUnitState(scadaResultArray) {
    if (!Array.isArray(scadaResultArray)) {
      return;
    }

    scadaResultArray.forEach((item) => {
      if (!item || typeof item.name !== "string") {
        return;
      }
      const unitId = this._extractUnitId(item.name);
      if (!unitId) {
        return;
      }

      if (!this.unitState[unitId]) {
        this.unitState[unitId] = {
          id: unitId,
          tags: {}
        };
      }

      this.unitState[unitId].tags[item.name] = item.value;
    });

    this.lastUpdate = Date.now();
  }

  setProductionPlan(plan = []) {
    if (!Array.isArray(plan)) {
      throw new Error("Production plan must be an array.");
    }
    this.productionPlan = plan;
  }

  getUnitTag(unitId, tagName) {
    return this.unitState[unitId]?.tags[tagName];
  }

  createRecipeWriteTags(unitId, recipe) {
    if (!unitId || !recipe || !recipe.kode) {
      throw new Error("Unit ID and recipe object are required.");
    }

    return {
      [`recipe_kode.${unitId}`]: recipe.kode,
      [`recipe_nama.${unitId}`]: recipe.nama || "",
      [`recipe_trolly.${unitId}`]: recipe.trolly || "",
      [`sb_${unitId}.target_menit`]: recipe.durasi || 0,
      [`recipe_batch.${unitId}`]: recipe.batch || "",
      [`recipe_qty.${unitId}`]: recipe.qty || 0,
      [`recipe_versi.${unitId}`]: recipe.versi || ""
    };
  }

  evaluateProcessLogic() {
    const actions = {};
    const realtime = {
      units: {},
      now: new Date().toISOString()
    };

    Object.values(this.unitState).forEach((unit) => {
      const tags = unit.tags;
      const id = unit.id;
      const isRecipeLoaded = !!tags[`recipe_kode.${id}`];
      const isRunning = Number(tags[`sb_${id}.flag_init_start`]) === 1;
      const isComplete = Number(tags[`sb_${id}.status_selesai`]) === 1;
      const isPaused = Number(tags[`sb${id}.run_stop`]) === 1;
      const startEnabled = Number(tags[`sb_${id}.btn_start_enable`]) === 1;

      realtime.units[id] = {
        isRecipeLoaded,
        isRunning,
        isComplete,
        isPaused,
        startEnabled,
        recipeCode: tags[`recipe_kode.${id}`] || null,
        recipeName: tags[`recipe_nama.${id}`] || null,
        temperature: tags[`sb${id}.temp`] != null ? Number(tags[`sb${id}.temp`]) / 10 : null,
        targetMinutes: tags[`sb_${id}.target_menit`] != null ? Number(tags[`sb_${id}.target_menit`]) : null
      };

      if (isRecipeLoaded && !isRunning && !isComplete && startEnabled) {
        // NOTE: Replace `sb_${id}.auto_start` with your actual SCADA write tag for command requests.
        actions[`sb_${id}.auto_start`] = 1;
        this.addLog(`Unit ${id} is ready and auto-start requested.`, "info");
      }

      if (isComplete && tags[`sb_${id}.btn_reset_enable`] === 1) {
        // Example reset automation for completed units.
        actions[`sb_${id}.auto_reset`] = 1;
        this.addLog(`Unit ${id} completed production and reset requested.`, "info");
      }

      if (this.productionPlan.length > 0) {
        this.productionPlan.forEach((planItem) => {
          if (planItem.unitId === id && planItem.action === "dispatch" && !isRecipeLoaded) {
            Object.assign(actions, this.createRecipeWriteTags(id, planItem.recipe));
            this.addLog(`Dispatching recipe ${planItem.recipe.kode} to unit ${id}`, "info");
          }
        });
      }
    });

    this.pendingWrites = actions;
    return {
      actions,
      realtime,
      logs: this.logs.slice(-50)
    };
  }

  getPendingWrites() {
    return { ...this.pendingWrites };
  }

  clearPendingWrites() {
    this.pendingWrites = {};
  }

  async runProductionCycle(readGroupTag, readTags, writeGroupTag = "Group_Resep") {
    const readResponse = await this.scadaRead(readGroupTag, readTags);
    if (readResponse?.result?.data) {
      this.updateUnitState(readResponse.result.data);
    }

    const evaluation = this.evaluateProcessLogic();
    const output = {
      readResponse,
      processEvaluation: evaluation,
      writeResponse: null
    };

    const pending = this.getPendingWrites();
    if (Object.keys(pending).length > 0) {
      output.writeResponse = await this.scadaWrite(writeGroupTag, pending);
      this.clearPendingWrites();
    }

    return output;
  }
}

module.exports = {
  CustomEngine
};
