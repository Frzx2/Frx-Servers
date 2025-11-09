// server_version.js (fixed)
// Builds typed version objects and filters by checkboxes reliably

window.addEventListener("DOMContentLoaded", () => {
  // DOM refs (acquired after DOM is ready)
  const versionList = document.getElementById("version-list");
  const searchInput = document.getElementById("search-input");
  const selectedLabel = document.getElementById("selected-version-label");
  const nextBtn = document.getElementById("next-btn");
  const backBtn = document.getElementById("back-btn");

  // Checkbox filters
  const releaseCheck = document.getElementById("release-check");
  const snapshotCheck = document.getElementById("snapshot-check");


  // ensure checkboxes default to checked
  releaseCheck.checked = true;
  snapshotCheck.checked = true;

  let serverType = localStorage.getItem("selectedServerType");
  if (!serverType) {
    alert("⚠️ Server type not selected! Redirecting back...");
    window.location.href = "../server_type/server_type.html";
    return;
  }

  // allVersions will hold objects: { id: string, type: "release"|"snapshot"|"custom" }
  let allVersions = [];
  let selectedVersion = null;

  // ---- utilities ----
  function renderVersionList(versions) {
    versionList.innerHTML = "";

    if (!versions.length) {
      versionList.innerHTML = `<p class="loading-text">No versions available.</p>`;
      return;
    }

    versions.slice(0, 150).forEach(v => {
      const item = document.createElement("div");
      item.className = "version-item";
      item.textContent = v.id;
      item.addEventListener("click", () => selectVersion(v.id, item));
      versionList.appendChild(item);
    });
  }

  function selectVersion(version, el) {
    document.querySelectorAll(".version-item").forEach(i => i.classList.remove("selected"));
    el.classList.add("selected");
    selectedVersion = version;
    selectedLabel.textContent = `Selected Version: ${version}`;
    localStorage.setItem("selectedVersion", version);
  }

  // classify custom types (rc, pre, cp, beta, alpha)
  function isCustomTag(id) {
    return /(?:\b|[-_.])(rc|pre|rcp|cp|beta|alpha|snapshot-pre|pre-release)\b/i.test(id);
  }

  // apply search + checkbox filters on typed allVersions
  function applyFilters() {
    const searchQuery = (searchInput.value || "").toLowerCase();

    const filtered = allVersions.filter(v => {
      // search match
      if (searchQuery && !v.id.toLowerCase().includes(searchQuery)) return false;

      // type match
      if (v.type === "release" && releaseCheck.checked) return true;
      if (v.type === "snapshot" && snapshotCheck.checked) return true;

      return false;
    });

    renderVersionList(filtered);
  }

  // ---- fetchers that populate allVersions as objects ----
  async function fetchVanilla() {
    const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
    const data = await res.json();
    // each manifest version entry has id and type fields
    allVersions = (data.versions || []).map(v => ({
      id: v.id,
      type: (v.type === "snapshot") ? "snapshot" : "release"
    }));
    // optionally mark some as custom if id looks like rc/cp etc.
    allVersions = allVersions.map(v => ({
      id: v.id,
      type: (v.type === "release" && isCustomTag(v.id)) ? "custom" : v.type
    }));
    applyFilters();
  }

  async function fetchPaper() {
    // Paper API returns stable release version strings (no snapshots)
    const res = await fetch("https://api.papermc.io/v2/projects/paper");
    const data = await res.json();
    allVersions = (data.versions || []).reverse().map(id => ({
      id,
      type: isCustomTag(id) ? "custom" : "release"
    }));
    applyFilters();
  }

  async function fetchFabric() {
    // Fabric endpoint returns array — items may be string or object
    const res = await fetch("https://meta.fabricmc.net/v2/versions/game");
    const data = await res.json();
    // data may be like [{version:"1.20", stable:true}, "1.19"]
    allVersions = (data || []).map(item => {
      if (typeof item === "string") {
        const id = item;
        return { id, type: isCustomTag(id) ? "custom" : "release" };
      } else if (typeof item === "object" && item.version) {
        const id = item.version;
        // treat unstable as snapshot-like if stable=false (best-effort)
        const t = (item.stable === false) ? "snapshot" : "release";
        return { id, type: isCustomTag(id) ? "custom" : t };
      } else {
        return { id: String(item), type: "release" };
      }
    });
    applyFilters();
  }

  async function fetchForge() {
    // Forge promotions JSON maps promos to recommended/latest keys
    const res = await fetch("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json");
    const data = await res.json();
    const promos = data.promos || {};
    const versions = Object.keys(promos)
      .filter(k => /-(recommended|latest)$/.test(k))
      .map(k => k.replace(/-(recommended|latest)$/, ""));
    allVersions = versions.reverse().map(id => ({
      id,
      type: isCustomTag(id) ? "custom" : "release"
    }));
    applyFilters();
  }

  // top-level loader
  async function fetchVersions() {
    versionList.innerHTML = `<p class="loading-text">⏳ Loading ${serverType} versions...</p>`;
    try {
      switch ((serverType || "").toLowerCase()) {
        case "vanilla":
          await fetchVanilla();
          break;
        case "paper":
          await fetchPaper();
          break;
        case "fabric":
          await fetchFabric();
          break;
        case "forge":
          await fetchForge();
          break;
        default:
          throw new Error("Unknown server type: " + serverType);
      }
    } catch (err) {
      console.error("Failed to load versions:", err);
      versionList.innerHTML = `<p class="loading-text">❌ Failed to load versions for ${serverType}</p>`;
    }
  }

  // event wiring
  searchInput.addEventListener("input", applyFilters);
  [releaseCheck, snapshotCheck].forEach(cb => cb.addEventListener("change", applyFilters));

  backBtn.addEventListener("click", () => {
    window.location.href = "../server_type/server_type.html";
  });

  nextBtn.addEventListener("click", () => {
    if (!selectedVersion) {
      alert("⚠️ Please select a version to proceed.");
    } else {
      // optional: highlight message
      window.location.href = "../server_ram/server_ram.html";
    }
  });

  // Fetch on load
  fetchVersions();
});