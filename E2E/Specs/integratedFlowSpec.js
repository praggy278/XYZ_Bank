var screenShotFn = require('../Utility/screenShotFn');
var homePage = require('../Pages/HomePage');
var data = require('../Data/testData');
var cf=require('../Utility/CommonFunction');

describe('Integrated Flow for a new customer', function(){
	var addCustomerPage;
	var customerLoginPage;
	var bankManagerPage;
	var customerAccountPage;
	var openAccountPage;
	var transactionsPage;
	
	it('Get Url', function() {
		homePage.launchURL();
		browser.sleep(1000);
		screenShotFn.takeSS('Get_Url');
	});
	
	it('Click on Manager Login', function() {
		bankManagerPage=homePage.managerLogin();
		screenShotFn.takeSS('Manager_Login');
	});

	it('Go to Add Customer Page', function() {
		addCustomerPage=bankManagerPage.gotoAddCust();
		console.log('Adding Customer');
		screenShotFn.takeSS('Adding_Customer');
	});

	it('Add Customer, verify successful addition in alert', function() {
		addCustomerPage.addCust();
		var myAlert = browser.switchTo().alert();
		let text=myAlert.getText().then(function(text){
			console.log(text);
			myAlert.accept();
			expect(text).toContain('Customer added successfully with customer id :');
		});
	});
	
	it('Add duplicate Customer, verify duplicate customer in alert', function() {
		homePage=cf.gotoHome();
		bankManagerPage=homePage.managerLogin();
		addCustomerPage=bankManagerPage.gotoAddCust();
		console.log('Adding Customer');
		addCustomerPage.addCust();
		var myAlert = browser.switchTo().alert();
		let text=myAlert.getText().then(function(text){
			console.log(text);
			expect(text).toBe('Please check the details. Customer may be duplicate.');
			myAlert.accept();
			screenShotFn.takeSS('Duplicate_Customer');
		});
	});
	it('Verify Customer Login is present for New Customer', function() {
		homePage=cf.gotoHome();
		customerLoginPage=homePage.custLogin();
		expect(customerLoginPage.dd.getText()).toContain(data.newCustName);
	});

	it('Verify Account not created for New Customer', function() {
		var customerAccountPage=customerLoginPage.newCustLogin();
		screenShotFn.takeSS('New_Customer_With_No_Account');
		let msg=customerAccountPage.message.getText().then(function(msg){
			expect(msg).toBe('Welcome '+data.newCustName+' !! Please open an account with us.');
			console.log(msg);
		});
	});
	
	it('Open new Account for New Customer', function() {
		homePage=cf.gotoHome();
		bankManagerPage=homePage.managerLogin();
		openAccountPage=bankManagerPage.gotoOpenAcc();
		openAccountPage.openAcc(data.newCustName,data.currency);
		var myAlert = browser.switchTo().alert();
		let text=myAlert.getText().then(function(text){
			console.log(text);
			expect(text).toContain('Account created successfully with account Number :');
			myAlert.accept();
			screenShotFn.takeSS('Open_Account');
		});
	});
	
	it('Verify Customer Login for New Customer after opening Account', function() {
		homePage=cf.gotoHome();
		customerLoginPage=homePage.custLogin();
		customerAccountPage=customerLoginPage.newCustLogin();
		screenShotFn.takeSS('New_Customer_With_New_Account');
		let msg=customerAccountPage.message.getText().then(function(msg){
			expect(msg).toContain('Welcome '+data.newCustName+' !!');
			console.log(msg);
		});
	});
	
	it('Doing some Transactions to verify Transactional history on Transactions Page', function() {
			customerAccountPage.depositAmt();
			customerAccountPage.withdrawValidAmt();
	});

	it('Go to Transactions', function() {
		cf.waitForTransactions(CustomerAccountPage);
		transactionsPage=customerAccountPage.gotoTransactions();
		screenShotFn.takeSS('Navigate_to_Transactions');
	});

	it('Verify Table is displayed on Transactions Page', function() {
		expect(transactionsPage.table.getText()).toContain('Date-Time').then(function(){
			console.log('Table checked');
		});
	});

	it('Verify Date is not empty and it is valid on Transactions Page', function() {
		expect(transactionsPage.startDatePicker.getAttribute('class')).toContain('ng-valid');
		expect(transactionsPage.endDatePicker.getAttribute('class')).toContain('ng-valid');
		console.log('Date checked');
	});

	it('Verify user is able to Choose Date on Transactions Page', function() {
		transactionsPage.setDate(data.newCustName);
		screenShotFn.takeSS('Date changed');
	});
		
	it('Deposit amount and verify message', function() {
		customerAccountPage=transactionsPage.back();
		customerAccountPage.depositAmt();
		customerAccountPage.transactionMsg.getText().then(function(msg){
			console.log(msg);
			screenShotFn.takeSS('Deposit_Successful');
			expect(msg).toBe('Deposit Successful');
		});
	});

	it('Deposit verification in Transactions', function() {
		cf.waitForTransactions(customerAccountPage);
		transactionsPage=customerAccountPage.gotoTransactions();
		transactionsPage.setDate(data.newCustName);
		transactionsPage.getAmt().then(function(last_amt){
			expect(last_amt).toBe(data.validAmount);
		});
		transactionsPage.getType().then(function(last_type){
			expect(last_type).toBe('Credit');
			console.log('Deposit Verified in Transactions');
		});
		screenShotFn.takeSS('Deposit_Verified');
	});
	
	it('Withdraw amount and verify message', function() {
		customerAccountPage=TransactionsPage.back();
		customerAccountPage.depositAmt();
		customerAccountPage.withdrawValidAmt();
		customerAccountPage.transactionMsg.getText().then(function(msg){
			console.log(msg);
			screenShotFn.takeSS('Withdrawal_Successful');
			expect(msg).toBe('Transaction successful');
		});
	});

	it('Withdrawal verification in Transactions', function() {
		cf.waitForTransactions(CustomerAccountPage);
		transactionsPage=CustomerAccountPage.gotoTransactions();
		transactionsPage.setDate(data.newCustName);
		transactionsPage.getAmt().then(function(last_amt){
			expect(last_amt).toBe(data.validAmount);
		});
		transactionsPage.getType().then(function(last_type){
			expect(last_type).toBe('Debit');
			console.log('Withdrawal Verified in Transactions');
		});
		screenShotFn.takeSS('Withdrawal_Verified');
	});

	it('Failed to withdraw, verify message', function(){
		customerAccountPage=transactionsPage.back();
		customerAccountPage.withdrawInvalidAmt();
		customerAccountPage.transactionMsg.getText().then(function(msg){
			console.log(msg);
			screenShotFn.takeSS('Failed_Withdrawal_Verified');
			expect(msg).toBe('Transaction Failed. You can not withdraw amount more than the balance.');
		});
	});
});