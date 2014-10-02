// Constants from nodejs-websocket/Connection.js
Connector.prototype.WS_CONNECTING = 0;
Connector.prototype.WS_OPEN = 1;
Connector.prototype.WS_CLOSING = 2;
Connector.prototype.WS_CLOSED = 3;

var wifi = null;
var ws = require("nodejs-websocket");

function Connector() {
  this.wsConnecting = false;
  this.wsConnectionStarted = -1;
  this.wifiBusySince = -1;
  this.wsConnectionAttempts = 0;
}

Connector.prototype.init = function(settings) {
  var me = this;
  if (settings == null) settings = {};  
  if (!settings.keepAliveRateMs) settings.keepAliveRateMs = 5000;
  if (!settings.connectTimeoutMs) settings.connectTimeoutMs = 10000;
  if (!settings.radioBusyTimeoutMs) settings.radioBusyTimeoutMs = 30000;
  me.settings = settings;
  if (settings) {
    wifi = require('wifi-cc3000');
    me.initWifi();
    me.tryWifiConnect();
  } else {
    // Assume network access
    console.log("connectWs");
    me.connectWs();
  }

  setInterval(function() { me.keepAlive(); }, settings.keepAliveRateMs);

}


Connector.prototype.sendEvent = function(name, data) {
  console.log("WS: sendEvent " + name + " - " + JSON.stringify(data));
    this.connection.sendText(JSON.stringify(
        [name, data]
    ));
}

Connector.prototype.sayToRoom = function(data) {
    data.room = roomId;
    this.sendEvent("say", data);
}


Connector.prototype.connectWs = function() {
  var me = this;
  if (me.wsConnecting) {
    console.log("WS: Connection in progress");
    return;
  }

  if (me.connection !== null) {
    var s = me.connection.readyState;
    console.log("Connect state: " + s);
    if (typeof(me.connection.readyState) !== 'undefined') {
      if (s == Connector.WS_CONNECTING) {
          console.log("WS: Still connecting");
          return;
      } else if (s == Connector.WS_OPEN) {
          console.log("WS: Open");
          return;
      } else if (s == Connector.WS_CLOSING) {
          console.log("WS: Closing");
          return;
      }
    }
  }
  me.wsConnecting = true;
  me.wsConnectionStarted = Date.now();

  console.log('WS: Connecting to ' + me.settings.url);
  me.wsConnectionAttempts++;
  me.connection = ws.connect(me.settings.url, 
      function() {
          console.log('WS: ...connected!');
          me.wsConnecting = false;
          me.wsConnectionAttempts = 0;
      }
  );

  
  me.connection.on("error", function (err) {
    console.log("WS: Error: " + err);
    me.connection.close();
    me.wsConnecting = false;

  });

  me.connection.on("text", function(text) {
    //console.log("WS: Text: " + text);
    var o = JSON.parse(text);
    var eventName = o[0];
    var eventPayload = o[1];
    if (me.settings.onEvent) {
      me.settings.onEvent(eventName, eventPayload);
    }
  });
  me.connection.on("close", function(code, reason) {
    console.log("WS: Close: " + code + " - " + reason);
    me.wsConnecting = false;
  });

}

Connector.prototype.initWifi = function() {
  var me = this;
  wifi.on('connect', function(err, data){
    // you're connected
    //console.log("Wifi connect", err, data);
    if (!data.connected) return;
    console.log("Wifi: Tessel connected. Ip: " + data.ip + " Ssid: " + data.ssid);
    me.connectWs();
  });

  wifi.on('disconnect', function(err, data){
    // wifi dropped, probably want to call connect() again
    console.log("Wifi disconnect", err, data);
    me.wsConnecting = true;

  })

  wifi.on('timeout', function(err){
    // tried to connect but couldn't, retry
    console.log("Wifi timeout"); 
    connect();
  });

  wifi.on('error', function(err){
    // one of the following happened
    // 1. tried to disconnect while not connected
    // 2. tried to disconnect while in the middle of trying to connect
    // 3. tried to initialize a connection without first waiting for a timeout or a disconnect
    console.log("Wifi error", err);
  });
}


Connector.prototype.keepAlive = function() {
  var me = this;
  var state = null;
  if (me.connection && typeof(me.connection.readyState) !== 'undefined') {
    state = me.connection.readyState;
  }
  
  // Quick health check:
  if (wifi.isConnected() && state == 1) return;

  console.log("keepAlive. Wifi busy: " + wifi.isBusy() + 
    " connected: " + wifi.isConnected() + 
    " Ws: " + state +
    " WsConnecting: " + me.wsConnecting);

  if (!me.wsConnecting  && state == null && wifi.isConnected()) {
    me.connectWs();
  } else if (me.wsConnecting) {
    if (me.wsConnectionStarted < Date.now() - me.settings.connectTimeoutMs) {
      // Taking longer than expected to connect to Kattegat
      console.log("keepAlive: Giving up on connection attempt after " +  me.settings.connectTimeoutMs + "ms");
      me.connection.close();
      if (me.wsConnectionAttempts > 5) {
        console.log("keepAlive: Giving up connecting after " + me.wsConnectionAttempts + " attempts");
        me.nuclearOption();
      }
    }
  }
}

Connector.prototype.nuclearOption = function() {
  var me = this;
  me.wsConnectionAttempts = 0;
  me.wifiBusySince = -1;
  wifi.reset();
  me.initWifi();     
}

Connector.prototype.tryWifiConnect = function() {
  console.log("Wifi: attempting connection");
  var me = this;
  if (!wifi.isBusy()) {
    me.wifiBusySince = -1;
    wifi.connect(me.settings);
  } else {
    if (me.wifiBusySince == -1) me.wifiBusySince = Date.now();

    // For the first few seconds of program bootup, you'll always 
    // see the wifi chip as being "busy"
    var elapsed = Date.now()-me.wifiBusySince;
    console.log("Wifi: Chip is busy, trying again (" + elapsed+ ")");
    setTimeout(function(){
      if (elapsed > me.settings.radioBusyTimeoutMs) {
        console.log("Wifi: Resetting radio after timeout " + me.settings.radioBusyTimeoutMs + "ms");
        me.nuclearOption();
        return;
      }
      me.tryWifiConnect();
    }, 5000);
  } 
}
module.exports = new Connector();
