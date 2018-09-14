# Tiny WebSocket #
This library is intend to wrap the [WebSocket](https://github.com/theturtle32/WebSocket-Node) library with a more flexible and more extendable interface.

## Install ##
Just type the following command to install the package
```bash
npm install tiny-websock
```

## Example ##
```javascript
const {WebSocketServer} = require( 'tiney-websock' );
const server = new WebSocketServer();   // Create a server instance
server.acceptOrigin( '*' );             // Accept request from anywhere

// Process messages and events under protocols
const protocol = server.protocol( 'accepted_protocol' );
protocol.on( 'message', (conn, msg)=>{
    console.log( "Received msg from connection under protocol 'accepted_protocol'" );
})
.on( 'say_hello', (e, name)=>{
    console.log( 'Receved `say_hello` event from connection.' );
});


// Intercept all protocols' events
server.on( 'message', (conn, msg)=>{
    console.log( "Some protocol received message from connection" );
})
.on( 'say_hello', (e, name)=>{
    console.log( 'Some protocol received `say_hello` event from connection' );
});
```