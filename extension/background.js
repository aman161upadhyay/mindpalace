// Background Service Worker — Highlight Compendium (MV3)
// Handles: keyboard command relay, context menu, API calls

const HARDCODED_DASHBOARD_URL = "https://mindpalace-bice.vercel.app";
const HARDCODED_API_TOKEN = "hc_89523f01462935157e81b0935f2535723d2eb9a3";

// ─── Auto-initialise settings on install / update ────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["dashboardUrl", "apiToken"], (items) => {
    const updates = {};
    if (!items.dashboardUrl || items.dashboardUrl.includes("your-app.vercel.app")) {
      updates.dashboardUrl = HARDCODED_DASHBOARD_URL;
    }
    if (!items.apiToken) {
      updates.apiToken = HARDCODED_API_TOKEN;
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });

  chrome.contextMenus.create({
    id: "save-highlight",
    title: "Save to Compendium",
    contexts: ["selection"],
  });
});

// ─── Context Menu Click ───────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-highlight" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "SAVE_SELECTION",
      text: info.selectionText,
    });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────
// NOTE: In MV3, the `tab` parameter of onCommand is NOT reliable — it can be
// undefined. Always query the active tab explicitly.

chrome.commands.onCommand.addListener((command) => {
  if (command === "save-highlight") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, () => {
          // Suppress "Could not establish connection" errors for pages where
          // the content script cannot run (e.g. chrome:// pages).
          if (chrome.runtime.lastError) {
            console.warn(
              "[HC] Could not send TRIGGER_SAVE:",
              chrome.runtime.lastError.message
            );
          }
        });
      }
    });
  }
});

// ─── Settings Helpers ─────────────────────────────────────────────────────────

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["apiToken", "dashboardUrl", "theme", "hasSeenTutorial"],
      (items) => {
        let currentUrl = items.dashboardUrl;
        if (!currentUrl || currentUrl.includes("your-app.vercel.app")) {
          currentUrl = HARDCODED_DASHBOARD_URL;
        }

        resolve({
          apiToken: items.apiToken || HARDCODED_API_TOKEN,
          dashboardUrl: currentUrl.replace(/\/$/, ""),
          theme: items.theme || "dark",
          hasSeenTutorial: items.hasSeenTutorial || false,
        });
      }
    );
  });
}

function saveSettings(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => resolve(true));
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_HIGHLIGHT") {
    handleSaveHighlight(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_RECENT") {
    handleGetRecent()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then((settings) => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const updates = {};
    if (message.apiToken !== undefined) updates.apiToken = message.apiToken;
    if (message.dashboardUrl !== undefined) updates.dashboardUrl = message.dashboardUrl;
    if (message.theme !== undefined) updates.theme = message.theme;
    if (message.hasSeenTutorial !== undefined) updates.hasSeenTutorial = message.hasSeenTutorial;
    saveSettings(updates).then(() => sendResponse({ success: true }));
    return true;
  }
});

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function handleSaveHighlight(payload) {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken) {
    throw new Error("API token not configured. Please visit the dashboard to connect.");
  }

  const token = apiToken;
  const baseUrl = (dashboardUrl || HARDCODED_DASHBOARD_URL).replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/api/extension/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiToken: token,
      text: payload.text,
      sourceUrl: payload.sourceUrl,
      pageTitle: payload.pageTitle,
      domain: payload.domain,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = await response.json().catch(() => {
    throw new Error("Invalid response from server");
  });
  return json;
}

async function handleGetRecent() {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken) return [];

  const baseUrl = (dashboardUrl || HARDCODED_DASHBOARD_URL).replace(/\/$/, "");

  try {
    const response = await fetch(
      `${baseUrl}/api/extension/recent?apiToken=${encodeURIComponent(apiToken)}`,
      { method: "GET" }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}
