$ = jQuery;

var messenger = {
    send: function (method, data, callback) {
        data = data || {};
        data.method = method;
        chrome.runtime.sendMessage(data, callback);
    },
    listen: function (method, callback) {
        chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
            if (request.method == method) {
                callback(request, sendResponse);
            }
        });
    }
};

// 3 Jan 2018 -> 2016-01-15 09:56:00
function amDateToISO2(amDate) {
    var date = amDate.split(" ");
    date = pad(date[2], 4) + "-" + pad(date[2], 2) + "-" + pad(date[0], 2);
    var time = date.length > 3 ? temp[3] : '00:00:00';
    time = time.split(':');
    if (time.length == 2) {
        time.push('00');
    }
    for (var i = 0; i < time.length; i++) {
        time[i] = pad(time[i], 2);
    }
    time = time.join(':');
    return date + ' ' + time;
}

// 01/15/2016 09:56 -> 2016-01-15 09:56:00
function amDateToISO(amDate) {
    var temp = amDate.split(" ");
    var date = temp[0].split("/");
    date = pad(date[2], 4) + "-" + pad(date[0], 2) + "-" + pad(date[1], 2);
    var time = temp.length > 1 ? temp[1] : '00:00:00';
    time = time.split(':');
    if (time.length == 2) {
        time.push('00');
    }
    for (var i = 0; i < time.length; i++) {
        time[i] = pad(time[i], 2);
    }
    time = time.join(':');
    return date + ' ' + time;
}

// 2016.01.15 09:56 -> 2016-01-15 09:56:00
function rusDateToISO(rusDate) {
    var temp = rusDate.split(" ");
    var date = temp[0].split(".");
    date = pad(date[2], 4) + "-" + pad(date[1], 2) + "-" + pad(date[0], 2);
    var time = temp.length > 1 ? temp[1] : '00:00:00';
    time = time.split(':');
    if (time.length == 2) {
        time.push('00');
    }
    for (var i = 0; i < time.length; i++) {
        time[i] = pad(time[i], 2);
    }
    time = time.join(':');
    return date + ' ' + time;
}

function formatDate(date) {
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();

    if (day < 10) {
        day = '0' + day;
    }
    if (month < 10) {
        month = '0' + month;
    }

    return year + '-' + month + '-' + day;
}

