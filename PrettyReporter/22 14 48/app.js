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
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003400ed-000e-00c4-0010-00c700a100b9.png",
        "timestamp": 1611307126940,
        "duration": 5005
    },
    {
        "description": "Go To Customer Login Page for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b1000b-007f-0073-00cf-002c00ad007f.png",
        "timestamp": 1611307132358,
        "duration": 855
    },
    {
        "description": "Login Customer for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009a00a5-0024-0062-006f-00ff00d200b8.png",
        "timestamp": 1611307133497,
        "duration": 1336
    },
    {
        "description": "Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d100de-00e7-008f-0060-002700e8001c.png",
        "timestamp": 1611307135292,
        "duration": 1891
    },
    {
        "description": "Go to Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00770087-00cc-005f-00ae-00da003400b0.png",
        "timestamp": 1611307137503,
        "duration": 1873
    },
    {
        "description": "Table is displayed for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c800d5-00f0-001d-00a5-00da007b0038.png",
        "timestamp": 1611307139681,
        "duration": 366
    },
    {
        "description": "Date is not empty and it is valid for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00200051-00fd-0060-0018-00f700bb0096.png",
        "timestamp": 1611307140395,
        "duration": 136
    },
    {
        "description": "Choose Date for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00710086-00f8-0095-00ad-00a700110028.png",
        "timestamp": 1611307140854,
        "duration": 1780
    },
    {
        "description": "Get Url for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0001008e-00ac-0058-0040-009a00bf004b.png",
        "timestamp": 1611307142947,
        "duration": 1857
    },
    {
        "description": "Go To Customer Login Page for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0096008d-0062-0058-004d-00ee00800085.png",
        "timestamp": 1611307145085,
        "duration": 910
    },
    {
        "description": "Login Customer for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009f0018-0043-0010-002e-00e3001a00f0.png",
        "timestamp": 1611307146294,
        "duration": 1197
    },
    {
        "description": "Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00300028-0092-0054-00b3-00a1007600b7.png",
        "timestamp": 1611307147797,
        "duration": 1242
    },
    {
        "description": "Go to Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007200ee-004b-00ed-00c6-00bd00ec0088.png",
        "timestamp": 1611307149347,
        "duration": 1391
    },
    {
        "description": "Table is displayed for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc00b2-007a-009f-005a-0050009c00f5.png",
        "timestamp": 1611307151026,
        "duration": 43
    },
    {
        "description": "Date is not empty and it is valid for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00390003-0069-001a-0048-00d300950045.png",
        "timestamp": 1611307151361,
        "duration": 70
    },
    {
        "description": "Choose Date for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00550052-0017-003d-0094-005b00cb003f.png",
        "timestamp": 1611307151728,
        "duration": 1545
    },
    {
        "description": "Deposit amount and verify message for Hermoine Granger|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005b003a-00fc-0072-003e-00a800d200c1.png",
        "timestamp": 1611307153578,
        "duration": 1447
    },
    {
        "description": "Deposit verification in Transactions for Hermoine Granger|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000900de-00c9-005c-00c0-0070004e00d3.png",
        "timestamp": 1611307155322,
        "duration": 4271
    },
    {
        "description": "Deposit amount and verify message for Albus Dumbledore|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00ac-0029-00ee-00a4-003d00f900db.png",
        "timestamp": 1611307159891,
        "duration": 1412
    },
    {
        "description": "Deposit verification in Transactions for Albus Dumbledore|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0041-0030-0083-00cd-003600f90060.png",
        "timestamp": 1611307161604,
        "duration": 3939
    },
    {
        "description": "Withdraw amount and verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d00a3-00cb-0085-0047-009e00300079.png",
        "timestamp": 1611307165873,
        "duration": 1604
    },
    {
        "description": "Withdrawal verification in Transactions for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb00c1-00c8-0007-007d-002000570058.png",
        "timestamp": 1611307167782,
        "duration": 4297
    },
    {
        "description": "Failed to withdraw, verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
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
                "timestamp": 1611307173609,
                "type": ""
            }
        ],
        "screenShotFile": "00550023-008f-0099-009d-00c0000c00e5.png",
        "timestamp": 1611307172432,
        "duration": 1542
    },
    {
        "description": "Withdraw amount and verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cf0063-003c-004b-00d2-00be0072006b.png",
        "timestamp": 1611307174281,
        "duration": 1784
    },
    {
        "description": "Withdrawal verification in Transactions for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d3006b-00d6-00ba-00ae-007f00c100b7.png",
        "timestamp": 1611307176368,
        "duration": 4031
    },
    {
        "description": "Failed to withdraw, verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
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
                "timestamp": 1611307181788,
                "type": ""
            }
        ],
        "screenShotFile": "00c7004f-00e0-003a-003e-00ac00770026.png",
        "timestamp": 1611307180714,
        "duration": 1430
    },
    {
        "description": "Manager Login|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000b00bd-00d3-0014-006c-0043004500a2.png",
        "timestamp": 1611307182450,
        "duration": 879
    },
    {
        "description": "Go to Add Customer Page|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f400b2-0028-0032-009d-0006008700a4.png",
        "timestamp": 1611307183626,
        "duration": 950
    },
    {
        "description": "Add Customer, verify successful addition in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00910089-0053-00c3-0005-00fa00a9005a.png",
        "timestamp": 1611307184882,
        "duration": 303
    },
    {
        "description": "Verify Customer Login present for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d600aa-0014-008f-008b-00e6002100e6.png",
        "timestamp": 1611307185535,
        "duration": 174
    },
    {
        "description": "Verify Account not created for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a800d7-00fb-00ce-0012-007600da00da.png",
        "timestamp": 1611307186001,
        "duration": 617
    },
    {
        "description": "Add duplicate Customer, verify duplicate customer in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "498096b2648e70ab3c0565e09e4b2bf1",
        "instanceId": 21756,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b00eb-0049-006e-00b1-0080001400e3.png",
        "timestamp": 1611307186908,
        "duration": 1365
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
