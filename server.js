/**
 * Author: JCloudYu
 * Create: 2018/09/15
**/
(()=>{
	"use strict";
	
	
	const {EventEmitter} = require( './lib/evt-emitter' );
	const http = require( 'http' );
	const {server:WebSockServer, connection:WebSockConnection} = require( 'websocket' );
	
	const INTERNAL_EVENT_TYPE = {
		CUSTOM_EVENT: '------ws-cust-evt'
	};
	
	// region [ Extend WebSocketConnection's default behavior ]
	WebSockConnection.prototype.sendEvent = function(event, ...eventArgs) {
		this.sendUTF(JSON.stringify({
			type:INTERNAL_EVENT_TYPE.CUSTOM_EVENT,
			event, eventArgs
		}));
	};
	// endregion
	
	
	
	const WEAK_RELATION_MAP	= new WeakMap();
	class WebSocketServer {
		constructor(httpServer=null) {
			const HTTP_SERVER = httpServer||http.createServer((req,res)=>{res.writeHead(400); res.end();});
			const WS_SERVER = new WebSockServer({ httpServer:HTTP_SERVER });
			const PRIVATES = {
				_httpServer:HTTP_SERVER,
				_webSockServer:WS_SERVER,
				_accepted_origin:[],
				_accepted_protocols:[],
				_support_channels:{},
				_support_channel_list:[]
			};
			WEAK_RELATION_MAP.set(this, PRIVATES);
			
			
			
			
			WS_SERVER.on('request', __HANDLE_SERVER_REQUEST.bind(WS_SERVER, this));
		}
		acceptOrigin(origin='*') {
			const {_accepted_origin:ACCEPTED_ORIGIN} = WEAK_RELATION_MAP.get(this);
			if ( !Array.isArray(origin) ) {
				origin = [origin];
			}
			
			for ( let _origin of origin ) {
				if ( ACCEPTED_ORIGIN.indexOf(_origin) >= 0 ) continue;
				ACCEPTED_ORIGIN.push(_origin);
			}
			
			return this;
		}
		acceptProtocol(protocol) {
			const {_accepted_protocols:ACCEPTED_PROTOCOLS} = WEAK_RELATION_MAP.get(this);
			if ( !Array.isArray(protocol) ) {
				protocol = [protocol];
			}
			
			for ( let _proto of protocol ) {
				if ( ACCEPTED_PROTOCOLS.indexOf(_proto) >= 0 ) continue;
				ACCEPTED_PROTOCOLS.push(_proto);
			}
			
			return this;
		}
		channel(channel_name) {
			const {
				_support_channels:SUPPORT_CHANNELS,
				_support_channel_list:SUPPORT_CHANNEL_LIST
			} = WEAK_RELATION_MAP.get(this);
			
			let channel = SUPPORT_CHANNELS[channel_name];
			if ( !channel || SUPPORT_CHANNEL_LIST.indexOf(channel_name) < 0 ) {
				SUPPORT_CHANNEL_LIST.push(channel_name);
				channel = SUPPORT_CHANNELS[channel_name] = new EventEmitter();
				WEAK_RELATION_MAP.set(channel, {
					connections: []
				});
				
				Object.defineProperty(channel, '_emit', {value:channel.emit});
				channel.emit = __HANDLE_CHANNEL_EMIT;
			}
			
			return channel;
		}
		async listen(port, host) {
			const {_httpServer:HTTP_SERVER} = WEAK_RELATION_MAP.get(this);
			return new Promise((resolve)=>{
				HTTP_SERVER.listen(port||80, host||'localhost', resolve);
			});
		}
	}
	
	module.exports = WebSocketServer;
	
	
	
	function __HANDLE_CHANNEL_EMIT(event, ...eventArgs) {
		const REL = WEAK_RELATION_MAP.get(this);
		this._emit(event, ...eventArgs);
		
		for( let conn of REL.connections ) {
			conn.sendEvent(event, ...eventArgs);
		}
	}
	function __HANDLE_SERVER_REQUEST(relatedServer, request) {
		const {
			_accepted_origin:ACCEPTED_ORIGIN,
			_accepted_protocols:ACCEPTED_PROTOCOLS,
			_support_channels:SUPPORT_CHANNELS,
			_support_channel_list:SUPPORT_CHANNEL_LIST
		} = WEAK_RELATION_MAP.get(relatedServer);
	
		if ( ACCEPTED_ORIGIN.indexOf( '*' ) < 0 && ACCEPTED_ORIGIN.indexOf(request.origin) < 0 ) {
			request.reject( 403, "Requested origin is not allowed to access this endpoint!" );
			return;
		}
		
		
		let URLInfo = require('url').parse(request.httpRequest.url, true);
		const requested_channels = __PARSE_CHANNEL_REQUEST(URLInfo.query._channel);
		if ( !__IN_AND(requested_channels, SUPPORT_CHANNEL_LIST) ) {
			request.reject( 400, "One of the requested channels is not support!" );
			return;
		}
		
		let found_protocol = __IN_OR(request.requestedProtocols, ACCEPTED_PROTOCOLS);
		if ( !found_protocol ) {
			request.reject( 400, "Requested protocols are not support!" );
			return;
		}
		
		const use_protocol = request.requestedProtocols[found_protocol.src];
		const connection = request.accept(use_protocol, request.origin);
		Object.defineProperty(connection, 'protocol', {value:use_protocol, enumerable:true});
		
		const conn_rel = { channels:[] };
		WEAK_RELATION_MAP.set(connection, conn_rel);
		
		
		
		for ( let channelId of requested_channels ) {
			const channel = SUPPORT_CHANNELS[channelId];
			const channelRel = WEAK_RELATION_MAP.get(channel);
			channelRel.connections.push(connection);
			conn_rel.channels.push(channel);
			channel._emit( 'open', {type:'open', sender:connection} );
		}
		
		
		
		
		connection.on( 'message', __HANDLE_CONNECTION_MESSAGE );
		connection.on( 'close', __HANDLE_CONNECTION_CLOSE );
	}
	function __HANDLE_CONNECTION_MESSAGE(msg) {
		const conn_relation = WEAK_RELATION_MAP.get(this);
		if ( msg.type === 'utf8' ) {
			try {
				let content = JSON.parse(msg.utf8Data);
				if ( content.type === INTERNAL_EVENT_TYPE.CUSTOM_EVENT ) {
					let { event, eventArgs } = content;
					for( let channel of conn_relation.channels ) {
						channel._emit(event, {type:event, sender:this}, ...eventArgs);
					}
					return;
				}
			}
			catch(e) {}
		}
		
		for( let channel of conn_relation.channels ) {
			channel._emit( 'raw-message', {type:'raw-message', sender:this}, msg);
		}
	}
	function __HANDLE_CONNECTION_CLOSE() {
		const conn_relation = WEAK_RELATION_MAP.get(this);
		for ( let channel of conn_relation.channels ) {
			const CHANNEL_REL = WEAK_RELATION_MAP.get(channel);
			let index = CHANNEL_REL.connections.indexOf(this);
			if ( index < 0 ) continue;
			
			CHANNEL_REL.connections.splice(index, 1);
		}
		
		conn_relation.channels = [];
	}
	
	function __IN_AND(source, reference) {
		if ( source.length === 0 ) return false;
	
		let all_in = true;
		for( let item of source ) {
			all_in = all_in && (reference.indexOf(item) >= 0);
		}
		return all_in;
	}
	function __IN_OR(source, reference) {
		let lock_item = null;
		source.forEach((item, idx)=>{
			if ( lock_item ) return;
			let refIdx = reference.indexOf(item);
			if ( refIdx < 0 ) return;
			
			lock_item = {src:idx, ref:refIdx};
		});
		return lock_item;
	}
	function __PARSE_CHANNEL_REQUEST(channel_info) {
		if ( typeof channel_info !== "string" ) return [];
		
		channel_info = channel_info.trim();
		if ( channel_info === '' ) return [];
		
		let channels = channel_info.split(',');
		channels.forEach((channel_name, idx)=>{channels[idx] = channel_name.trim()});
		return channels;
	}
})();
