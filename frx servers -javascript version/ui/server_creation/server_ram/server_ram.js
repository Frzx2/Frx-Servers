const slider = document.getElementById("ram-slider");
const ramValue = document.getElementById("ram-value");
const serverNameInput = document.getElementById("server-name");
const errorLabel = document.getElementById("error-label");
const nextBtn = document.getElementById("next-btn");
const backBtn = document.getElementById("back-btn");
const ramButtons = document.querySelectorAll(".ram-btn");
const os = require("os");

// Convert system memory to MB
const totalSystemRAM = Math.floor(os.totalmem() / (1024 * 1024));

// Minimum allowed RAM (2GB)
const MIN_RAM = 2048;
const MAX_RAM = totalSystemRAM;
const WARN_THRESHOLD = Math.floor(MAX_RAM * 0.6); // 60%


// Load Content
window.addEventListener("DOMContentLoaded", () => {
  slider.max = MAX_RAM;

  const savedRam = localStorage.getItem("selectedRamMB");

  if (savedRam && savedRam <= MAX_RAM) {
    slider.value = savedRam;
    ramValue.textContent = savedRam;
  } else {
    slider.value = MIN_RAM;
    ramValue.textContent = MIN_RAM;
  }

  updateSliderColor(slider.value);

  ramButtons.forEach(btn => {
    const val = parseInt(btn.dataset.value);
    if (val > MAX_RAM) btn.disabled = true;
  });
});
// Update the slider fill dynamically
function updateSliderFill() {
  const val = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty("--fill", `${val}%`);
}

slider.addEventListener("input", updateSliderFill);
window.addEventListener("DOMContentLoaded", updateSliderFill);

// === FUNCTIONS ===
function updateSliderColor(val) {
  const percent = ((val - slider.min) / (slider.max - slider.min)) * 100;

  // Color gradient effect
  let color;
  if (percent < 60) color = "#00eaff"; // safe blue
  else if (percent < 80) color = "#ffb300"; // warning orange
  else color = "#ff1744"; // danger red

  slider.style.setProperty("--slider-fill", color);

  // Apply gradient for visual progress
  slider.style.background = `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, rgba(255,255,255,0.1) ${percent}%, rgba(255,255,255,0.1) 100%)`;


  // Warning message
  if (val > WARN_THRESHOLD) {
    errorLabel.textContent = `⚠️ You're allocating over 60% of your system RAM (${(val/1024).toFixed(1)} GB of ${(MAX_RAM/1024).toFixed(1)} GB).`;
    } else {
    errorLabel.textContent = "";
  } 
}

// === EVENTS ===
slider.addEventListener("input", () => {
  ramValue.textContent = slider.value;
  updateSliderColor(slider.value);
});

ramButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.value);
    if (val > MAX_RAM) {
      errorLabel.textContent = `⚠️ Your system only supports up to ${MAX_RAM} MB`;
      return;
    }
    slider.value = val;
    ramValue.textContent = val;
    updateSliderColor(val);
  });
});

// === NEXT BUTTON ===
nextBtn.addEventListener("click", () => {
  const serverName = serverNameInput.value.trim();
  const ram = parseInt(slider.value);

  if (!serverName) {
    errorLabel.textContent = "⚠️ Please enter a server name.";
    console.log("[ERROR] Server name is empty.");
    return;
  }

  if (ram < MIN_RAM) {
    errorLabel.textContent = `⚠️ RAM must be at least ${MIN_RAM} MB.`;
    return;
  }

  if (ram > MAX_RAM) {
    errorLabel.textContent = `⚠️ RAM cannot exceed ${MAX_RAM} MB (your system limit).`;
    return;
  }

  localStorage.setItem("serverName", serverName);
  localStorage.setItem("selectedRamMB", ram);

  errorLabel.textContent = `✅ Saved ${ram} MB for "${serverName}"`;
  setTimeout(() => {
    window.location.href = "../server_world/server_world.html";
  }, 300);
});

// === BACK BUTTON ===
backBtn.addEventListener("click", () => {
  window.location.href = "../server_version/server_version.html";
});
