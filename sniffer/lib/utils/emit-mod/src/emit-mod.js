"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventEmitter = void 0;
const events_1 = require("events");
class EventEmitter extends events_1.EventEmitter {
    constructor() {
        super({ captureRejections: true });
    }
    /**
     * Emit listeners safely without synchronous exceptions thrown (async listeners are still subject to usual `EventEmitter` behaviour).
     * Exceptions are sent the same way as exceptions from async listeners (`error` event, or rejetion symbol if defined).
     * If `eventName` is `"error"`, any exceptions are logged via `process.emitWarning()`.
     */
    emitSafe(eventName, ...args) {
        var _a;
        let ret = false;
        if (eventName !== "error") {
            try {
                ret = this.emit(eventName, ...args);
            }
            catch (e) {
                const rejectionViaSymbol = this[events_1.captureRejectionSymbol];
                if (typeof rejectionViaSymbol === "function") {
                    rejectionViaSymbol(e, eventName, ...args);
                }
                else {
                    this.emitSafe("error", e);
                }
            }
        }
        else {
            try {
                ret = this.emit(eventName, ...args);
            }
            catch (e) {
                process.emitWarning(new Error(`While emitting an error event safely, an error handler threw exception synchronously.\nError handler exception: ${e === null || e === void 0 ? void 0 : e.toString()}\nError handler arg: ${(_a = args[0]) === null || _a === void 0 ? void 0 : _a.toString()}`));
            }
        }
        return ret;
    }
    /**
     * Creates a `Promise` that resolves when an listener of matching `condition` fires. Recommended to set a `timeout` value and handle the exception to avoid memory leaks due to listeners that will never be fired.
     * @throws On timeout
     */
    waitFor(eventName, options) {
        return new Promise((resolve, reject) => {
            var timer;
            const listener = (...args) => {
                if ((options === null || options === void 0 ? void 0 : options.condition) && options.condition(...args) !== true) {
                    return;
                }
                if (timer) {
                    clearTimeout(timer);
                }
                this.off(eventName, listener);
                resolve(args);
            };
            this.on(eventName, listener);
            const timeout = options === null || options === void 0 ? void 0 : options.timeout;
            if (timeout) {
                timer = setTimeout(() => {
                    this.off(eventName, listener);
                    reject(`Timed out after ${timeout}ms`);
                }, timeout);
            }
        });
    }
}
exports.EventEmitter = EventEmitter;
