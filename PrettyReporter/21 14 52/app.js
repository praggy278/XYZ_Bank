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
        "description": "Get Url|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001100d6-00de-0013-0015-009700a5004f.png",
        "timestamp": 1611220979760,
        "duration": 3454
    },
    {
        "description": "Go To Customer Login Page|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c60098-00e6-00df-00dd-00b200e100b0.png",
        "timestamp": 1611220983542,
        "duration": 911
    },
    {
        "description": "Login Customer|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00550034-00ff-00d5-00f0-00fc001e007d.png",
        "timestamp": 1611220984735,
        "duration": 1253
    },
    {
        "description": "Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bc00d7-0002-00f6-00d4-007100ea00ce.png",
        "timestamp": 1611220986373,
        "duration": 1921
    },
    {
        "description": "Go to Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d8005d-004d-00c5-00b4-005000100032.png",
        "timestamp": 1611220988608,
        "duration": 1805
    },
    {
        "description": "Table is displayed|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0044002b-00db-007b-0020-00bd00a800cf.png",
        "timestamp": 1611220990704,
        "duration": 367
    },
    {
        "description": "Date is not empty and it is valid|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc00b1-001d-00de-009b-006500410033.png",
        "timestamp": 1611220991380,
        "duration": 70
    },
    {
        "description": "Choose Date|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d300bb-00a8-003e-0097-00ee0067000a.png",
        "timestamp": 1611220991755,
        "duration": 1642
    },
    {
        "description": "Get Url|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009a006a-003a-006f-00f8-00e7005000dc.png",
        "timestamp": 1611220993698,
        "duration": 1811
    },
    {
        "description": "Go To Customer Login Page|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00470080-0075-00c8-009e-00f600400037.png",
        "timestamp": 1611220995797,
        "duration": 923
    },
    {
        "description": "Login Customer|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00050048-0091-0000-007b-007500b4003e.png",
        "timestamp": 1611220997019,
        "duration": 1199
    },
    {
        "description": "Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a4002a-009a-004b-00bf-001600c400fc.png",
        "timestamp": 1611220998513,
        "duration": 1596
    },
    {
        "description": "Go to Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0087006e-00fe-0020-0076-00290047008c.png",
        "timestamp": 1611221000440,
        "duration": 1362
    },
    {
        "description": "Table is displayed|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e0059-00b7-0009-00e2-00af00b40023.png",
        "timestamp": 1611221002090,
        "duration": 52
    },
    {
        "description": "Date is not empty and it is valid|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fe0052-006a-007e-007c-006600280095.png",
        "timestamp": 1611221002438,
        "duration": 68
    },
    {
        "description": "Choose Date|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700bd-0034-0038-0024-006600ff00ea.png",
        "timestamp": 1611221002805,
        "duration": 1551
    },
    {
        "description": "Deposit amount and verify message|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa0010-00eb-0036-0028-001600560042.png",
        "timestamp": 1611221004682,
        "duration": 1385
    },
    {
        "description": "Deposit verification in Transactions|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c008d-0006-003e-0063-00c1007b0012.png",
        "timestamp": 1611221006365,
        "duration": 4239
    },
    {
        "description": "Deposit amount and verify message|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e00ba-00ff-00f8-00f8-005900950059.png",
        "timestamp": 1611221010952,
        "duration": 1420
    },
    {
        "description": "Deposit verification in Transactions|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001700d2-000d-00e1-0085-004900b5004a.png",
        "timestamp": 1611221012674,
        "duration": 3883
    },
    {
        "description": "Withdraw amount and verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00570079-0054-00d8-00ce-0013001e000c.png",
        "timestamp": 1611221016874,
        "duration": 1584
    },
    {
        "description": "Withdrawal verification in Transactions|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008a0040-0023-00c0-00b3-0077008d007d.png",
        "timestamp": 1611221018746,
        "duration": 4242
    },
    {
        "description": "Failed to withdraw, verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
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
                "timestamp": 1611221024374,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0003-004a-005b-000c-00bf009d00e5.png",
        "timestamp": 1611221023306,
        "duration": 1434
    },
    {
        "description": "Withdraw amount and verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001800c0-0015-0090-00d8-00be00910078.png",
        "timestamp": 1611221025054,
        "duration": 1678
    },
    {
        "description": "Withdrawal verification in Transactions|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0032000a-0055-00b9-00e1-0034006b0076.png",
        "timestamp": 1611221027033,
        "duration": 3980
    },
    {
        "description": "Failed to withdraw, verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
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
                "timestamp": 1611221032370,
                "type": ""
            }
        ],
        "screenShotFile": "009300cd-00f2-00c4-0064-008f005200b6.png",
        "timestamp": 1611221031316,
        "duration": 1402
    },
    {
        "description": "Manager Login|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e5009b-00bb-0058-005e-00c100b50077.png",
        "timestamp": 1611221033017,
        "duration": 850
    },
    {
        "description": "Go to Add Customer Page|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a600b0-00c8-00cc-00db-0080005d0059.png",
        "timestamp": 1611221034149,
        "duration": 921
    },
    {
        "description": "Add Customer, verify successful addition in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200ff-00bf-0019-0069-007a005f0052.png",
        "timestamp": 1611221035364,
        "duration": 290
    },
    {
        "description": "Verify Customer Login present for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c4003d-005f-00bd-0078-00cd00220011.png",
        "timestamp": 1611221036011,
        "duration": 160
    },
    {
        "description": "Verify Account not created for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d500c0-0056-00bf-005e-0084003b0065.png",
        "timestamp": 1611221036461,
        "duration": 610
    },
    {
        "description": "Add duplicate Customer, verify duplicate customer in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fcffcbed87ddf63f66262f063f32a2d4",
        "instanceId": 20236,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da00d4-00b0-00e5-0072-007000b200eb.png",
        "timestamp": 1611221037372,
        "duration": 1323
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
