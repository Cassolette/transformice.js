"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// From `tiny-typed-emitter` package. Modified to use `emittery` instead.
const TypedEmitter = require("eventemitter2");

// Inject to promisify by default
const originalOn = TypedEmitter.prototype._on;
TypedEmitter.prototype._on = function (type, listener, prepend, options) {
	if (options === false) {
		options = {
			async: true,
			promisify: true,
		};
	} else {
		if (typeof options !== "object") {
			options = {};
		}
		if (options.promisify !== false) {
			// null, undefined, etc become true
			options.promisify = true;
		}
	}
	return originalOn.call(this, type, listener, prepend, options);
};

exports.TypedEmitter = TypedEmitter;
