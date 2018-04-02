$ = jQuery;

var app = {
    HOMEMONEY_APP_ID: 46,
    transaction_tabs: [],
    rememberTab: function(id) {
        this.transaction_tabs.push(id);
    },
    forgetTab: function(id) {
        var index = this.transaction_tabs.indexOf(id);
        if (index > -1) {
            this.transaction_tabs.splice(index, 1);
        }
    },
    get_token: function(token_data) {
        token_data = token_data || localStorage['homemoney-token'];
        try {
            token_data = JSON.parse(token_data);
            if (this.token_expired(token_data)) {
                token_data = undefined;
            }
        }
        catch (e) {
            token_data = undefined;
        }
        return token_data ? token_data.token : null;
    },
    save_token: function(token_data) {
        if (token_data && typeof token_data == "object") {
            localStorage['homemoney-token'] = JSON.stringify(token_data);
            return token_data.token;
        }
        else {
            localStorage.removeItem('homemoney-token');
        }
    },
    token_expired: function(token_data) {
        return token_data.created + token_data.expiration < Math.floor(Date.now() / 1000)
    },
    deliver_token: function(token) {
        for (var i = 0; i < this.transaction_tabs.length; i++) {
            chrome.tabs.sendMessage(this.transaction_tabs[i], {
                method: 'DeliverHomemoneyToken',
                token: token
            });
        }
        chrome.runtime.sendMessage({
            method: 'DeliverHomemoneyToken',
            token: token
        });
    },
    loadSavedSettings: function() {
        var settings = localStorage.getItem("homemoney-settings");
        try {
            settings = JSON.parse(settings);
            if (settings.default == undefined) {
                settings = { default: settings };
            }
        }
        catch (e) {
            settings = undefined;
        }
        return settings;
    },
    // ----------------------------------------- //
    // Chrome messaging methods ---------------- //
    // ----------------------------------------- //
    RequestHomemoneyToken: function(request, sender, sendResponse) {
        if (sender.tab != undefined) {
            this.rememberTab(sender.tab.id);
        }

        var token = this.get_token();

        if (!request.just_checking && !token) {
            var params = {
                url: "https://homemoney.ua/api/oauth/authorize/m/?response_type=token&client_id=" + this.HOMEMONEY_APP_ID + "&scope=api"
            };
            // There are 2 cases: when you request token through popup or through the actual Export button in
            // transactions. First doesn't have tab, but the second has.
            if (sender.tab != undefined) {
                params.openerTabId = sender.tab.id;
            }
            chrome.tabs.create(params);
        }
        else {
            this.deliver_token(token);
        }
    },
    UpdateHomemoneyToken: function(request, sender, sendResponse) {
        var token = this.save_token(request.token_data);
        this.deliver_token(token);

        if (sender.tab != undefined) {
            if (sender.tab.openerTabId != undefined) {
                chrome.tabs.update(sender.tab.openerTabId, {active: true});
            }
            else if (this.transaction_tabs.length) {
                chrome.tabs.update(this.transaction_tabs[this.transaction_tabs.length - 1], {active: true});
            }
            chrome.tabs.remove(sender.tab.id);
        }
    },
    RequestHomemoneySettings: function(request, sender, sendResponse) {
        sendResponse(this.loadSavedSettings());
    },
    HomemoneySettingsUpdated: function(request, sender, sendResponse) {
        for (var i = 0; i < this.transaction_tabs.length; i++) {
            chrome.tabs.sendMessage(this.transaction_tabs[i], {
                method: 'HomemoneySettingsUpdated',
                settings: request.settings
            });
        }
    },
    DoGoToTransactions: function(request, sender, sendResponse){
        var payoneer_do_go_to_transactions = localStorage.getItem('payoneer_do_go_to_transactions');
        if (payoneer_do_go_to_transactions) {
            if ((parseInt(payoneer_do_go_to_transactions) + 180) < new Date().getTime()) {
                sendResponse(true);
            }
            localStorage.removeItem('payoneer_do_go_to_transactions');
        }
    },
    ArrivedToTransactions: function(request, sender, sendResponse){
        localStorage.removeItem('payoneer_do_go_to_transactions');
    }
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (typeof app[request.method] == "function") {
        app[request.method].call(app, request, sender, sendResponse);
    }
});
chrome.tabs.onRemoved.addListener(app.forgetTab.bind(app));

