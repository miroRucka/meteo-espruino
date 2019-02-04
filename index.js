var wifi = require('Wifi');
var esp8266 = require('ESP8266');

var ssid = "sanovNet2";
var password = "odvolatvpripade";

var config = {
    "serverEndpoint": "api2.horske.info",
    "serverPort": "80",
    "auth": "Basic c3VzbGlrOlN1c2xpazEyMw==",
    "startProgramTimeout": 90000, //!!!TOTO NEDAVAJ MENSIE AKO 15000, POTOM BY SI NESTIHOL FLASHNUT KOLI SPANKU!!!
    "sleepTime": 420000,
    "location": "Espruino meteo station",
    "locationId": "espruino_005",
    "elevation": "394",
    "hw": {
        "dht22": true, /*temperature sensor base on dht 22*/
        "dht11": false, /*temperature sensor base on dht 11*/
        "bmp085": true, /*pressure sensor*/
        "bh1750": true, /*light sensor*/
        "ds18b20": true, /*"temperature sensor base on ds18b20"*/
    }
};

var logger = {
    debug: console.log,
    error: console.error
};

var dht22 = require("http://www.espruino.com/modules/DHT22.js").connect(NodeMCU.D1);

I2C1.setup({scl: NodeMCU.D2, sda: NodeMCU.D3});
var bmp = require("BMP085").connect(I2C1);

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
            var bmp = require("BMP085").connect(I2C1);
            bmp.getPressure(function (d) {
                resolve(d);
            });
        }
    });
};

var _readLight = function () {
    return new Promise(function (resolve, reject) {
        if (!config.hw.bh1750) {
            reject();
        }
        else {
            var bh = require("BH1750").connect(I2C1);
            bh.start(1,0);
            resolve(bh.read());
            resolve();
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
    var number = Number(pressure) / Math.exp(-Number(elevation) / (29.271795 * (273.15 + Number(temperature))));
    return Number(number)/100;
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
        locationId: config.locationId,
        timestamp: (new Date()).getTime()
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

var _upload = function (sensorData) {
    return new Promise(function (resolve, reject) {
        var content = JSON.stringify(sensorData);
        var options = {
            host: config.serverEndpoint,
            port: config.serverPort,
            path: '/meteo-data',
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Content-Length": content.length,
                "Authorization": config.auth
            }
        };
        require("http").request(options, function (res) {
            resolve("done");
        }).end(content);
    });
};

var _jobTick = function () {
    _measure().then(function (data) {
        logger.debug(data);
        return _upload(data);
    }).then(function (res) {
        logger.debug(res);
        esp8266.deepSleep(config.sleepTime * 1000);
        setTimeout(_jobTick,500);
    });
};

var _main = function () {

    var _onWifiConnected = function () {
        _logWifiInfo();
        _jobTick();
    };

    wifi.connect(ssid, {password: password}, _onWifiConnected);
    wifi.save();
};

logger.debug("start with config: ", config);

setTimeout(_main, config.startProgramTimeout);

save();