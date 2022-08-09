var screenShotFn = require('../Utility/screenShotFn');
var HomePage = require('../Pages/HomePage');
var data = require('../Data/testData');
var dataProvider = require('jasmine-data-provider');
var dataSupplier=require('../Data/dataSupplier');
var cf=require('../Utility/CommonFunction');

dataProvider(dataSupplier , function(input){
	describe('Customer is able to successfully Deposit', function(){
		var CustomerLoginPage;
		var CustomerAccountPage;
		
		it('Deposit amount and verify message for '+input.userID, function() {
			HomePage.launchURL();
			CustomerLoginPage=HomePage.custLogin();
			CustomerAccountPage=CustomerLoginPage.custLogin(input.userID);
			CustomerAccountPage.depositAmt();
			CustomerAccountPage.transactionMsg.getText().then(function(msg){
				console.log(msg+input.userID);
				screenShotFn.takeSS('Deposit_Successful'+input.userID);
				expect(msg).toBe('Deposit Successful');
			});
		});

		it('Deposit verification in Transactions for '+input.userID, function() {
			var TransactionsPage;
			cf.waitForTransactions(CustomerAccountPage);
			TransactionsPage=CustomerAccountPage.gotoTransactions();
			TransactionsPage.setDate(input.userID);
			TransactionsPage.getAmt().then(function(last_amt){
				expect(last_amt).toBe(data.validAmount);
			});
			TransactionsPage.getType().then(function(last_type){
				expect(last_type).toBe('Credit');
				console.log('Deposit Verified'+input.userID);
			});
			screenShotFn.takeSS('Deposit_Verified_'+input.userID);
		});
	});
});