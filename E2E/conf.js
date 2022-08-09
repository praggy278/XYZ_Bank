var htmlReporter=require('protractor-beautiful-reporter');
var time = new Date();
exports.config = {
	seleniumAddress: 'http://localhost:4444/wd/hub',
	//specs: ['./Specs/Spec_ViewTransactions.js', './Specs/Spec_Deposit.js', './Specs/Spec_Withdrawal.js', './Specs/Spec_AddCustomer.js'],
	specs: ['./Specs/integratedFlowSpec.js'],
	onPrepare: function(){
		jasmine.getEnv().addReporter(new htmlReporter({
			baseDirectory: '../PrettyReporter/'+time.getDate()+' '+time.getHours() + ' ' + time.getMinutes()
		}).getJasmine2Reporter());
	}
};