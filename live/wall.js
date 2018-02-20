(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var WallClient = exports.WallClient = function () {
    function WallClient(uri, username, password) {
        var _this = this;

        var qos = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

        _classCallCheck(this, WallClient);

        this.username = username;
        this.password = password;
        this.qos = qos;
        this.clientId = WallClient.generateClientId();

        // paho documentation: http://www.eclipse.org/paho/files/jsdoc/index.html
        this.client = new Paho.MQTT.Client(uri, this.clientId);

        this.client.onMessageArrived = function (message) {

            var payload = void 0,
                binary = void 0;

            try {
                payload = message.payloadString;
            } catch (e) {
                payload = message.payloadBytes;
                binary = true;
            }

            //console.log("Message arrived ", message.destinationName);
            _this.onMessage(message.destinationName, payload, message.retained, message.qos, binary);
        };

        this.client.onConnectionLost = function (error) {
            console.info("Connection lost ", error);

            if (WallClient.isNetworkError(error.errorCode)) {
                _this._reconnect();
                return;
            }

            _this.onError("Connection lost (" + error.errorMessage + ")", true);
        };

        this.currentTopic = null;

        this.onConnected = $.noop();
        this.onMessage = $.noop();
        this.onError = $.noop();
        this.onStateChanged = $.noop();

        this.firstConnection = true;
        this.attempts = 0;
        this._setState(WallClient.STATE.NEW);
    }

    _createClass(WallClient, [{
        key: "subscribe",
        value: function subscribe(topic, fn) {
            var _this2 = this;

            // unsubscribe current topic (if exists)
            if (this.currentTopic !== null && this.currentTopic !== topic) {
                var oldTopic = this.currentTopic;
                this.client.unsubscribe(oldTopic, {
                    onSuccess: function onSuccess() {
                        console.info("Unsubscribe '%s' success", oldTopic);
                    },
                    onFailure: function onFailure(error) {
                        console.error("Unsubscribe '%s' failure", oldTopic, error);
                    }
                });
            }

            // subscribe new topic
            this.client.subscribe(topic, {
                qos: this.qos,
                onSuccess: function onSuccess(r) {
                    console.info("Subscribe '%s' success", topic, r);
                    if (fn) {
                        fn();
                    }
                },
                onFailure: function onFailure(r) {
                    console.error("subscribe '%s' failure", topic, r);
                    _this2.onError("Subscribe failure");
                }
            });

            this.currentTopic = topic;
        }
    }, {
        key: "connect",
        value: function connect() {
            var _this3 = this;

            var connectOptions = {

                onSuccess: function onSuccess() {
                    console.info("Connect success");

                    _this3.attempts = 0;
                    _this3._setState(WallClient.STATE.CONNECTED);

                    if (_this3.firstConnection) {
                        _this3.firstConnection = false;
                        _this3.onConnected();
                    } else {
                        _this3.subscribe(_this3.currentTopic);
                    }
                },

                onFailure: function onFailure(error) {
                    console.error("Connect fail ", error);

                    if (WallClient.isNetworkError(error.errorCode)) {
                        _this3._reconnect();
                        return;
                    }

                    _this3.onError("Fail to connect", true);
                }
            };

            if (this.username && this.password) {
                connectOptions.userName = this.username;
                connectOptions.password = this.password;
            }

            this._setState(this.firstConnection ? WallClient.STATE.CONNECTING : WallClient.STATE.RECONNECTING);

            this.client.connect(connectOptions);
        }
    }, {
        key: "_reconnect",
        value: function _reconnect() {
            var _this4 = this;

            this.attempts++;
            this._setState(this.firstConnection ? WallClient.STATE.CONNECTING : WallClient.STATE.RECONNECTING);

            var t = (this.attempts - 1) * 2000;
            t = Math.max(Math.min(t, 30000), 100);

            setTimeout(function () {
                _this4.connect();
            }, t);
        }
    }, {
        key: "_setState",
        value: function _setState(state) {
            this.state = state;

            if (this.onStateChanged) this.onStateChanged(state);
        }
    }, {
        key: "toString",
        value: function toString() {
            // _getURI is undocumented function (it is URI used for underlying WebSocket connection)
            // see https://github.com/eclipse/paho.mqtt.javascript/blob/master/src/mqttws31.js#L1622
            return this.client._getURI();
        }
    }], [{
        key: "generateClientId",
        value: function generateClientId() {
            var time = Date.now() % 1000;
            var rnd = Math.round(Math.random() * 1000);
            return "wall" + (time * 1000 + rnd);
        }
    }, {
        key: "isNetworkError",
        value: function isNetworkError(code) {
            // possible codes: https://github.com/eclipse/paho.mqtt.javascript/blob/master/src/mqttws31.js#L166
            var networkErrors = [1 /* CONNECT_TIMEOUT */
            , 2 /* SUBSCRIBE_TIMEOUT */
            , 3 /* UNSUBSCRIBE_TIMEOUT */
            , 4 /* PING_TIMEOUT */
            , 6 /* CONNACK_RETURNCODE */
            , 7 /* SOCKET_ERROR */
            , 8 /* SOCKET_CLOSE */
            , 9 /* MALFORMED_UTF */
            , 11 /* INVALID_STATE */
            , 12 /* INVALID_TYPE */
            , 15 /* INVALID_STORED_DATA */
            , 16 /* INVALID_MQTT_MESSAGE_TYPE */
            , 17 /* MALFORMED_UNICODE */
            ];
            return networkErrors.indexOf(code) >= 0;
        }
    }]);

    return WallClient;
}();

WallClient.STATE = {
    NEW: 0,
    CONNECTING: 1,
    CONNECTED: 2,
    RECONNECTING: 3,
    ERROR: 99
};

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Toolbar = exports.Footer = exports.MessageContainer = exports.MessageLine = exports.UI = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils.js');

var _client = require('./client.js');

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UI = exports.UI = {};

UI.setTitle = function (topic) {
    document.title = "Avions.brussels - Live " + (topic ? " for " + topic : "");
};

UI.toast = function (message) {
    var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "info";
    var persistent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    return new Toast(message, type, persistent);
};

var Toast = function () {
    function Toast(message) {
        var _this = this;

        var type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "info";
        var persistent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        _classCallCheck(this, Toast);

        this.$root = $("<div class='toast-item'>").text(message).addClass(type).hide().appendTo("#toast").fadeIn();

        if (persistent) {
            this.$root.addClass("persistent");
        } else {
            setTimeout(function () {
                _this.hide();
            }, 5000);
        }
    }

    _createClass(Toast, [{
        key: 'hide',
        value: function hide() {
            var _this2 = this;

            this.$root.slideUp().queue(function () {
                _this2.remove();
            });
        }
    }, {
        key: 'remove',
        value: function remove() {
            this.$root.remove();
        }
    }, {
        key: 'setMessage',
        value: function setMessage(message) {
            this.$root.text(message);
        }
    }]);

    return Toast;
}();

var MessageLine = exports.MessageLine = function () {
    function MessageLine(topic) {
        _classCallCheck(this, MessageLine);

        this.topic = topic;
        this.counter = 0;
        this.isNew = true;
        this.init();
    }

    _createClass(MessageLine, [{
        key: 'init',
        value: function init() {
            this.$root = $("<article class='message'>");

            var header = $("<header>").appendTo(this.$root);

            $("<h2>").text(this.topic).appendTo(header);

            if (window.config.showCounter) {
                this.$counterMark = $("<span class='mark counter' title='Message counter'>0</span>").appendTo(header);
            }

            this.$retainMark = $("<span class='mark retain' title='Retain message'>R</span>").appendTo(header);

            this.$qosMark = $("<span class='mark qos' title='Received message QoS'>QoS</span>").appendTo(header);

            this.$payload = $("<p>").appendTo(this.$root);
        }
    }, {
        key: 'highlight',
        value: function highlight() {
            var line = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

            (line ? this.$root : this.$payload).stop().css({ backgroundColor: "#0CB0FF" }).animate({ backgroundColor: "#fff" }, 2000);
        }
    }, {
        key: 'update',
        value: function update(payload, retained, qos, binary) {
            this.counter++;
            this.isRetained = retained;

            if (this.$counterMark) {
                this.$counterMark.text(this.counter);
            }

            if (this.$qosMark) {
                if (qos == 0) {
                    this.$qosMark.hide();
                } else {
                    this.$qosMark.show();
                    this.$qosMark.text('QoS ' + qos);
                    this.$qosMark.attr("data-qos", qos);
                }
            }

            if (binary) {
                payload = "HEX: " + formatByteArray(payload);
                this.isSystemPayload = true;
            } else {
                if (payload == "") {
                    payload = "NULL";
                    this.isSystemPayload = true;
                } else {
                    this.isSystemPayload = false;
                }
            }

            this.$payload.text(payload);
            this.highlight(this.isNew);

            if (this.isNew) {
                this.isNew = false;
            }
        }
    }, {
        key: 'isRetained',
        set: function set(value) {
            this.$retainMark[value ? 'show' : 'hide']();
        }
    }, {
        key: 'isSystemPayload',
        set: function set(value) {
            this.$payload.toggleClass("sys", value);
        }
    }]);

    return MessageLine;
}();

function formatByteArray(a) {
    var a2 = new Array(a.length);

    for (var i = a.length - 1; i >= 0; i--) {
        a2[i] = (a[i] <= 0x0F ? "0" : "") + a[i].toString(16).toUpperCase();
    }

    return a2.join(" ");
}

var MessageContainer = exports.MessageContainer = function () {
    function MessageContainer($parent) {
        _classCallCheck(this, MessageContainer);

        this.sort = 'Alphabetically';
        this.$parent = $parent;
        this.init();
    }

    _createClass(MessageContainer, [{
        key: 'init',
        value: function init() {
            this.reset();
        }
    }, {
        key: 'reset',
        value: function reset() {
            this.lines = {};
            this.topics = [];
            this.$parent.html("");
        }
    }, {
        key: 'update',
        value: function update(topic, payload, retained, qos, binary) {

            if (!this.lines[topic]) {

                var line = new MessageLine(topic, this.$parent);

                this['addLine' + this.sort](line);
                this.lines[topic] = line;
            }

            this.lines[topic].update(payload, retained, qos, binary);
        }
    }, {
        key: 'addLineAlphabetically',
        value: function addLineAlphabetically(line) {

            if (this.topics.length == 0) {
                this.addLineChronologically(line);
                return;
            }

            var topic = line.topic;

            this.topics.push(topic);
            this.topics.sort();

            var n = this.topics.indexOf(topic);

            if (n == 0) {
                this.$parent.prepend(line.$root);
                return;
            }

            var prev = this.topics[n - 1];
            line.$root.insertAfter(this.lines[prev].$root);
        }
    }, {
        key: 'addLineChronologically',
        value: function addLineChronologically(line) {
            this.topics.push(line.topic);
            this.$parent.append(line.$root);
        }
    }]);

    return MessageContainer;
}();

MessageContainer.SORT_APLHA = "Alphabetically";
MessageContainer.SORT_CHRONO = "Chronologically";

var Footer = exports.Footer = function () {
    function Footer() {
        _classCallCheck(this, Footer);
    }

    _createClass(Footer, [{
        key: 'clientId',
        set: function set(value) {
            $("#status-client").text(value);
        }
    }, {
        key: 'uri',
        set: function set(value) {
            $("#status-host").text(value);
        }
    }, {
        key: 'state',
        set: function set(value) {
            var text = void 0,
                className = void 0;

            switch (value) {
                case _client.WallClient.STATE.NEW:
                    text = "";
                    className = "connecting";
                    break;
                case _client.WallClient.STATE.CONNECTING:
                    text = "connecting...";
                    className = "connecting";
                    break;
                case _client.WallClient.STATE.CONNECTED:
                    text = "connected";
                    className = "connected";
                    break;
                case _client.WallClient.STATE.RECONNECTING:
                    text = "reconnecting...";
                    className = "connecting";
                    break;
                case _client.WallClient.STATE.ERROR:
                    text = "not connected";
                    className = "fail";
                    break;
                default:
                    throw new Error("Unknown WallClient.STATE");
            }

            if (this.reconnectAttempts > 1) {
                text += ' (' + this.reconnectAttempts + ')';
            }

            $("#status-state").removeClass().addClass(className);
            $("#status-state span").text(text);
        }
    }]);

    return Footer;
}();

var Toolbar = exports.Toolbar = function (_EventEmitter) {
    _inherits(Toolbar, _EventEmitter);

    function Toolbar(parent) {
        _classCallCheck(this, Toolbar);

        var _this3 = _possibleConstructorReturn(this, (Toolbar.__proto__ || Object.getPrototypeOf(Toolbar)).call(this));

        _this3.$parent = parent;
        _this3.$topic = parent.find("#topic");

        _this3.initEventHandlers();
        _this3.initDefaultTopic();
        return _this3;
    }

    _createClass(Toolbar, [{
        key: 'initEventHandlers',
        value: function initEventHandlers() {
            var _this4 = this;

            var inhibitor = false;

            this.$topic.keyup(function (e) {
                if (e.which === 13) {
                    // ENTER
                    _this4.$topic.blur();
                }

                if (e.keyCode === 27) {
                    // ESC
                    inhibitor = true;
                    _this4.$topic.blur();
                }
            });

            this.$topic.focus(function (e) {
                inhibitor = false;
            });

            this.$topic.blur(function (e) {
                if (inhibitor) {
                    _this4.updateUi(); // revert changes
                } else {
                    _this4.inputChanged();
                }
            });
        }
    }, {
        key: 'inputChanged',
        value: function inputChanged() {
            var newTopic = this.$topic.val();

            if (newTopic === this._topic) {
                return;
            }

            this._topic = newTopic;
            this.emit("topic", newTopic);
        }
    }, {
        key: 'initDefaultTopic',
        value: function initDefaultTopic() {
            // URL hash 
            if (location.hash !== "") {
                this._topic = location.hash.substr(1);
            } else {
                this._topic = config.defaultTopic || "/#";
            }

            this.updateUi();
        }
    }, {
        key: 'updateUi',
        value: function updateUi() {
            this.$topic.val(this._topic);
        }
    }, {
        key: 'topic',
        get: function get() {
            return this._topic;
        },
        set: function set(value) {
            this._topic = value;
            this.updateUi();
            this.emit("topic", value);
        }
    }]);

    return Toolbar;
}(_utils.EventEmitter);

},{"./client.js":1,"./utils.js":3}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Simple version of node.js's EventEmiter class
 */
