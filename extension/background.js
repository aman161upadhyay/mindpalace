// Background Service Worker — Highlight Compendium (MV3)
// Fixed: onCommand tab lookup, hardcoded URL/token, context menu duplicate guard

const DASHBOARD_URL = "https://mindpalace-bice.vercel.app";
const API_TOKEN = "hc_89523f01462935157e81b0935f2535723d2eb9a3";

// ─── Install / Update ────────────────────────────────────────────────────────
// Always write the correct URL+token on install AND on every service worker
// startup, so they are never stale even if chrome.storage was wiped.

function ensureSettings() {
  chrome.storage.sync.set({
    dashboardUrl: DASHBOARD_URL,
    apiToken: API_TOKEN,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureSettings();

  // Remove any existing context menu items first to avoid "duplicate id" errors
  // when the service worker restarts (which re-runs onInstalled in some cases).
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-highlight",
      title: "Save to Compendium",
      contexts: ["selection"],
    });
  });
});

// Also ensure settings are fresh every time the service worker wakes up.
ensureSettings();

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-highlight" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TRIGGER_SAVE",
    }, () => { void chrome.runtime.lastError; });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────
// CRITICAL FIX: In MV3, the `tab` param of onCommand is unreliable (often
// undefined). Always query the active tab explicitly.

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-highlight") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;

    // Guard: content scripts cannot run on chrome:// or edge:// pages
    const url = tab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") || url.startsWith("about:")) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, () => {
      // Swallow "Could not establish connection" — happens on pages where the
      // content script hasn't loaded yet (e.g. PDF viewer, new tab).
      void chrome.runtime.lastError;
    });
  });
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SAVE_HIGHLIGHT") {
    handleSaveHighlight(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "GET_RECENT") {
    handleGetRecent()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    sendResponse({ apiToken: API_TOKEN, dashboardUrl: DASHBOARD_URL });
    return false;
  }

  if (message.type === "SAVE_SETTINGS") {
    // Accept settings from popup but always keep our hardcoded values as fallback
    const updates = {};
    if (message.apiToken) updates.apiToken = message.apiToken;
    if (message.dashboardUrl) updates.dashboardUrl = message.dashboardUrl;
    chrome.storage.sync.set(updates, () => sendResponse({ success: true }));
    return true;
  }
});

// ─── API: Save Highlight ──────────────────────────────────────────────────────

async function handleSaveHighlight(payload) {
  const response = await fetch(`${DASHBOARD_URL}/api/extension/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiToken: API_TOKEN,
      text: payload.text,
      sourceUrl: payload.sourceUrl,
      pageTitle: payload.pageTitle,
      domain: payload.domain,
    }),
  });

  if (!response.ok) {
    let errText = "";
    try { errText = await response.text(); } catch (_) {}
    throw new Error(`Save failed (${response.status}): ${errText.slice(0, 150)}`);
  }

  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

// ─── API: Get Recent ──────────────────────────────────────────────────────────

async function handleGetRecent() {
  try {
    const response = await fetch(
      `${DASHBOARD_URL}/api/extension/recent?apiToken=${encodeURIComponent(API_TOKEN)}`,
      { method: "GET" }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (_) {
    return [];
  }
}