var app = {
    fee_suffix: 'FEE',
    homemoney_token: null,
    USD_currency_id: null,
    categories: null,
    accounts: null,
    settings: null,
    transactions: null,
    account_select: [],
    account_select_count: [],
    ready: false,
    lastPayoneerData: null,
    start: function () {
        if (!document.getElementsByClassName('myaccount').length) {
            return;
        }
        messenger.send('ArrivedToTransactions');

        var first = true;
        this.getTokenOrWait(function (homemoney_token) {
            if (!first) return;
            first = false;

            console.log('s2: token success');
            this.homemoney_token = homemoney_token;
            this.loadHomemoneyData(homemoney_token);
        }.bind(this), function () {
            console.log('s2: token failed');
            if (this.homemoney_token) {
                this.destroy();
            }
        }.bind(this), true);


        var s = document.createElement('script');
        s.src = chrome.extension.getURL('js/tr.js');
        (document.head || document.documentElement).appendChild(s);
        s.onload = function () {
            s.remove();
        };

        document.addEventListener('Home-o-neer:getMainTransactions', function (e) {
            this.lastPayoneerData = {};
            for (var i = 0; i < e.detail.Transactions.length; i++) {
                this.lastPayoneerData[e.detail.Transactions[i].ActivityId] = e.detail.Transactions[i];
            }
            this.initIfReady();
        }.bind(this));

        document.addEventListener('Home-o-neer:getMoreTransactions', function (e) {
            for (var i = 0; i < e.detail.Transactions.length; i++) {
                this.lastPayoneerData[e.detail.Transactions[i].ActivityId] = e.detail.Transactions[i];
            }
            this.initIfReady();
        }.bind(this));
        
        $("body").on("click", ".load-more__btn", function(){
            setTimeout(function(){
                this.initIfReady();
            }.bind(this), 1000);
        }.bind(this));
    },
    getTokenOrWait: function (success, failure, just_checking) {
        messenger.listen('DeliverHomemoneyToken', function (request) {
            if (request.token == undefined || !request.token) {
                return typeof failure == "function" ? failure(request.token) : failure;
            }
            return typeof success == "function" ? success(request.token) : success;
        });
        messenger.send("RequestHomemoneyToken", {just_checking: just_checking});
    },
    loadHomemoneyData: function () {
        console.log('sl: loadHomemoneyData');

        getCategories(this.homemoney_token, function (categories) {
            console.log('s3: categories success');
            this.categories = categories;
            this.initIfReady();
        }.bind(this));

        getAccounts(this.homemoney_token, function (accounts) {
            console.log('s4: accounts success');
            this.accounts = accounts;
            this.initIfReady();
        }.bind(this));

        messenger.send("RequestHomemoneySettings", null, function (settings) {
            console.log('s5: settings success');
            this.settings = settings;
            this.initIfReady();
        }.bind(this));

        messenger.listen('HomemoneySettingsUpdated', function (request) {
            this.settings = request.settings;
            this.initIfReady();
        }.bind(this));

        this.loadTransactions(this.initIfReady.bind(this));
    },
    loadTransactions: function (callback) {
        var date = $('.date-picker__body__dropdown .value-wrapper').text();
        if (date) {
            var date = $('.date-picker__body__dropdown .value-wrapper').text().split(' - ');
            var from = amDateToISO2(date[0]);
            var to = amDateToISO2(date[1] + ' 23:59:59');
        }
        else {
            var today = new Date();
            today.setDate(today.getDate() - 90);
            from = moment(today).format('YYYY-MM-DD') + ' 00:00:00';
            to = moment().format('YYYY-MM-DD') + ' 23:59:59';
        }

        getTransactions(this.homemoney_token, from, to, function (transactions) {
            console.log('s6: transactions success');

            var account = this.getSettings('payoneer_account');
            if (account) {
                this.transactions = [];
                for (var i = 0; i < transactions.length; i++) {
                    if (transactions[i].AccountId == account) {
                        this.transactions.push(transactions[i]);
                    }
                }
            }
            else {
                this.transactions = transactions;
            }
            callback();
        }.bind(this));
    },
    getSettings: function (property) {
        var profile = $('option[value=' + $('#ddlAccounts').val() + ']').first().text().replace('Prepaid Card - XXXX-', '');
        if (this.settings[profile] != undefined && this.settings[profile][property] != undefined) {
            return this.settings[profile][property];
        }
        else {
            return this.settings.default[property];
        }
    },
    initIfReady: function () {
        console.log('| attempt to init');
        console.log("- categories:" + (this.categories ? "ok" : "null"));
        console.log("- accounts:" + (this.accounts ? "ok" : "null"));
        console.log("- settings:" + (this.settings ? "ok" : "null"));
        console.log("- transactions:" + (this.transactions ? "ok" : "null"));
        if (this.categories && this.accounts && this.settings && this.transactions) {
            this.USD_currency_id = getHomemoneyCurrencyId(this.accounts, this.getSettings('payoneer_account'), 'USD');
            this.init();
        }
    },
    init: function () {
        if (!this.lastPayoneerData) {
            return;
        }
        console.log('init!');

        this.renderHomemoneyHead();
        $('.transactions__body__tables__table-transactions tbody tr:not(.homemoney-processed)').each(function (index, row) {
            this.renderRow(row);
        }.bind(this));
    },
    renderHomemoneyHead: function () {
        if ($('.transactions__body__tables__table-transactions thead.homemoney-processed').length) return;

        $('.transactions__body__tables__table-transactions thead tr:first-child th:first-child').width(100);
        $('.transactions__body__tables__table-transactions thead tr:first-child').append('<th class="table__table-th categories">' + chrome.i18n.getMessage("payoneer_category") + '</th><th class="table__table-th plan">' + chrome.i18n.getMessage("payoneer_plan") + '</th><th class="table__table-th action">Action</th>');
        $('.transactions__body__tables__table-transactions thead').addClass('homemoney-processed');
    },
    renderRow: function (row) {
        row.className += ' homemoney-processed';

        var date = moment($('.column-date', row).text()).format('YYYY-MM-DD');
        var comment = $('.activity-description strong', row).text();
        var amount = $('.column-amount strong', row).text().replace(/ USD$/, '');

        var ind;
        var found = false;
        for (ind in this.lastPayoneerData) {
            if (!this.lastPayoneerData.hasOwnProperty(ind)) {
                return;
            }
            var tr = this.lastPayoneerData[ind];
            if (tr.homemoney === undefined &&
                date === moment(tr.Date).format('YYYY-MM-DD') &&
                (comment === tr.Description.Value || tr.TypeId == 20) &&
                amount === tr.Amount.ResParams.Amount) {

                tr.homemoney = true;
                found = true;

                break;
            }
        }

        if (!found) {
            return;
        }

        var data = {};
        data.id = tr.ActivityId;
        data.date = moment(tr.Date).format('YYYY-MM-DD hh:mm:ss');
        data.description = tr.Description.Value || comment;
        data.total = parseFloat(amount.replace(',', '').replace(/^\-/, ''));
        data.transaction_amount = data.total;
        data.transaction_currency = 'USD';
        data.transaction_fee = 0;

        data.typeId = tr.TypeId;
        switch (tr.TypeId) {
            // Withdraw to bank account.
            case 1:
                data.type = 'transfer';
                data.transfer_type = 'bank';
                break;
            // Regular debit transaction.
            case 2:
                data.type = 'debit';
                break;
            // ATM withdrawal.
            case 3:
                data.type = 'transfer';
                data.transfer_type = 'cash';
                break;
            // Money that came from partners.
            case 6:
                data.type = 'credit';
                // Immediate load fee is $5 (not included into visible total).
                data.total += 5;
                data.transaction_amount += 5;
                data.transaction_fee = 5;
                break;
            // Transfer to other Payoneer account.
            case 14:
                data.type = 'debit';
                break;
            // Transfer from other Payoneer account.
            case 15:
                data.type = 'credit';
                break;
            // Payoneer fees.
            case 20:
                data.type = 'debit';
                data.category = this.getSettings('payoneer_fees_category');
                break;
            default:
                console.error('Unknown type ID ' + tr.TypeId + '. (' + JSON.stringify(tr) + ')');
                return;
        }

        $(row).data('data', data);

        if (localStorage.getItem('ta' + data.id)) {
            data.transaction_amount = parseFloat(localStorage['ta' + data.id]);
            data.transaction_currency = localStorage['tc' + data.id];
            data.transaction_fee = parseFloat(localStorage['tf' + data.id]);
            this.renderRowControls(row, data);
            return;
        }

        if (data.type === 'transfer') {
            this.loadPayoneerTransactionDetails(data, function (data, upd) {
                if (data.transfer_type === 'cash') {
                    if (!upd.Details[1] ||
                        !upd.Details[1].Content[4] ||
                        !upd.Details[1].Content[4].Title ||
                        !upd.Details[1].Content[4].Title.ResKey ||
                        upd.Details[1].Content[4].Title.ResKey !== 'SidebarTransactionAmountTitle.Text') {
                        console.error("Something is wrong with details data structure, please check (SidebarTransactionAmountTitle.Text).\n\n Transaction data: ");
                        console.error(data);
                        console.error(upd);
                        return;
                    }

                    data.transaction_amount = parseFloat(upd.Details[1].Content[4].Values[0].ResParams.Amount.replace(',', ''));
                    data.transaction_currency = upd.Details[1].Content[4].Values[0].ResParams.Currency;
                    data.transaction_fee = parseFloat(upd.Details[0].Content[1].Values[0].ResParams.Amount.replace(',', ''));
                }
                else if (data.transfer_type === 'bank') {
                    if (!upd.Details[1] ||
                        !upd.Details[1].Content[1] ||
                        !upd.Details[1].Content[1].Title ||
                        !upd.Details[1].Content[1].Title.ResKey ||
                        upd.Details[1].Content[1].Title.ResKey !== 'SidebarTransferAmountTitle.Text') {
                        console.error("Something is wrong with details data structure, please check (SidebarTransactionAmountTitle.Text).\n\n Transaction data:");
                        console.error(data);
                        console.error(upd);
                        return;
                    }

                    data.transaction_amount = parseFloat(upd.Details[1].Content[1].Values[0].ResParams.Amount.replace(',', ''));
                    data.transaction_currency = upd.Details[1].Content[1].Values[0].ResParams.Currency;
                    if (data.transaction_currency === 'USD') {
                        // $1.5
                        data.transaction_fee = 1.5;
                    }
                    else {
                        // 2% + $2.
                        data.transaction_fee = data.transaction_amount * 0.02 + 2;
                    }
                }
                else {
                    console.error("Unknown transfer.\n\n Transaction data:");
                    console.error(data);
                    console.error(upd);
                    return;
                }

                localStorage['ta' + data.id] = data.transaction_amount;
                localStorage['tc' + data.id] = data.transaction_currency;
                localStorage['tf' + data.id] = data.transaction_fee;

                $(row).data('data', data);

                this.renderRowControls(row, data);
            }.bind(this));
            return;
        }

        localStorage['ta' + data.id] = data.transaction_amount;
        localStorage['tc' + data.id] = data.transaction_currency;
        localStorage['tf' + data.id] = data.transaction_fee;

        $(row).data('data', data);

        this.renderRowControls(row, data);
    },
    isTransactionIgnored: function (data) {
        var start_date = this.getSettings('integration_start_date');
        return start_date && data.date < start_date;
    },
    isTransactionAdded: function (data) {
        // Exact description match (for transactions added with extension).
        var d = data.description + ' [#' + data.id + ']';
        for (var i = 0; i < this.transactions.length; i++) {
            if (d == html_entity_decode(this.transactions[i].Description, 'ENT_QUOTES')) {
                this.transactions[i].added = true;
                return this.transactions[i];
            }
        }

        // Fuzzy description match (for transactions added by hands).
        var tr, r;
        for (var i = 0; i < this.transactions.length; i++) {
            tr = this.transactions[i];
            tr.iso_date = tr.iso_date || (tr.Date.indexOf('/') == -1 ? rusDateToISO(tr.Date) : amDateToISO(tr.Date));
            r = new RegExp('^' + regexp_escape(data.description) + '( \[#[0-9]+\])?$');
            if (tr.Total == data.total) {
                if (tr.iso_date.split(" ")[0] == data.date.split(" ")[0]) {
                    if (r.test(tr.Description) || r.test(html_entity_decode(tr.Description, 'ENT_QUOTES'))) {
                        this.transactions[i].added = true;
                        return this.transactions[i];
                    }
                }
            }
        }
        return false;
    },
    loadPayoneerTransactionDetails: function (data, callback) {
        $.get('https://activityfacade.payoneer.com/api/activity/getItemDetails?activityItemId=' + data.id + '&activityType=' + data.typeId, function (upd) {
            callback(data, upd);
        });
    },
    renderRowControls: function (row, data) {
        var ignoreClicks = function (e) {
            e.stopPropagation();
            if (e.target.nodeName == 'A') return;
            e.preventDefault();
            return false;
        };

        if (data.type == 'transfer') {
            var accounts_cell = document.createElement('td');
            accounts_cell.className = "table__table-td accounts first";
            $(accounts_cell).bind('click', ignoreClicks);

            var accounts_select = this.renderRowAccounts(row, data);
            accounts_cell.appendChild(accounts_select);

            row.appendChild(accounts_cell);
        }
        else {
            var categories_cell = document.createElement('td');
            categories_cell.className = "table__table-td categories first";
            $(categories_cell).bind('click', ignoreClicks);

            var categories_select = this.renderRowCategories(row, data);
            categories_cell.appendChild(categories_select);

            row.appendChild(categories_cell);
        }

        $(row).append('<td class="table__table-td plan"></td>');
        var $plan = $('<input type="checkbox" class="homemoney-plan" value="plan" />');
        $('.plan', row).append($plan);
        var transaction;
        if (transaction = this.isTransactionAdded(data)) {
            $plan.prop('checked', transaction.isPlan && transaction.isPlan != 'false');
        }
        $plan.bind('click', function (e) {
            e.stopPropagation();
            if (!$('.homemoney-export', row).prop('disabled') || $('.homemoney-export', row).hasClass('success')) {
                $('.homemoney-export', row).trigger('enable');
                $('.homemoney-export', row).trigger('click');
            }
        });

        $(row).append('<td class="table__table-td export"></td>');
        var $export = this.renderRowExport(row, data);
        $('.export', row).append($export).bind('click', ignoreClicks);

        if (!$('select.primary', row).val()) {
            $('.homemoney-export', row).trigger('disable', data.type == 'transfer' ? 'account' : 'category');
        }

        row.className += ' ' + data.type;
    },
    renderRowAccounts: function (row, data) {
        if (!this.account_select[data.transfer_type]) {
            var default_select = document.createElement('select');
            default_select.className = "primary homemoney-account";
            var options = '<option value="" selected></option>';
            var accounts = getWithdrawalAccounts(
                this.accounts,
                this.getSettings('withdraw_account'),
                data.transaction_currency != 'all' ? (['USD', data.transaction_currency]) : null,
                (data.transfer_type == 'cash') ? 1 : 5
            );
            for (var i = 0; i < accounts.length; i++) {
                options += '<option value="' + accounts[i].id + '">' + accounts[i].name + '</option>';
            }
            default_select.innerHTML = options;
            this.account_select[data.transfer_type] = default_select;
            this.account_select_count[data.transfer_type] = accounts.length;
        }

        var select = this.account_select[data.transfer_type].cloneNode(true);
        var $select = $(select);
        $select.bind('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        var wrap = document.createElement('div');
        var $wrap = $(wrap);
        wrap.className = 'wrap';
        wrap.appendChild(select);

        if (this.account_select_count[data.transfer_type] <= 1) {
            $select.hide();
            $wrap.append('<div class="homemoney-account-currency-note">' + chrome.i18n.getMessage("payoneer_error_no_cash_account", data.transaction_currency) + '</div>');
        }

        var transaction;
        if (this.isTransactionIgnored(data)) {
            $select.prop('disabled', true);
        }
        else if (transaction = this.isTransactionAdded(data)) {
            if (transaction.TransAccountId != 0) {
                $select.val(transaction.TransAccountId);
            }
        }
        else {
            $select.val(this.getSettings('withdraw_account'));
        }

        var that = this;
        $select.bind('change', function () {
            var $select = $(this);
            var $wrap = $select.closest('.wrap');
            $('.homemoney-account-currency', $wrap).remove();

            var value = $(this).val();
            if (value) {
                $('.homemoney-export', row).trigger('enable');

                var currencies = [];
                var accounts = getWithdrawalAccounts(
                    that.accounts,
                    that.getSettings('withdraw_account'),
                    data.transaction_currency != 'all' ? (['USD', data.transaction_currency]) : null,
                    (data.transfer_type == 'cash') ? 1 : 5
                );
                for (var i = 0; i < accounts.length; i++) {
                    if (accounts[i].id == value) {
                        var all_currencies = accounts[i].ListCurrencyInfo;
                        for (var j = 0; j < all_currencies.length; j++) {
                            if (data.transaction_currency === 'all' || homemoneyCurrencyEquals(all_currencies[j], 'USD') || homemoneyCurrencyEquals(all_currencies[j], data.transaction_currency)) {
                                currencies.push(all_currencies[j]);
                            }
                        }
                        break;
                    }
                }
                if (!accounts.length || !currencies.length) {
                    $('.homemoney-account-currency-note', $wrap).remove();
                    $wrap.append('<div class="homemoney-account-currency-note">' + chrome.i18n.getMessage("payoneer_error_no_cash_account", data.transaction_currency) + '</div>');
                    return;
                }

                var $select_currencies = $('<select class="homemoney-account-currency" style="width:30%"></select>');
                for (var i = 0; i < currencies.length; i++) {
                    $select_currencies.append($('<option value="' + currencies[i].id + '">' + currencies[i].shortname + '</option>'));
                }
                $wrap.append($select_currencies);

                var selected = false;
                for (var i = 0; i < currencies.length; i++) {
                    if (data.transaction_currency == currencies[i].shortname) {
                        $select_currencies.val(currencies[i].id);
                        selected = true;
                    }
                }
                if (!selected) {
                    var regexp = currency_transforms[data.transaction_currency];
                    if (regexp) {
                        for (var i = 0; i < currencies.length; i++) {
                            if (regexp.test(currencies[i].shortname)) {
                                $select_currencies.val(currencies[i].id);
                                selected = true;
                            }
                        }
                    }
                    if (!selected && data.transaction_currency != 'all') {
                        $('.homemoney-account-currency-note', $wrap).remove();
                        $wrap.append('<div class="homemoney-account-currency-note">' + chrome.i18n.getMessage("payoneer_error_no_cash_account2", data.transaction_currency) + '</div>');
                        for (var i = 0; i < currencies.length; i++) {
                            if (currency_transforms['USD'].test(currencies[i].shortname)) {
                                $select_currencies.val(currencies[i].id);
                                selected = true;
                            }
                        }
                    }
                }
            }
            else {
                $('.homemoney-export', row).trigger('disable', 'account');
            }
        });
        $select.trigger('change');

        return wrap;
    },
    renderRowCategories: function (row, data) {
        if (!this.category_selects) {
            this.category_selects = {};
            for (var c in {credit: '', debit: ''}) {
                var default_select = document.createElement('select');
                default_select.className = "primary homemoney-category";
                var options = '<option value="" selected></option>';
                for (var i = 0; i < this.categories[c].length; i++) {
                    options += '<option value="' + this.categories[c][i].id + '">' + this.categories[c][i].FullName + '</option>';
                }
                default_select.innerHTML = options;
                this.category_selects[c] = default_select;
            }
        }

        if (!data.type || !this.category_selects[data.type]) {
            console.error("Can't render category control for following data: " + JSON.stringify(data));
            return;
        }

        var select = this.category_selects[data.type].cloneNode(true);
        var $select = $(select);
        $select.bind('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        var transaction;
        if (this.isTransactionIgnored(data)) {
            $select.prop('disabled', true);
            $select.data('changed', true);
        }
        else if (transaction = this.isTransactionAdded(data)) {
            if (transaction.CategoryId != 0) {
                $select.val(transaction.CategoryId);
                $select.data('changed', true);
            }
        }
        else if (/Immediate Load fee/.test(data.description) ||
            /Annual fee/.test(data.description) ||
            data.transaction_type == 'ATM Withdrawal Decline') {
            $select.val(this.getSettings('payoneer_fees_category'));
        }
        else {
            var saved_category;
            if (data.category) {
                saved_category = data.category;
            } 
            else {
                saved_category = localStorage.getItem('c' + data.type.charAt(0) + '_' + data.description);
            }
            $select.val(saved_category);
            $select.data('changed', false);
        }

        $select.bind('change', function () {
            if ($(this).val()) {
                $('.homemoney-export', row).trigger('enable');
                $('.homemoney-export', row).trigger('click');
            }
            else {
                $('.homemoney-export', row).trigger('disable', 'category');
            }
        });

        return select;
    },
    renderRowExport: function (row, data) {
        var that = this;
        var $button = $('<button class="homemoney-export"><i class="fa fa-paper-plane"></i><span class="title">' + chrome.i18n.getMessage("payoneer_export") + '</span></button>');
        $button.bind('click', function (e) {
            var $button = $(this);
            var $select = $('.first select', $button.closest('tr'));
            e.preventDefault();
            e.stopPropagation();

            if ($('.homemoney-category', row).length) {
                data.category = $('.homemoney-category', row).val();
            }
            else {
                data.transaction_account = $('.homemoney-account', row).val();
                data.transaction_curency_id = $('.homemoney-account-currency', row).val();
            }
            data.plan = $('.homemoney-plan', row).prop('checked');

            var primary_transaction = jQuery.extend(true, {}, data);

            if (primary_transaction.type != 'transfer') {
                that.associateCategory(primary_transaction.description, primary_transaction.type, $('.homemoney-category', row).val());
            }

            if (primary_transaction.transaction_fee) {
                primary_transaction.total -= primary_transaction.transaction_fee;

                var secondary_transaction = jQuery.extend(true, {}, data);
                secondary_transaction.type = 'debit';
                secondary_transaction.total = primary_transaction.transaction_fee;
                secondary_transaction.description += ' (Payoneer fee)';
                secondary_transaction.category = that.getSettings('payoneer_fees_category');
                secondary_transaction.id = secondary_transaction.id + that.fee_suffix;
                secondary_transaction.guid = toGUID(secondary_transaction.id, that.homemoney_token);

                var tr = that.isTransactionAdded(secondary_transaction);
                transactionSave(that.homemoney_token,
                    that.getSettings('payoneer_account'),
                    secondary_transaction.type,
                    secondary_transaction.total,
                    that.USD_currency_id,
                    secondary_transaction.category,
                    secondary_transaction.date,
                    secondary_transaction.description + ' [#' + secondary_transaction.id + ']',
                    secondary_transaction.transaction_account,
                    secondary_transaction.transaction_amount,
                    secondary_transaction.transaction_curency_id,
                    secondary_transaction.plan,
                    secondary_transaction.guid,
                    tr ? true : false
                );
            }

            $button.prop('disabled', true).removeClass('success').removeClass('error').addClass('progress');
            var tr = that.isTransactionAdded(data);
            primary_transaction.guid = tr ? tr.GUID : toGUID(primary_transaction.id, that.homemoney_token);
            transactionSave(that.homemoney_token,
                that.getSettings('payoneer_account'),
                primary_transaction.type,
                primary_transaction.total,
                that.USD_currency_id,
                primary_transaction.category,
                primary_transaction.date,
                primary_transaction.description + ' [#' + primary_transaction.id + ']',
                primary_transaction.transaction_account,
                primary_transaction.transaction_amount,
                primary_transaction.transaction_curency_id,
                primary_transaction.plan,
                primary_transaction.guid,
                tr ? true : false,
                function (data) {
                    that.transactions.push(data.payload);
                    $select.data('changed', true);
                    $button.removeClass('progress').addClass('success').html('<i class="fa fa-check"></i><span class="title">' + chrome.i18n.getMessage("payoneer_done") + '</span>');
                },
                function (error, code) {
                    // Unblock button on error.
                    $button.removeClass('progress').addClass('error').prop('disabled', false).html('<i class="fa fa-refresh"></i><span class="title">' + chrome.i18n.getMessage("payoneer_retry") + '</span>');

                    if (typeof error == "string") {
                        alert(error);
                    }
                    else {
                        console.error(error);
                        alert(chrome.i18n.getMessage("payoneer_error_saving_transaction"));
                    }
                }
            );
        });

        $button.bind('enable', function () {
            var $button = $(this);
            $button.prop('disabled', false).removeClass('success').removeClass('error').removeClass('changed').html('<i class="fa fa-paper-plane"></i><span class="title">' + chrome.i18n.getMessage("payoneer_export") + '</span>');
        });

        $button.bind('disable', function (e, type) {
            var $button = $(this);
            $button.prop('disabled', true).removeClass('success').removeClass('error').removeClass('changed').html('<i class="fa fa-arrow-left"></i><span class="title">' + chrome.i18n.getMessage("payoneer_select_" + type) + '</span>')
        });

        $button.bind('change', function () {
            var $button = $(this);
            $button.prop('disabled', false).removeClass('success').removeClass('error').addClass('changed').html('<i class="fa fa-paper-plane"></i><span class="title">' + chrome.i18n.getMessage("payoneer_save") + '</span>');
        });

        if (this.isTransactionIgnored(data) || this.isTransactionAdded(data)) {
            $button.prop('disabled', true).addClass('success').html('<i class="fa fa-check"></i><span class="title">' + chrome.i18n.getMessage("payoneer_done") + '</span>');
        }

        return $button;
    },
    associateCategory: function (description, type, category) {
        if (!description || !type || !category) {
            return;
        }
        localStorage.setItem('c' + type.charAt(0) + '_' + description, category);
        this.updateCategories();
    },
    updateCategories: function () {
        $('.transactions__body__tables__table-transactions tbody tr:not(.homemoney-processed)').each(function (index, row) {
            var data = $(row).data('data');

            if (!data) {
                return;
            }

            var category = localStorage.getItem('c' + data.type.charAt(0) + '_' + data.description);

            if (data.type != 'transfer' && category) {
                if (!$('select', row).val() || !$('select', row).data('changed')) {
                    $('select', row).val(category);
                    $('.homemoney-export', row).trigger('enable');
                }
            }
        }.bind(this));
    },
    destroy: function () {
        // Simplest possible way to die.
        location.reload();
    }
};

setTimeout(function () {
    app.start();
}, 0);
