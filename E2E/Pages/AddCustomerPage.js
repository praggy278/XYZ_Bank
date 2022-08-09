var data = require('../Data/testData');

var AddCustomerPage = function() {
	firstNameTextbox = element(by.model('fName'));
	lastNameTextbox = element(by.model('lName'));
	postCodeTextbox = element(by.model('postCd'));
	this.addBtn = element(by.xpath('//form[1]/button[1]'));

	this.addCust = function() {
		firstNameTextbox.sendKeys(data.firstName);
		expect(firstNameTextbox.getAttribute('value')).toBe(data.firstName);
		lastNameTextbox.sendKeys(data.lastName);
		expect(lastNameTextbox.getAttribute('value')).toBe(data.lastName);
		postCodeTextbox.sendKeys(data.postCode);
		expect(postCodeTextbox.getAttribute('value')).toBe(data.postCode);
		this.addBtn.click();
	};
};
module.exports = new AddCustomerPage();