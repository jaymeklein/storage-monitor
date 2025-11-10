// Store the last known value for this domain and key
let lastValue = null;
let isMonitoring = false;

// Function to start monitoring localStorage
function startMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;
  
  console.log('Starting localStorage monitoring...');
  
  // Override localStorage methods to detect changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    const oldValue = localStorage.getItem(key);
    const result = originalSetItem.apply(this, arguments);
    
    // Notify about the change
    setTimeout(() => notifyStorageChange(key, value, oldValue), 0);
    return result;
  };

  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function(key) {
    const oldValue = localStorage.getItem(key);
    const result = originalRemoveItem.apply(this, arguments);
    
    // Notify about the change (value is now null)
    setTimeout(() => notifyStorageChange(key, null, oldValue), 0);
    return result;
  };

  const originalClear = localStorage.clear;
  localStorage.clear = function() {
    // Get all keys before clearing
    const keys = Object.keys(localStorage);
    const oldValues = {};
    keys.forEach(key => {
      oldValues[key] = localStorage.getItem(key);
    });
    
    const result = originalClear.apply(this, arguments);
    
    // Notify about each key being removed
    keys.forEach(key => {
      setTimeout(() => notifyStorageChange(key, null, oldValues[key]), 0);
    });
    
    return result;
  };
}

function notifyStorageChange(key, newValue, oldValue) {
  console.log('Storage change detected:', { key, newValue, oldValue });
  
  // Get the monitored key from storage
  chrome.storage.sync.get(['monitoredKey']).then((result) => {
    const monitoredKey = result.monitoredKey;
    
    if (monitoredKey === key) {
      const domain = window.location.hostname;
      
      // Send notification to popup
      chrome.runtime.sendMessage({
        action: 'storageUpdated',
        domain: domain,
        key: key,
        value: newValue,
        oldValue: oldValue
      }).then(() => {
        console.log('Storage change message sent to popup');
      }).catch(error => {
        console.error('Failed to send message to popup:', error);
      });
      
      // Also update lastValue
      lastValue = newValue;
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStorageValue') {
    try {
      const value = localStorage.getItem(request.key);
      lastValue = value; // Update last known value
      sendResponse({ 
        value: value,
        exists: value !== null
      });
    } catch (error) {
      console.error('Error reading localStorage:', error);
      sendResponse({ 
        value: null,
        error: error.message 
      });
    }
  }
  return true; // Keep message channel open for async response
});

// Start monitoring when content script loads
startMonitoring();

// Initialize lastValue when content script loads
chrome.storage.sync.get(['monitoredKey']).then((result) => {
  if (result.monitoredKey) {
    lastValue = localStorage.getItem(result.monitoredKey);
    console.log('Initialized monitoring for key:', result.monitoredKey, 'value:', lastValue);
  }
});