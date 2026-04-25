// Popup Script — Mind Palace
// Hardcoded defaults so the popup always works without manual configuration.

const DASHBOARD_URL = "https://mindpalace-bice.vercel.app";
const API_TOKEN = "hc_89523f01462935157e81b0935f2535723d2eb9a3";

document.addEventListener("DOMContentLoaded", () => {
  const viewMain      = document.getElementById("view-main");
  const viewSettings  = document.getElementById("view-settings");
  const listEl        = document.getElementById("highlights-list");
  const btnSettings   = document.getElementById("btn-settings");
  const btnBack       = document.getElementById("btn-back");
  const btnDashboard  = document.getElementById("btn-open-dashboard");
  const btnSave       = document.getElementById("btn-save-settings");
  const inputUrl      = document.getElementById("input-dashboard-url");
  const inputToken    = document.getElementById("input-api-token");
  const statusEl      = document.getElementById("settings-status");

  // ─── View Switching ──────────────────────────────────────────────────────────

  function show(name) {
    viewMain.classList.toggle("active", name === "main");
    viewSettings.classList.toggle("active", name === "settings");
  }

  btnSettings.addEventListener("click", () => {
    // Always pre-fill with current (hardcoded) values
    inputUrl.value   = DASHBOARD_URL;
    inputToken.value = API_TOKEN;
    show("settings");
  });

  btnBack.addEventListener("click", () => {
    show("main");
    loadRecent();
  });

  // ─── Save Settings ───────────────────────────────────────────────────────────

  btnSave.addEventListener("click", () => {
    const url   = (inputUrl.value.trim()   || DASHBOARD_URL).replace(/\/$/, "");
    const token = (inputToken.value.trim() || API_TOKEN);

    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", apiToken: token, dashboardUrl: url }, () => {
      showStatus("Settings saved!", "success");
      setTimeout(() => { show("main"); loadRecent(); }, 1200);
    });
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status-msg " + type;
    setTimeout(() => { statusEl.className = "status-msg"; }, 3000);
  }

  // ─── Open Dashboard ──────────────────────────────────────────────────────────

  btnDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: DASHBOARD_URL + "/mind-palace" });
    window.close();
  });

  // ─── Load Recent Highlights ──────────────────────────────────────────────────

  function loadRecent() {
    listEl.innerHTML = '<div class="spinner"></div>';

    chrome.runtime.sendMessage({ type: "GET_RECENT" }, (response) => {
      if (chrome.runtime.lastError) {
        renderError("Extension error. Try reloading the page.");
        return;
      }
      if (!response || !response.success) {
        renderError((response && response.error) || "Could not load highlights");
        return;
      }
      const items = response.data;
      if (!items || items.length === 0) {
        renderEmpty();
      } else {
        renderHighlights(items);
      }
    });
  }

  function renderHighlights(items) {
    listEl.innerHTML = "";
    items.forEach((h) => {
      const div = document.createElement("div");
      div.className = "highlight-item";
      const domain = h.domain || tryDomain(h.sourceUrl);
      const date = new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      div.innerHTML =
        '<div class="hi-text">"' + esc(h.text) + '"</div>' +
        '<div class="hi-meta"><span class="hi-domain">' + esc(domain) + '</span><span>' + date + '</span></div>';
      listEl.appendChild(div);
    });
  }

  function renderEmpty() {
    listEl.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">✦</div>' +
      '<div class="empty-title">No highlights yet</div>' +
      '<div class="empty-desc">Select text on any webpage and press<br><strong>Ctrl+Shift+S</strong> to save your first highlight.</div>' +
      '</div>';
  }

  function renderError(msg) {
    listEl.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon" style="color:#ef4444">✗</div>' +
      '<div class="empty-title">Could not load</div>' +
      '<div class="empty-desc">' + esc(msg) + '</div>' +
      '</div>';
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function tryDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (_) { return url || "unknown"; }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  loadRecent();
});
