var screenShotFn = require('../Utility/screenShotFn');
var homePage = require('../Pages/HomePage');
var dataProvider = require('jasmine-data-provider');
var dataSupplier=require('../Data/dataSupplier');
var cf=require('../Utility/CommonFunction');

dataProvider(dataSupplier , function(input){
	describe('Customer is able to View Transactions', function(){
		var transactionsPage;
		var customerLoginPage;
		var customerAccountPage;
		
		it('Get Url for '+input.userID, function() {
			homePage.launchURL();
			browser.sleep(1000);
			screenShotFn.takeSS('Get_Url');
		});
		
		it('Go To Customer Login Page for '+input.userID, function() {
			customerLoginPage=homePage.custLogin();
			screenShotFn.takeSS('Goto_CustomerLogin');
		});

		it('Login Customer for '+input.userID, function() {
			customerAccountPage=customerLoginPage.custLogin(input.userID);
			screenShotFn.takeSS('Logged_In'+input.userID);
		});

		it('Doing some Transactions to verify Transactional history on Transactions Page for '+input.userID, function() {
			customerAccountPage.depositAmt();
			customerAccountPage.withdrawValidAmt();
		});

		it('Go to Transactions for '+input.userID, function() {
			cf.waitForTransactions(customerAccountPage);
			transactionsPage=customerAccountPage.gotoTransactions();
			screenShotFn.takeSS('Navigate_to_Transactions'+input.userID);
		});

		it('Verify Table is displayed on Transactions Page for '+input.userID, function() {
			expect(transactionsPage.table.getText()).toContain('Date-Time').then(function(){
				console.log('Table checked');
			});
		});

		it('Verify Date is not empty and it is valid on Transactions Page for '+input.userID, function() {
			expect(transactionsPage.startDatePicker.getAttribute('class')).toContain('ng-valid');
			expect(transactionsPage.endDatePicker.getAttribute('class')).toContain('ng-valid');
			console.log('Date checked');
		});

		it('Verify user is able to Choose Date on Transactions Page for '+input.userID, function() {
			transactionsPage.setDate(input.userID);
			screenShotFn.takeSS('Date changed');
		});
	});
});