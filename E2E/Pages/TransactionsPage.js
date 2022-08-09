var TransactionsPage = function() {
	this.backBtn = element(by.buttonText('Back'));
	this.startDatePicker = element(by.id('start'));
	this.endDatePicker = element(by.id('start'));
	this.lastAmt=element.all(by.xpath('//table[contains(@class,"table-bordered")]//tbody//tr//td[2]')).last();
	l=element.all(by.xpath('//table[contains(@class,"table-bordered")]//tbody//tr//td[2]')).last();
	this.lastType= element.all(by.xpath('//table[contains(@class,"table-bordered")]//tbody//tr//td[3]')).last();
	this.table=element(by.tagName('table')); 
	tData=element(by.xpath('//tbody/tr[1]/td[1]'));

	this.back = function() {
		this.backBtn.click();
		return require('../Pages/CustomerAccountPage.js');
	};

	this.setDate = function(name) { 
		if(name=="Hermoine Granger"){
			var dp=this.startDatePicker;
			var d=dp.getAttribute('max').then(function(d){
				var dd=d.slice(8,10);
				var mm=d.slice(5,7);
				var yyyy=d.slice(0,4);
				dp.sendKeys(dd+'-'+mm+'-'+yyyy+' 00:00').then(function(){//' '+hh+':'+min).then(function(){
					browser.sleep(1000);
					expect(dp.getAttribute("value")).toContain(yyyy+'-'+mm+'-'+dd);
					console.log('Date is successfully changed');
				});
			});
		}
		else{
			var dp=this.startDatePicker;
			var d=dp.getAttribute('min').then(function(d){
				var dd=d.slice(8,10);
				var mm=d.slice(5,7);
				var yyyy=d.slice(0,4);
				var hh=d.slice(11,13);
				var min=d.slice(14,16);
				dp.sendKeys(dd+'-'+mm+' '+hh).then(function(){//+':'+min
					browser.sleep(1000);
					expect(dp.getAttribute("value")).toContain(yyyy+'-'+mm+'-'+dd+'T'+hh+':');
					console.log('Date is successfully changed');
				});
			});
		}
	};

	this.getAmt = function() {
		return l.getText();
	};

	this.getType = function() {
		return this.lastType.getText();
	};
};
module.exports = new TransactionsPage();