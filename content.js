// Content Script — Highlight Compendium (MV3)
// Listens for Ctrl+Shift+S, captures selection, shows tooltip

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__highlightCompendiumLoaded) return;
  window.__highlightCompendiumLoaded = true;

  // ─── Tooltip ────────────────────────────────────────────────────────────────

  let tooltipHost = null;
  let shadowRoot = null;
  let tooltipTimeout = null;

  function createTooltip() {
    if (tooltipHost) return;

    tooltipHost = document.createElement("div");
    tooltipHost.id = "__hc-tooltip-host";
    tooltipHost.style.position = "absolute";
    tooltipHost.style.zIndex = "2147483647";
    tooltipHost.style.pointerEvents = "none";
    document.body.appendChild(tooltipHost);

    shadowRoot = tooltipHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      #tooltip {
        position: absolute;
        padding: 8px 14px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        transition: opacity 0.2s ease, transform 0.2s ease;
        opacity: 0;
        transform: translateY(4px);
        max-width: 320px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      }
    `;
    shadowRoot.appendChild(style);

    const tooltipEl = document.createElement("div");
    tooltipEl.id = "tooltip";
    shadowRoot.appendChild(tooltipEl);
  }

  function showTooltip(message, type = "success", x, y) {
    createTooltip();
    
    const tooltipEl = shadowRoot.getElementById("tooltip");

    const isSuccess = type === "success";
    const isError = type === "error";
    const isSaving = type === "saving";

    tooltipEl.style.background = isSuccess
      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
      : isError
        ? "#ef4444"
        : "#1e1e2e";
    tooltipEl.style.color = "#ffffff";
    tooltipEl.style.border = isSuccess
      ? "1px solid rgba(99,102,241,0.5)"
      : isError
        ? "1px solid rgba(239,68,68,0.5)"
        : "1px solid rgba(255,255,255,0.1)";

    const icon = isSuccess ? "✓" : isError ? "✗" : "⋯";
    tooltipEl.innerHTML = `
      <span style="
        width: 18px; height: 18px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; flex-shrink: 0;
      ">${icon}</span>
      <span>${message}</span>
    `;

    // Position near cursor or center of viewport
    let left = x ?? window.innerWidth / 2;
    let top = y ?? window.innerHeight / 2;

    tooltipEl.style.left = left + "px";
    tooltipEl.style.top = top + "px";
    tooltipEl.style.opacity = "1";
    tooltipEl.style.transform = "translateY(0)";

    clearTimeout(tooltipTimeout);
    if (type !== "saving") {
      tooltipTimeout = setTimeout(hideTooltip, type === "error" ? 4000 : 2500);
    }
  }

  function hideTooltip() {
    if (!shadowRoot) return;
    const tooltipEl = shadowRoot.getElementById("tooltip");
    if (tooltipEl) {
      tooltipEl.style.opacity = "0";
      tooltipEl.style.transform = "translateY(4px)";
    }
  }

  // ─── Capture & Save ──────────────────────────────────────────────────────────

  // Removed passive mouse tracking

  function getSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";
    return sel.toString().trim();
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  async function saveHighlight() {
    const text = getSelectedText();
    const sel = window.getSelection();

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      x = rect.right + window.scrollX - 20;
      y = rect.bottom + window.scrollY + 10;
    }

    if (!text) {
      showTooltip("Select some text first", "error", x, y);
      return;
    }

    if (text.length > 50000) {
      showTooltip("Selection too long (max 50,000 characters)", "error", x, y);
      return;
    }

    showTooltip("Saving to Compendium…", "saving", x, y);

    const payload = {
      text,
      sourceUrl: window.location.href,
      pageTitle: document.title || "",
      domain: getDomain(window.location.href),
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_HIGHLIGHT",
        payload,
      });

      if (response?.success) {
        showTooltip("Saved to Compendium ✓", "success", x, y);
        // Clear the selection
        window.getSelection()?.removeAllRanges();
      } else {
        const errMsg = response?.error || "Failed to save";
        if (errMsg.includes("API token") || errMsg.includes("dashboard URL")) {
          showTooltip("Configure extension settings first", "error", x, y);
        } else {
          showTooltip("Error: " + errMsg.slice(0, 60), "error", x, y);
        }
      }
    } catch (err) {
      showTooltip("Extension error — check settings", "error", x, y);
      console.error("[Highlight Compendium] Error:", err);
    }
  }

  // ─── Keyboard Shortcut (Ctrl+Shift+S) ───────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      saveHighlight();
    }
  }, true);

  // ─── Message from background (context menu / command relay) ─────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRIGGER_SAVE") {
      saveHighlight();
    } else if (message.type === "SAVE_SELECTION" && message.text) {
      // Text already provided (from context menu)
      const payload = {
        text: message.text,
        sourceUrl: window.location.href,
        pageTitle: document.title || "",
        domain: getDomain(window.location.href),
      };

      const sel = window.getSelection();
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        x = rect.right + window.scrollX - 20;
        y = rect.bottom + window.scrollY + 10;
      }

      showTooltip("Saving to Compendium…", "saving", x, y);

      chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", payload }).then((response) => {
        if (response?.success) {
          showTooltip("Saved to Compendium ✓", "success", x, y);
        } else {
          showTooltip("Error: " + (response?.error || "Failed").slice(0, 60), "error", x, y);
        }
      });
    }
  });

  // ─── Website ↔ Extension Bridge (Custom DOM Events) ────────────────────────
  // Uses CustomEvents on document instead of window.postMessage.
  // CustomEvents reliably cross the content-script ↔ page boundary because
  // both worlds share the same DOM.

  // Announce presence immediately so the page knows the extension is loaded
  document.dispatchEvent(new CustomEvent("HC_EXTENSION_PRESENT"));

  // Also inject a marker attribute the page can check synchronously
  document.documentElement.setAttribute("data-hc-extension", "true");

  document.addEventListener("HC_GET_SETTINGS", () => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      document.dispatchEvent(new CustomEvent("HC_SETTINGS_RESPONSE", {
        detail: {
          apiToken: response?.apiToken || "",
          dashboardUrl: response?.dashboardUrl || "",
        }
      }));
    });
  });

  document.addEventListener("HC_SAVE_SETTINGS", (e) => {
    const detail = e.detail || {};
    chrome.runtime.sendMessage(
      {
        type: "SAVE_SETTINGS",
        apiToken: detail.apiToken || "",
        dashboardUrl: detail.dashboardUrl || "",
      },
      (response) => {
        document.dispatchEvent(new CustomEvent("HC_SETTINGS_SAVED", {
          detail: { success: response?.success }
        }));
      }
    );
  });
})();