var EventEmitter = exports.EventEmitter = function () {
    function EventEmitter() {
        _classCallCheck(this, EventEmitter);
    }

    _createClass(EventEmitter, [{
        key: 'on',


        /**
         * Add event handler of givent type
         */
        value: function on(type, fn) {
            if (this['_on' + type] === undefined) {
                this['_on' + type] = [];
            }

            this['_on' + type].push(fn);
        }

        /**
         * Emit event of type.
         * 
         * All arguments will be applay to callback, preserve context of object this.
         */

    }, {
        key: 'emit',
        value: function emit(type) {
            var _this = this;

            for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
            }

            if (this['_on' + type]) {
                this['_on' + type].forEach(function (fn) {
                    return fn.apply(_this, args);
                });
            }
        }
    }]);

    return EventEmitter;
}();

},{}],4:[function(require,module,exports){
"use strict";

var _client = require("./client.js");

var _ui = require("./ui.js");

// --- Main -------------------------------------------------------------------

// decode password base64 (if empty leve it)
var password = config.server.password !== undefined ? atob(config.server.password) : undefined;

var client = new _client.WallClient(config.server.uri, config.server.username, password, config.qos);
var messages = new _ui.MessageContainer($("section.messages"));
var footer = new _ui.Footer();
var toolbar = new _ui.Toolbar($("#header"));

messages.sort = config.alphabeticalSort ? _ui.MessageContainer.SORT_APLHA : _ui.MessageContainer.SORT_CHRONO;

footer.clientId = client.clientId;
footer.uri = client.toString();
footer.state = 0;

function load() {
    var topic = toolbar.topic;

    client.subscribe(topic, function () {
        _ui.UI.setTitle(topic);
        location.hash = "#" + topic;
    });

    messages.reset();
}

toolbar.on("topic", function () {
    load();
});

client.onConnected = function () {
    load();
    _ui.UI.toast("Connected to host " + client.toString());
};

client.onError = function (description, isFatal) {
    _ui.UI.toast(description, "error", isFatal);
};

var reconnectingToast = null;

client.onStateChanged = function (state) {
    footer.reconnectAttempts = client.attempts;
    footer.state = state;

    if ((state === _client.WallClient.STATE.CONNECTING || state === _client.WallClient.STATE.RECONNECTING) && client.attempts >= 2) {
        var msg = state === _client.WallClient.STATE.CONNECTING ? "Fail to connect. Trying to connect... (" + client.attempts + " attempts)" : "Connection lost. Trying to reconnect... (" + client.attempts + " attempts)";

        if (reconnectingToast === null) {
            reconnectingToast = _ui.UI.toast(msg, "error", true);
        } else {
            reconnectingToast.setMessage(msg);
        }
    }

    if (state === _client.WallClient.STATE.CONNECTED && reconnectingToast !== null) {
        reconnectingToast.hide();
        reconnectingToast = null;

        if (client.firstConnection == false) {
            _ui.UI.toast("Reconnected");
        }
    }
};

client.onMessage = function (topic, msg, retained, qos, binary) {
    messages.update(topic, msg, retained, qos, binary);
};

client.connect();

},{"./client.js":1,"./ui.js":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvY2xpZW50LmpzIiwic3JjL2pzL3VpLmpzIiwic3JjL2pzL3V0aWxzLmpzIiwic3JjL2pzL3dhbGwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7O0lDQWEsVSxXQUFBLFU7QUFFVCx3QkFBWSxHQUFaLEVBQWlCLFFBQWpCLEVBQTJCLFFBQTNCLEVBQThDO0FBQUE7O0FBQUEsWUFBVCxHQUFTLHVFQUFILENBQUc7O0FBQUE7O0FBRTFDLGFBQUssUUFBTCxHQUFnQixRQUFoQjtBQUNBLGFBQUssUUFBTCxHQUFnQixRQUFoQjtBQUNBLGFBQUssR0FBTCxHQUFXLEdBQVg7QUFDQSxhQUFLLFFBQUwsR0FBZ0IsV0FBVyxnQkFBWCxFQUFoQjs7QUFFQTtBQUNBLGFBQUssTUFBTCxHQUFjLElBQUksS0FBSyxJQUFMLENBQVUsTUFBZCxDQUFxQixHQUFyQixFQUEwQixLQUFLLFFBQS9CLENBQWQ7O0FBRUEsYUFBSyxNQUFMLENBQVksZ0JBQVosR0FBK0IsVUFBQyxPQUFELEVBQWE7O0FBRXhDLGdCQUFJLGdCQUFKO0FBQUEsZ0JBQWEsZUFBYjs7QUFFQSxnQkFBRztBQUNDLDBCQUFVLFFBQVEsYUFBbEI7QUFDSCxhQUZELENBRUUsT0FBTSxDQUFOLEVBQVM7QUFDUCwwQkFBVSxRQUFRLFlBQWxCO0FBQ0EseUJBQVMsSUFBVDtBQUNIOztBQUVEO0FBQ0Esa0JBQUssU0FBTCxDQUFlLFFBQVEsZUFBdkIsRUFBd0MsT0FBeEMsRUFBaUQsUUFBUSxRQUF6RCxFQUFtRSxRQUFRLEdBQTNFLEVBQWdGLE1BQWhGO0FBQ0gsU0FiRDs7QUFlQSxhQUFLLE1BQUwsQ0FBWSxnQkFBWixHQUErQixVQUFDLEtBQUQsRUFBVztBQUN0QyxvQkFBUSxJQUFSLENBQWEsa0JBQWIsRUFBaUMsS0FBakM7O0FBRUEsZ0JBQUksV0FBVyxjQUFYLENBQTBCLE1BQU0sU0FBaEMsQ0FB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VUFBVSxtQkFBVyxLQUFYLENBQWlCLFNBQTNCLElBQXdDLHNCQUFzQixJQUFsRSxFQUF3RTtBQUNwRSwwQkFBa0IsSUFBbEI7QUFDQSw0QkFBb0IsSUFBcEI7O0FBRUEsWUFBSSxPQUFPLGVBQVAsSUFBMEIsS0FBOUIsRUFBcUM7QUFDakMsbUJBQUcsS0FBSCxDQUFTLGFBQVQ7QUFDSDtBQUNKO0FBQ0osQ0F4QkQ7O0FBMEJBLE9BQU8sU0FBUCxHQUFtQixVQUFDLEtBQUQsRUFBUSxHQUFSLEVBQWEsUUFBYixFQUF1QixHQUF2QixFQUE0QixNQUE1QixFQUF1QztBQUN0RCxhQUFTLE1BQVQsQ0FBZ0IsS0FBaEIsRUFBdUIsR0FBdkIsRUFBNEIsUUFBNUIsRUFBc0MsR0FBdEMsRUFBMkMsTUFBM0M7QUFDSCxDQUZEOztBQUlBLE9BQU8sT0FBUCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJleHBvcnQgY2xhc3MgV2FsbENsaWVudCB7XHJcblxyXG4gICAgY29uc3RydWN0b3IodXJpLCB1c2VybmFtZSwgcGFzc3dvcmQsIHFvcyA9IDApIHtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnVzZXJuYW1lID0gdXNlcm5hbWU7XHJcbiAgICAgICAgdGhpcy5wYXNzd29yZCA9IHBhc3N3b3JkO1xyXG4gICAgICAgIHRoaXMucW9zID0gcW9zO1xyXG4gICAgICAgIHRoaXMuY2xpZW50SWQgPSBXYWxsQ2xpZW50LmdlbmVyYXRlQ2xpZW50SWQoKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBwYWhvIGRvY3VtZW50YXRpb246IGh0dHA6Ly93d3cuZWNsaXBzZS5vcmcvcGFoby9maWxlcy9qc2RvYy9pbmRleC5odG1sXHJcbiAgICAgICAgdGhpcy5jbGllbnQgPSBuZXcgUGFoby5NUVRULkNsaWVudCh1cmksIHRoaXMuY2xpZW50SWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uTWVzc2FnZUFycml2ZWQgPSAobWVzc2FnZSkgPT4ge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGV0IHBheWxvYWQsIGJpbmFyeTtcclxuXHJcbiAgICAgICAgICAgIHRyeXtcclxuICAgICAgICAgICAgICAgIHBheWxvYWQgPSBtZXNzYWdlLnBheWxvYWRTdHJpbmc7XHJcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xyXG4gICAgICAgICAgICAgICAgcGF5bG9hZCA9IG1lc3NhZ2UucGF5bG9hZEJ5dGVzIFxyXG4gICAgICAgICAgICAgICAgYmluYXJ5ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhcIk1lc3NhZ2UgYXJyaXZlZCBcIiwgbWVzc2FnZS5kZXN0aW5hdGlvbk5hbWUpO1xyXG4gICAgICAgICAgICB0aGlzLm9uTWVzc2FnZShtZXNzYWdlLmRlc3RpbmF0aW9uTmFtZSwgcGF5bG9hZCwgbWVzc2FnZS5yZXRhaW5lZCwgbWVzc2FnZS5xb3MsIGJpbmFyeSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jbGllbnQub25Db25uZWN0aW9uTG9zdCA9IChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmluZm8oXCJDb25uZWN0aW9uIGxvc3QgXCIsIGVycm9yKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChXYWxsQ2xpZW50LmlzTmV0d29ya0Vycm9yKGVycm9yLmVycm9yQ29kZSkpe1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVjb25uZWN0KCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRoaXMub25FcnJvcihgQ29ubmVjdGlvbiBsb3N0ICgke2Vycm9yLmVycm9yTWVzc2FnZX0pYCwgdHJ1ZSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5jdXJyZW50VG9waWMgPSBudWxsO1xyXG5cclxuICAgICAgICB0aGlzLm9uQ29ubmVjdGVkID0gJC5ub29wKCk7XHJcbiAgICAgICAgdGhpcy5vbk1lc3NhZ2UgPSAkLm5vb3AoKTtcclxuICAgICAgICB0aGlzLm9uRXJyb3IgPSAkLm5vb3AoKTtcclxuICAgICAgICB0aGlzLm9uU3RhdGVDaGFuZ2VkID0gJC5ub29wKCk7XHJcblxyXG4gICAgICAgIHRoaXMuZmlyc3RDb25uZWN0aW9uID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmF0dGVtcHRzID0gMDtcclxuICAgICAgICB0aGlzLl9zZXRTdGF0ZShXYWxsQ2xpZW50LlNUQVRFLk5FVyk7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdlbmVyYXRlQ2xpZW50SWQoKSB7XHJcbiAgICAgICAgdmFyIHRpbWUgPSBEYXRlLm5vdygpICUgMTAwMDtcclxuICAgICAgICB2YXIgcm5kID0gTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMTAwMCk7XHJcbiAgICAgICAgcmV0dXJuIGB3YWxsJHt0aW1lKjEwMDAgKyBybmR9YDtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgaXNOZXR3b3JrRXJyb3IgKGNvZGUpIHtcclxuICAgICAgICAvLyBwb3NzaWJsZSBjb2RlczogaHR0cHM6Ly9naXRodWIuY29tL2VjbGlwc2UvcGFoby5tcXR0LmphdmFzY3JpcHQvYmxvYi9tYXN0ZXIvc3JjL21xdHR3czMxLmpzI0wxNjZcclxuICAgICAgICBjb25zdCBuZXR3b3JrRXJyb3JzID0gWyBcclxuICAgICAgICAgICAgMSAvKiBDT05ORUNUX1RJTUVPVVQgKi8sXHJcbiAgICAgICAgICAgIDIgLyogU1VCU0NSSUJFX1RJTUVPVVQgKi8sIFxyXG4gICAgICAgICAgICAzIC8qIFVOU1VCU0NSSUJFX1RJTUVPVVQgKi8sXHJcbiAgICAgICAgICAgIDQgLyogUElOR19USU1FT1VUICovLFxyXG4gICAgICAgICAgICA2IC8qIENPTk5BQ0tfUkVUVVJOQ09ERSAqLyxcclxuICAgICAgICAgICAgNyAvKiBTT0NLRVRfRVJST1IgKi8sXHJcbiAgICAgICAgICAgIDggLyogU09DS0VUX0NMT1NFICovLFxyXG4gICAgICAgICAgICA5IC8qIE1BTEZPUk1FRF9VVEYgKi8sXHJcbiAgICAgICAgICAgIDExIC8qIElOVkFMSURfU1RBVEUgKi8sXHJcbiAgICAgICAgICAgIDEyIC8qIElOVkFMSURfVFlQRSAqLyxcclxuICAgICAgICAgICAgMTUgLyogSU5WQUxJRF9TVE9SRURfREFUQSAqLyxcclxuICAgICAgICAgICAgMTYgLyogSU5WQUxJRF9NUVRUX01FU1NBR0VfVFlQRSAqLyxcclxuICAgICAgICAgICAgMTcgLyogTUFMRk9STUVEX1VOSUNPREUgKi8sXHJcbiAgICAgICAgXTtcclxuICAgICAgICByZXR1cm4gbmV0d29ya0Vycm9ycy5pbmRleE9mKGNvZGUpID49IDA7XHJcbiAgICB9XHJcblxyXG4gICAgc3Vic2NyaWJlICh0b3BpYywgZm4pIHtcclxuICAgIFxyXG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGN1cnJlbnQgdG9waWMgKGlmIGV4aXN0cylcclxuICAgICAgICBpZiAodGhpcy5jdXJyZW50VG9waWMgIT09IG51bGwgJiYgdGhpcy5jdXJyZW50VG9waWMgIT09IHRvcGljKSB7XHJcbiAgICAgICAgICAgIGxldCBvbGRUb3BpYyA9IHRoaXMuY3VycmVudFRvcGljO1xyXG4gICAgICAgICAgICB0aGlzLmNsaWVudC51bnN1YnNjcmliZShvbGRUb3BpYywge1xyXG4gICAgICAgICAgICAgICAgb25TdWNjZXNzOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKFwiVW5zdWJzY3JpYmUgJyVzJyBzdWNjZXNzXCIsIG9sZFRvcGljKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBvbkZhaWx1cmU6IChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJVbnN1YnNjcmliZSAnJXMnIGZhaWx1cmVcIiwgb2xkVG9waWMsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgXHJcbiAgICAgICAgLy8gc3Vic2NyaWJlIG5ldyB0b3BpY1xyXG4gICAgICAgIHRoaXMuY2xpZW50LnN1YnNjcmliZSh0b3BpYywge1xyXG4gICAgICAgICAgICBxb3M6IHRoaXMucW9zLFxyXG4gICAgICAgICAgICBvblN1Y2Nlc3M6IChyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmluZm8oXCJTdWJzY3JpYmUgJyVzJyBzdWNjZXNzXCIsIHRvcGljLCByKTtcclxuICAgICAgICAgICAgICAgIGlmIChmbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGZuKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG9uRmFpbHVyZTogKHIpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJzdWJzY3JpYmUgJyVzJyBmYWlsdXJlXCIsIHRvcGljLCByKTtcclxuICAgICAgICAgICAgICAgIHRoaXMub25FcnJvcihcIlN1YnNjcmliZSBmYWlsdXJlXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY3VycmVudFRvcGljID0gdG9waWM7XHJcbiAgICB9XHJcblxyXG4gICAgY29ubmVjdCAoKSB7XHJcblxyXG4gICAgICAgIGxldCBjb25uZWN0T3B0aW9ucyA9IHtcclxuXHJcbiAgICAgICAgICAgIG9uU3VjY2VzcyA6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhcIkNvbm5lY3Qgc3VjY2Vzc1wiKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmF0dGVtcHRzID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3NldFN0YXRlKFdhbGxDbGllbnQuU1RBVEUuQ09OTkVDVEVEKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZmlyc3RDb25uZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJzdENvbm5lY3Rpb24gPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uQ29ubmVjdGVkKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3Vic2NyaWJlKHRoaXMuY3VycmVudFRvcGljKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuXHJcbiAgICAgICAgICAgIG9uRmFpbHVyZSA6IChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkNvbm5lY3QgZmFpbCBcIiwgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoV2FsbENsaWVudC5pc05ldHdvcmtFcnJvcihlcnJvci5lcnJvckNvZGUpKXtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZWNvbm5lY3QoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHRoaXMub25FcnJvcihcIkZhaWwgdG8gY29ubmVjdFwiLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnVzZXJuYW1lICYmIHRoaXMucGFzc3dvcmQpIHtcclxuICAgICAgICAgICAgY29ubmVjdE9wdGlvbnMudXNlck5hbWUgPSB0aGlzLnVzZXJuYW1lO1xyXG4gICAgICAgICAgICBjb25uZWN0T3B0aW9ucy5wYXNzd29yZCA9IHRoaXMucGFzc3dvcmQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLl9zZXRTdGF0ZSh0aGlzLmZpcnN0Q29ubmVjdGlvbiA/IFdhbGxDbGllbnQuU1RBVEUuQ09OTkVDVElORyA6IFdhbGxDbGllbnQuU1RBVEUuUkVDT05ORUNUSU5HKVxyXG5cclxuICAgICAgICB0aGlzLmNsaWVudC5jb25uZWN0KGNvbm5lY3RPcHRpb25zKTtcclxuICAgIH1cclxuXHJcbiAgICBfcmVjb25uZWN0ICgpIHtcclxuXHJcbiAgICAgICAgdGhpcy5hdHRlbXB0cyArKztcclxuICAgICAgICB0aGlzLl9zZXRTdGF0ZSh0aGlzLmZpcnN0Q29ubmVjdGlvbiA/IFdhbGxDbGllbnQuU1RBVEUuQ09OTkVDVElORyA6IFdhbGxDbGllbnQuU1RBVEUuUkVDT05ORUNUSU5HKTtcclxuXHJcbiAgICAgICAgbGV0IHQgPSAodGhpcy5hdHRlbXB0cy0xKSAqIDIwMDA7XHJcbiAgICAgICAgdCA9IE1hdGgubWF4KE1hdGgubWluKHQsIDMwMDAwKSwgMTAwKTtcclxuXHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuY29ubmVjdCgpO1xyXG4gICAgICAgIH0sIHQpO1xyXG4gICAgfVxyXG5cclxuICAgIF9zZXRTdGF0ZSAoc3RhdGUpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gc3RhdGU7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLm9uU3RhdGVDaGFuZ2VkKVxyXG4gICAgICAgICAgICB0aGlzLm9uU3RhdGVDaGFuZ2VkKHN0YXRlKTtcclxuICAgIH1cclxuXHJcbiAgICB0b1N0cmluZyAoKSB7XHJcbiAgICAgICAgLy8gX2dldFVSSSBpcyB1bmRvY3VtZW50ZWQgZnVuY3Rpb24gKGl0IGlzIFVSSSB1c2VkIGZvciB1bmRlcmx5aW5nIFdlYlNvY2tldCBjb25uZWN0aW9uKVxyXG4gICAgICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vZWNsaXBzZS9wYWhvLm1xdHQuamF2YXNjcmlwdC9ibG9iL21hc3Rlci9zcmMvbXF0dHdzMzEuanMjTDE2MjJcclxuICAgICAgICByZXR1cm4gdGhpcy5jbGllbnQuX2dldFVSSSgpO1xyXG4gICAgfVxyXG59XHJcblxyXG5XYWxsQ2xpZW50LlNUQVRFID0ge1xyXG4gICAgTkVXOiAwLFxyXG4gICAgQ09OTkVDVElORzogMSxcclxuICAgIENPTk5FQ1RFRDogMixcclxuICAgIFJFQ09OTkVDVElORzogMyxcclxuICAgIEVSUk9SOiA5OVxyXG59O1xyXG4iLCJpbXBvcnQge0V2ZW50RW1pdHRlcn0gZnJvbSAnLi91dGlscy5qcyc7XHJcbmltcG9ydCB7V2FsbENsaWVudH0gZnJvbSAnLi9jbGllbnQuanMnO1xyXG5cclxuZXhwb3J0IHZhciBVSSA9IHt9O1xyXG5cclxuVUkuc2V0VGl0bGUgPSBmdW5jdGlvbiAodG9waWMpIHtcclxuICAgIGRvY3VtZW50LnRpdGxlID0gXCJBdmlvbnMuYnJ1c3NlbHMgLSBUcmFja2VyIFwiICsgKHRvcGljID8gKFwiIGZvciBcIiArIHRvcGljKSA6IFwiXCIpO1xyXG59O1xyXG4gXHJcblVJLnRvYXN0ID0gZnVuY3Rpb24gKG1lc3NhZ2UsIHR5cGUgPSBcImluZm9cIiwgcGVyc2lzdGVudCA9IGZhbHNlKSB7XHJcbiAgICByZXR1cm4gbmV3IFRvYXN0KG1lc3NhZ2UsIHR5cGUsIHBlcnNpc3RlbnQpO1xyXG59O1xyXG5cclxuY2xhc3MgVG9hc3Qge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yIChtZXNzYWdlLCB0eXBlID0gXCJpbmZvXCIsIHBlcnNpc3RlbnQgPSBmYWxzZSkge1xyXG5cclxuICAgICAgICB0aGlzLiRyb290ID0gJChcIjxkaXYgY2xhc3M9J3RvYXN0LWl0ZW0nPlwiKVxyXG4gICAgICAgICAgICAudGV4dChtZXNzYWdlKVxyXG4gICAgICAgICAgICAuYWRkQ2xhc3ModHlwZSlcclxuICAgICAgICAgICAgLmhpZGUoKVxyXG4gICAgICAgICAgICAuYXBwZW5kVG8oXCIjdG9hc3RcIilcclxuICAgICAgICAgICAgLmZhZGVJbigpO1xyXG5cclxuICAgICAgICBpZiAocGVyc2lzdGVudCkge1xyXG4gICAgICAgICAgICB0aGlzLiRyb290LmFkZENsYXNzKFwicGVyc2lzdGVudFwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgdGhpcy5oaWRlKCk7IH0sIDUwMDApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBoaWRlICgpIHtcclxuICAgICAgICB0aGlzLiRyb290LnNsaWRlVXAoKS5xdWV1ZSgoKSA9PiB7IHRoaXMucmVtb3ZlKCk7IH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZSAoKSB7XHJcbiAgICAgICAgdGhpcy4kcm9vdC5yZW1vdmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRNZXNzYWdlIChtZXNzYWdlKSB7XHJcbiAgICAgICAgdGhpcy4kcm9vdC50ZXh0KG1lc3NhZ2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTWVzc2FnZUxpbmUge1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHRvcGljKXtcclxuICAgICAgICB0aGlzLnRvcGljID0gdG9waWM7XHJcbiAgICAgICAgdGhpcy5jb3VudGVyID0gMDtcclxuICAgICAgICB0aGlzLmlzTmV3ID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIHRoaXMuJHJvb3QgPSAkKFwiPGFydGljbGUgY2xhc3M9J21lc3NhZ2UnPlwiKTtcclxuXHJcbiAgICAgICAgdmFyIGhlYWRlciA9ICQoXCI8aGVhZGVyPlwiKS5hcHBlbmRUbyh0aGlzLiRyb290KTtcclxuXHJcbiAgICAgICAgJChcIjxoMj5cIilcclxuICAgICAgICAgICAgLnRleHQodGhpcy50b3BpYylcclxuICAgICAgICAgICAgLmFwcGVuZFRvKGhlYWRlcik7XHJcblxyXG4gICAgICAgIGlmICh3aW5kb3cuY29uZmlnLnNob3dDb3VudGVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJGNvdW50ZXJNYXJrID0gJChcIjxzcGFuIGNsYXNzPSdtYXJrIGNvdW50ZXInIHRpdGxlPSdNZXNzYWdlIGNvdW50ZXInPjA8L3NwYW4+XCIpXHJcbiAgICAgICAgICAgICAgICAuYXBwZW5kVG8oaGVhZGVyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuJHJldGFpbk1hcmsgPSAkKFwiPHNwYW4gY2xhc3M9J21hcmsgcmV0YWluJyB0aXRsZT0nUmV0YWluIG1lc3NhZ2UnPlI8L3NwYW4+XCIpXHJcbiAgICAgICAgICAgIC5hcHBlbmRUbyhoZWFkZXIpO1xyXG5cclxuICAgICAgICB0aGlzLiRxb3NNYXJrID0gJChcIjxzcGFuIGNsYXNzPSdtYXJrIHFvcycgdGl0bGU9J1JlY2VpdmVkIG1lc3NhZ2UgUW9TJz5Rb1M8L3NwYW4+XCIpXHJcbiAgICAgICAgICAgIC5hcHBlbmRUbyhoZWFkZXIpO1xyXG5cclxuICAgICAgICB0aGlzLiRwYXlsb2FkID0gJChcIjxwPlwiKS5hcHBlbmRUbyh0aGlzLiRyb290KTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgaXNSZXRhaW5lZCh2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuJHJldGFpbk1hcmtbdmFsdWUgPyAnc2hvdycgOiAnaGlkZSddKCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGlzU3lzdGVtUGF5bG9hZCh2YWx1ZSkge1xyXG4gICAgICAgIHRoaXMuJHBheWxvYWQudG9nZ2xlQ2xhc3MoXCJzeXNcIiwgdmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGhpZ2hsaWdodChsaW5lID0gZmFsc2UpIHtcclxuICAgICAgICAobGluZSA/IHRoaXMuJHJvb3QgOiB0aGlzLiRwYXlsb2FkKVxyXG4gICAgICAgICAgICAuc3RvcCgpXHJcbiAgICAgICAgICAgIC5jc3Moe2JhY2tncm91bmRDb2xvcjogXCIjMENCMEZGXCJ9KVxyXG4gICAgICAgICAgICAuYW5pbWF0ZSh7YmFja2dyb3VuZENvbG9yOiBcIiNmZmZcIn0sIDIwMDApO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZShwYXlsb2FkLCByZXRhaW5lZCwgcW9zLCBiaW5hcnkpIHtcclxuICAgICAgICB0aGlzLmNvdW50ZXIgKys7XHJcbiAgICAgICAgdGhpcy5pc1JldGFpbmVkID0gcmV0YWluZWQ7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLiRjb3VudGVyTWFyaykge1xyXG4gICAgICAgICAgICB0aGlzLiRjb3VudGVyTWFyay50ZXh0KHRoaXMuY291bnRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLiRxb3NNYXJrKSB7XHJcbiAgICAgICAgICAgIGlmIChxb3MgPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy4kcW9zTWFyay5oaWRlKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLiRxb3NNYXJrLnNob3coKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuJHFvc01hcmsudGV4dChgUW9TICR7cW9zfWApO1xyXG4gICAgICAgICAgICAgICAgdGhpcy4kcW9zTWFyay5hdHRyKFwiZGF0YS1xb3NcIiwgcW9zKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGJpbmFyeSkgXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwYXlsb2FkID0gXCJIRVg6IFwiICsgZm9ybWF0Qnl0ZUFycmF5KHBheWxvYWQpO1xyXG4gICAgICAgICAgICB0aGlzLmlzU3lzdGVtUGF5bG9hZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2VcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGlmIChwYXlsb2FkID09IFwiXCIpIFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBwYXlsb2FkID0gXCJOVUxMXCI7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzU3lzdGVtUGF5bG9hZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzU3lzdGVtUGF5bG9hZCA9IGZhbHNlOyAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy4kcGF5bG9hZC50ZXh0KHBheWxvYWQpO1xyXG4gICAgICAgIHRoaXMuaGlnaGxpZ2h0KHRoaXMuaXNOZXcpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5pc05ldykge1xyXG4gICAgICAgICAgICB0aGlzLmlzTmV3ID0gZmFsc2U7XHJcbiAgICAgICAgfSAgICAgICBcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0Qnl0ZUFycmF5KGEpIHtcclxuICAgIHZhciBhMiA9IG5ldyBBcnJheShhLmxlbmd0aCk7XHJcblxyXG4gICAgZm9yKHZhciBpID0gYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgIGEyW2ldID0gKChhW2ldIDw9IDB4MEYpID8gXCIwXCIgOiBcIlwiKSArIGFbaV0udG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGEyLmpvaW4oXCIgXCIpO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTWVzc2FnZUNvbnRhaW5lciB7XHJcblxyXG4gICAgY29uc3RydWN0b3IoJHBhcmVudCkge1xyXG4gICAgICAgIHRoaXMuc29ydCA9ICdBbHBoYWJldGljYWxseSc7XHJcbiAgICAgICAgdGhpcy4kcGFyZW50ID0gJHBhcmVudDtcclxuICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgIH1cclxuXHJcbiAgICBpbml0KCkge1xyXG4gICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmxpbmVzID0ge307XHJcbiAgICAgICAgdGhpcy50b3BpY3MgPSBbXTtcclxuICAgICAgICB0aGlzLiRwYXJlbnQuaHRtbChcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUgKHRvcGljLCBwYXlsb2FkLCByZXRhaW5lZCwgcW9zLCBiaW5hcnkpIHtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmxpbmVzW3RvcGljXSkge1xyXG5cclxuICAgICAgICAgICAgdmFyIGxpbmUgPSBuZXcgTWVzc2FnZUxpbmUodG9waWMsIHRoaXMuJHBhcmVudCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzW2BhZGRMaW5lJHt0aGlzLnNvcnR9YF0obGluZSk7XHJcbiAgICAgICAgICAgIHRoaXMubGluZXNbdG9waWNdID0gbGluZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMubGluZXNbdG9waWNdLnVwZGF0ZShwYXlsb2FkLCByZXRhaW5lZCwgcW9zLCBiaW5hcnkpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZExpbmVBbHBoYWJldGljYWxseSAobGluZSkge1xyXG5cclxuICAgICAgICBpZiAodGhpcy50b3BpY3MubGVuZ3RoID09IDApIFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdGhpcy5hZGRMaW5lQ2hyb25vbG9naWNhbGx5KGxpbmUpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgdG9waWMgPSBsaW5lLnRvcGljO1xyXG5cclxuICAgICAgICB0aGlzLnRvcGljcy5wdXNoKHRvcGljKTtcclxuICAgICAgICB0aGlzLnRvcGljcy5zb3J0KCk7XHJcblxyXG4gICAgICAgIHZhciBuID0gdGhpcy50b3BpY3MuaW5kZXhPZih0b3BpYyk7XHJcblxyXG4gICAgICAgIGlmIChuID09IDApe1xyXG4gICAgICAgICAgICB0aGlzLiRwYXJlbnQucHJlcGVuZChsaW5lLiRyb290KTtcclxuICAgICAgICAgICAgcmV0dXJuOyAgICBcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBwcmV2ID0gdGhpcy50b3BpY3NbbiAtIDFdO1xyXG4gICAgICAgIGxpbmUuJHJvb3QuaW5zZXJ0QWZ0ZXIodGhpcy5saW5lc1twcmV2XS4kcm9vdCk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkTGluZUNocm9ub2xvZ2ljYWxseSAobGluZSkge1xyXG4gICAgICAgIHRoaXMudG9waWNzLnB1c2gobGluZS50b3BpYyk7XHJcbiAgICAgICAgdGhpcy4kcGFyZW50LmFwcGVuZChsaW5lLiRyb290KTtcclxuICAgIH1cclxufVxyXG5cclxuTWVzc2FnZUNvbnRhaW5lci5TT1JUX0FQTEhBID0gXCJBbHBoYWJldGljYWxseVwiO1xyXG5NZXNzYWdlQ29udGFpbmVyLlNPUlRfQ0hST05PID0gXCJDaHJvbm9sb2dpY2FsbHlcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBGb290ZXIge1xyXG5cclxuICAgIHNldCBjbGllbnRJZCh2YWx1ZSkge1xyXG4gICAgICAgICQoXCIjc3RhdHVzLWNsaWVudFwiKS50ZXh0KHZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgdXJpKHZhbHVlKSB7XHJcbiAgICAgICAgJChcIiNzdGF0dXMtaG9zdFwiKS50ZXh0KHZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXQgc3RhdGUodmFsdWUpIHtcclxuICAgICAgICBsZXQgdGV4dCwgY2xhc3NOYW1lO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgV2FsbENsaWVudC5TVEFURS5ORVc6XHJcbiAgICAgICAgICAgICAgICB0ZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZSA9IFwiY29ubmVjdGluZ1wiO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgV2FsbENsaWVudC5TVEFURS5DT05ORUNUSU5HOlxyXG4gICAgICAgICAgICAgICAgdGV4dCA9IFwiY29ubmVjdGluZy4uLlwiO1xyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lID0gXCJjb25uZWN0aW5nXCI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSBXYWxsQ2xpZW50LlNUQVRFLkNPTk5FQ1RFRDpcclxuICAgICAgICAgICAgICAgIHRleHQgPSBcImNvbm5lY3RlZFwiO1xyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lID0gXCJjb25uZWN0ZWRcIjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFdhbGxDbGllbnQuU1RBVEUuUkVDT05ORUNUSU5HOlxyXG4gICAgICAgICAgICAgICAgdGV4dCA9IFwicmVjb25uZWN0aW5nLi4uXCI7XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWUgPSBcImNvbm5lY3RpbmdcIjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIFdhbGxDbGllbnQuU1RBVEUuRVJST1I6XHJcbiAgICAgICAgICAgICAgICB0ZXh0ID0gXCJub3QgY29ubmVjdGVkXCI7XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWUgPSBcImZhaWxcIjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBXYWxsQ2xpZW50LlNUQVRFXCIpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA+IDEpIHtcclxuICAgICAgICAgICAgdGV4dCArPSBgICgke3RoaXMucmVjb25uZWN0QXR0ZW1wdHN9KWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAkKFwiI3N0YXR1cy1zdGF0ZVwiKS5yZW1vdmVDbGFzcygpLmFkZENsYXNzKGNsYXNzTmFtZSk7XHJcbiAgICAgICAgJChcIiNzdGF0dXMtc3RhdGUgc3BhblwiKS50ZXh0KHRleHQpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgVG9vbGJhciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG4gICAgY29uc3RydWN0b3IgKHBhcmVudCkge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy4kcGFyZW50ID0gcGFyZW50O1xyXG4gICAgICAgIHRoaXMuJHRvcGljID0gcGFyZW50LmZpbmQoXCIjdG9waWNcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pbml0RXZlbnRIYW5kbGVycygpO1xyXG4gICAgICAgIHRoaXMuaW5pdERlZmF1bHRUb3BpYygpO1xyXG4gICAgfVxyXG5cclxuICAgIGluaXRFdmVudEhhbmRsZXJzICgpIHtcclxuICAgICAgICBsZXQgaW5oaWJpdG9yID0gZmFsc2U7XHJcblxyXG4gICAgICAgIHRoaXMuJHRvcGljLmtleXVwKChlKSA9PiB7XHJcbiAgICAgICAgICAgIGlmKGUud2hpY2ggPT09IDEzKSB7IC8vIEVOVEVSXHJcbiAgICAgICAgICAgICAgICB0aGlzLiR0b3BpYy5ibHVyKCk7XHJcbiAgICAgICAgICAgIH0gIFxyXG5cclxuICAgICAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gMjcpIHsgLy8gRVNDXHJcbiAgICAgICAgICAgICAgICBpbmhpYml0b3IgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgdGhpcy4kdG9waWMuYmx1cigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuJHRvcGljLmZvY3VzKChlKSA9PiB7XHJcbiAgICAgICAgICAgIGluaGliaXRvciA9IGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLiR0b3BpYy5ibHVyKChlKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChpbmhpYml0b3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVWkoKTsgLy8gcmV2ZXJ0IGNoYW5nZXNcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuaW5wdXRDaGFuZ2VkKCk7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaW5wdXRDaGFuZ2VkICgpIHtcclxuICAgICAgICB2YXIgbmV3VG9waWMgPSB0aGlzLiR0b3BpYy52YWwoKTsgXHJcblxyXG4gICAgICAgIGlmIChuZXdUb3BpYyA9PT0gdGhpcy5fdG9waWMpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fdG9waWMgPSBuZXdUb3BpYztcclxuICAgICAgICB0aGlzLmVtaXQoXCJ0b3BpY1wiLCBuZXdUb3BpYyk7XHJcbiAgICB9IFxyXG5cclxuICAgIGluaXREZWZhdWx0VG9waWMgKCkge1xyXG4gICAgICAgIC8vIFVSTCBoYXNoIFxyXG4gICAgICAgIGlmIChsb2NhdGlvbi5oYXNoICE9PSBcIlwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3RvcGljID0gbG9jYXRpb24uaGFzaC5zdWJzdHIoMSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5fdG9waWMgPSBjb25maWcuZGVmYXVsdFRvcGljIHx8IFwiLyNcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlVWkoKTtcclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGVVaSAoKSB7XHJcbiAgICAgICAgdGhpcy4kdG9waWMudmFsKHRoaXMuX3RvcGljKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXQgdG9waWMgKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl90b3BpYztcclxuICAgIH1cclxuXHJcbiAgICBzZXQgdG9waWMgKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy5fdG9waWMgPSB2YWx1ZTtcclxuICAgICAgICB0aGlzLnVwZGF0ZVVpKCk7XHJcbiAgICAgICAgdGhpcy5lbWl0KFwidG9waWNcIiwgdmFsdWUpO1xyXG4gICAgfVxyXG59IiwiLyoqXHJcbiAqIFNpbXBsZSB2ZXJzaW9uIG9mIG5vZGUuanMncyBFdmVudEVtaXRlciBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEV2ZW50RW1pdHRlciB7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogQWRkIGV2ZW50IGhhbmRsZXIgb2YgZ2l2ZW50IHR5cGVcclxuICAgICAqL1xyXG4gICAgb24gKHR5cGUsIGZuKSB7XHJcbiAgICAgICAgaWYgKHRoaXNbJ19vbicgKyB0eXBlXSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHRoaXNbJ19vbicgKyB0eXBlXSA9IFtdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpc1snX29uJyArIHR5cGVdLnB1c2goZm4pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRW1pdCBldmVudCBvZiB0eXBlLlxyXG4gICAgICogXHJcbiAgICAgKiBBbGwgYXJndW1lbnRzIHdpbGwgYmUgYXBwbGF5IHRvIGNhbGxiYWNrLCBwcmVzZXJ2ZSBjb250ZXh0IG9mIG9iamVjdCB0aGlzLlxyXG4gICAgICovXHJcbiAgICBlbWl0ICh0eXBlLCAuLi5hcmdzKSB7XHJcbiAgICAgICAgaWYgKHRoaXNbJ19vbicgKyB0eXBlXSkge1xyXG4gICAgICAgICAgICB0aGlzWydfb24nICsgdHlwZV0uZm9yRWFjaCgoZm4pID0+IGZuLmFwcGx5KHRoaXMsIGFyZ3MpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn0gXHJcbiIsImltcG9ydCB7V2FsbENsaWVudH0gZnJvbSAnLi9jbGllbnQuanMnO1xyXG5pbXBvcnQge1VJLCBNZXNzYWdlTGluZSwgTWVzc2FnZUNvbnRhaW5lciwgRm9vdGVyLCBUb29sYmFyfSBmcm9tIFwiLi91aS5qc1wiO1xyXG5cclxuLy8gLS0tIE1haW4gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLy8gZGVjb2RlIHBhc3N3b3JkIGJhc2U2NCAoaWYgZW1wdHkgbGV2ZSBpdClcclxubGV0IHBhc3N3b3JkID0gY29uZmlnLnNlcnZlci5wYXNzd29yZCAhPT0gdW5kZWZpbmVkID8gYXRvYihjb25maWcuc2VydmVyLnBhc3N3b3JkKSA6IHVuZGVmaW5lZDtcclxuXHJcbmxldCBjbGllbnQgPSBuZXcgV2FsbENsaWVudChjb25maWcuc2VydmVyLnVyaSwgY29uZmlnLnNlcnZlci51c2VybmFtZSwgcGFzc3dvcmQsIGNvbmZpZy5xb3MpO1xyXG5sZXQgbWVzc2FnZXMgPSBuZXcgTWVzc2FnZUNvbnRhaW5lcigkKFwic2VjdGlvbi5tZXNzYWdlc1wiKSk7XHJcbmxldCBmb290ZXIgPSBuZXcgRm9vdGVyKCk7XHJcbmxldCB0b29sYmFyID0gbmV3IFRvb2xiYXIoJChcIiNoZWFkZXJcIikpO1xyXG5cclxubWVzc2FnZXMuc29ydCA9IGNvbmZpZy5hbHBoYWJldGljYWxTb3J0ID8gTWVzc2FnZUNvbnRhaW5lci5TT1JUX0FQTEhBIDogTWVzc2FnZUNvbnRhaW5lci5TT1JUX0NIUk9OTztcclxuXHJcbmZvb3Rlci5jbGllbnRJZCA9IGNsaWVudC5jbGllbnRJZDtcclxuZm9vdGVyLnVyaSA9IGNsaWVudC50b1N0cmluZygpO1xyXG5mb290ZXIuc3RhdGUgPSAwO1xyXG5cclxuZnVuY3Rpb24gbG9hZCgpIHtcclxuICAgIGxldCB0b3BpYyA9IHRvb2xiYXIudG9waWM7XHJcblxyXG4gICAgY2xpZW50LnN1YnNjcmliZSh0b3BpYywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIFVJLnNldFRpdGxlKHRvcGljKTtcclxuICAgICAgICBsb2NhdGlvbi5oYXNoID0gXCIjXCIgKyB0b3BpYztcclxuICAgIH0pO1xyXG5cclxuICAgIG1lc3NhZ2VzLnJlc2V0KCk7XHJcbn1cclxuXHJcbnRvb2xiYXIub24oXCJ0b3BpY1wiLCAoKSA9PiB7XHJcbiAgICBsb2FkKCk7XHJcbn0pO1xyXG5cclxuY2xpZW50Lm9uQ29ubmVjdGVkID0gKCkgPT4ge1xyXG4gICAgbG9hZCgpO1xyXG4gICAgVUkudG9hc3QoXCJDb25uZWN0ZWQgdG8gaG9zdCBcIiArIGNsaWVudC50b1N0cmluZygpKTtcclxufTtcclxuXHJcbmNsaWVudC5vbkVycm9yID0gKGRlc2NyaXB0aW9uLCBpc0ZhdGFsKSA9PiB7XHJcbiAgICBVSS50b2FzdChkZXNjcmlwdGlvbiwgXCJlcnJvclwiLCBpc0ZhdGFsKTtcclxufTtcclxuXHJcbmxldCByZWNvbm5lY3RpbmdUb2FzdCA9IG51bGw7XHJcblxyXG5jbGllbnQub25TdGF0ZUNoYW5nZWQgPSAoc3RhdGUpID0+IHtcclxuICAgIGZvb3Rlci5yZWNvbm5lY3RBdHRlbXB0cyA9IGNsaWVudC5hdHRlbXB0cztcclxuICAgIGZvb3Rlci5zdGF0ZSA9IHN0YXRlO1xyXG5cclxuICAgIGlmICgoc3RhdGUgPT09IFdhbGxDbGllbnQuU1RBVEUuQ09OTkVDVElORyB8fCBzdGF0ZSA9PT0gV2FsbENsaWVudC5TVEFURS5SRUNPTk5FQ1RJTkcpICYmIGNsaWVudC5hdHRlbXB0cyA+PSAyKSB7XHJcbiAgICAgICAgbGV0IG1zZyA9IHN0YXRlID09PSBXYWxsQ2xpZW50LlNUQVRFLkNPTk5FQ1RJTkcgP1xyXG4gICAgICAgICAgICBgRmFpbCB0byBjb25uZWN0LiBUcnlpbmcgdG8gY29ubmVjdC4uLiAoJHtjbGllbnQuYXR0ZW1wdHN9IGF0dGVtcHRzKWA6XHJcbiAgICAgICAgICAgIGBDb25uZWN0aW9uIGxvc3QuIFRyeWluZyB0byByZWNvbm5lY3QuLi4gKCR7Y2xpZW50LmF0dGVtcHRzfSBhdHRlbXB0cylgO1xyXG5cclxuICAgICAgICBpZiAocmVjb25uZWN0aW5nVG9hc3QgPT09IG51bGwpe1xyXG4gICAgICAgICAgICByZWNvbm5lY3RpbmdUb2FzdCA9IFVJLnRvYXN0KG1zZywgXCJlcnJvclwiLCB0cnVlKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZWNvbm5lY3RpbmdUb2FzdC5zZXRNZXNzYWdlKG1zZyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChzdGF0ZSA9PT0gV2FsbENsaWVudC5TVEFURS5DT05ORUNURUQgJiYgcmVjb25uZWN0aW5nVG9hc3QgIT09IG51bGwpIHtcclxuICAgICAgICByZWNvbm5lY3RpbmdUb2FzdC5oaWRlKCk7XHJcbiAgICAgICAgcmVjb25uZWN0aW5nVG9hc3QgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoY2xpZW50LmZpcnN0Q29ubmVjdGlvbiA9PSBmYWxzZSkge1xyXG4gICAgICAgICAgICBVSS50b2FzdChcIlJlY29ubmVjdGVkXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuY2xpZW50Lm9uTWVzc2FnZSA9ICh0b3BpYywgbXNnLCByZXRhaW5lZCwgcW9zLCBiaW5hcnkpID0+IHtcclxuICAgIG1lc3NhZ2VzLnVwZGF0ZSh0b3BpYywgbXNnLCByZXRhaW5lZCwgcW9zLCBiaW5hcnkpO1xyXG59O1xyXG5cclxuY2xpZW50LmNvbm5lY3QoKTtcclxuIl19
