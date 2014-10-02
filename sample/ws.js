var req = require('request');
var tessel = require("tessel")
var connector = require("./connector");

var settings = { 
    ssid: "--",
    password:"--",
    security: "wpa2",
    timeout: 30, //secs,
    url: "ws://192.168.1.15:8001"
  }

connector.init(settings);

var objectId = {"myAppID": true};
var roomId = "MyAppRoom";
var picCounter = 0 ;
var connection = null;


settings.onEvent = function(evt, data) {
    switch (evt) {
        case "hello":
            onHello(data);
            break;
        case "list":
            // After joining the channel, server tells.
            // us who else is in there with us. In this case
            // we don't care, so just drop it.
            break;
        case "join":
            onJoin(data);
            break;
        case "say":
            onSay(data);
            break;
        default:
            console.log("Unhandled event: " + evt);
            console.log("        payload: " + JSON.stringify(data));
    }
}

tessel.button.on('release', function(time) {
    console.log("Button press!");
    connector.sayToRoom({button: "release"});
})

function onHello(data) {
    console.log("Received hello from server. Our id is:" + data.id);
    
    console.log('Joining room:' + roomId);
    var join = { room: roomId };
    connector.sendEvent("join", join);

    getPersist();
};

function onSay(data) {
    console.log("Received:");
    console.log(data);
};

function onJoin(data) {
    console.log("...joined");
}