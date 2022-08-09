var BankManagerPage = function() {
	this.addCustBtn = element(by.buttonText('Add Customer'));
	this.openAccBtn = element(by.buttonText('Open Account'));

	this.gotoAddCust = function() {
		this.addCustBtn.click();
		return require('../Pages/AddCustomerPage.js');
	};
	
	this.gotoOpenAcc = function() {
		this.openAccBtn.click();
		return require('../Pages/OpenAccountPage.js');
	};
};
module.exports = new BankManagerPage();