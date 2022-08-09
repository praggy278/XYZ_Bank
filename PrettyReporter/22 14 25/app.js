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
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005700a6-0037-0010-00bf-004a001700c9.png",
        "timestamp": 1611305752963,
        "duration": 2983
    },
    {
        "description": "Go To Customer Login Page for Hermoine Granger|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Get_Url.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Get_Url.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "007200bf-00e9-0016-009e-001300d500c1.png",
        "timestamp": 1611305756386,
        "duration": 637
    },
    {
        "description": "Login Customer for Hermoine Granger|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Goto_CustomerLogin.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Goto_CustomerLogin.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "004200fe-00af-0037-004d-00a100ab00b4.png",
        "timestamp": 1611305757389,
        "duration": 1111
    },
    {
        "description": "Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Logged_InHermoine Granger.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Logged_InHermoine Granger.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00c000a1-0033-0084-0069-005f00a50014.png",
        "timestamp": 1611305758870,
        "duration": 1446
    },
    {
        "description": "Go to Transactions for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00780055-0016-00bc-0052-00db00fb008f.png",
        "timestamp": 1611305760683,
        "duration": 1942
    },
    {
        "description": "Table is displayed for Hermoine Granger|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Navigate_to_TransactionsHermoine Granger.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Navigate_to_TransactionsHermoine Granger.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00120049-0018-003c-003d-004e00bf00e5.png",
        "timestamp": 1611305762936,
        "duration": 320
    },
    {
        "description": "Date is not empty and it is valid for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0051003f-003b-0000-00fa-0049000c0018.png",
        "timestamp": 1611305763567,
        "duration": 66
    },
    {
        "description": "Choose Date for Hermoine Granger|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700ac-008e-00ce-0015-0070001800e0.png",
        "timestamp": 1611305763952,
        "duration": 1618
    },
    {
        "description": "Get Url for Albus Dumbledore|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Get_Url.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Get_Url.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00a3008c-0018-00f1-00e9-0062002e00a5.png",
        "timestamp": 1611305765882,
        "duration": 1805
    },
    {
        "description": "Go To Customer Login Page for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008800c0-0001-005a-00cf-006a00c500f8.png",
        "timestamp": 1611305767989,
        "duration": 880
    },
    {
        "description": "Login Customer for Albus Dumbledore|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Goto_CustomerLogin.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Goto_CustomerLogin.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00cc00bd-003a-0015-0069-0026007b00e0.png",
        "timestamp": 1611305769231,
        "duration": 1047
    },
    {
        "description": "Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Logged_InAlbus Dumbledore.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Logged_InAlbus Dumbledore.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "0091003d-00dc-0042-002b-00c2004f008d.png",
        "timestamp": 1611305770644,
        "duration": 1095
    },
    {
        "description": "Go to Transactions for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001200e2-0094-002b-00a1-003b001800a6.png",
        "timestamp": 1611305772052,
        "duration": 1354
    },
    {
        "description": "Table is displayed for Albus Dumbledore|Customer Login View Transactions",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Navigate_to_TransactionsAlbus Dumbledore.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Navigate_to_TransactionsAlbus Dumbledore.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00a80049-00d9-0087-0085-001200120045.png",
        "timestamp": 1611305773711,
        "duration": 18
    },
    {
        "description": "Date is not empty and it is valid for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ad009c-00f6-0092-00ab-00d300d80036.png",
        "timestamp": 1611305774012,
        "duration": 56
    },
    {
        "description": "Choose Date for Albus Dumbledore|Customer Login View Transactions",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0010005f-00c0-0006-0046-00bb00ce00b9.png",
        "timestamp": 1611305774369,
        "duration": 1503
    },
    {
        "description": "Deposit amount and verify message for Hermoine Granger|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00740072-007a-0021-00a1-002200200024.png",
        "timestamp": 1611305776173,
        "duration": 1390
    },
    {
        "description": "Deposit verification in Transactions for Hermoine Granger|Customer Login Deposit",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_SuccessfulHermoine Granger.png'",
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_Verified_Hermoine Granger.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_SuccessfulHermoine Granger.png'",
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_Verified_Hermoine Granger.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00e000a3-008f-0008-00c0-008b00790006.png",
        "timestamp": 1611305777937,
        "duration": 4141
    },
    {
        "description": "Deposit amount and verify message for Albus Dumbledore|Customer Login Deposit",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00670006-00cd-0072-0092-00890039002a.png",
        "timestamp": 1611305782390,
        "duration": 1379
    },
    {
        "description": "Deposit verification in Transactions for Albus Dumbledore|Customer Login Deposit",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_SuccessfulAlbus Dumbledore.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Deposit_SuccessfulAlbus Dumbledore.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "007f0061-0005-0053-0067-004a000f00a7.png",
        "timestamp": 1611305784126,
        "duration": 3789
    },
    {
        "description": "Withdraw amount and verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700b8-00e4-0036-00cd-009b00730037.png",
        "timestamp": 1611305788228,
        "duration": 1528
    },
    {
        "description": "Withdrawal verification in Transactions for Hermoine Granger|Customer Login Withdrawal",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_SuccessfulHermoine Granger.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_SuccessfulHermoine Granger.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "0056007e-0051-00c7-0092-00ec00d100a8.png",
        "timestamp": 1611305790125,
        "duration": 4115
    },
    {
        "description": "Failed to withdraw, verify message for Hermoine Granger|Customer Login Withdrawal",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_VerifiedHermoine Granger.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_VerifiedHermoine Granger.png'"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1611305795633,
                "type": ""
            }
        ],
        "screenShotFile": "008500e9-007f-00e3-00b5-000100c1001a.png",
        "timestamp": 1611305794666,
        "duration": 1340
    },
    {
        "description": "Withdraw amount and verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c009c-005f-00a1-008c-009d00ce0022.png",
        "timestamp": 1611305796307,
        "duration": 1516
    },
    {
        "description": "Withdrawal verification in Transactions for Albus Dumbledore|Customer Login Withdrawal",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_SuccessfulAlbus Dumbledore.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_SuccessfulAlbus Dumbledore.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "003e003b-0020-0075-00fc-0041005400bc.png",
        "timestamp": 1611305798229,
        "duration": 3848
    },
    {
        "description": "Failed to withdraw, verify message for Albus Dumbledore|Customer Login Withdrawal",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_VerifiedAlbus Dumbledore.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Withdrawal_VerifiedAlbus Dumbledore.png'"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "http://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1611305803405,
                "type": ""
            }
        ],
        "screenShotFile": "00e10044-0037-0093-00ba-00c800b50073.png",
        "timestamp": 1611305802462,
        "duration": 1282
    },
    {
        "description": "Manager Login|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b0085-00aa-0020-000a-00c300b500f8.png",
        "timestamp": 1611305804051,
        "duration": 858
    },
    {
        "description": "Go to Add Customer Page|Bank-Manager Login Add Customer",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Manager_Login.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Manager_Login.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00080041-00db-0003-002d-0058000f009d.png",
        "timestamp": 1611305805198,
        "duration": 911
    },
    {
        "description": "Add Customer, verify successful addition in alert|Bank-Manager Login Add Customer",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Adding_Customer.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\Adding_Customer.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00d60027-00de-00e1-00d6-002a000700dc.png",
        "timestamp": 1611305806427,
        "duration": 300
    },
    {
        "description": "Verify Customer Login present for New Customer|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e0025-0092-00e3-0029-008b00990081.png",
        "timestamp": 1611305807052,
        "duration": 162
    },
    {
        "description": "Verify Account not created for New Customer|Bank-Manager Login Add Customer",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\New_Customer_With_No_Account.png'"
        ],
        "trace": [
            "Error: ENOENT: no such file or directory, open 'C:\\Users\\PRAGYA\\js-eclipse-workspace\\XYZ Bank Project\\Screenshots\\22 14 25\\New_Customer_With_No_Account.png'"
        ],
        "browserLogs": [],
        "screenShotFile": "00dd002d-00b1-0090-008a-007d00590002.png",
        "timestamp": 1611305807515,
        "duration": 594
    },
    {
        "description": "Add duplicate Customer, verify duplicate customer in alert|Bank-Manager Login Add Customer",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e9c57b6882e30b6217648e30ef0a1450",
        "instanceId": 26244,
        "browser": {
            "name": "chrome",
            "version": "88.0.4324.96"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d50052-0056-0035-006e-001a00c0006b.png",
        "timestamp": 1611305808410,
        "duration": 1236
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
