// Background Service Worker — Highlight Compendium (MV3)
// Handles: keyboard command relay, context menu, API calls

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
      type: "SAVE_SELECTION",
      text: info.selectionText,
    });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "save-highlight" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" });
  }
});

// ─── Message Handler (from content script) ───────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    chrome.storage.sync.get(["apiToken", "dashboardUrl"], (items) => {
      sendResponse({ apiToken: items.apiToken || "", dashboardUrl: items.dashboardUrl || "" });
    });
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.sync.set(
      { apiToken: message.apiToken, dashboardUrl: message.dashboardUrl },
      () => sendResponse({ success: true }),
    );
    return true;
  }
});

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiToken", "dashboardUrl"], (items) => {
      resolve({
        apiToken: items.apiToken || "",
        dashboardUrl: (items.dashboardUrl || "").replace(/\/$/, ""),
      });
    });
  });
}

async function handleSaveHighlight(payload) {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken || !dashboardUrl) {
    throw new Error("Please configure your API token and dashboard URL in the extension settings.");
  }

  const url = `${dashboardUrl}/api/trpc/extension.saveHighlight`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      json: {
        apiToken,
        text: payload.text,
        sourceUrl: payload.sourceUrl,
        pageTitle: payload.pageTitle,
        domain: payload.domain,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to save highlight");
  }

  return data.result?.data?.json ?? data.result?.data;
}

async function handleGetRecent() {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken || !dashboardUrl) {
    return [];
  }

  const params = encodeURIComponent(JSON.stringify({ json: { apiToken, limit: 5 } }));
  const url = `${dashboardUrl}/api/trpc/extension.getRecent?input=${params}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return data.result?.data?.json ?? data.result?.data ?? [];
}
