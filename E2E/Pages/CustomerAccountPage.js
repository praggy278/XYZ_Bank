var data = require('../Data/testData');

var CustomerAccountPage = function() {
	this.accountDropdown = element(by.id('accountSelect'));
	this.accountDetails=element(by.xpath('//div[3]/div[1]/div[2]/div[1]/div[2]'));
	this.message=element(by.xpath('//div[2]/div[1]/div[1]'));
	this.transactionsBtn=element(by.buttonText('Transactions'));
	this.depositBtn=element(by.buttonText('Deposit'));
	this.withdrawBtn=element(by.buttonText('Withdrawl'));
	this.amtTextbox=element(by.model('amount'));
	this.depSubmitBtn=element(by.xpath('//form[1]/button[1]'));
	this.witSubmitBtn=element(by.buttonText('Withdraw'));
	this.transactionMsg=element(by.xpath("//span[@ng-show='message']"));

	this.getAccount = function(acc) {
		this.accountDropdown.click().then(function(){
			console.log('Dropdown clicked');
			element(by.cssContainingText('option', acc)).click().then(function(){
				console.log('Account Selected');
			});
		});
	};

	this.getAccountDetails = function() {
		console.log(this.accountDetails.getText());
	};

	this.gotoTransactions = function() {
		this.transactionsBtn.click();
		return require('../Pages/TransactionsPage.js');
	};

	this.depositAmt = function() {
		this.depositBtn.click();
		this.amtTextbox.sendKeys(data.validAmount);
		expect(this.amtTextbox.getAttribute('value')).toBe(data.validAmount);
		this.depSubmitBtn.click();
	};

	this.withdrawValidAmt = function() {
		this.withdrawBtn.click();
		this.amtTextbox.sendKeys(data.validAmount);
		expect(this.amtTextbox.getAttribute('value')).toBe(data.validAmount);
		this.witSubmitBtn.click();
	};

	this.withdrawInvalidAmt = function() {
		this.withdrawBtn.click();
		this.amtTextbox.sendKeys(data.invalidAmount);
		expect(this.amtTextbox.getAttribute('value')).toBe(data.invalidAmount);
		this.witSubmitBtn.click();
	};
};
module.exports = new CustomerAccountPage();