/**
 * These function don't require sending AJAX requests and can be executed in the content context.
 */
var HomemoneyUtils = {
    currency_transforms: {
        USD: /^(\$|USD|дол)/i,
        UAH: /^(₴|UAH|грн|hrn|grn)/i,
        EUR: /^(€|EUR|евр|євр)/i,
        RUB: /^(₽|RUB|руб)/i
    },

    homemoneyCurrencyEquals: function (currency, currency_name) {
        var regexp = HomemoneyUtils.currency_transforms[currency_name];
        if (!regexp) {
            for (var iso_currency in HomemoneyUtils.currency_transforms) {
                if (HomemoneyUtils.currency_transforms[iso_currency].test(currency_name)) {
                    regexp = HomemoneyUtils.currency_transforms[iso_currency];
                    break;
                }
            }
        }
        if (regexp && regexp.test(currency.shortname)) {
            return true;
        }
        return false
    },

    getHomemoneyCurrencyId: function (accounts, account_id, iso_currency) {
        var exact = HomemoneyUtils.GroupIterator(accounts, null, function (account) {
            return account.id == account_id;
        });

        if (!exact.length) {
            return;
        }
        var account = exact[0];

        for (var i = 0; i < account.ListCurrencyInfo.length; i++) {
            var account_currency = account.ListCurrencyInfo[i];
            if (HomemoneyUtils.homemoneyCurrencyEquals(account_currency, iso_currency)) {
                return account_currency.id;
            }
        }
    },

    getWithdrawalAccounts: function (data, top_of_the_list, allowed_currencies, type) {
        type = type == undefined ? 1 : type;

        top_of_the_list = top_of_the_list ? HomemoneyUtils.GroupIterator(data, null, function (account) {
            return account.id == top_of_the_list
        }) : [];

        var exact = HomemoneyUtils.GroupIterator(data, function (group) {
            return group.id == type;
        }, function (account) {
            return account.isDefault == true;
        });
        var close = HomemoneyUtils.GroupIterator(data, function (group) {
            return group.id == type;
        }, function (account) {
            return account.isDefault != true;
        });
        var all = arrayUnique([].concat(top_of_the_list, exact, close));

        if (allowed_currencies) {
            var result = [];
            for (var i = 0; i < all.length; i++) {
                var account = all[i];
                currency:
                    for (var j = 0; j < account.ListCurrencyInfo.length; j++) {
                        var account_currency = account.ListCurrencyInfo[j];
                        for (var k = 0; k < allowed_currencies.length; k++) {
                            var regexp = HomemoneyUtils.currency_transforms[allowed_currencies[k]];
                            if (regexp) {
                                if (regexp.test(account_currency.shortname)) {
                                    result.push(account);
                                    break currency;
                                }
                            }
                        }
                    }
            }
            all = result;
        }
        return all;
    },

    getPayoneerOrderedAccounts: function (data) {
        var exact = HomemoneyUtils.GroupIterator(data, function (group) {
            return group.id == 5;
        }, function (account) {
            return account.name == 'Payoneer';
        });
        var close = HomemoneyUtils.GroupIterator(data, function (group) {
            return group.id == 5;
        }, function (account) {
            return account.name != 'Payoneer' && /.*Payoneer.*/g.test(account.name);
        });
        var others = HomemoneyUtils.GroupIterator(data, function (group) {
            return group.id == 5;
        }, function (account) {
            return account.name != 'Payoneer' && !/.*Payoneer.*/g.test(account.name);
        });
        return arrayUnique([].concat(exact, close, others));
    },

    GroupIterator: function (groups, GroupsMatcher, AccountsMatcher) {
        var result = [], accounts;
        for (var g = 0; g < groups.ListGroupInfo.length; g++) {
            var group = groups.ListGroupInfo[g];
            if (!GroupsMatcher || GroupsMatcher(group)) {
                if (HomemoneyUtils.AccountsIterator) {
                    accounts = HomemoneyUtils.AccountsIterator(group.ListAccountInfo, AccountsMatcher);
                } else {
                    accounts = group.ListAccountInfo;
                }
                for (var i = 0; i < accounts.length; i++) {
                    accounts[i].group = group;
                }
                result = result.concat(accounts);
            }
        }
        return result;
    },

    AccountsIterator: function (accounts, matcher) {
        if (!matcher) {
            return accounts;
        }
        var result = [];
        for (var a = 0; a < accounts.length; a++) {
            var account = accounts[a];
            if (matcher(account)) {
                result.push(account);
            }
        }
        return result;
    }
};