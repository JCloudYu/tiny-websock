/**
 * Author: JCloudYu
 * Create: 2018/09/15
**/
((exports)=>{
	"use strict";
	
	
	const _previous = exports.EventEmitter;
	
	
	
	const _EventEmitter = new WeakMap();
	class EventEmitter {
		constructor() {
			const PRIVATES = {};
			_EventEmitter.set(this, PRIVATES);
			PRIVATES._event_queue = [];
			PRIVATES._handle_promise = false;
		}
		
		/**
		 * Emit an event. Note that if handlePromise property is set to true, this function will return a promise or undefined otherwise.
		 *
		 * @param {string} eventName The name of event to be emitted
		 * @param {...*} args The arguments that are passed to the listeners
		 * @returns {undefined|Promise}
		**/
		emit(eventName, ...args) {
			const {_event_queue, _handle_promise} = _EventEmitter.get(this);
			const name = eventName.toString();
			return (_handle_promise?__EMIT_PROMISE:__EMIT)(this, _event_queue[name], args);
		}
		
		/**
		 * Add a listener to a specific event
		 *
 		 * @param {string} eventName The event the listener will listen to
		 * @param {function} listener The listener
		 * @returns {EventEmitter} Return the emitter instance for chaining
		**/
		addListener(eventName, listener) {
			if ( typeof listener !== "function" ) {
				throw new TypeError( "Given listener should be a function" );
			}
		
			const {_event_queue} = _EventEmitter.get(this);
			const name = eventName.toString();
			const queue = _event_queue[name] = _event_queue[name]||[];
			queue.push(listener);
			
			return this;
		}
		
		/**
		 * Add a listener to a specific event
		 *
 		 * @param {string} eventName The event the listener will listen to
		 * @param {function} listener The listener to be added
		 * @returns {EventEmitter} Return the emitter instance for chaining
		**/
		on(eventName, listener) {
			return this.addListener(eventName, listener);
		}
		
		/**
		 * Remove all the specific event's listeners.
		 *
		 * @param {string} eventName The event to remove
		 * @returns {EventEmitter}
		**/
		removeAllListeners(eventName) {
			const PRIVATES = _EventEmitter.get(this);
			const name = eventName.toString();
			delete PRIVATES._event_queue[name];
			
			return this;
		}
		
		/**
		 * Remove a listener from a specific event
		 *
		 * @param {string} eventName The event where the listener locates
		 * @param {function} listener The target listener to be removed
		 * @returns {EventEmitter} Return the emitter instance for chaining
		**/
		removeListener(eventName, listener) {
			const {_event_queue} = _EventEmitter.get(this);
			const name = eventName.toString();
			const queue = _event_queue[name];
			if ( queue ) {
				let index;
				while( (index = queue.indexOf(listener)) >= 0 ) {
					queue.splice(index, 1);
				}
			}
			
			return this;
		}
		
		/**
		 * Remove a listener from a specific event
		 *
		 * @param {string} eventName The event where the listener locates
		 * @param {function} listener The target listener to be removed
		 * @returns {EventEmitter} Return the emitter instance for chaining
		**/
		off(eventName, listener) {
			if ( arguments.length === 1 ) {
				return this.removeAllListeners(eventName);
			}
		
			return this.removeListener(eventName, listener);
		}
		
		/**
		 * Add a listener that will be invoked only once to a specific event.
		 * Please note that the listener registered with once cannot be removed by off, removeListener or removeAllListeners.
		 *
 		 * @param {string} eventName The event the listener will listen to
		 * @param {function} listener The listener to be added
		 * @returns {EventEmitter} Return the emitter instance for chaining
		**/
		once(eventName, listener) {
			return this.addListener(eventName, __ONCE_WRAPPER(this, eventName, listener));
		}
		
		/**
		 * Retrieve a copy of specific event's listener queue
		 *
		 * @param {string} eventName The specific event name
		 * @returns {function[]} The listener queue
		**/
		listeners(eventName) {
			const {_event_queue} = _EventEmitter.get(this);
			const name = eventName.toString();
			return (_event_queue[name]||[]).slice(0);
		}
		
		/**
		 * Retrieve the listener number of specific event
		 *
		 * @param {string} eventName The specific event name
		 * @returns {number} The amount of listeners
		**/
		listenerCount(eventName) {
			const {_event_queue} = _EventEmitter.get(this);
			const name = eventName.toString();
			return (_event_queue[name]||[]).length;
		}
		
		/**
		 * Retrieve the registered event names
		 *
		 * @property-read {string[]} events
		**/
		get events() {
			const {_event_queue} = _EventEmitter.get(this);
			const _events = [];
			for( let name in _event_queue ) {
				if ( !_event_queue.hasOwnProperty(name) )  continue;
				if ( _event_queue[name].length === 0 ) continue;
				_events.push(name);
			}
			return _events;
		}
		set events(val) { throw new TypeError("Cannot assign to read only property 'events' of <EventEmitter>"); }
		
		/**
		 * @property {boolean} handlePromise
		**/
		get handlePromise() {
			const {_handle_promise} = _EventEmitter.get(this);
			return _handle_promise;
		}
		set handlePromise(value) {
			const PRIVATES = _EventEmitter.get(this);
			PRIVATES._handle_promise = !!value;
		}
		
		/**
		 * Revert to the previous version if any...
		 *
		 * @returns {EventEmitter}
		**/
		static noConflic() {
			if ( _previous ) {
				exports.EventEmitter = _previous;
			}
			
			return exports.EventEmitter;
		}
	}
	
	
	
	exports.EventEmitter = EventEmitter;
	return exports;
	
	
	
	function __ONCE_WRAPPER(emitter, eventName, listener) {
		if ( typeof listener !== "function" ) {
			throw new TypeError( "Given listener should be a function" );
		}
	
		const once = function(...args) {
			const {_event_queue, _handle_promise} = _EventEmitter.get(this);
			const name = eventName.toString();
			const queue = _event_queue[name] = _event_queue[name]||[];
			
			let index = queue.indexOf(once);
			if ( !_handle_promise ) {
				listener.call(emitter, ...args);
				
				if ( index >= 0 ) {
					queue.splice(index, 1);
				}
				
				return;
			}
			
			return Promise.resolve(listener.call(emitter, ...args))
			.then(()=>{
				if ( index >= 0 ) {
					queue.splice(index, 1);
				}
			});
		};
		return once;
	}
	async function __EMIT_PROMISE(emitter, queue, args) {
		if ( Array.isArray(queue) ) {
			for( let func of queue ) {
				await func.call(emitter, ...args);
			}
		}
	}
	function __EMIT(emitter, queue, args) {
		if ( Array.isArray(queue) ) {
			for( let func of queue ) {
				func.call(emitter, ...args);
			}
		}
	}
})(module.exports);
