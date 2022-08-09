var screenShotFn = require('../Utility/screenShotFn');
var HomePage = require('../Pages/HomePage');
var data = require('../Data/testData');
var cf=require('../Utility/CommonFunction');

describe('Bank Manager is able to Add Customer', function(){
	var AddCustomerPage;
	var CustomerLoginPage;
	var BankManagerPage;

	it('Click on Manager Login', function() {
		HomePage.launchURL();
		BankManagerPage=HomePage.managerLogin();
		screenShotFn.takeSS('Manager_Login');
	});

	it('Go to Add Customer Page', function() {
		HomePage.launchURL();
		BankManagerPage=HomePage.managerLogin();
		AddCustomerPage=BankManagerPage.gotoAddCust();
		console.log('Adding Customer');
		screenShotFn.takeSS('Adding_Customer');
	});

	it('Add Customer, verify successful addition in alert', function() {
		AddCustomerPage.addCust();
		var myAlert = browser.switchTo().alert();
		let text=myAlert.getText().then(function(text){
			console.log(text);
			myAlert.accept();
			expect(text).toContain('Customer added successfully with customer id :');
		});
	});

	it('Verify Customer Login present for New Customer', function() {
		HomePage=cf.gotoHome();
		CustomerLoginPage=HomePage.custLogin();
		expect(CustomerLoginPage.dd.getText()).toContain(data.newCustName);
	});

	it('Verify Account not created for New Customer', function() {
		var CustomerAccountPage=CustomerLoginPage.newCustLogin();
		screenShotFn.takeSS('New_Customer_With_No_Account');
		let msg=CustomerAccountPage.message.getText().then(function(msg){
			expect(msg).toBe('Welcome '+data.newCustName+' !! Please open an account with us.');
			console.log(msg);
		});
	});

	it('Add duplicate Customer, verify duplicate customer in alert', function() {
		HomePage=cf.gotoHome();
		BankManagerPage=HomePage.managerLogin();
		AddCustomerPage=BankManagerPage.gotoAddCust();
		console.log('Adding Customer');
		AddCustomerPage.addCust();
		var myAlert = browser.switchTo().alert();
		let text=myAlert.getText().then(function(text){
			console.log(text);
			expect(text).toBe('Please check the details. Customer may be duplicate.');
			myAlert.accept();
			screenShotFn.takeSS('Duplicate_Customer');
		});
	});

/*it('Try leaving fields and verify tooltip message', function() {
});*/
});