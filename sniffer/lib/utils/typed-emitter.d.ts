import EventEmitter2, { OnOptions, CancelablePromise } from "eventemitter2";

/// From `tiny-typed-emitter` package. Modified type declaration to extend `emittery`.

export type ListenerSignature<L> = {
	[E in keyof L]: (...args: any[]) => any;
};

export type DefaultListener = {
	[k: string]: (...args: any[]) => any;
};

export class TypedEmitter<L extends ListenerSignature<L> = DefaultListener> extends EventEmitter2 {
    emit<U extends keyof L>(event: U, ...args: Parameters<L[U]>): boolean;
    emitAsync(event: event | eventNS, ...values: any[]): Promise<any[]>;
    addListener<U extends keyof L>(event: U, listener: L[U]): this;
    
    on<U extends keyof L>(event: U, listener: L[U], options: {objectify: true} & OnOptions): Listener;
    on<U extends keyof L>(event: U, listener: L[U], options?: boolean|OnOptions): this;

    once<U extends keyof L>(event: U, listener: L[U], options: {objectify: true} & OnOptions): Listener;
    once<U extends keyof L>(event: U, listener: L[U], options?: boolean|OnOptions): this;

    many<U extends keyof L>(event: U, timesToListen: number, listener: L[U], options: {objectify: true} & OnOptions): Listener;
    many<U extends keyof L>(event: U, timesToListen: number, listener: L[U], options?: boolean|OnOptions): this;

    removeListener<U extends keyof L>(event: U, listener: L[U]): this;

    off<U extends keyof L>(event: U, listener: L[U]): this;

    removeAllListeners(event?: keyof L): this;
    
    eventNames<U extends keyof L>(): U[];

    listenerCount(event: keyof L): number;

    listeners<U extends keyof L>(event: U): L[U][];

    waitFor<U extends keyof L>(event: U, timeout?: number): CancelablePromise<any[]>
    waitFor<U extends keyof L>(event: U, filter?: WaitForFilter): CancelablePromise<any[]>
    waitFor<U extends keyof L>(event: U, options?: WaitForOptions): CancelablePromise<any[]>

    hasListeners<U extends keyof L>(event?: U): Boolean
}
