/**
 * Project: tiny-websock
 * File: index.js
 * Author: JCloudYu
 * Create Date: Sep. 13, 2018
**/
(()=>{
	"use strict";
	
	const WebSocketServer = require( './server' );
	module.exports = WebSocketServer.WebSocketServer = WebSocketServer;
})();
