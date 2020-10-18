function addXMLRequestCallback(callback) {
    var oldSend, oldOnload, i, oldSetRequestHeader;
    var authorization;

    if (XMLHttpRequest.callbacks) {
        // we've already overridden send() so just add the callback
        XMLHttpRequest.callbacks.push(callback);
    } else {
        // create a callback queue
        XMLHttpRequest.callbacks = [callback];
        // store the native send()
        oldSend = XMLHttpRequest.prototype.send;
        // override the native send()
        XMLHttpRequest.prototype.send = function () {
            this.onload = function() {
                for (i = 0; i < XMLHttpRequest.callbacks.length; i++) {
                    XMLHttpRequest.callbacks[i](this);
                }
            }.bind(this);

            if (authorization && this.headers.Authorization === undefined) {
                this.setRequestHeader('Authorization', authorization);
            }

            oldSend.apply(this, arguments);
        }

        // Reasign the existing setRequestHeader function to 
        // something else on the XMLHtttpRequest class
        oldSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader; 

        // Override the existing setRequestHeader function so that it stores the headers
        XMLHttpRequest.prototype.setRequestHeader = function() {
            // Call the wrappedSetRequestHeader function first 
            // so we get exceptions if we are in an erronous state etc.
            oldSetRequestHeader.apply(this, arguments);

            // Create a headers map if it does not exist
            if(!this.headers) {
                this.headers = {};
            }

            var header = arguments[0];
            var value = arguments[1];

            if (header == 'Authorization') {
                authorization = value;
                document.dispatchEvent(new CustomEvent('Home-o-neer:authorization', {
                    detail: value
                }));
            }

            // Create a list for the header that if it does not exist
            if(!this.headers[header]) {
                this.headers[header] = [];
            }

            // Add the value to the header
            this.headers[header].push(value);
        };
    }
}

//setTimeout(function () {
    addXMLRequestCallback(function (xhr) {
        if (xhr.responseURL && /api\/activity\/getMainTransactions/.test(xhr.responseURL)) {
            document.dispatchEvent(new CustomEvent('Home-o-neer:getMainTransactions', {
                detail: JSON.parse(xhr.response)
            }));
        }

        if (xhr.responseURL && /api\/activity\/getMoreTransactions/.test(xhr.responseURL)) {
            document.dispatchEvent(new CustomEvent('Home-o-neer:getMoreTransactions', {
                detail: JSON.parse(xhr.response)
            }));
        }
    });
//}, 0);
