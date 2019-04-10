var Messenger = {
    send: function (method, data, callback) {
        data = data || {};
        data.method = method;
        chrome.runtime.sendMessage(data, callback);
    },
    sendToTab: function (tab, method, data, callback) {
        data = data || {};
        data.method = method;
        chrome.tabs.sendMessage(tab, data, callback);
    },
    listen: function (method, callback) {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (typeof method == "function" && !callback) {
                return method(request, sender, sendResponse);
            }
            else if (request.method == method) {
                return callback(request, sender, sendResponse);
            }
        });
    }
};