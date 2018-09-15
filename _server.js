/**
 * Project: tiny-websock
 * File: server.js
 * Author: JCloudYu
 * Create Date: Sep. 13, 2018 
**/
(()=>{
	"use strict";
	
	const {EventEmitter}	= require( 'events' );
	const {server:WSServer} = require( 'websocket' );
	const http = require( 'http' );
	
	
	
	const _WebSocketServer = new WeakMap();
	const _Protocols = new WeakMap();
	class WebSocketServer extends EventEmitter {
		constructor(options={}, serverInst=null){
			super();
			this.setMaxListeners(0);
			
			const _http = serverInst || http.createServer();
			options.httpServer = _http;
			const ws_server = new WSServer(options);
			ws_server.internal_relation = this;
			
			
			
			ws_server
			.on( 'request', __HANDLE_REQUEST)
			.on( 'close', __HANDLE_CLOSE)
			.on( 'message', __HANDLE_MSG );
			
			
			
			const _PRIVATES = {
				http: _http, ws_server,
				sockets:{},
				accepted_origins: [],
				protocol_handlers:{}
			};
			
			Object.defineProperty(this, '_emit', {value:EventEmitter.prototype.emit.bind(this)});
			
			_WebSocketServer.set(this, _PRIVATES);
		}
		acceptOrigin(origin=null) {
			if ( arguments.length === 0 ) return;
		
			const _PRIVATES = _WebSocketServer.get(this);
			if ( !Array.isArray( origin ) ) {
				origin = [origin];
			}
			
			for( let ori of origin ) {
				if ( typeof ori !== "string" ) continue;
				
				ori = ori.toLowerCase();
				if ( _PRIVATES.accepted_origins.indexOf(ori) < 0 ) {
					_PRIVATES.accepted_origins.push(ori);
				}
			}
			
			return this;
		}
		protocol( p_name ) {
			if ( typeof p_name !== "string" ) return null;
			
			p_name = p_name.toLowerCase();
			const handlers = _WebSocketServer.get(this).protocol_handlers;
			if ( !handlers[p_name] ) {
				const emitter = handlers[p_name] = new EventEmitter();
				const _PRIVATES = { conn:[] };
				Object.defineProperty(emitter, '_emit', {value:emitter.emit});
				emitter.emit = __EMIT_FOR_PROTOCOLS;
				_Protocols.set(emitter, _PRIVATES);
				emitter.setMaxListeners(0);
			}
			return handlers[p_name];
		}
		emit(event, ...args) {
			const _PRIVATE = _WebSocketServer.get(this);
			const handlers = _PRIVATE.protocol_handlers;

			this._emit(event, ...args);
			for ( let protocol in handlers ) {
				if ( !handlers.hasOwnProperty(protocol) ) continue;
				handlers[protocol].emit(event, ...args);
			}
		}
		async listen(...args) {
			let _arguments = [];
			for( let arg of args ) {
				if ( typeof arg === "function" ) break;
				_arguments.push(arg);
			}
		
			return new Promise((resolve)=>{
				_WebSocketServer.get(this).http.listen(..._arguments, resolve);
			});
		}
		async close() {
			const _PRIVATE = _WebSocketServer.get(this);
			_PRIVATE.ws_server.shutDown();
			return new Promise((resolve)=>{
				_PRIVATE.http.close(resolve);
			});
		}
	}
	
	module.exports = WebSocketServer;
	
	
	
	
	
	
	// region [ Centralize all ws-server's handlers here... ]
	const _ConnectionRelation = new WeakMap();
	function __HANDLE_REQUEST(request) {
		const _PRIVATES		= _WebSocketServer.get(this.internal_relation);
		const origin_map	= _PRIVATES.accepted_origins;
		const protocol_map	= _PRIVATES.protocol_handlers;
		
		
		
		// region [ Check origin ]
		if ( origin_map.indexOf( '*' ) < 0 && origin_map.indexOf(request.origin) < 0 ) {
			request.reject(403, "The origin is not accepted!");
			return;
		}
		// endregion
		
		// region [ Check protocols ]
		if ( !Array.isArray(request.requestedProtocols) ) {
			request.reject(400, "The requested protocols are not supported!");
			return;
		}
		
		let selected_protocol = null, related_handler = null;
		for ( let protocol of request.requestedProtocols ) {
			protocol = protocol.toLowerCase();
			if ( protocol_map[protocol] ) {
				selected_protocol = protocol;
				related_handler = protocol_map[protocol];
				break;
			}
		}
		related_handler = protocol_map['basic-protocol'];
		if ( !related_handler ) {
			request.reject(400, "The requested protocols are not supported!");
			return;
		}
		// endregion
		
		// region [ Accept connection and overwrite 'removeAllListeners' api ]
		const conn = request.accept(null, request.origin);
		_ConnectionRelation.set(conn, related_handler);
		_Protocols.get(related_handler).conn.push(conn);
		Object.defineProperties(conn, {
			_removeAllListeners:{value:conn.removeAllListeners}
		});
		conn.event = __EMIT_EVENT_FOR_CONNECTION;
		conn.removeAllListeners = __UGLY_REMOVE_LISTENER_FOR_CONNECTION.bind(conn, this);
		conn.on( 'message', __BRIDGE_MESSAGE_FROM_CONNECTION_TO_WS_SERVER.bind(this, conn) );
		__HANDLE_CONNECT.call(this, conn);
		// endregion
	}
	function __HANDLE_CONNECT(conn) {
		this.internal_relation._emit( 'connect', conn );
		_ConnectionRelation.get(conn)._emit( 'connect', conn );
	}
	function __HANDLE_CLOSE(conn, code, desc) {
		this.internal_relation._emit( 'disconnect', conn, code, desc );
		const related_handler = _ConnectionRelation.get(conn);
		related_handler._emit( 'disconnect', conn, code, desc );
		
		const handler_privates = _Protocols.get(related_handler);
		let idx = handler_privates.conn.indexOf(conn);
		if ( idx >= 0 ) { handler_privates.conn.splice(idx, 1); }
	}
	function __HANDLE_MSG(conn, msg) {
		if ( msg.type === "utf8" ) {
			try {
				let msgCtnt = JSON.parse(msg.utf8Data);
				if ( Object(msgCtnt) === msgCtnt && msgCtnt.type === "------ws-cust-evt" ) {
					let event = msgCtnt.event.toString();
					let eventArgs = Array.isArray(msgCtnt.eventArgs) ? msgCtnt.eventArgs : [];
					this.internal_relation._emit( event, {type:event, sender:conn}, ...eventArgs );
					_ConnectionRelation.get(conn)._emit( event, {type:event, sender:conn}, ...eventArgs );
					return;
				}
			}catch(e) {}
		}
		
		this.internal_relation._emit( 'message', conn, msg );
		_ConnectionRelation.get(conn)._emit( 'message', conn, msg );
	}
	// endregion
	
	// region [ Helper functions ]
	function __EMIT_FOR_PROTOCOLS(event, ...args) {
		const _PRIVATES = _Protocols.get(this);
		this._emit(event, ...args);
		
		for ( let conn of _PRIVATES.conn ) {
			conn.emit(event, ...args);
			conn.event(event, ...args);
		}
	}
	function __EMIT_EVENT_FOR_CONNECTION(event, ...args) {
		this.emit(event, ...args);
		this.sendUTF(JSON.stringify({type:'------ws-cust-evt', event, eventArgs:args}));
	}
	function __UGLY_REMOVE_LISTENER_FOR_CONNECTION(ws, ...args) {
		this._removeAllListeners(...args);
		this.on( 'message', __BRIDGE_MESSAGE_FROM_CONNECTION_TO_WS_SERVER.bind(ws, this) );
	}
	function __BRIDGE_MESSAGE_FROM_CONNECTION_TO_WS_SERVER(conn, msg) {
		this.emit( 'message', conn, msg );
	}
	// endregion
})();
