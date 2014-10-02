We had trouble interacting with Kattegat with the Tessel using Socket.io.

This bridge daemon accepts connections via nodejs-websocket, which connects over plain TCP rather than HTTP, and seems much more reliable. Quite hacky.