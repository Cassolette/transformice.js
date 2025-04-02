import { EventEmitter as NodeEventEmitter, captureRejectionSymbol } from "events";
import { type On2Options } from "../index";

export class EventEmitter extends NodeEventEmitter {
	constructor() {
		super({ captureRejections: true });
	}

	on2(eventName: string | symbol, listener: () => any, options?: On2Options) {
		const _ = this.on(eventName, listener);
		if (options?.signal) {
			options.signal.addEventListener("abort", () => {
				this.off(eventName, listener);
			}, { once: true });
		}
		return _;
	}

	/**
	 * Emit listeners safely without synchronous exceptions thrown (async listeners are still subject to usual `EventEmitter` behaviour).
	 * Exceptions are sent the same way as exceptions from async listeners (`error` event, or rejetion symbol if defined).
	 * If `eventName` is `"error"`, any exceptions are logged via `process.emitWarning()`.
	 */
	emitSafe(eventName: string | symbol, ...args: any[]): boolean {
		let ret = false;
		if (eventName !== "error") {
			try {
				ret = this.emit(eventName, ...args);
			} catch (e) {
				const rejectionViaSymbol = this[captureRejectionSymbol];
				if (typeof rejectionViaSymbol === "function") {
					rejectionViaSymbol(e as Error, eventName, ...args);
				} else {
					this.emitSafe("error", e);
				}
			}
		} else {
			try {
				ret = this.emit(eventName, ...args);
			} catch (e) {
				process.emitWarning(
					new Error(
						`While emitting an error event safely, an error handler threw exception synchronously.\nError handler exception: ${e?.toString()}\nError handler arg: ${args[0]?.toString()}`,
					),
				);
			}
		}
		return ret;
	}

	/**
	 * Creates a `Promise` that resolves when an listener of matching `condition` fires. Recommended to set a `timeout` value and handle the exception to avoid memory leaks due to listeners that will never be fired.
	 * @throws On timeout
	 */
	waitFor(
		eventName: string | symbol,
		options?: { timeout?: number; condition: (...args: any[]) => boolean },
	): Promise<any[]> {
		return new Promise((resolve, reject) => {
			var timer: ReturnType<typeof setTimeout> | undefined;
			const listener = (...args: any) => {
				if (options?.condition && options.condition(...args) !== true) {
					return;
				}
				if (timer) {
					clearTimeout(timer);
				}
				this.off(eventName, listener);
				resolve(args);
			};
			this.on(eventName as string | symbol, listener);

			const timeout = options?.timeout;
			if (timeout) {
				timer = setTimeout(() => {
					this.off(eventName as string | symbol, listener);
					reject(`Timed out after ${timeout}ms`);
				}, timeout);
			}
		});
	}
}
