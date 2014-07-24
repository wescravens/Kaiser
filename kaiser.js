(function(root, factory) {

	// If AMD support, define the module
	if ( typeof define === 'function' && define.amd ) {
		define(['jquery', 'lodash' ,'exports'], function($, _, exports) {
			return factory(root, exports, _, $);
		});
	}

	// Otherwise Expose Global
	else {
		root.Kaiser = factory(root, {}, root._, (root.jQuery || root.$));
	}

})(this, function(root, kaiser, _, $) {

	var eventMatcher = /^(\S+)\s*(.*)$/,
		moduleSplitter = /\s*[\s]\s*/g;

	/**
	 * The core class that will provide an abstraction layer for storing data
	 * Instances of this class can be typed to only store a singe data type
	 * @param {object} type Type of data to be stored.  Type must be the actual constructor
	 * function for the data type (ie: Object, Array, ArrayBuffer, String, Number, etc)
	 */
	function Storage(type, modPermission) {
		var isTyped = type ? true : false;

		// the private object where data will be stored
		var storage = {};

		var length = this.length = 0;

		function set(key, value, modifyPermission) {
			if (isTyped && value.constructor !== type) {
				throw new TypeError('Cannot create ' + value.constructor.name + ' ' + key + '. ' + key + ' is not a ' + type.name + '.');
			}

			// if key already exists
			if (!!storage[key]) {
				// if modify permissions
				if (modifyPermission) {
					storage[key] = value;
				} 
				// if no modify permissions
				else {
					throw new Error(key + ' already exists.  Existing ' + type.name + ' cannot be redefined.');
				}
			} 
			// key doesn't exist
			else {
				storage[key] = value;
				length++;
			}
		}

		function get(key) {
			if (key) {
				if (storage[key]) {
					return storage[key];
				} else {
					throw new Error(key + ' does not exist.');
				}
			} else {
				return storage;
			}
		}

		// sets attributes of "storage" if they match the defined type
		this.create = function(key, value) {
			// if the first parameter is an object
			// store the key value pairs of the object
			if (typeof key === 'object') {
				_.forEach(key, function(v, k) {
					set(k, v);
				});
			} else {
				set(key, value);
			}

			return this;
		};

		// returns the value for the provided key or the whole object if no key is given
		this.find = function(name) {
			return get(name);
		};

		if (modPermission) {
			this.modify = function(key, value) {
				set(key, value, true);
				return this;
			}
		}
	};

	// assign the core class to the global namespace
	kaiser = new Storage(false);

	var exposed = ['$', 'options', 'LOG', 'Module', 'Middleware', 'Directive', 'createNamespace', 'from', 'init'];

	// define our core functions
	kaiser.create({

		$: $,

		options: function() {
			return {
				logEnabled: false
			}
		},

		LOG: function() {
			if (!kaiser.options.logEnabled) { return false; }
			if (console && console.log) {
				console.log('kaiser Log: ', arguments);
			} else if (log) {
				log('kaiser Log: ', arguments);
			}
		},

		Module: new Storage(Function, true),

		Middleware: new Storage(Function, true),

		Directive: new Storage(Function, true),

		// creates a new instance of Storage and sets the defaults
		createNamespace: function(name, type, modifyPermission) {
			type = type || false;
			modifyPermission = modifyPermission || true;
			kaiser[name] = new Storage(type, modifyPermission);
			return kaiser[name];
		},

		from: function(namespace) {
			namespace = kaiser[namespace];
			if (!namespace) {
				throw new Error(namespace + ' is not an existing namespace.');
			}
			return {
				import: function() {
					switch (arguments.length) {
						case 0: 
							return namespace.find();
							break;

						case 1:
							return namespace.find(arguments[0]);
							break;

						default:
							var rtn = {};
							_.forEach(arguments, function(arg) {
								rtn[arg] = namespace.find(arg);
							});
							return rtn;
					}
				}
			};
		},
		/**
		 * Publicly exposed start function
		 * Maps module function names to DOM nodes
		 * initializes modules
		 */
		init: function() {
			// cache the modules
			var $moduleElements = $('[module]');
			$moduleElements = $moduleElements.length ? $moduleElements : $('[data-module]');

			// if no modules exist, no need to go any further
			if ( !$moduleElements.length ) { return; }

			var moduleMap = mapModulesToElements($moduleElements);

			// Setup and initialize each of the modules referenced in the DOM
			_.forEach(moduleMap, function(module) {
				var instance = setDefaults(module.name, module.$element);
				initModule(instance);
			});
		}
	});

	_.forEach(exposed, function(name) {
		kaiser[name] = kaiser.find(name);
	});

	/**
	 * Reverses a jQuery selection to a unique selector string
	 * @param  {object} $node jQuery selection
	 * @return {string} jQuery selector string
	 */
	function createUniqueSelector($nodes) {
		var path;
		_.forEach($nodes, function(node) {
			var name = node.localName;
			var $node = $(node);
			if (!name) { return false; }
			name = name.toLowerCase();

			var parent = $node.parent();

			var sameTagSiblings = parent.children(name);
			if (sameTagSiblings.length > 1) { 
				allSiblings = parent.children();
				var index = allSiblings.index(node) + 1;
				if (index > 1) {
					name += ':nth-child(' + index + ')';
				}
			}

			path = name + (path ? '>' + path : '');
			node = parent;
		});
		return path;
	}

	/**
	 * Creates a collection of objects mapping module function names to their DOM elements
	 *
	 * @private
	 * @param  {object} elements
	 * @return {array}  Collection of module maps
	 */
	function mapModulesToElements(elements) {
		var functionMap = _.map(elements, function(element) {
			var $element = kaiser.$(element),
				moduleString = $element.attr('module') || $element.data('module'),
				funcNames = moduleString.split(moduleSplitter),
				collection = _.map(funcNames, function(funcName) {
					return { name: funcName, $element: $element };
				});

			return collection;
		});

		// remove nested arrays before returning
		return _.flatten(functionMap);
	}

	function initModule(instance) {
		var module = kaiser.Module.find(instance.name)(instance);
		if (typeof module !== 'object') {
			throw new TypeError('Object Expected: Module ' + instance.name + ' returned ' + typeof module);
		}

		module.init();
		kaiser.LOG('Initialized module: ' + instance.name);

		module.listen();

		bindDirectives(module);
	}

	/**
	 * Looks for defined directives in the module scope and calls their functions
	 * @param  {object} module Scope of the module
	 * @return {undefined} no return
	 */
	function bindDirectives(module) {
		var directives = kaiser.Directive.find();
		_.forEach(directives, function() {
			// only the second arg is needed
			var name = arguments[1];

			var $parent = module.$el.parent('[data-module-id]');

			$parent = $parent.length ? $parent : module.$el.wrap('<div data-module-id="' + module._id + '">');

			// Set $child to either the attribute name or data-attribute name
			// depending on which returns a match.
			var $child = $parent.find('[' + name + ']');
			$child = $child.length ? $child : module.$('[data-' + name + ']');
			var action = $child.attr(name) || $child.data(name);

			if ($child.length) {
				// call the directive function and pass in the module scope, element, and function name
				directives[name](module, $child, action);
			}
		});
	};

	/**
	 * Function to inject default properties
	 * @private
	 * @param  {String} func The function name to be initialized
	 * @param  {Object} elem The root DOM node of the module
	 * @return {Object} The middleware object to be passed in to the module
	 */
	function setDefaults(name, elem) {

		var defaultMiddleware = {
			_id: _.uniqueId('module-'),

			name: name,

			$el: elem,

			$: function(child) {
				return this.$el.find(child);
			},

			events: {},

			// attach event listeners based on the module's events object
			// Events are delegated via jQuery's 'on' function
			// The 'on' function will scope the function passed in to
			// the element the event is attached to, so $.proxy is
			// used to retain the View scope within the function
			listen: function() {
				if (!this.events) { return this; }
				// unbind previously bound events to prevent multiple bindings
				this.ignoreAll();
				for (var key in this.events) {
					var _event = this.util.createEventData(key, this);

					if ( _event.selector === '' ) {
						kaiser.LOG(_event.eventName + ' events on ' + this._id + ' will trigger ' + _event.callback);
						this.$el.on(_event.eventName, kaiser.$.proxy(this[_event.callback], this));
					} else {
						kaiser.LOG(_event.eventName + ' events on ' + _event.selector + ' will trigger ' + _event.callback);
						this.$el.on(_event.eventName, _event.selector, kaiser.$.proxy(this[_event.callback], this));
					}
				}
				return this;
			},

			/**
			 * Attaches events scoped within the module
			 * @param  {string} event jQuery event name
			 * @param  {string|object} selector jQuery selector string or jQuery selection
			 * @param  {string} callback callback name within scope
			 * @return {object} this Used for method chaining
			 */
			listenTo: function(event, selector, callbackName) {
				if (!event || !selector) {
					throw new Error('listenTo requires at least two parameters. (<event>, <callback>) or (<event>, <selector>, <callback>)');
				}

				if (typeof selector === 'object') {
					selector = createUniqueSelector(selector);
				}

				// if callbackName is provided in place of selector
				// assign callbackName to selector and selector to an empty string
				// TODO: find a better way to do this
				if (!callbackName) {
					callbackName = selector;
					selector = '';
				}

				// create an event object to store in this.events
				var _event = this.util.createEventObject(event, selector, callbackName);

				// create the event string with the module _id
				var eventName = event + '.' + this._id;

				// push the event to the events object
				_.extend(this.events, _event);

				if ( selector === '' ) {
					kaiser.LOG(eventName + ' events on ' + this._id + ' will trigger ' + callbackName);
					this.$el.on(eventName, kaiser.$.proxy(this[callbackName], this));
				} else {
					kaiser.LOG(eventName + ' events on ' + selector + ' will trigger ' + callbackName);
					this.$el.on(eventName, selector, kaiser.$.proxy(this[callbackName], this));
				}

				return this;
			},

			// Ignores the event name passed in ie: 'click .button'
			// within the scope of this module
			ignore: function(eventString) {
				if (!this.events) { return this; }
				var _event = this.util.createEventData(eventString, this);
				if (_event.selector === '') {
					kaiser.LOG('Ignoring ' + _event.eventName + ' events on ' + this._id);
					this.$el.off(_event.eventName);
				} else {
					kaiser.LOG('Ignoring ' + _event.eventName + ' events on ' + _event.selector);
					this.$el.off(_event.eventName, _event.selector);
				}

				return this;
			},

			// unbinds all events within the scope of this module
			ignoreAll: function() {
				if (!this.events) { return this; }
				for (var key in this.events) {
					var _event = this.util.createEventData(key, this);

					if (_event.selector === '') {
						kaiser.LOG('Ignoring ' + _event.eventName + ' events on ' + this._id);
						this.$el.off(_event.eventName);
					} else {
						kaiser.LOG('Ignoring ' + _event.eventName + ' events on ' + _event.selector);
						this.$el.off(_event.eventName, _event.selector);
					}
				}

				return this;
			},

			destroy: function() {
				kaiser.LOG('Destroyed module ' + this._id);
				this.$el.remove();
				this.ignoreAll();
				return this;
			},

			util: {
				createEventData: function(key, root) {
					var match = key.match(eventMatcher);
					return {
						callback: root.events[key],
						eventName: match[1] + '.' + root._id,
						selector: match[2]
					}
				},

				createEventObject: function(event, selector, callback) {
					var ret = {}
					ret[event + ' ' + selector] = callback;
					return ret;
				}
			}
		};

		return defaultMiddleware;
	}

	return kaiser;

});