var wifi = require('Wifi');
var esp8266 = require('ESP8266');

var ssid = "sanovNet2";
var password = "odvolatvpripade";

var config = {
    "serverEndpoint": "api.horske.info",
    "serverPort": "80",
    "auth": "c3VzbGlrOmJ1Ym8=",
    "startProgramTimeout": 30000, //!!!TOTO NEDAVAJ MENSIE AKO 15000, POTOM BY SI NESTIHOL FLASHNUT KOLI SPANKU!!!
    "sleepTime": 390000,
    "location": "Espruino meteo station",
    "locationId": "espruino_005",
    "elevation": "394",
    "hw": {
        "dht22": true, /*temperature sensor base on dht 22*/
        "dht11": false, /*temperature sensor base on dht 11*/
        "bmp085": false, /*pressure sensor*/
        "bh1750": false, /*light sensor*/
        "ds18b20": true, /*"temperature sensor base on ds18b20"*/
    }
};

var logger = {
    debug: console.log,
    error: console.error
};

var dht22 = require("http://www.espruino.com/modules/DHT22.js").connect(NodeMCU.D1);


var _readDHT22 = function () {
    return new Promise(function (resolve, reject) {
        if (!config.hw.dht22) {
            reject();
        }
        else {
            dht22.read(function (a) {
                var data = {
                    temperature: a.temp,
                    humidity: a.rh
                };
                resolve(data);
            });
        }
    });
};


var _readBmp085 = function () {
    return new Promise(function (resolve, reject) {
        if (!config.hw.bmp085) {
            reject();
        }
        else {
            //to impl
        }
    });
};

var _readLight = function () {
    return new Promise(function (resolve, reject) {
        if (!config.hw.bh1750) {
            reject();
        }
        else {
            //to impl
        }
    });
};

var _readDs18b20 = function () {
    return new Promise(function (resolve, reject) {
        if (!Boolean(config.hw.ds18b20)) {
            reject();
        }
        else {
            // cannot init without connected sensor.
            var ds18b20 = require("http://www.espruino.com/modules/DS18B20.js").connect(new OneWire(NodeMCU.D4));
            ds18b20.getTemp(function (temp) {
                resolve(temp);
            });
        }
    });
};


var _getPressureRSL = function (pressure, temperature, elevation) {
    if (_isUndefined(pressure) || _isUndefined(temperature) || _isUndefined(elevation)) {
        return;
    }
    return Number(pressure) / Math.exp(-Number(elevation) / (29.271795 * (273.15 + Number(temperature))));
};

function _isUndefined(value) {
    // Obtain `undefined` value that's
    // guaranteed to not have been re-assigned
    var undefined = void(0);
    return value === undefined;
}

var _logWifiInfo = function () {
    var IPobject = wifi.getIP();

    logger.debug('IP: ', IPobject.ip);
    logger.debug('MAC: ', IPobject.mac);
};

var _measure = function () {
    var result = {
        temperature: [],
        pressure: undefined,
        light: undefined,
        humidity: undefined,
        location: config.location,
        locationId: config.locationId
    };
    return _readBmp085()
        .then(function (data) {
            var rsl = _getPressureRSL(data.pressure, data.temperature, config.elevation);
            result.pressure = !_isUndefined(rsl) ? rsl : data.pressure;
            result.temperature.push({'key': 't1', value: Number(data.temperature)});
            return _readDs18b20();
        }, function () {
            return _readDs18b20();
        }).then(function (data) {
            result.temperature.push({'key': 't2', value: Number(data)});
            return _readLight();
        }, function () {
            return _readLight();
        }).then(function (light) {
            result.light = light;
            return _readDHT22();
        }, function () {
            return _readDHT22();
        }).then(function (dht) {
            result.temperature.push({'key': 't3', value: Number(dht.temperature)});
            result.humidity = dht.humidity;
            return new Promise(function (resolve) {
                resolve(result);
            });
        }, function () {
            return new Promise(function (resolve) {
                resolve(result);
            });
        });
};

var _scheduler = function (job) {

    var timeout;

    var startJob = function () {
        timeout = setTimeout(function () {
            logger.debug('job fired...');
            if (!_isUndefined(job)) {
                job();
            } else {
                logger.debug('job is not exist, please check configuration');
            }
            startJob();
        }, 0);
    };

    var stopJob = function () {
        if (!_isUndefined(timeout)) {
            clearTimeout(timeout);
        }
    };

    return {
        start: startJob,
        stop: stopJob
    };
};

var _upload = function (sensorData) {
    return new Promise(function (resolve, reject) {
        var content = JSON.stringify(sensorData);
        var options = {
            host: config.serverEndpoint,
            port: config.serverPort,
            path: '/api/sensors',
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Content-Length": content.length,
                "Authorization": config.auth
            }
        };
        require("http").request(options, function (res) {
            res.on('data', function (data) {
                resolve(data);
            });
            res.on('error', function (data) {
                reject(data);
            });
        }).end(content);
    });
};

var _jobTick = function () {
    _measure().then(function (data) {
        logger.debug(data);
        return _upload(data);
    }).then(function (res) {
        logger.debug(res);
        setTimeout(function () {
            //esp8266.deepSleep(config.sleepTime * 1000);
            logger.debug("sleeeeeeeeeeeeeeeeeeeeeeeep");
        }, 1000);
    });
};

var _main = function () {

    var _onWifiConnected = function () {
        _logWifiInfo();

        _scheduler(_jobTick).start();
        //after start;
        _jobTick(true);

    };

    wifi.connect(ssid, {password: password}, _onWifiConnected);
    wifi.save();

    save();

};

logger.debug("start with config: ", config);

setTimeout(_main, config.startProgramTimeout);