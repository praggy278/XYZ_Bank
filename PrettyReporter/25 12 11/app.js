var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Get Url for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005400f3-0015-0042-0012-006a00f500c6.png",
        "timestamp": 1611556874366,
        "duration": 3274
    },
    {
        "description": "Go To Customer Login Page for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b700ed-0020-00a1-007c-00ed004e00b1.png",
        "timestamp": 1611556878035,
        "duration": 369
    },
    {
        "description": "Login Customer for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00de00e2-00e6-0092-00cb-00a9000c0028.png",
        "timestamp": 1611556878689,
        "duration": 929
    },
    {
        "description": "Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a80035-00e5-0085-00c9-007300f400c3.png",
        "timestamp": 1611556879924,
        "duration": 597
    },
    {
        "description": "Go to Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00470004-0018-0063-0013-00bb00560083.png",
        "timestamp": 1611556880849,
        "duration": 684
    },
    {
        "description": "Table is displayed for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c0082-00cc-00df-000c-0062003c0054.png",
        "timestamp": 1611556881836,
        "duration": 369
    },
    {
        "description": "Date is not empty and it is valid for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00930011-0047-00cb-00ce-007000e8000e.png",
        "timestamp": 1611556882508,
        "duration": 65
    },
    {
        "description": "Choose Date for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00300013-00c6-006b-0077-00b200720089.png",
        "timestamp": 1611556882879,
        "duration": 1629
    },
    {
        "description": "Get Url for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009e00fd-00aa-0051-0038-004c001300cb.png",
        "timestamp": 1611556884820,
        "duration": 1856
    },
    {
        "description": "Go To Customer Login Page for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0060002f-00d1-007e-00ec-003600900023.png",
        "timestamp": 1611556886971,
        "duration": 368
    },
    {
        "description": "Login Customer for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0067001c-00a3-00d9-000f-0027009b0030.png",
        "timestamp": 1611556887636,
        "duration": 562
    },
    {
        "description": "Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000a0008-00c8-00e9-00fd-009300e20097.png",
        "timestamp": 1611556888502,
        "duration": 369
    },
    {
        "description": "Go to Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009400d1-008c-0018-00fb-00db00c00090.png",
        "timestamp": 1611556889190,
        "duration": 501
    },
    {
        "description": "Table is displayed for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b0036-0037-00a1-0077-004e000b0081.png",
        "timestamp": 1611556889982,
        "duration": 42
    },
    {
        "description": "Date is not empty and it is valid for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0051007a-009d-00de-0050-006f00790000.png",
        "timestamp": 1611556890319,
        "duration": 60
    },
    {
        "description": "Choose Date for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f400d2-005f-00c3-00a1-0098007b001c.png",
        "timestamp": 1611556890687,
        "duration": 1493
    },
    {
        "description": "Deposit amount and verify message for Hermoine Granger|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f500b3-002d-0015-0033-000600df002e.png",
        "timestamp": 1611556892487,
        "duration": 1420
    },
    {
        "description": "Deposit verification in Transactions for Hermoine Granger|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0079002e-0031-0089-00ec-00c0003d0044.png",
        "timestamp": 1611556894207,
        "duration": 2945
    },
    {
        "description": "Deposit amount and verify message for Albus Dumbledore|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d00fa-004c-0020-0033-006a008500be.png",
        "timestamp": 1611556897451,
        "duration": 1416
    },
    {
        "description": "Deposit verification in Transactions for Albus Dumbledore|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b400e7-000b-00ec-00fa-001800df0078.png",
        "timestamp": 1611556899157,
        "duration": 2644
    },
    {
        "description": "Withdraw amount and verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700f5-00ad-00ad-004f-002800c20092.png",
        "timestamp": 1611556902111,
        "duration": 1594
    },
    {
        "description": "Withdrawal verification in Transactions for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009800b1-00b3-0056-003a-007d003300b1.png",
        "timestamp": 1611556903995,
        "duration": 2972
    },
    {
        "description": "Failed to withdraw, verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1611556908315,
                "type": ""
            }
        ],
        "screenShotFile": "00db0046-00d6-00a5-00f5-005500ec00b2.png",
        "timestamp": 1611556907280,
        "duration": 1378
    },
    {
        "description": "Withdraw amount and verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0007001f-00f9-00c2-000a-00040031001a.png",
        "timestamp": 1611556908952,
        "duration": 1554
    },
    {
        "description": "Withdrawal verification in Transactions for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00030049-0054-003e-00f1-006a00030083.png",
        "timestamp": 1611556910806,
        "duration": 2619
    },
    {
        "description": "Failed to withdraw, verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1611556914770,
                "type": ""
            }
        ],
        "screenShotFile": "009f007a-0015-00ad-00ac-00bf00e60056.png",
        "timestamp": 1611556913726,
        "duration": 1390
    },
    {
        "description": "Manager Login|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dc00fa-004a-007f-0004-002d00d70025.png",
        "timestamp": 1611556915431,
        "duration": 858
    },
    {
        "description": "Go to Add Customer Page|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0071004a-00b9-003c-0022-00de007c00dd.png",
        "timestamp": 1611556916584,
        "duration": 942
    },
    {
        "description": "Add Customer, verify successful addition in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f00f0-0016-006e-00bc-00cd008400d4.png",
        "timestamp": 1611556917828,
        "duration": 290
    },
    {
        "description": "Verify Customer Login present for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a500d8-0089-0017-0030-003f00c600dc.png",
        "timestamp": 1611556918454,
        "duration": 161
    },
    {
        "description": "Verify Account not created for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00850078-007d-00f7-00d6-007100b70033.png",
        "timestamp": 1611556918916,
        "duration": 643
    },
    {
        "description": "Add duplicate Customer, verify duplicate customer in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2956142003867835e13c87b8ecbba928",
        "instanceId": 17392,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b10094-00bd-0015-005a-009500c000de.png",
        "timestamp": 1611556919876,
        "duration": 1908
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
