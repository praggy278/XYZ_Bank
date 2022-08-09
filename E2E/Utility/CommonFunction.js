var CommonFunction = function(){
	this.homeBtn = element(by.buttonText('Home'));
	this.logOutBtn = element(by.buttonText('Logout'));

	this.gotoHome = function() {
		this.homeBtn.click();
		return require('../Pages/HomePage.js');
	};

	this.logout = function() {
		this.logOutBtn.click();
		return require('../Pages/CustomerLoginPage.js');
	};

	this.waitForTransactions=function(CustomerAccountPage){
		browser.wait(function () {
			var TransactionsPage=CustomerAccountPage.gotoTransactions();
			if (TransactionsPage.lastAmt.isPresent()) {
				CustomerAccountPage=TransactionsPage.back();
				return true;
			}
			CustomerAccountPage=TransactionsPage.back();
			return false;
		}, 5000);
	};
};
module.exports = new CommonFunction();