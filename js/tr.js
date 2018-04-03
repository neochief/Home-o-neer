function addXMLRequestCallback(callback) {
    var oldSend, oldOnload, i;
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
            this.addEventListener("loadend", function() {
                for (i = 0; i < XMLHttpRequest.callbacks.length; i++) {
                    XMLHttpRequest.callbacks[i](this);
                }
            }.bind(this));
            oldSend.apply(this, arguments);
        }
    }
}

setTimeout(function () {
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
}, 0);
