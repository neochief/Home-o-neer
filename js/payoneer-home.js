chrome.runtime.sendMessage({
    method: "DoGoToTransactions"
}, function (redirect) {
    if (redirect) {
        window.location = "https://myaccount.payoneer.com/MainPage/Widget.aspx?w=Activity#/activity/transactions";
    }
});