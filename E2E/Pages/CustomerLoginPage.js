var data = require('../Data/testData');

var CustomerLoginPage = function() {
	yourNameDropdown = element(by.id('userSelect'));
	this.dd=element(by.id('userSelect'));
	newName=element(by.xpath('//option[contains(text(),"'+data.newCustName+'")]'));
	loginBtn = element(by.buttonText('Login'));

	this.custLogin = function(cust) {
		yourNameDropdown.click().then(function(){
			console.log('Dropdown clicked');
			name=element(by.xpath('//option[contains(text(),"'+cust+'")]'));
			name.click().then(function(){
				console.log('Customer Selected');
				loginBtn.click().then(function(){
					console.log('Logged In');
				});
			});
		});
		return require('../Pages/CustomerAccountPage.js');
	};

	this.newCustLogin = function() {
		yourNameDropdown.click().then(function(){
			console.log('Dropdown clicked');
			newName.click().then(function(){
				console.log('Customer Selected');
				loginBtn.click().then(function(){
					console.log('Logged In');
				});
			});
		});
		return require('../Pages/CustomerAccountPage.js');
	};
};
module.exports = new CustomerLoginPage();