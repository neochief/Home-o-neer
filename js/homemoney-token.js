(function($) {
    function getJsonFromQuery(query) {
        var result = {};
        query.split("&").forEach(function(part) {
            var item = part.split("=");
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    }

    if (window.location.hash) {
        var query = window.location.hash.substr(1);
        var params = getJsonFromQuery(query);

        var token_data;
        if (params.error == undefined) {
            token_data = {
                'token': params.access_token,
                'created': Math.floor(Date.now() / 1000),
                'expiration': params.expires_in
            };
        }
        else {
            token_data = null;
        }

        chrome.runtime.sendMessage({
            method: "UpdateHomemoneyToken",
            token_data: token_data
        });
    } else {
        // Fragment doesn't exist
    }
})(jQuery);
