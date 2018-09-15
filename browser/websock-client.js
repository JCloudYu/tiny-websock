/**
 * Author: JCloudYu
 * Create: 2018/09/15
 **/
((exports)=>{
	"use strict";
	
	// region [ Declare ]
	const {EventEmitter} = (a=>{"use strict";function b(a,b,c){if("function"!=typeof c)throw new TypeError("Given listener should be a function");const d=function(...e){const{_event_queue:g,_handle_promise:h}=f.get(this),i=b.toString(),j=g[i]=g[i]||[];let k=j.indexOf(d);return h?Promise.resolve(c.call(a,...e)).then(()=>{0<=k&&j.splice(k,1)}):(c.call(a,...e),void(0<=k&&j.splice(k,1)))};return d}async function c(a,b,c){if(Array.isArray(b))for(let d of b)await d.call(a,...c)}function d(a,b,c){if(Array.isArray(b))for(let d of b)d.call(a,...c)}const e=a.EventEmitter,f=new WeakMap;class g{constructor(){const a={};f.set(this,a),a._event_queue=[],a._handle_promise=!1}emit(a,...b){const{_event_queue:e,_handle_promise:g}=f.get(this),h=a.toString();return(g?c:d)(this,e[h],b)}addListener(a,b){if("function"!=typeof b)throw new TypeError("Given listener should be a function");const{_event_queue:c}=f.get(this),d=a.toString(),e=c[d]=c[d]||[];return e.push(b),this}on(a,b){return this.addListener(a,b)}removeAllListeners(a){const b=f.get(this),c=a.toString();return delete b._event_queue[c],this}removeListener(a,b){const{_event_queue:c}=f.get(this),d=a.toString(),e=c[d];if(e)for(let a;0<=(a=e.indexOf(b));)e.splice(a,1);return this}off(a,b){return 1===arguments.length?this.removeAllListeners(a):this.removeListener(a,b)}once(a,c){return this.addListener(a,b(this,a,c))}listeners(a){const{_event_queue:b}=f.get(this),c=a.toString();return(b[c]||[]).slice(0)}listenerCount(a){const{_event_queue:b}=f.get(this),c=a.toString();return(b[c]||[]).length}get events(){const{_event_queue:a}=f.get(this),b=[];for(let c in a)a.hasOwnProperty(c)&&(0===a[c].length||b.push(c));return b}set events(a){throw new TypeError("Cannot assign to read only property 'events' of <EventEmitter>")}get handlePromise(){const{_handle_promise:a}=f.get(this);return a}set handlePromise(a){const b=f.get(this);b._handle_promise=!!a}static noConflic(){return e&&(a.EventEmitter=e),a.EventEmitter}}return a.EventEmitter=g,a})({});
	// endregion
	
	
	const _previous = exports.WebSocketClient;
	
	
	const INTERNAL_EVENT_TYPE = {
		CUSTOM_EVENT: '------ws-cust-evt'
	};
	const WEBSOCKET_READY_STATE = {
		NOT_INSTANTIATED:-1, CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3
	};
	
	const _WebSocketClient = new WeakMap();
	class WebSocketClient extends EventEmitter {
		constructor() {
			super();
			
			const PRIVATES = {
				connection:null
			};
			_WebSocketClient.set(this, PRIVATES);
			
			Object.defineProperty( this, '_emit', {value:this.emit} );
			this.emit = __HANDLE_EMIT;
		}
		connect(URI, protocol=[]) {
			const PRIVATES = _WebSocketClient.get(this);
			const connection = PRIVATES.connection = new WebSocket( URI, protocol );
			connection.onopen	 =__HANDLE_OPEN.bind(this, connection);
			connection.onmessage =__HANDLE_MESSAGE.bind(this, connection);
			connection.onclose	 =__HANDLE_CLOSE.bind(this, connection);
			connection.onerror	 =__HANDLE_ERROR.bind(this, connection);
			return this;
		}
		send(data) {
			const {connection} = _WebSocketClient.get(this);
			if ( connection && connection.readyState === WEBSOCKET_READY_STATE.OPEN ) {
				connection.send(data);
			}
			
			return this;
		}
		close(code=1005, reason='') {
			const {connection} = _WebSocketClient.get(this);
			if ( connection && connection.readyState < WEBSOCKET_READY_STATE.CLOSING ) {
				connection.close(code, reason);
			}
			
			return this;
		}
		get url() {
			const {connection} = _WebSocketClient.get(this);
			return connection ? connection.url : null;
		}
		get state() {
			const {connection} = _WebSocketClient.get(this);
			return connection ? connection.readyState : WEBSOCKET_READY_STATE.NOT_INSTANTIATED;
		}
		get protocol() {
			const {connection} = _WebSocketClient.get(this);
			return connection ? connection.protocol : null;
		}
		get extensions() {
			const {connection} = _WebSocketClient.get(this);
			return connection ? connection.extensions : null;
		}
		static noConflict() {
			if ( _previous ) {
				exports.WebSocketClient = _previous;
			}
			return exports.WebSocketClient;
		}
	}
	
	exports.WebSocketClient = WebSocketClient;
	return exports;
	
	
	
	
	
	function __HANDLE_OPEN(connection, event) {
		this._emit('open', {type:'open', sender:this});
	}
	function __HANDLE_MESSAGE(connection, event) {
		let {data} = event;
		if ( typeof data === "string" ) {
			try {
				let content = JSON.parse(data);
				if ( content.type === INTERNAL_EVENT_TYPE.CUSTOM_EVENT ) {
					let {event, eventArgs} = content;
					this._emit( event, {type:event, sender:this}, ...eventArgs );
					return;
				}
			}
			catch(e) {}
		}
	
		this._emit( 'raw-message', {type:'raw-message', sender:this}, data);
	}
	function __HANDLE_CLOSE(connection, event) {
		this._emit('close', {type:'close', sender:this});
	}
	function __HANDLE_ERROR(connection, event) {
		this._emit('error', {type:'error', sender:this});
	}
	function __HANDLE_EMIT(event, ...eventArgs){
		const {connection} = _WebSocketClient.get(this);
		this._emit(event, ...eventArgs);
		
		if ( connection && connection.readyState === WEBSOCKET_READY_STATE.OPEN ) {
			connection.send(JSON.stringify({
				type: INTERNAL_EVENT_TYPE.CUSTOM_EVENT,
				event, eventArgs
			}));
		}
	}
})(window?window:(module?module.exports:{}));
