chrome.runtime.sendMessage({
    method: "DoGoToTransactions"
}, function(){
    window.location = "https://myaccount.payoneer.com/MainPage/Transactions.aspx";
});