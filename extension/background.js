// Background Service Worker — Mind Palace (MV3)

const DEFAULT_DASHBOARD_URL = "https://themindpalace.org";
// Store installs have an update_url; unpacked (developer) installs do not.
const IS_UNPACKED = !("update_url" in chrome.runtime.getManifest());

// Helper to get dynamic settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiToken", "dashboardUrl"], (items) => {
      resolve({
        apiToken: items.apiToken || "",
        dashboardUrl: (items.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/$/, "")
      });
    });
  });
}

// Only https servers (or localhost for developer installs) may be used as the dashboard.
function normalizeDashboardUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol === "https:") return u.origin;
    if (IS_UNPACKED && u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return u.origin;
  } catch (_) {}
  return "";
}

// If the saved server address now redirects to a new home, remember the new one.
function rememberRedirect(response, currentUrl) {
  try {
    if (!response.redirected) return;
    const next = new URL(response.url);
    if (next.protocol === "https:" && next.origin !== new URL(currentUrl).origin) {
      chrome.storage.sync.set({ dashboardUrl: next.origin });
    }
  } catch (_) {}
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
}

// Short visual confirmation on the toolbar icon (used where no page tooltip can be shown, e.g. PDFs).
function flashBadge(text, color) {
  try {
    chrome.action.setBadgeBackgroundColor({ color });
    chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
  } catch (_) {}
}

async function friendlyError(response) {
  let serverMsg = "";
  try { serverMsg = (await response.json()).error || ""; } catch (_) {}
  if (response.status === 401) return "Your Mind Palace sign-in has expired. Open themindpalace.org and sign in again.";
  if (response.status === 429) return "Too many saves in a minute. Please wait a moment and try again.";
  if (response.status === 400 && serverMsg) return serverMsg;
  return `Mind Palace server error (${response.status}). Please try again later.`;
}

chrome.runtime.onInstalled.addListener(() => {
  // Remove any existing context menu items first to avoid "duplicate id" errors
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-highlight",
      title: "Save to Mind Palace",
      contexts: ["selection"],
    });
  });
});

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-highlight" || !info.selectionText) return;

  // Fallback for places the content script cannot reach: Chrome's PDF viewer, iframes, pages
  // opened before the extension was installed. The menu already gives us the selected text.
  const saveDirectly = () => {
    const sourceUrl = info.frameUrl || info.pageUrl || (tab && tab.url) || "";
    handleSaveHighlight({
      text: info.selectionText,
      sourceUrl,
      pageTitle: (tab && tab.title) || "",
      domain: hostOf(sourceUrl),
    })
      .then(() => flashBadge("✓", "#16a34a"))
      .catch(() => flashBadge("!", "#dc2626"));
  };

  if (!tab || typeof tab.id !== "number" || tab.id < 0 || (info.frameId && info.frameId !== 0)) {
    saveDirectly();
    return;
  }
  // The menu already knows the selected text (it works in PDFs too), so hand it to the page script.
  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE", selectionText: info.selectionText }, { frameId: 0 }, () => {
    if (chrome.runtime.lastError) saveDirectly();
  });
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-highlight") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, { frameId: 0 }, () => {
      // Only a page with no Mind Palace script at all (chrome:// pages, the Web Store) gets here.
      const err = chrome.runtime.lastError;
      if (err && /Receiving end does not exist|Could not establish connection/i.test(err.message || "")) {
        flashBadge("?", "#d97706");
        try { chrome.action.setTitle({ title: "Mind Palace can't save from this page. Try a normal web page or PDF." }); } catch (_) {}
      }
    });
  });
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only this extension's own pages and content scripts may talk to the background.
  if (sender.id !== chrome.runtime.id) return;

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
    getSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const updates = {};
    if (typeof message.apiToken === "string") updates.apiToken = message.apiToken.trim();
    if (typeof message.dashboardUrl === "string") {
      const url = message.dashboardUrl === "" ? "" : normalizeDashboardUrl(message.dashboardUrl);
      if (message.dashboardUrl !== "" && !url) {
        sendResponse({ success: false, error: "The server address must start with https://" });
        return;
      }
      updates.dashboardUrl = url;
    }
    chrome.storage.sync.set(updates, () => sendResponse({ success: true }));
    return true;
  }
});

// ─── API: Save Highlight ──────────────────────────────────────────────────────

async function handleSaveHighlight(payload) {
  const { apiToken, dashboardUrl } = await getSettings();

  if (!apiToken) {
    throw new Error("Not connected yet. Sign in at themindpalace.org to connect the extension.");
  }

  let response;
  try {
    response = await fetch(`${dashboardUrl}/api/extension/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken,
        text: payload.text,
        sourceUrl: payload.sourceUrl,
        pageTitle: String(payload.pageTitle || "").slice(0, 500),
        domain: payload.domain,
      }),
    });
  } catch (_) {
    throw new Error("Can't reach Mind Palace. Check your internet connection.");
  }

  rememberRedirect(response, dashboardUrl);

  if (!response.ok) throw new Error(await friendlyError(response));

  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

// ─── API: Get Recent ──────────────────────────────────────────────────────────

async function handleGetRecent() {
  const { apiToken, dashboardUrl } = await getSettings();
  if (!apiToken) return [];

  const headers = { "Authorization": `Bearer ${apiToken}` };
  let response;
  try {
    response = await fetch(`${dashboardUrl}/api/extension/recent`, { method: "GET", headers });
    rememberRedirect(response, dashboardUrl);
    // Browsers drop Authorization on cross-origin redirects, so retry once at the new address.
    if (response.redirected && response.status === 401) {
      const newOrigin = new URL(response.url).origin;
      response = await fetch(`${newOrigin}/api/extension/recent`, { method: "GET", headers });
    }
  } catch (_) {
    throw new Error("Can't reach Mind Palace. Check your internet connection.");
  }
  if (!response.ok) throw new Error(await friendlyError(response));
  return await response.json();
}
