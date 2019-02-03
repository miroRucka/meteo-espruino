var wifi = require('Wifi');

var ssid = "sanovNet2";
var password = "odvolatvpripade";

var server = "horske.info";
var options = {
    username: "suslik",
    password: "Suslik123"
};
var mqtt = require("MQTT").create(server, options);

mqtt.on('connected', function() {
    console.log("mqtt connected...");
});


var _main = function () {

    var _onWifiConnected = function () {
        console.log("connected...");
        mqtt.connect({
            host: "horske.info",
            username: "suslik",
            password: "Suslik123"
        });
    };

    wifi.connect(ssid, {password: password}, _onWifiConnected);
    wifi.save();


}();

