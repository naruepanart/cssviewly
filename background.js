// Keep track if context menus have been created to avoid duplicates
let contextMenusCreated = false;
let cssCiewerContextMenusParent = null;

// --- Helper Function for Notifications ---
function showNotification(title, message) {
	// Make sure you have an icon file (e.g., icon48.png) in your extension package
	const icon = chrome.runtime.getURL("images/icon48.png"); // <-- Path specified here

	chrome.notifications.create({ // <-- API call using the icon
		type: 'basic',
		iconUrl: icon,            // <-- Chrome tries to load this URL
		title: title,
		message: message,
		priority: 0 // Optional: -2 to 2
	});
}


// --- Helper Function to Execute Script in Tab ---
// This function will be injected into the page to call the existing function
function callCssViewlyFunction(functionName, arg) {
	if (typeof window[functionName] === 'function') {
		window[functionName](arg);
	} else {
		console.error(`CSSViewly: ${functionName} function not found in page context.`);
		// Optionally, notify the user via background notification if critical
	}
}

// --- Context Menu Click Handlers (Updated) ---
function cssCiewerDebugHandler(info, tab, functionName, arg) {
	if (tab && tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("https://chrome.google.com/")) {
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: callCssViewlyFunction, // Inject the helper
			args: [functionName, arg]     // Pass function name and its argument
		}).catch(err => console.error(`CSSViewly: Error executing script for ${functionName}: ${err}`));
	} else {
		console.log("CSSViewly: Cannot execute script on this page or tab ID missing.");
		// Optionally show a notification
		showNotification("CSSViewly:", "Cannot run this command on the current page.");
	}
}

// Specific handlers now just call the generic one
function cssCiewerDebugEl(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'el'); }
function cssCiewerDebugElId(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'id'); }
function cssCiewerDebugElTagName(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'tagName'); }
function cssCiewerDebugElClassName(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'className'); }
function cssCiewerDebugElStyle(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'style'); }
function cssCiewerDebugElCssText(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'cssText'); }
function cssCiewerDebugElGetComputedStyle(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'getComputedStyle'); }
function cssCiewerDebugElSimpleCssDefinition(info, tab) { cssCiewerDebugHandler(info, tab, 'cssviewlyCopyCssToConsole', 'simpleCssDefinition'); }


// --- Create Context Menus (Only Once) ---
function setupContextMenus() {
	if (contextMenusCreated) {
		return; // Already set up
	}
	// Ensure removal of old menus in case of service worker restart/update issues
	chrome.contextMenus.removeAll(() => {
		cssCiewerContextMenusParent = chrome.contextMenus.create({ id: "cssviewlyParent", title: "CSSViewly console", contexts: ["all"] });

		chrome.contextMenus.create({ id: "cssviewlyEl", title: "element", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyId", title: "element.id", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyTagName", title: "element.tagName", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyClassName", title: "element.className", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyStyle", title: "element.style", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyCssText", title: "element.cssText", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlyComputed", title: "element.getComputedStyle", contexts: ["all"], parentId: cssCiewerContextMenusParent, });
		chrome.contextMenus.create({ id: "cssviewlySimpleDef", title: "element.simpleCssDefinition", contexts: ["all"], parentId: cssCiewerContextMenusParent });

		contextMenusCreated = true;
		console.log("CSSViewly: Context menus created.");
	});
}

// --- Event Listeners ---

// Run on install/update - Good place for setup
chrome.runtime.onInstalled.addListener(details => {
	console.log("CSSViewly installed or updated:", details.reason);
	setupContextMenus(); // Set up menus on install/update

	// Optional: Open options page on first install or update
	// if (details.reason == "install" || details.reason == "update") {
	//     chrome.runtime.openOptionsPage(); // Preferred over creating a tab directly
	// }
});

// Run on browser startup (service worker might start here)
chrome.runtime.onStartup.addListener(() => {
	console.log("CSSViewly starting up...");
	setupContextMenus(); // Ensure menus are set up on startup too
});


// Action Button Clicked (Extension Icon)
chrome.action.onClicked.addListener((tab) => {
	// Check for restricted URLs
	if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("https://chrome.google.com/")) {
		// Use notification instead of alert
		showNotification("CSSViewly Warning", "CSSViewly cannot run on the Chrome Web Store or internal Chrome pages.");
		console.log("CSSViewly: Blocked on restricted URL:", tab.url);
		return;
	}

	// Ensure context menus are set up if the service worker restarted
	setupContextMenus();

	// Inject CSS using scripting API
	chrome.scripting.insertCSS({
		target: { tabId: tab.id },
		files: ['CSSViewly.css']
	}).then(() => {
		console.log("CSSViewly: CSS injected successfully.");
		// Inject JS using scripting API *after* CSS (or concurrently if order doesn't matter)
		return chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: ['CSSViewly.js']
		});
	}).then(() => {
		console.log("CSSViewly: JS injected successfully.");
		// Optional: Send a message to the content script if needed after injection
		// chrome.tabs.sendMessage(tab.id, { action: "cssviewlyLoaded" });
	}).catch(err => {
		console.error(`CSSViewly: Failed to inject script or CSS: ${err}`, err);
		showNotification("CSSViewly Error", "Failed to load CSSViewly resources. Check console for details.");
	});
});

console.log("CSSViewly background script loaded.");
// Initial setup in case the service worker starts but onInstalled/onStartup don't fire immediately
setupContextMenus();
