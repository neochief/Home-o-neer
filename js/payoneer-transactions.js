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
    start: function () {
        if (!document.getElementById('gvTranscations')) {
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
        getTransactions(this.homemoney_token, this.amDateToISO($('.dateRangeFrom').val()), this.amDateToISO($('.dateRangeTo').val() + ' 23:59:59'), function (transactions) {
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
        console.log('init!');
        this.renderHomemoneyHead();
        this.renderHomemoneyBody();
        this.handlePrevNextButtons();
        this.addMiscControls();
    },
    getSettings: function (property) {
        var profile = $('option[value=' + $('#ctl00_ddlAccounts').val() + ']').first().text().replace('Prepaid Card - XXXX-', '');
        if (this.settings[profile] != undefined && this.settings[profile][property] != undefined) {
            return this.settings[profile][property];
        }
        else {
            return this.settings.default[property];
        }
    },
    renderHomemoneyHead: function () {
        if ($('#gvTranscations thead.homemoney-processed').length) return;
        $('#gvTranscations thead tr:first-child th:first-child').width(100);
        $('#gvTranscations thead tr:first-child th').attr('rowspan', 2);
        $('#gvTranscations thead tr:first-child').append('<th colspan="3" class="table-header">Homemoney</th>');
        $('#gvTranscations thead tr:first-child th:last-child').width('30%');
        $('#gvTranscations thead').append('<tr class="table-header"><th>' + chrome.i18n.getMessage("payoneer_category") + '</th><th>' + chrome.i18n.getMessage("payoneer_plan") + '</th><th></th></tr>');
        $('#gvTranscations thead').addClass('homemoney-processed');
    },
    renderHomemoneyBody: function () {
        if (this.timer != undefined) {
            clearInterval(this.timer);
        }
        var probe = function () {
            if ($('.loadingDivPlugin').length) {
                return;
            }
            else {
                clearInterval(this.timer);
                this.doRenderBody();
            }
        }.bind(this);
        this.timer = setInterval(probe, 100);
    },
    doRenderBody: function () {
        $('#gvTranscations tbody tr:not(.homemoney-processed)').each(this.renderRow.bind(this));
    },
    // 01/15/2016 09:56 -> 2016-01-15 09:56:00
    amDateToISO: function (amDate) {
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
    },
    // 2016.01.15 09:56 -> 2016-01-15 09:56:00
    rusDateToISO: function (rusDate) {
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
    },
    renderRow: function (index, row) {
        row.className += ' homemoney-processed';
        var date = this.amDateToISO($('td:nth-child(1)', row).text().trim());

        var data = {
            id: $(row).attr('rowkeyvalue'),
            date: date,
            description: $('td:nth-child(2)', row).text().trim(),
            debit: $('td:nth-child(3)', row).text().trim().replace(/[$€]/g, ''),
            credit: $('td:nth-child(4)', row).text().trim().replace(/[$€]/g, ''),
        };
        if (data.description === 'Load to card') {
            row.className += ' homemoney-hidden';
        }
        data.debit = data.debit ? parseFloat(data.debit) : 0;
        data.credit = data.credit ? parseFloat(data.credit) : 0;
        data.total = data.debit == '' ? data.credit : data.debit;
        data.transaction_type = localStorage['t' + data.id];
        data.transaction_amount = parseFloat(localStorage['ta' + data.id]);
        data.transaction_currency = localStorage['tc' + data.id];
        data.transaction_fee = parseFloat(localStorage['tf' + data.id]);
        if (data.transaction_type === 'ATM Withdrawal') {
            data.type = 'transfer';
            data.transfer_type = 'cash';
        }
        else if (/Withdrawal to/.test(data.transaction_type)) {
            data.type = 'transfer';
            data.transfer_type = 'bank';
            data.transfer_account = data.transaction_type.replace('Withdrawal to ', '');
            data.transaction_currency = 'all';
        }
        else {
            data.type = data.debit == '' ? 'credit' : 'debit';
        }
        $(row).data('data', data);

        if (!data.transaction_type) {
            this.loadPayoneerTransactionDetails($('#qaz').val(), data, index, function ($page, data) {
                data.transaction_type = $('#lblTransactionDescription', $page).text();
                var raw_amount = $('#lblForeignCurrencyAmount', $page).text();

                var pre_number_regexp = /([^0-9 .])([0-9\-.]+)\s*/g; // €100 or £100
                var post_number_regexp = /([0-9\-.]+) (...)\s*/g; // 100 UAH or 100 CHF

                if (pre_number_regexp.test(raw_amount)) {
                    data.transaction_amount = parseFloat(raw_amount.replace(pre_number_regexp, '$2'));
                    data.transaction_currency = raw_amount.replace(pre_number_regexp, '$1');
                }
                else if (post_number_regexp.test(raw_amount)) {
                    data.transaction_amount = parseFloat(raw_amount.replace(post_number_regexp, '$1'));
                    data.transaction_currency = raw_amount.replace(post_number_regexp, '$2');
                }
                data.transaction_currency = data.transaction_currency ? data.transaction_currency : 'USD';

                data.transaction_fee = parseFloat($('#lblFeeRate', $page).text().replace(/[$€]/g, ''));
                if (data.transaction_type === 'ATM Withdrawal') {
                    data.type = 'transfer';
                    data.transfer_type = 'cash';
                }
                else if (/Withdrawal to/.test(data.transaction_type)) {
                    data.type = 'transfer';
                    data.transfer_type = 'bank';
                }
                else {
                    data.type = data.debit == '' ? 'credit' : 'debit';
                }
                $(row).data('data', data);

                localStorage['t' + data.id] = data.transaction_type;
                localStorage['ta' + data.id] = data.transaction_amount;
                localStorage['tc' + data.id] = data.transaction_currency;
                localStorage['tf' + data.id] = data.transaction_fee;

                this.renderRowControls(row, data);
            }.bind(this));
        }
        else {
            this.renderRowControls(row, data);
        }
    },
    loadPayoneerTransactionDetails: function (qaz, data, index, callback) {
        $.post('https://myaccount.payoneer.com/MainPage/TransactionDetailsTemplate.aspx?transactionDetails=true&AuditId=' + data.id + '&rowindex=' + index + '&currPage=' + $('.currentPage').text(),
            JSON.stringify({PayoneerInternalId: $('#qaz').val()}), function (page) {
                callback($(page), data);
            }.bind(this));
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
            tr.iso_date = tr.iso_date || (tr.Date.indexOf('/') == -1 ? this.rusDateToISO(tr.Date) : this.amDateToISO(tr.Date));
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
    renderRowControls: function (row, data) {
        if (data.transaction_type == 'Load to card') {
            return;
        }

        var ignoreClicks = function (e) {
            e.stopPropagation();
            if (e.target.nodeName == 'A') return;
            e.preventDefault();
            return false;
        };

        if (data.type == 'transfer') {
            var accounts_cell = document.createElement('td');
            accounts_cell.className = "accounts first";
            $(accounts_cell).bind('click', ignoreClicks);

            var accounts_select = this.renderRowAccounts(row, data);
            accounts_cell.appendChild(accounts_select);

            row.appendChild(accounts_cell);
        }
        else {
            var categories_cell = document.createElement('td');
            categories_cell.className = "categories first";
            $(categories_cell).bind('click', ignoreClicks);

            var categories_select = this.renderRowCategories(row, data);
            categories_cell.appendChild(categories_select);

            row.appendChild(categories_cell);
        }

        $(row).append('<td class="plan"></td>');
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

        $(row).append('<td class="export"></td>');
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
            var saved_category = localStorage.getItem('c' + data.type.charAt(0) + '_' + data.description);
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
        $('#gvTranscations tbody tr.homemoney-processed').each(function (index, row) {
            var data = $(row).data('data');
            var category = localStorage.getItem('c' + data.type.charAt(0) + '_' + data.description);

            if (data.type != 'transfer' && category) {
                if (!$('select', row).val() || !$('select', row).data('changed')) {
                    $('select', row).val(category);
                    $('.homemoney-export', row).trigger('enable');
                }
            }
        }.bind(this));
    },
    handlePrevNextButtons: function () {
        $('.searchDateRange').delegate('.btnDateRangeSearch', 'click', function () {
            this.loadTransactions(this.renderHomemoneyBody.bind(this));
        }.bind(this));
        $('.searchPanel').delegate('.input[type=button]', 'click', this.renderHomemoneyBody.bind(this));
        $('.pageNavigation').delegate('.prevPage, .nextPage', 'click', this.renderHomemoneyBody.bind(this));
    },
    addMiscControls: function () {
        $('.searchPanel:not(.hmp-log)').append('<a href="#" class="btn-little log-not-added" title="Log not added transactions">Log missing</a>').addClass('hmp-log');
        $('.searchPanel').delegate('.log-not-added', 'click', function () {
            this.logNotAddedTransactions();
            return false;
        }.bind(this));

        $('.searchPanel:not(.hmp-cache)').append('<a href="#" class="btn-little refresh-cache">Refresh transactions cache</a>').addClass('hmp-cache');
        $('.searchPanel').delegate('.refresh-cache', 'click', function () {
            $('#gvTranscations tbody tr').each(function () {
                var id = $(this).attr('rowkeyvalue');
                localStorage.removeItem('t' + id);
                localStorage.removeItem('ta' + id);
                localStorage.removeItem('tc' + id);
                localStorage.removeItem('tf' + id);
            });
            return false;
        }.bind(this));
    },
    logNotAddedTransactions: function () {
        var result = [];
        for (var i = 0; i < this.transactions.length; i++) {
            var tr = this.transactions[i];
            if (tr.added == undefined || !tr.added) {
                if (/\(Payoneer fee\) \[/.test(tr.Description)) {
                    continue;
                }
                result.push(this.transactions[i]);
            }
        }
        console.log(result);
    },
    destroy: function () {
        // Simplest possible way to die.
        location.reload();
    }
};
app.start();