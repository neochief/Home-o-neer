/**
 * These function require sending AJAX requests and can not be executed in the content context.
 */
var Homemoney = {
    homemoney_api: function (method, payload, data, sender, sendResponse) {
        var url = 'https://homemoney.ua/api/api2.asmx/' + method;

        $.post(url, payload).done(function (data) {
            data.payload = payload;
            if (data.code && data.message) {
                if (typeof sendResponse == "function") sendResponse({success: false, data: data});
                return;
            }
            if (data.Error && data.Error.message) {
                if (typeof sendResponse == "function") sendResponse({success: false, data: data});
                return;
            }
            if (typeof sendResponse == "function") sendResponse({success: true, data: data});
        }).fail(function (data) {
            data.payload = payload;
            if (typeof sendResponse == "function") sendResponse({success: false, data: data});
        });

        return true;
    },

    getTransactions: function (token, date_from, date_to, data, sender, sendResponse) {
        return Homemoney.homemoney_api('TransactionListByPeriod', {
            token: token,
            from: date_from,
            to: date_to
        }, data, sender, function (result) {
            if (!result.success) {
                if (typeof sendResponse == "function") sendResponse({success: false, data: data});
                return;
            }

            var transactions = result.data.ListTransaction;
            if (typeof sendResponse == "function") sendResponse({success: true, data: transactions});
        });
    },

    getCategories: function (token, data, sender, sendResponse) {
        return Homemoney.homemoney_api('CategoryList', {token: token}, data, sender,function (result) {
            if (!result.success) {
                if (typeof sendResponse == "function") sendResponse(result);
                return;
            }

            var debit = $.grep(result.data.ListCategory, function (k) {
                return k.type == 1;
            });
            var credit = $.grep(result.data.ListCategory, function (k) {
                return k.type == 3;
            });
            var categories = {debit: debit, credit: credit};

            if (typeof sendResponse == "function") sendResponse({success: true, data: categories});
        });
    },

    getAccounts: function (token, data, sender, sendResponse) {
        return Homemoney.homemoney_api('BalanceList ', {token: token}, data, sender, sendResponse);
    },

    transactionSave: function (token, accountId, type, total, currencyId, categoryId, date, description, transAccountId, transTotal, transCurencyId, isPlan, guid, editing, data, sender, sendResponse) {
        var payload = {
            Token: token,
            AccountId: accountId,
            Type: type == 'transfer' ? '2' : (type == 'credit' ? '3' : '1'),
            Total: total.toString(),
            CurencyId: currencyId,
            CategoryId: categoryId,
            Date: date,
            Description: description,
            isPlan: isPlan ? 'true' : 'false',
            GUID: guid
        };
        if (type == 'transfer') {
            payload.CategoryId = '0';
            payload.TransAccountId = transAccountId;
            payload.TransTotal = transTotal;
            payload.TransCurencyId = transCurencyId;
        } else {
            payload.TransAccountId = '0';
            payload.TransTotal = '0';
            payload.TransCurencyId = '0';
        }
        return Homemoney.homemoney_api('TransactionSave', payload, data, sender, sendResponse);
    },
};
