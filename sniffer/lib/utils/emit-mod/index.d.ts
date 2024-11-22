import NodeEventEmitter from "events";

export interface IWaitForOptions<F extends unknown[]> {
	/**
	 * The maximum time (in milliseconds) to wait for the event.
	 */
	timeout?: number;
	/**
	 * The condition to resolve the event.
	 *
	 * If this condition returns false, the waiter continues to wait until the next event or
	 * timeout, whichever first.
	 */
	condition?: (...args: F) => boolean;
}

type ListenerSignature<L> = {
	[E in keyof L]: (...args: any[]) => any;
};

export class EventEmitter<
	L extends ListenerSignature<L> = {
		[k: string]: (...args: any[]) => any;
	},
> extends NodeEventEmitter {
	addListener<U extends keyof L>(eventName: U, listener: L[U]): this;
	prependListener<U extends keyof L>(eventName: U, listener: L[U]): this;
	prependOnceListener<U extends keyof L>(eventName: U, listener: L[U]): this;
	removeListener<U extends keyof L>(eventName: U, listener: L[U]): this;
	removeAllListeners(eventName?: keyof L): this;
	once<U extends keyof L>(eventName: U, listener: L[U]): this;
	on<U extends keyof L>(eventName: U, listener: L[U]): this;
	off<U extends keyof L>(eventName: U, listener: L[U]): this;
	emit<U extends keyof L>(eventName: U, ...args: Parameters<L[U]>): boolean;
	eventNames<U extends keyof L>(): U[];
	listenerCount(type: keyof L): number;
	listeners<U extends keyof L>(type: U): L[U][];
	rawListeners<U extends keyof L>(type: U): L[U][];
	getMaxListeners(): number;
	setMaxListeners(n: number): this;
	/**
	 * Emit listeners safely without synchronous exceptions thrown (async listeners are still
	 * subject to usual `EventEmitter` behaviour). Exceptions are sent the same way as
     * exceptions from async listeners (`error` event, or rejetion symbol if defined).
	 * If `eventName` is `"error"`, any exceptions are logged via `process.emitWarning()`.
	 */
	emitSafe<U extends keyof L>(eventName: U, ...args: Parameters<L[U]>): boolean;
	/**
	 * Creates a `Promise` that resolves when an listener of matching `condition` fires. Recommended
	 * to set a `timeout` value and handle the exception to avoid memory leaks due to listeners that
	 * will never be fired.
	 * @throws On timeout
	 */
	waitFor<U extends keyof L>(
		eventName: U,
		options?: IWaitForOptions<Parameters<L[U]>>,
	): Promise<Parameters<L[U]>>;
}
