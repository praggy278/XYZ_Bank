var data = require('../Data/testData');

var HomePage = function() {
	this.custLoginBtn = element(by.buttonText('Customer Login'));
	this.managerLoginBtn = element(by.buttonText('Bank Manager Login'));

	this.custLogin = function() {
		this.custLoginBtn.click();
		return require('../Pages/CustomerLoginPage.js');
	};

	this.managerLogin = function() {
		this.managerLoginBtn.click();
		return require('../Pages/BankManagerPage.js');
	};

	this.launchURL = function (){
		browser.get(data.url);
	};
};
module.exports = new HomePage();