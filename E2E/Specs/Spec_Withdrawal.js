var screenShotFn = require('../Utility/screenShotFn');
var HomePage = require('../Pages/HomePage');
var data = require('../Data/testData');
var dataProvider = require('jasmine-data-provider');
var dataSupplier=require('../Data/dataSupplier');
var cf=require('../Utility/CommonFunction');

dataProvider(dataSupplier , function(input){
	describe('Customer is able to successfully Withdraw a valid amount', function(){
		var CustomerAccountPage;
		var CustomerLoginPage;
		var TransactionsPage;
		
		it('Withdraw amount and verify message for '+input.userID, function() {
			HomePage.launchURL();
			CustomerLoginPage=HomePage.custLogin();
			CustomerAccountPage=CustomerLoginPage.custLogin(input.userID);
			CustomerAccountPage.depositAmt();
			CustomerAccountPage.withdrawValidAmt();
			CustomerAccountPage.transactionMsg.getText().then(function(msg){
				console.log(msg+input.userID);
				screenShotFn.takeSS('Withdrawal_Successful'+input.userID);
				expect(msg).toBe('Transaction successful');
			});
		});

		it('Withdrawal verification in Transactions for '+input.userID, function() {
			cf.waitForTransactions(CustomerAccountPage);
			TransactionsPage=CustomerAccountPage.gotoTransactions();
			TransactionsPage.setDate(input.userID);
			TransactionsPage.getAmt().then(function(last_amt){
				expect(last_amt).toBe(data.validAmount);
			});
			TransactionsPage.getType().then(function(last_type){
				expect(last_type).toBe('Debit');
				console.log('Withdrawal Verified'+input.userID);
			});
			screenShotFn.takeSS('Withdrawal_Verified'+input.userID);
		});

		it('Failed to withdraw, verify message for '+input.userID, function(){
			CustomerAccountPage=TransactionsPage.back();
			CustomerAccountPage.withdrawInvalidAmt();
			CustomerAccountPage.transactionMsg.getText().then(function(msg){
				console.log(msg+input.userID);
				screenShotFn.takeSS('Failed_Withdrawal_Verified'+input.userID);
				expect(msg).toBe('Transaction Failed. You can not withdraw amount more than the balance.');
			});
		});
	});
});