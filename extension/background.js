// Background Service Worker — Highlight Compendium (MV3)
// Handles: keyboard command relay, context menu, API calls

const DEFAULT_DASHBOARD_URL = "https://your-app.vercel.app";

// ─── Context Menu Setup ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
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
      type: "TRIGGER_SAVE",
    });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "save-highlight" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" });
  }
});

// ─── Settings Helpers ─────────────────────────────────────────────────────────

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["apiToken", "dashboardUrl", "theme", "hasSeenTutorial"],
      (items) => {
        resolve({
          apiToken: items.apiToken || "",
          dashboardUrl: (items.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/$/, ""),
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

  if (!apiToken || !dashboardUrl) {
    throw new Error(
      "Please configure your API token and dashboard URL in the extension settings."
    );
  }

  const response = await fetch(`${dashboardUrl}/api/extension/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiToken,
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

  return response.json();
}

async function handleGetRecent() {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken || !dashboardUrl) {
    return [];
  }

  const response = await fetch(
    `${dashboardUrl}/api/extension/recent?apiToken=${encodeURIComponent(apiToken)}`,
    { method: "GET" }
  );

  if (!response.ok) return [];
  return response.json();
}
