async function startServer() {
  appendConsole("🟢 Starting Minecraft server...", "info");
  toggleButtons("running");
  setServerState("starting");
  startGraph();
  startUptime();

  const baseDir = localStorage.getItem("selectedServerPath");
  const infoPath = path.join(baseDir, "server_info.json");
  const jarPath = path.join(baseDir, "server.jar");
  const propertiesPath = path.join(baseDir, "server.properties");
  // === Read server_info.json ===
  let serverInfo = {};
  let javaPath = "java";
  let serverRAM = 2048;
  let serverType = "vanilla";

  if (fs.existsSync(infoPath)) {
    try {
      serverInfo = JSON.parse(fs.readFileSync(infoPath, "utf8"));
      javaPath = serverInfo.java_path || "java";
      serverRAM = serverInfo.server_ram || 2048;
      serverType = (serverInfo.server_type || "vanilla").toLowerCase();
    } catch (err) {
      appendConsole(`Error reading server_info.json: ${err}`, "error");
      return;
    }
  } else {
    appendConsole("⚠️ server_info.json not found. Using defaults.", "error");
  }

  // === Check for server.jar ===
  if (!fs.existsSync(jarPath)) {
    appendConsole(`❌ server.jar not found in: ${jarPath}`, "error");
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }
  // === Verify and enforce RCON configuration ===
  if (!fs.existsSync(propertiesPath)) {
    appendConsole("⚠️ server.properties not found — cannot verify RCON.", "error");
    toggleButtons("hidden");
    toggleServerStatus(false);
    return;
  }

try {
  let properties = fs.readFileSync(propertiesPath, "utf8");
  let modified = false;

  // === Ensure RCON is enabled ===
  if (/enable-rcon\s*=\s*false/i.test(properties)) {
    properties = properties.replace(/enable-rcon\s*=\s*false/i, "enable-rcon=true");
    modified = true;
  } else if (!/enable-rcon\s*=\s*true/i.test(properties)) {
    properties += "\nenable-rcon=true";
    modified = true;
  } else {return ;}

  //=== Always overwrite RCON password with 123 ===
  if (/rcon\.password\s*=.*/i.test(properties)) {
    properties = properties.replace(/rcon\.password\s*=.*/i, "rcon.password=123");
  } else {
    properties += "\nrcon.password=123";
  }
  modified = true; // always mark as modified since password is forced

  // === Ensure RCON port exists ===
  if (/rcon\.port\s*=\s*\d+/i.test(properties)) {
  } else {
    properties += "\nrcon.port=25575";
    modified = true;
  }

  // === Save file & allow OS to flush ===
  if (modified) {
    fs.writeFileSync(propertiesPath, properties, "utf8");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // === Reverify file contents ===
  const verify = fs.readFileSync(propertiesPath, "utf8");
  if (!/enable-rcon\s*=\s*true/i.test(verify) ||
      !/rcon\.password\s*=\s*123/i.test(verify) ||
      !/rcon\.port\s*=\s*\d+/i.test(verify)) {
    appendConsole("❌ RCON verification failed after save — cannot continue.", "error");
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }


} catch (err) {
  appendConsole(`❌ Failed to verify or update RCON: ${err}`, "error");
  toggleButtons("hidden");
  setServerState("offline");
  return;
}

  try {
    let properties = fs.readFileSync(propertiesPath, "utf8");
    let modified = false;

    const rconEnabled = /enable-rcon\s*=\s*true/i.test(properties);
    const hasPasswordLine = /rcon\.password\s*=.*/i.test(properties);
    const hasNonEmptyPassword = /rcon\.password\s*=\s*\S+/i.test(properties);
    const hasPort = /rcon\.port\s*=\s*\d+/i.test(properties);

    // === Enable RCON if disabled ===
    if (!rconEnabled) {
      if (/enable-rcon\s*=\s*false/i.test(properties)) {
        properties = properties.replace(/enable-rcon\s*=\s*false/i, "enable-rcon=true");
      } else {
        properties += "\nenable-rcon=true";
      }
      modified = true;
    } else {return ;
    }

    // === Ensure password exists and is not empty ===
    if (!hasPasswordLine) {
      properties += "\nrcon.password=123";
      modified = true;
    } else if (!hasNonEmptyPassword) {
      properties = properties.replace(/rcon\.password\s*=.*/i, "rcon.password=123");
      modified = true;
    }

    // === Ensure RCON port ===
    if (!hasPort) {
      properties += "\nrcon.port=25575";
      modified = true;
    }

    // === Save file & allow OS to flush ===
    if (modified) {
      fs.writeFileSync(propertiesPath, properties, "utf8");

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // === Reverify file contents ===
    const verify = fs.readFileSync(propertiesPath, "utf8");
    if (!/enable-rcon\s*=\s*true/i.test(verify) ||
        !/rcon\.password\s*=\s*\S+/i.test(verify) ||
        !/rcon\.port\s*=\s*\d+/i.test(verify)) {
      toggleButtons("hidden");
      setServerState("offline");
      return;
    }

  } catch (err) {
    appendConsole(`❌ Failed to verify RCON: ${err}`, "error");
    toggleButtons("hidden");
    setServerState("offline");
    return;
  }
  // === Calculate RAM ===
  const ramMax = `${Math.floor(serverRAM / 1024)}G`;

  // === Start Playit tunnel ===
  try {
    fetchPlayitIP();
  } catch {
    appendConsole(" fetchPlayitIP() not available or failed to start.", "error");
  }

  // === Prepare Java command ===
  const args = [
    `-Xmx${ramMax}`,
    "-Xms1G",
    "-jar",
    "server.jar",
    "nogui"
  ];

  appendConsole("🚀 Launching process:", "info");
  appendConsole(`"${javaPath}" ${args.join(" ")}`, "info");

  try {
      serverProcess = spawn(`"${javaPath}"`, args, {
      cwd: baseDir,
      shell: true
    });

    let serverStarted = false;

    serverProcess.stdout.on("data", (data) => {
      const text = data.toString();
      appendConsole(text, "info");

      // Detect server start message
      if (!serverStarted && /Done\s*\(\d+\.\d+s\)!.*type "help"/i.test(text)) {
        serverStarted = true;
        appendConsole("✅ Server started successfully and is now running!", "success");
        setServerState("online");
        isServerRunning = true;
      }
    });

    serverProcess.stderr.on("data", (data) => {
      appendConsole(data.toString(), "error");
    });

    serverProcess.on("exit", (code) => {
      appendConsole(`🛑 Server exited with code ${code}`, "error");
      toggleButtons("hidden");
      setServerState("stopped");
      stopPlayit();
    });

    // Make serverProcess globally accessible
    window.serverProcess = serverProcess;

  } catch (err) {
    appendConsole(`❌ Failed to start server process: ${err}`, "error");
    toggleButtons("hidden");
    setServerState("stopped");
    stopPlayit();
  }
}