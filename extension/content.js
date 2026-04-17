// Content Script — Highlight Compendium (MV3)
// Listens for Ctrl+Shift+S (via background relay), captures selection, shows tooltip

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
    tooltipHost.setAttribute("style",
      "position:fixed !important;" +
      "top:0 !important;" +
      "left:0 !important;" +
      "width:0 !important;" +
      "height:0 !important;" +
      "overflow:visible !important;" +
      "z-index:2147483647 !important;" +
      "pointer-events:none !important;"
    );
    document.body.appendChild(tooltipHost);

    shadowRoot = tooltipHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      #tooltip {
        position: fixed;
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
        z-index: 2147483647;
      }
    `;
    shadowRoot.appendChild(style);

    const tooltipEl = document.createElement("div");
    tooltipEl.id = "tooltip";
    shadowRoot.appendChild(tooltipEl);
  }

  function showTooltip(message, type, x, y) {
    if (type === undefined) type = "success";
    createTooltip();

    const tooltipEl = shadowRoot.getElementById("tooltip");

    const isSuccess = type === "success";
    const isError = type === "error";

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
    tooltipEl.textContent = "";
    const iconEl = document.createElement("span");
    iconEl.setAttribute("style", "width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;");
    iconEl.textContent = icon;
    const msgEl = document.createElement("span");
    msgEl.textContent = message;
    tooltipEl.appendChild(iconEl);
    tooltipEl.appendChild(msgEl);

    // Position near selection — coordinates are already viewport-relative
    // because getBoundingClientRect() returns viewport coords.
    // For position:fixed we must NOT add scrollX/scrollY.
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = (x !== undefined && x !== null) ? x : vw / 2;
    let top  = (y !== undefined && y !== null) ? y : vh / 2;

    // Keep tooltip inside viewport (rough estimate: 300px wide, 50px tall)
    if (left + 300 > vw) left = vw - 310;
    if (left < 8) left = 8;
    if (top + 50 > vh) top = top - 60;
    if (top < 8) top = 8;

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

  // ─── Floating Action Button (FAB) ───────────────────────────────────────────

  let fabHost = null;
  let fabShadowRoot = null;

  function createFloatingButton() {
    if (fabHost) return;

    fabHost = document.createElement("div");
    fabHost.id = "__hc-fab-host";
    fabHost.setAttribute("style",
      "position:absolute !important;" +
      "top:0 !important;" +
      "left:0 !important;" +
      "width:0 !important;" +
      "height:0 !important;" +
      "overflow:visible !important;" +
      "z-index:2147483646 !important;"
    );
    document.body.appendChild(fabHost);

    fabShadowRoot = fabHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      #fab {
        position: absolute;
        padding: 6px 12px;
        border-radius: 6px;
        background: #1e1e2e;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.1);
        display: none;
        align-items: center;
        gap: 6px;
        transition: opacity 0.15s ease, transform 0.15s ease;
        opacity: 0;
        transform: translateY(4px);
        user-select: none;
      }
      #fab:hover {
        background: #2a2a3e;
      }
      #fab:active {
        transform: translateY(2px);
      }
    `;
    fabShadowRoot.appendChild(style);

    const fabEl = document.createElement("div");
    fabEl.id = "fab";
    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = document.createElementNS(svgNS, "svg");
    svgEl.setAttribute("viewBox", "0 0 24 24");
    svgEl.setAttribute("width", "14");
    svgEl.setAttribute("height", "14");
    svgEl.setAttribute("fill", "none");
    svgEl.setAttribute("stroke", "currentColor");
    svgEl.setAttribute("stroke-width", "2");
    const svgPath = document.createElementNS(svgNS, "path");
    svgPath.setAttribute("d", "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z");
    const poly1 = document.createElementNS(svgNS, "polyline");
    poly1.setAttribute("points", "17 21 17 13 7 13 7 21");
    const poly2 = document.createElementNS(svgNS, "polyline");
    poly2.setAttribute("points", "7 3 7 8 15 8");
    svgEl.appendChild(svgPath);
    svgEl.appendChild(poly1);
    svgEl.appendChild(poly2);
    fabEl.appendChild(svgEl);
    fabEl.appendChild(document.createTextNode(" Save"));
    
    // Prevent mouse down on fab from clearing selection
    fabEl.addEventListener("mousedown", (e) => e.preventDefault());
    
    fabEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFloatingButton();
      saveHighlight();
    });
    
    fabShadowRoot.appendChild(fabEl);
  }

  function showFloatingButton() {
    const text = getSelectedText();
    if (!text) {
      hideFloatingButton();
      return;
    }
    
    createFloatingButton();
    const fabEl = fabShadowRoot.getElementById("fab");
    
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    
    const left = rect.left + window.scrollX + (rect.width / 2) - 35;
    const top = rect.top + window.scrollY - 40;
    
    const finalTop = top < window.scrollY ? rect.bottom + window.scrollY + 10 : top;

    fabEl.style.left = left + "px";
    fabEl.style.top = finalTop + "px";
    fabEl.style.display = "flex";
    
    void fabEl.offsetWidth; // trigger reflow
    fabEl.style.opacity = "1";
    fabEl.style.transform = "translateY(0)";
  }

  function hideFloatingButton() {
    if (!fabShadowRoot) return;
    const fabEl = fabShadowRoot.getElementById("fab");
    if (fabEl && fabEl.style.display !== "none") {
      fabEl.style.opacity = "0";
      fabEl.style.transform = "translateY(4px)";
      setTimeout(() => { fabEl.style.display = "none"; }, 150);
    }
  }

  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      if (getSelectedText()) {
        showFloatingButton();
      } else {
        hideFloatingButton();
      }
    }, 10);
  });
  
  document.addEventListener("selectionchange", () => {
    if (!getSelectedText()) {
      hideFloatingButton();
    }
  });

  // ─── Capture & Save ──────────────────────────────────────────────────────────

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

  function getTooltipPosition() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // rect coords are already viewport-relative — use directly for position:fixed
      return { x: rect.right - 20, y: rect.bottom + 10 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  async function saveHighlight() {
    const text = getSelectedText();
    const pos = getTooltipPosition();

    if (!text) {
      showTooltip("Select some text first", "error", pos.x, pos.y);
      return;
    }

    if (text.length > 50000) {
      showTooltip("Selection too long (max 50,000 characters)", "error", pos.x, pos.y);
      return;
    }

    showTooltip("Saving to Compendium\u2026", "saving", pos.x, pos.y);

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

      if (response && response.success) {
        showTooltip("Saved to Compendium \u2713", "success", pos.x, pos.y);
        window.getSelection() && window.getSelection().removeAllRanges();
      } else {
        const errMsg = (response && response.error) || "Failed to save";
        if (errMsg.includes("API token") || errMsg.includes("dashboard URL") || errMsg.includes("not configured")) {
          showTooltip("Open the dashboard to connect the extension", "error", pos.x, pos.y);
        } else {
          showTooltip("Error: " + errMsg.slice(0, 60), "error", pos.x, pos.y);
        }
      }
    } catch (err) {
      showTooltip("Extension error \u2014 check settings", "error", pos.x, pos.y);
      console.error("[Highlight Compendium] Error:", err);
    }
  }

  // ─── Message from background (context menu / command relay) ─────────────────
  // The keyboard shortcut goes: Chrome -> background onCommand -> tabs.sendMessage
  // -> content script onMessage(TRIGGER_SAVE) -> saveHighlight()
  // We keep a direct keydown listener as a fallback for pages where the
  // background relay might be slow.

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TRIGGER_SAVE") {
      saveHighlight();
    } else if (message.type === "SAVE_SELECTION" && message.text) {
      const payload = {
        text: message.text,
        sourceUrl: window.location.href,
        pageTitle: document.title || "",
        domain: getDomain(window.location.href),
      };

      const pos = getTooltipPosition();
      showTooltip("Saving to Compendium\u2026", "saving", pos.x, pos.y);

      chrome.runtime.sendMessage({ type: "SAVE_HIGHLIGHT", payload }).then((response) => {
        if (response && response.success) {
          showTooltip("Saved to Compendium \u2713", "success", pos.x, pos.y);
        } else {
          showTooltip("Error: " + ((response && response.error) || "Failed").slice(0, 60), "error", pos.x, pos.y);
        }
      });
    }
  });

  // ─── Direct keyboard fallback ────────────────────────────────────────────────
  // Capture phase (true) so we intercept before the page's own handlers.

  document.addEventListener("keydown", function(e) {
    const isMac = /mac/i.test(navigator.platform);
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopImmediatePropagation();
      saveHighlight();
    }
  }, true);

  // ─── Website <-> Extension Bridge (Custom DOM Events) ──────────────────────

  document.dispatchEvent(new CustomEvent("HC_EXTENSION_PRESENT"));
  document.documentElement.setAttribute("data-hc-extension", "true");

  document.addEventListener("HC_GET_SETTINGS", function() {
    try {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, function(response) {
        document.dispatchEvent(new CustomEvent("HC_SETTINGS_RESPONSE", {
          detail: {
            apiToken: (response && response.apiToken) || "",
            dashboardUrl: (response && response.dashboardUrl) || "",
          }
        }));
      });
    } catch (e) {
      // Extension context invalidated
    }
  });

  document.addEventListener("HC_SAVE_SETTINGS", function(e) {
    const detail = (e && e.detail) || {};
    try {
      chrome.runtime.sendMessage(
        {
          type: "SAVE_SETTINGS",
          apiToken: detail.apiToken || "",
          dashboardUrl: detail.dashboardUrl || "",
        },
        function(response) {
          document.dispatchEvent(new CustomEvent("HC_SETTINGS_SAVED", {
            detail: { success: response && response.success }
          }));
        }
      );
    } catch (e) {
      // Extension context invalidated
    }
  });
})();
