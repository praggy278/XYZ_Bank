var screenShotFn = require('../Utility/screenShotFn');
var HomePage = require('../Pages/HomePage');
var dataProvider = require('jasmine-data-provider');
var dataSupplier=require('../Data/JasDataProvider');
var cf=require('../Utility/CommonFunction');

dataProvider(dataSupplier , function(input){
	describe('Customer Login View Transactions', function(){
		var TransactionsPage;
		var CustomerLoginPage;
		var CustomerAccountPage;
		
		it('Get Url for '+input.userID, function() {
			HomePage.launchURL();
			browser.sleep(1000);
			screenShotFn.takeSS('Get_Url');
		});
		
		it('Go To Customer Login Page for '+input.userID, function() {
			CustomerLoginPage=HomePage.custLogin();
			screenShotFn.takeSS('Goto_CustomerLogin');
		});

		it('Login Customer for '+input.userID, function() {
			CustomerAccountPage=CustomerLoginPage.custLogin(input.userID);
			screenShotFn.takeSS('Logged_In'+input.userID);
		});

		it('Transactions for '+input.userID, function() {
			CustomerAccountPage.depositAmt();
			CustomerAccountPage.withdrawValidAmt();
		});

		it('Go to Transactions for '+input.userID, function() {
			cf.waitForTransactions(CustomerAccountPage);
			TransactionsPage=CustomerAccountPage.gotoTransactions();
			screenShotFn.takeSS('Navigate_to_Transactions'+input.userID);
		});

		it('Table is displayed for '+input.userID+'',async ()=> {
			await expect(TransactionsPage.table.getText()).toContain('Date-Time');
				console.log('Table checked');
		});

		it('Date is not empty and it is valid for '+input.userID, function() {
			expect(TransactionsPage.startDatePicker.getAttribute('class')).toContain('ng-valid');
			expect(TransactionsPage.endDatePicker.getAttribute('class')).toContain('ng-valid');
			console.log('Date checked');
		});

		it('Choose Date for '+input.userID, function() {
			TransactionsPage.setDate(input.userID);
			screenShotFn.takeSS('Date changed');
		});
	});
});