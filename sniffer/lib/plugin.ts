import { type Session, type SessionEvents } from "./sniffer";
import { EventEmitter } from "./utils/emit-mod";

/**
 * Proxy to `Session` that only exists for the lifetime of the user plugin.
 */
export class SessionProxy extends EventEmitter<SessionEvents> {
	private proxyListeners: { [eventName: string]: (...args: any) => void } = {};
	private isConnected: boolean = false;

	constructor(private session: Session) {
		super();
		this.connect();
	}

	private connect() {
		for (const evt of [
			"bulleConnect",
			"packetReceived",
			"packetSent",
			"error",
		] as (keyof SessionEvents)[]) {
			const listener = (...args: any) => {
				this.emitSafe(evt, ...args);
			};
			this.proxyListeners[evt] = listener;
			this.session.on(evt, listener);
		}
		const close = this.close.bind(this);
		this.proxyListeners["closed"] = close;
		this.session.once("closed", close);

		this.isConnected = true;
	}

	/**
	 * Disconnects proxy from the actual Session. Does not actually close the `Session`.
	 */
	close() {
		if (!this.isConnected) {
			return;
		}
		for (const evt in this.proxyListeners) {
			this.session.removeListener(evt as keyof SessionEvents, this.proxyListeners[evt]);
		}
		this.isConnected = false;
		this.emitSafe("closed");
	}

	// tbc connection proxy
	get main() {
		return this.session.main;
	}
	get bulle() {
		return this.session.bulle;
	}
	get active() {
		return this.isConnected && this.session.active;
	}
}

export interface UserPlugin {
	eventNewSession?: (session: SessionProxy) => void;
}
