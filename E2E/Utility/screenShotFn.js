var fs = require('fs');
var screenShotFn = function() {
	var time = new Date();
	screenshotPath ='../Screenshots/'+time.getDate()+' '+time.getHours()+' '+time.getMinutes();
	if (!fs.existsSync(screenshotPath)) {
		fs.mkdirSync(screenshotPath)
	}
	this.takeSS=function(name){
		browser.takeScreenshot().then(function(ss){
			var stream= fs.createWriteStream(screenshotPath+'/'+name+'.png');
			stream.write(new Buffer.from(ss,'base64'));
			stream.end();
		});
	};
};
module.exports = new screenShotFn();