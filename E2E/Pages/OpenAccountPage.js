var data = require('../Data/testData');

var OpenAccountPage = function() {
	this.customerDD = element(by.id('userSelect'));
	this.currencyDD = element(by.id('currency'));
	this.processBtn = element(by.buttonText('Process'));

	this.openAcc = function(cust,curr) {
		this.customerDD.click().then(function(){
			opt1=element(by.xpath('//option[contains(text(),"'+cust+'")]'));
			opt1.click();
		});
		this.currencyDD.click().then(function(){
			opt2=element(by.xpath('//option[contains(text(),"'+curr+'")]'));
			opt2.click();
		});
		this.processBtn.click();
	};
};
module.exports = new OpenAccountPage();