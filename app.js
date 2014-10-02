var ws = require("nodejs-websocket");
var io = require("socket.io-client");
var ws = require("nodejs-websocket");

var bridgePort = 8001;
var kattegatUrl = "http://localhost:3000";

console.log("Starting bridge on port " + bridgePort + " to Kattegat on: " + kattegatUrl);

var onConnect = function(conn) {
	console.log("Bridge client connected");
  
  // Make connection to server
  setTimeout(function() {
    makeBridge(conn);
  }, 1000);
}

var makeBridge = function(conn) {
  var kconn = io(kattegatUrl, {multiplex:false});

  var forwardJson = function(evt, d) {
    var s = JSON.stringify(
      [evt, d]
    )
    console.log("Forwarding: " + s);
    conn.sendText(s);
  }

  // Connect and listen to events from Kattegat side
  console.log("Attempting bridge to Kattegat")
  kconn.on('connect', function() {
    console.log("...bridged connection to Kattegat");
    kconn.on('hello', function(d) { forwardJson('hello', d) });
    kconn.on('join', function(d) { forwardJson('join', d) });
    kconn.on('leave', function(d) { forwardJson('leave', d) });
    kconn.on('say', function(d) { forwardJson('say', d) });
    kconn.on('list', function(d) { forwardJson('list', d) });
    kconn.on('rooms', function(d) { forwardJson('rooms', d) });
    kconn.on('data', function(d) { forwardJson('data', d) });

    kconn.on('disconnect', function() {
      console.log("Bridge disconnected");
      conn.close();
    })
  })

  // Forward events from the client side
  conn.on("text", function (json) {
    //console.log("in: " + text);
    // var bracePos = text.indexOf("{");
    // var bracketPos = text.indexOf("[");
    // if (bracePos < 0 && bracketPos < 0) {
    //   console.log("Bridge received malformed text: " + text);
    //   return;
    // }
    // var pos = Math.min(bracketPos, bracePos);
    // var prefix = text.substr(0, pos);
    // var json = text.substr(pos, text.length-pos);
    try {    
      var o = JSON.parse(json);
      var eventName = o[0];
      var eventPayload = o[1];
      console.log("Forwarding to Kattegat: " + eventName + " - " + JSON.stringify(eventPayload));
      kconn.emit(eventName, eventPayload);
    } catch (e) {
      console.log("Bridge received malformed json: " + json);
    }
  })

  conn.on("close", function (code, reason) {
      console.log("Bridge client closed");
      kconn.close();
  })
  conn.on("error", function(e) {
  	console.log("Bridge client error: " +  e);
  })
}

var server = ws.createServer(onConnect).listen(bridgePort);
