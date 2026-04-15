// Popup Script — Highlight Compendium

document.addEventListener("DOMContentLoaded", () => {
  // ─── Elements ──────────────────────────────────────────────────────────────
  const viewMain = document.getElementById("view-main");
  const viewSettings = document.getElementById("view-settings");
  const highlightsList = document.getElementById("highlights-list");
  const btnSettings = document.getElementById("btn-settings");
  const btnBack = document.getElementById("btn-back");
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");
  const btnSaveSettings = document.getElementById("btn-save-settings");
  const inputDashboardUrl = document.getElementById("input-dashboard-url");
  const inputApiToken = document.getElementById("input-api-token");
  const settingsStatus = document.getElementById("settings-status");

  // ─── View Switching ────────────────────────────────────────────────────────

  function showView(name) {
    viewMain.classList.remove("active");
    viewSettings.classList.remove("active");
    if (name === "main") viewMain.classList.add("active");
    if (name === "settings") viewSettings.classList.add("active");
  }

  btnSettings.addEventListener("click", () => {
    loadSettingsIntoForm();
    showView("settings");
  });

  btnBack.addEventListener("click", () => {
    showView("main");
    loadRecent();
  });

  // ─── Settings ──────────────────────────────────────────────────────────────

  function loadSettingsIntoForm() {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (response) {
        inputDashboardUrl.value = response.dashboardUrl || "";
        inputApiToken.value = response.apiToken || "";
      }
    });
  }

  btnSaveSettings.addEventListener("click", () => {
    const dashboardUrl = inputDashboardUrl.value.trim().replace(/\/$/, "");
    const apiToken = inputApiToken.value.trim();

    if (!dashboardUrl) {
      showStatus("Please enter the dashboard URL", "error");
      return;
    }
    if (!apiToken) {
      showStatus("Please enter your API token", "error");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "SAVE_SETTINGS", apiToken, dashboardUrl },
      () => {
        showStatus("Settings saved!", "success");
        setTimeout(() => {
          showView("main");
          loadRecent();
        }, 1200);
      },
    );
  });

  function showStatus(msg, type) {
    settingsStatus.textContent = msg;
    settingsStatus.className = "status-msg " + type;
    setTimeout(() => {
      settingsStatus.className = "status-msg";
    }, 3000);
  }

  // ─── Open Dashboard ────────────────────────────────────────────────────────

  btnOpenDashboard.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      const url = response?.dashboardUrl;
      if (url) {
        chrome.tabs.create({ url: url + "/compendium" });
        window.close();
      } else {
        loadSettingsIntoForm();
        showView("settings");
        showStatus("Set your dashboard URL first", "error");
      }
    });
  });

  // ─── Load Recent Highlights ────────────────────────────────────────────────

  function loadRecent() {
    highlightsList.innerHTML = '<div class="spinner"></div>';

    chrome.runtime.sendMessage({ type: "GET_RECENT" }, (response) => {
      if (chrome.runtime.lastError) {
        renderError("Extension error. Try reloading.");
        return;
      }

      if (!response?.success) {
        const err = response?.error || "";
        if (err.includes("API token") || err.includes("dashboard")) {
          renderConfigPrompt();
        } else {
          renderError(err || "Could not load highlights");
        }
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
    highlightsList.innerHTML = "";
    items.forEach((h) => {
      const div = document.createElement("div");
      div.className = "highlight-item";

      const domain = h.domain || tryGetDomain(h.sourceUrl);
      const date = new Date(h.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

      div.innerHTML = `
        <div class="hi-text">"${escapeHtml(h.text)}"</div>
        <div class="hi-meta">
          <div class="hi-domain">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            ${escapeHtml(domain)}
          </div>
          <span>${date}</span>
        </div>
      `;
      highlightsList.appendChild(div);
    });
  }

  function renderEmpty() {
    highlightsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <div class="empty-title">No highlights yet</div>
        <div class="empty-desc">
          Select text on any webpage and press<br>
          <strong>Ctrl+Shift+S</strong> to save your first highlight.
        </div>
      </div>
    `;
  }

  function renderConfigPrompt() {
    highlightsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚙</div>
        <div class="empty-title">Setup required</div>
        <div class="empty-desc">
          Click the settings icon above to enter your<br>
          API token and dashboard URL.
        </div>
      </div>
    `;
  }

  function renderError(msg) {
    highlightsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:#ef4444">✗</div>
        <div class="empty-title">Could not load</div>
        <div class="empty-desc">${escapeHtml(msg)}</div>
      </div>
    `;
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function tryGetDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url || "unknown";
    }
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  loadRecent();
});
