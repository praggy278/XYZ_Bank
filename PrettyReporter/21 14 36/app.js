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
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e50075-00ab-0034-00f9-00ec004e00cf.png",
        "timestamp": 1611219978746,
        "duration": 3365
    },
    {
        "description": "Go To Customer Login Page|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c600cd-0070-003b-00e3-006300810080.png",
        "timestamp": 1611219982444,
        "duration": 863
    },
    {
        "description": "Login Customer|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bb00c3-00e9-0047-0017-0059000000bc.png",
        "timestamp": 1611219983606,
        "duration": 1245
    },
    {
        "description": "Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00230095-00d2-0083-0096-001e003200cf.png",
        "timestamp": 1611219985209,
        "duration": 1961
    },
    {
        "description": "Go to Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007700b9-00bd-00cc-001d-007c00e50032.png",
        "timestamp": 1611219987487,
        "duration": 1817
    },
    {
        "description": "Table is displayed|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009400b2-00cc-00ec-0019-0060008900f3.png",
        "timestamp": 1611219989604,
        "duration": 348
    },
    {
        "description": "Date is not empty and it is valid|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e700c7-0006-00b9-009e-00b300a700b4.png",
        "timestamp": 1611219990258,
        "duration": 67
    },
    {
        "description": "Choose Date|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00b2-00f7-0055-001a-0055004b00d2.png",
        "timestamp": 1611219990618,
        "duration": 1603
    },
    {
        "description": "Get Url|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ae00f9-0001-00d0-000e-00df008f0040.png",
        "timestamp": 1611219992545,
        "duration": 1815
    },
    {
        "description": "Go To Customer Login Page|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005f00aa-004f-0002-0024-006c00960081.png",
        "timestamp": 1611219994652,
        "duration": 894
    },
    {
        "description": "Login Customer|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f500dc-001a-0043-00bc-006b002800d7.png",
        "timestamp": 1611219995826,
        "duration": 1188
    },
    {
        "description": "Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00370058-001c-00c3-0099-00a300080070.png",
        "timestamp": 1611219997308,
        "duration": 1612
    },
    {
        "description": "Go to Transactions|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008600cc-004c-000d-0063-005000580091.png",
        "timestamp": 1611219999231,
        "duration": 1364
    },
    {
        "description": "Table is displayed|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001f0023-0022-0018-000d-006b0054001d.png",
        "timestamp": 1611220000890,
        "duration": 39
    },
    {
        "description": "Date is not empty and it is valid|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004200c0-001b-0026-0024-00fa00fa008d.png",
        "timestamp": 1611220001219,
        "duration": 63
    },
    {
        "description": "Choose Date|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0045003c-00cc-003b-0099-003900820076.png",
        "timestamp": 1611220001567,
        "duration": 1524
    },
    {
        "description": "Deposit amount and verify message|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00020013-0008-0064-0016-00a900df0007.png",
        "timestamp": 1611220003404,
        "duration": 1431
    },
    {
        "description": "Deposit verification in Transactions|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c0065-00e7-009c-009a-009f006900d6.png",
        "timestamp": 1611220005125,
        "duration": 4231
    },
    {
        "description": "Deposit amount and verify message|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00500066-0026-00dd-001e-0063004c00e0.png",
        "timestamp": 1611220009668,
        "duration": 1470
    },
    {
        "description": "Deposit verification in Transactions|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001000d3-00e1-0098-00f9-0086008c00f6.png",
        "timestamp": 1611220011432,
        "duration": 3939
    },
    {
        "description": "Withdraw amount and verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008100e6-009e-00ed-00ae-003b003800c7.png",
        "timestamp": 1611220015682,
        "duration": 1578
    },
    {
        "description": "Withdrawal verification in Transactions|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b60027-00dd-009c-007c-00e7005e008b.png",
        "timestamp": 1611220017561,
        "duration": 4394
    },
    {
        "description": "Failed to withdraw, verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
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
                "timestamp": 1611220023306,
                "type": ""
            }
        ],
        "screenShotFile": "00e90039-00c9-0090-00e3-00d4009400a5.png",
        "timestamp": 1611220022262,
        "duration": 1391
    },
    {
        "description": "Withdraw amount and verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002f00f6-00a1-0075-007f-009e004900d2.png",
        "timestamp": 1611220023980,
        "duration": 1816
    },
    {
        "description": "Withdrawal verification in Transactions|Customer Login Withdrawal",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: -1, but there are only 0 elements that match locator By(xpath, //table[contains(@class,\"table-bordered\")]//tbody//tr//td[2])"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: -1, but there are only 0 elements that match locator By(xpath, //table[contains(@class,\"table-bordered\")]//tbody//tr//td[2])\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at runMicrotasks (<anonymous>)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at TransactionsPage.getAmt (C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\E2E\\Pages\\TransactionsPage.js:59:10)\n    at UserContext.<anonymous> (C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\E2E\\Specs\\Spec_Withdrawal.js:39:18)\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Withdrawal verification in Transactions\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\E2E\\Specs\\Spec_Withdrawal.js:25:1)\n    at addSpecsToSuite (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\PRAGYA\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\E2E\\Specs\\Spec_Withdrawal.js:8:1\n    at C:\\Users\\PRAGYA\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at C:\\Users\\PRAGYA\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Object.<anonymous> (C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\E2E\\Specs\\Spec_Withdrawal.js:7:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00790095-005a-00f9-00e6-00f6004f0097.png",
        "timestamp": 1611220026080,
        "duration": 3676
    },
    {
        "description": "Failed to withdraw, verify message|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
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
                "timestamp": 1611220031128,
                "type": ""
            }
        ],
        "screenShotFile": "000d0088-005d-00d9-002a-007c00e700dd.png",
        "timestamp": 1611220030077,
        "duration": 1407
    },
    {
        "description": "Manager Login|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003b007d-0006-00eb-008c-00aa00ad0072.png",
        "timestamp": 1611220031793,
        "duration": 854
    },
    {
        "description": "Go to Add Customer Page|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0094003a-00d9-0009-0024-007500930088.png",
        "timestamp": 1611220032937,
        "duration": 981
    },
    {
        "description": "Add Customer, verify successful addition in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009a00de-0030-0019-0061-000f00eb00fd.png",
        "timestamp": 1611220034223,
        "duration": 298
    },
    {
        "description": "Verify Customer Login present for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e9004f-00c9-0013-00fe-00c700b30015.png",
        "timestamp": 1611220034869,
        "duration": 174
    },
    {
        "description": "Verify Account not created for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e0083-00db-00d1-0095-008100510008.png",
        "timestamp": 1611220035325,
        "duration": 644
    },
    {
        "description": "Add duplicate Customer, verify duplicate customer in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "08894abc63535dfe4d445ac83312c263",
        "instanceId": 19216,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d00aa-006f-004b-009b-00560016000f.png",
        "timestamp": 1611220036289,
        "duration": 1317
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
