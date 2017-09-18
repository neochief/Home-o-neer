$(function () {
    var Popup = {
        email: null,
        homemoney_token: null,
        settingsReady: false,

        start: function () {
            this.translate();
            setTimeout(function(){
            debugger;
                this.attachListeners();
                this.init();
            }.bind(this), 3000)
        },

        init: function () {
            $('.pane:not(.loading)').hide();
            $('.loading').show();

            this.homemoney_token = this.loadSavedToken();
            if (this.homemoney_token == undefined) {
                $('.loading').hide();
                $('.homemoney-link-form').show();
                return;
            }

            this.syncData(function () {
                if (!this.validateSettings(this.loadSavedSettings())) {
                    $('.homemoney-settings').show();
                    $('.homemoney-settings #profile').prop('disabled', true);
                }
                else {
                    $('.actions').show();
                    $('.homemoney-settings #profile').prop('disabled', false);
                }
            }.bind(this));
        },

        loadSavedToken: function () {
            var token_data = localStorage['homemoney-token'];
            try {
                token_data = JSON.parse(token_data);
                if (this.tokenExpired(token_data)) {
                    token_data = undefined;
                }
            }
            catch (e) {
                token_data = undefined;
            }
            return token_data ? token_data.token : null;
        },

        tokenExpired: function (token_data) {
            return token_data.created + token_data.expiration < Math.floor(Date.now() / 1000)
        },

        loadSavedSettings: function () {
            var settings = localStorage.getItem("homemoney-settings");
            try {
                settings = JSON.parse(settings);
            }
            catch (e) {
                settings = undefined;
            }
            settings = settings || {};
            if (settings.default == undefined) {
                settings = {default: settings};
            }
            return settings;
        },

        validateSettings: function (settings) {
            return !(settings == undefined || !settings || settings.default == undefined || !settings.default ||
            settings.default.payoneer_account == undefined || !settings.default.payoneer_account || $('#homemoney-payoneer-account option[value=' + settings.default.payoneer_account + ']').length == 0 ||
            settings.default.withdraw_account == undefined || !settings.default.withdraw_account || $('#homemoney-withdraw-account option[value=' + settings.default.withdraw_account + ']').length == 0 ||
            settings.default.payoneer_fees_category == undefined || !settings.default.payoneer_fees_category || $('#homemoney-payoneer-fees-category option[value=' + settings.default.payoneer_fees_category + ']').length == 0);
        },

        getSettings: function (property, profile) {
            var settings = this.loadSavedSettings();

            profile = profile || 'default';

            if (settings[profile] != undefined && settings[profile][property] != undefined) {
                return settings[profile][property];
            }
            else {
                return settings.default[property];
            }
        },

        syncData: function (success, failure) {
            $('.pane:not(.loading)').hide();
            $('.loading').show();

            this.resetSettingForm();

            $('.homemoney-settings *').prop('disabled', true);

            this.settingsReady = false;
            getAccounts(this.homemoney_token, this.onGetAccounts(success), this.onSettingsFail(failure));
            getCategories(this.homemoney_token, this.onGetCategories(success), this.onSettingsFail(failure));
        },

        resetSettingForm: function () {

            $('#profile').empty();
            $('#profile').append('<option value="default">' + chrome.i18n.getMessage("popup_homemoney_settings_profile_default") + '</option>');

            var settings = this.loadSavedSettings();
            var saved_profiles = Object.keys(settings);
            for (var i = 0; i < saved_profiles.length; i++) {
                if (saved_profiles[i] == 'default') continue;
                $('#profile').append('<option value="' + saved_profiles[i] + '">' + saved_profiles[i] + '</option>');
            }

            $('#profile').append('<option value="add">' + chrome.i18n.getMessage("popup_homemoney_settings_profile_add") + '</option>');

            $('.homemoney-settings .homemoney-payoneer-card').hide().val('');
            $('.profile-remove').hide();
        },

        onGetAccounts: function (success) {
            return function (data) {
                var all = getPayoneerOrderedAccounts(data);
                $('#homemoney-payoneer-account').empty();
                var addedAnything = false;
                for (var i = 0; i < all.length; i++) {
                    var hasUSD = false;
                    for (var j = 0; j < all[i].ListCurrencyInfo.length; j++) {
                        if (['$', 'USD'].indexOf(all[i].ListCurrencyInfo[j].shortname) != -1) {
                            hasUSD = true;
                            break;
                        }
                    }
                    if (hasUSD) {
                        $('#homemoney-payoneer-account').append('<option value="' + all[i].id + '">' + all[i].group.name + '/' + all[i].name + '</option>');
                        addedAnything = true;
                    }
                }
                if (!addedAnything) {
                    $('.homemoney-payoneer-account').append('<div class="error">' + chrome.i18n.getMessage("popup_error_payoneer_account") + '</div>');
                }
                if (addedAnything && this.getSettings('payoneer_account')) {
                    $('#homemoney-payoneer-account').val(this.getSettings('payoneer_account'));
                }

                all = getWithdrawalAccounts(data);
                if (!all.length) {
                    $('.homemoney-payoneer-account').append('<div class="error">' + chrome.i18n.getMessage("popup_error_cash_account") + '</div>');
                }
                else {
                    $('#homemoney-withdraw-account').empty();
                    for (var i = 0; i < all.length; i++) {
                        $('#homemoney-withdraw-account').append('<option value="' + all[i].id + '">' + all[i].group.name + '/' + all[i].name + '</option>')
                    }
                    if (this.getSettings('withdraw_account')) {
                        $('#homemoney-withdraw-account').val(this.getSettings('withdraw_account'));
                    }
                }

                if (this.getSettings('integration_start_date')) {
                    $('#homemoney-integration-start-date').val(this.getSettings('integration_start_date'));
                }

                this.checkSettingsReady(success);
                this.settingsReady = true;
            }.bind(this);
        },

        onGetCategories: function (success) {
            return function (categories) {
                $('#homemoney-payoneer-fees-category').empty();
                var cat_list = [];
                for (var i = 0; i < categories.debit.length; i++) {
                    if (/Payoneer/g.test(categories.debit[i].FullName)) {
                        cat_list.push(categories.debit[i]);
                    }
                }
                for (var i = 0; i < categories.debit.length; i++) {
                    if (!/Payoneer/g.test(categories.debit[i].FullName)) {
                        cat_list.push(categories.debit[i]);
                    }
                }
                for (var i = 0; i < cat_list.length; i++) {
                    $('#homemoney-payoneer-fees-category').append('<option value="' + cat_list[i].id + '">' + cat_list[i].FullName + '</option>')
                }
                if (this.getSettings('payoneer_fees_category')) {
                    $('#homemoney-payoneer-fees-category').val(this.getSettings('payoneer_fees_category'));
                }

                this.checkSettingsReady(success);
                this.settingsReady = true;
            }.bind(this);
        },

        checkSettingsReady: function (success) {
            if (!this.settingsReady) return;

            $('.homemoney-settings *').prop('disabled', false);
            $('.loading').hide();
            if (typeof success == 'function') {
                success();
            }
        },

        onSettingsFail: function (failure) {
            return function () {
                $('.pane').hide();
                $('.loading').hide();

                if (typeof failure == 'function') {
                    failure();
                }
                $('.error-global').show();
                $('.homemoney-link-form h3').hide();
                $('.homemoney-link-form').show();
                $('.homemoney-link-form .homemoney-link').text(chrome.i18n.getMessage("popup_relink_homemoney_account"));
            }.bind(this);
        },

        attachListeners: function () {
            var that = this;

            $('.homemoney-link').click(function (e) {
                $('.error', this).remove();
                chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
                    if (request.method == 'DeliverHomemoneyToken') {
                        if (request.token == undefined || !request.token) {
                            $('.homemoney-link .error').remove();
                            $('.homemoney-link').append('<div class="error">' + chrome.i18n.getMessage("popup_error_token") + '</div>');
                        }
                        else {
                            that.init();
                        }
                    }
                });
                chrome.runtime.sendMessage({method: "RequestHomemoneyToken"});
            });

            $('.homemoney-settings #profile').bind('change', function (e) {
                var profile = $(this).val();
                $('.homemoney-payoneer-card').toggle(profile != 'default');
                $('.profile-remove').toggle(profile != 'default' && profile != 'add');

                if (profile == 'default' || profile == 'add') {
                    $('#homemoney-payoneer-card').val('');
                }
                else {
                    $('#homemoney-payoneer-card').val(profile);
                }
                $('#homemoney-payoneer-account').val(that.getSettings('payoneer_account', profile));
                $('#homemoney-withdraw-account').val(that.getSettings('withdraw_account', profile));
                $('#homemoney-payoneer-fees-category').val(that.getSettings('payoneer_fees_category', profile));
                $('#homemoney-integration-start-date').val(that.getSettings('integration_start_date', profile)).trim();
            });

            $('.homemoney-settings #profile-remove').bind('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                var profile = $('.homemoney-settings #profile').val();
                if (profile == 'default' || profile == 'add') return;

                var settings = that.loadSavedSettings();
                delete settings[profile];
                localStorage.setItem("homemoney-settings", JSON.stringify(settings));
                chrome.runtime.sendMessage({method: "HomemoneySettingsUpdated", settings: settings});
                that.init();
            });

            $('#homemoney-payoneer-card').bind('keyup', function () {
                if (this.value.length > 4) {
                    this.value = this.value.slice(this.value.length - 4, this.value.length);
                }
            });

            $('.homemoney-settings').submit(function (e) {
                e.preventDefault();
                $('.error', this).remove();

                var old_profile = $('.homemoney-settings #profile').val();
                var new_profile = $('#homemoney-payoneer-card').val().trim();
                if (old_profile == 'default') {
                    new_profile = 'default'
                }
                else {
                    if (new_profile.length != 4 || !$.isNumeric(new_profile)) {
                        $('.homemoney-payoneer-card').append('<div class="error">' + chrome.i18n.getMessage("popup_error_card_digits") + '</div>');
                        return false;
                    }
                }

                var profile_settings = {
                    payoneer_account: $('#homemoney-payoneer-account').val(),
                    withdraw_account: $('#homemoney-withdraw-account').val(),
                    payoneer_fees_category: $('#homemoney-payoneer-fees-category').val(),
                    integration_start_date: $('#homemoney-integration-start-date').val().trim()
                };
                if (profile_settings.integration_start_date && !/^[1-2][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]$/g.test(profile_settings.integration_start_date)) {
                    $('.homemoney-integration-start-date').append('<div class="error">' + chrome.i18n.getMessage("popup_error_date_format") + '</div>');
                    return false;
                }

                var settings = that.loadSavedSettings();
                delete settings[old_profile];
                settings[new_profile] = profile_settings;
                localStorage.setItem("homemoney-settings", JSON.stringify(settings));
                chrome.runtime.sendMessage({method: "HomemoneySettingsUpdated", settings: settings});

                that.init();
                return false;
            });

            $('.actions .payoneer-account').click(function () {
                localStorage.setItem('payoneer_do_go_to_transactions', new Date().getTime());
                chrome.tabs.create({url: "https://myaccount.payoneer.com/MainPage/Transactions.aspx"});
            });

            $('.actions .settings').click(function () {
                debugger;
                that.syncData(function () {
                    $('.homemoney-settings').show();
                });
            });

            $('.actions .log-out').click(function () {
                localStorage.removeItem("email");
                localStorage.removeItem("homemoney-token");
                localStorage.removeItem("homemoney-settings");

                chrome.runtime.sendMessage({
                    method: "UpdateHomemoneyToken",
                    token_data: null
                });
                chrome.runtime.sendMessage({
                    method: 'DeliverCredentials',
                    email: null,
                });
                window.close();
            });
        },

        translate: function () {
            $('.loading h3 span').text(chrome.i18n.getMessage("loading"));
            $('.homemoney-link-form h3').text(chrome.i18n.getMessage("popup_homemoney_account"));
            $('.homemoney-link-form .homemoney-link').text(chrome.i18n.getMessage("popup_link_homemoney_account"));
            $('.homemoney-settings h3 .title').text(chrome.i18n.getMessage("popup_homemoney_settings"));
            $('.homemoney-settings h3 .profile label').text(chrome.i18n.getMessage("popup_homemoney_settings_profile"));
            $('.homemoney-settings h3 #profile option[value=default]').text(chrome.i18n.getMessage("popup_homemoney_settings_profile_default"));
            $('.homemoney-settings h3 #profile option[value=add]').text(chrome.i18n.getMessage("popup_homemoney_settings_profile_add"));
            $('.homemoney-settings .homemoney-payoneer-card label').text(chrome.i18n.getMessage("popup_homemoney_payoneer_card"));
            $('.homemoney-settings .homemoney-payoneer-account label').text(chrome.i18n.getMessage("popup_homemoney_payoneer_account"));
            $('.homemoney-settings .homemoney-withdraw-account label').text(chrome.i18n.getMessage("popup_homemoney_withdraw_account"));
            $('.homemoney-settings .homemoney-payoneer-fees-category label').text(chrome.i18n.getMessage("popup_homemoney_payoneer_fees_category"));
            $('.homemoney-settings #homemoney-integration-start-date').attr('placeholder', chrome.i18n.getMessage("popup_date_format"));
            $('.homemoney-settings .homemoney-integration-start-date label').text(chrome.i18n.getMessage("popup_homemoney_integration_start_date"));
            $('.homemoney-settings .homemoney-settings-save').text(chrome.i18n.getMessage("popup_homemoney_settings_save"));
            $('.homemoney-settings #profile-remove').text(chrome.i18n.getMessage("popup_homemoney_settings_profile_remove"));
            $('.menu .payoneer-account a span').text(chrome.i18n.getMessage("popup_menu_payoneer_account"));
            $('.menu .settings a span').text(chrome.i18n.getMessage("popup_menu_settings"));
            $('.menu .help a span').text(chrome.i18n.getMessage("popup_menu_help"));
            $('.menu .log-out a span').text(chrome.i18n.getMessage("popup_menu_log_out"));
            $('.error-global span').text(chrome.i18n.getMessage("popup_error_global"));
        },
    };
    Popup.start();
});