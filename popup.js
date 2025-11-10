// Get current tab URL
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Load settings from storage
async function loadSettings() {
  const result = await chrome.storage.sync.get(['monitoredKey']);
  return result.monitoredKey || '';
}

// Update the popup with current storage value
async function updatePopup() {
  const tab = await getCurrentTab();
  const tabUrl = tab.url ? new URL(tab.url) : null;
  
  if (tabUrl) {
    const domain = tabUrl.hostname;
    document.getElementById('current-site').textContent = domain;
  } else {
    document.getElementById('current-site').textContent = 'N/A';
  }
  
  const keyToMonitor = await loadSettings();
  document.getElementById('key-input').value = keyToMonitor;
  
  if (keyToMonitor && tab.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getStorageValue',
        key: keyToMonitor
      });
      
      if (response && response.value !== undefined) {
        const displayValue = formatValueForDisplay(response.value);
        document.getElementById('value-display').value = displayValue;
      } else {
        document.getElementById('value-display').value = '';
      }
    } catch (error) {
      document.getElementById('value-display').value = '';
      console.log('Could not get storage value (page may not be loaded):', error);
    }
  } else {
    document.getElementById('value-display').value = '';
  }
}

function formatValueForDisplay(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  try {
    // Try to parse as JSON for pretty formatting
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(value);
  } catch {
    // If not JSON, return as string
    return String(value);
  }
}

// Save the key to monitor
function saveKey(key) {
  chrome.storage.sync.set({ monitoredKey: key }, () => {
    showStatus('Key saved!');
    updatePopup();
  });
}

// Copy value to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showStatus('Copied to clipboard!');
  }).catch(err => {
    showStatus('Failed to copy');
    console.error('Copy failed:', err);
  });
}

// Show status message
function showStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

// Visual feedback for value changes
function highlightValueChange() {
  const textarea = document.getElementById('value-display');
  textarea.classList.add('value-change');
  setTimeout(() => {
    textarea.classList.remove('value-change');
  }, 1000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', updatePopup);

document.getElementById('key-input').addEventListener('input', (e) => {
  const key = e.target.value.trim();
  if (key) {
    saveKey(key);
  }
});

document.getElementById('key-input').addEventListener('blur', (e) => {
  const key = e.target.value.trim();
  saveKey(key);
});

document.getElementById('copy-btn').addEventListener('click', () => {
  const value = document.getElementById('value-display').value;
  if (value) {
    copyToClipboard(value);
  } else {
    showStatus('No value to copy');
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.monitoredKey) {
    updatePopup();
  }
});

// Listen for value change messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'storageUpdated') {
    console.log('Value change received in popup:', request);
    const displayValue = formatValueForDisplay(request.value);
    document.getElementById('value-display').value = displayValue;
    highlightValueChange();
    
    // Show change notification in status
    const oldValue = request.oldValue === null ? 'null' : request.oldValue;
    const newValue = request.value === null ? 'null' : request.value;
    showStatus(`Value changed: ${oldValue} → ${newValue}`);
  }
});