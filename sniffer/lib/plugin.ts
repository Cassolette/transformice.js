import { ByteArrayFactory, Connection, ConnectionEvents, Host } from "./connection";
import { type Session, type SessionEvents } from "./sniffer";
import { EventEmitter } from "./utils/emit-mod";

export interface SessionProxyEvents {
	packetReceived: (connection: ConnectionProxy, packetFactory: ByteArrayFactory) => void;
	packetSent: (
		connection: ConnectionProxy,
		packetFactory: ByteArrayFactory,
		fingerprint: number,
	) => void;
	/**
	 * Emitted when a connection with the game server (bulle) is established.
	 */
	bulleConnect: (connection: ConnectionProxy, changedFrom?: ConnectionProxy) => void;
	closed: () => void;
	error: (e: Error) => void;
}

/**
 * Proxy to `Session` that only exists for the lifetime of the user plugin.
 */
export class SessionProxy extends EventEmitter<SessionProxyEvents> {
	private subscriptions: { eventName: string; listener: (...args: any) => void }[] = [];
	private mapConnectionToProxy: Map<Connection, ConnectionProxy> = new Map();
	private isConnected: boolean = false;

	#main: ConnectionProxy;
	#bulle?: ConnectionProxy;

	constructor(private session: Session) {
		super();

		this.#main = new ConnectionProxy(this.session.main);
		this.mapConnectionToProxy.set(this.session.main, this.#main);
		if (this.session.bulle) {
			this.#bulle = new ConnectionProxy(this.session.bulle);
			this.mapConnectionToProxy.set(this.session.bulle, this.#bulle);
		}

		this.connect();
	}

	/**
	 * Subscribe to `Session` events only for the lifetime of this proxy. Clears all subscriptions on `close()`.
	 */
	private subscribe<E extends keyof SessionEvents>(eventName: E, listener: SessionEvents[E]) {
		this.session.on(eventName, listener);
		this.subscriptions.push({ eventName, listener });
	}

	private connect() {
		this.subscribe("bulleConnect", (conn, changedFrom) => {
			const proxy = new ConnectionProxy(conn);
			this.mapConnectionToProxy.set(conn, proxy);
			if (changedFrom) {
				this.mapConnectionToProxy.delete(changedFrom);
			}
			this.#bulle = proxy;
			this.emitSafe(
				"bulleConnect",
				proxy,
				changedFrom ? this.mapConnectionToProxy.get(changedFrom) : undefined,
			);
		});

		for (const evt of ["packetReceived", "packetSent", "error"] as (keyof SessionEvents)[]) {
			const listener =
				evt === "packetReceived" || evt === "packetSent"
					? (connection: Connection, ...args: any) => {
							const proxy = this.mapConnectionToProxy.get(connection);
							if (proxy) {
								// @ts-ignore
								this.emitSafe(evt, proxy, ...args);
							} else {
								this.emitSafe(
									"error",
									new Error(
										`Could not find a proxy to Connection: ${connection}`,
									),
								);
							}
						}
					: (...args: any) => {
							this.emitSafe(evt, ...args);
						};
			this.subscribe(evt, listener);
		}
		this.subscribe("closed", this.close.bind(this));
		this.isConnected = true;
	}

	/**
	 * Disconnects proxy from the actual Session. Does not actually close the `Session`.
	 */
	close() {
		if (!this.isConnected) {
			return;
		}
		// Remove subscriptions from Session.
		for (const subsc of this.subscriptions) {
			this.session.removeListener(subsc.eventName as keyof SessionEvents, subsc.listener);
		}
		this.isConnected = false;
		this.emitSafe("closed");
	}

	get main() {
		return this.#main;
	}
	get bulle() {
		return this.#bulle;
	}
	get active() {
		return this.isConnected && this.session.active;
	}
}

// export interface ConnectionProxyEvents {
// 	closed: () => void;
// 	error: (e: Error) => void;
// }

/**
 * Proxy to `Connection`.
 */
export class ConnectionProxy /*extends EventEmitter<ConnectionProxyEvents>*/ {
	private subscriptions: { eventName: string; listener: (...args: any) => void }[] = [];
	private isConnected: boolean = false;

	constructor(private connection: Connection) {
		//super();
		this.connect();
	}

	/**
	 * Subscribe to `Connection` events only for the lifetime of this proxy. Clears all subscriptions on `close()`.
	 */
	private subscribe<E extends keyof ConnectionEvents>(
		eventName: E,
		listener: ConnectionEvents[E],
	) {
		this.connection.on(eventName, listener);
		this.subscriptions.push({ eventName, listener });
	}

	private connect() {
		this.isConnected = true;
	}

	get active() {
		return this.isConnected && this.connection.active;
	}

	get client() {
		return new Host(this.connection.client.addr, this.connection.client.port);
	}

	get server() {
		return new Host(this.connection.server.addr, this.connection.server.port);
	}
}

export interface UserPlugin {
	eventNewSession?: (session: SessionProxy) => void;
}
