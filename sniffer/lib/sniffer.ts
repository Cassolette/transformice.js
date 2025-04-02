import { ByteArray, Client, IdentifierSplit } from "@cheeseformice/transformice.js";
import { BulleIdentifier } from "@cheeseformice/transformice.js/dist/enums";
import { EventEmitter } from "./utils/emit-mod";
import {
	ByteArrayFactory,
	Connection,
	ConnectionScanner,
	type ConnectionScannerEvents,
	Scanner,
} from "./connection";

export interface SessionEvents {
	packetReceived: (connection: Connection, packetFactory: ByteArrayFactory) => void;
	packetSent: (
		connection: Connection,
		packetFactory: ByteArrayFactory,
		fingerprint: number,
	) => void;
	/**
	 * Emitted when a connection with the game server (bulle) is established.
	 */
	bulleConnect: (connection: Connection, changedFrom?: Connection) => void;
	closed: () => void;
	error: (e: any) => void;
}

class Session extends EventEmitter<SessionEvents> {
	public bulle?: Connection;
	public active: boolean;

	constructor(
		public sniffer: Sniffer,
		public main: Connection,
	) {
		super();
		if (!main.active) {
			throw new Error("Tried to create new session with a dead main connection.");
		}
		this.active = true;

		main.on("packetSent", (packetFactory) => {
			const packetMinusFp = packetFactory.create();
			const fp = packetMinusFp.readByte();
			this.emitSafe("packetSent", main, new ByteArrayFactory(packetMinusFp), fp);
		});
		main.on("packetReceived", (packetFactory) => {
			this.handlePacketReceived(main, packetFactory.create());
			this.emitSafe("packetReceived", main, packetFactory);
		});
		main.on("closed", () => {
			this.active = false;
			this.emitSafe("closed");
			main.removeAllListeners();
		});
	}

	protected async handlePacketReceived(conn: Connection, packet: ByteArray) {
		try {
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			//console.log("error readCode", e);
			return;
		}

		if (ccc == BulleIdentifier.bulleConnection && conn == this.main) {
			const timestamp = packet.readUnsignedInt();
			const playerId = packet.readUnsignedInt();
			const pcode = packet.readUnsignedInt();
			const hostIp = packet.readUTF();
			packet.readUTF(); // ports

			const bulleScannerTask = this.sniffer.scanner.task(hostIp);
			const bulleScanner = new ConnectionScanner(bulleScannerTask);
			bulleScanner.start();

			const [bulle, _] = await bulleScanner.waitFor("packetSent", {
				timeout: 20000,
				condition: (_, packetFactory) => {
					const packet = packetFactory.create();
					try {
						packet.readByte(); // fp
						var ccc = packet.readUnsignedShort();
					} catch (e) {
						return false;
					}
					//console.log("bsend", IdentifierSplit(ccc));
					if (ccc == BulleIdentifier.bulleConnection) {
						const bTimestamp = packet.readUnsignedInt();
						const bPlayerId = packet.readUnsignedInt();
						const bPcode = packet.readUnsignedInt();
						return (
							bTimestamp === timestamp && bPlayerId === playerId && bPcode === pcode
						);
					}
					return false;
				},
			});

			const prevBulle = this.bulle;
			prevBulle?.close();

			this.bulle = bulle;
			bulle.on("packetSent", (packetFactory) => {
				const packetMinusFp = packetFactory.create();
				const fp = packetMinusFp.readByte();
				this.emitSafe("packetSent", bulle, new ByteArrayFactory(packetMinusFp), fp);
			});
			bulle.on("packetReceived", (packet) => {
				this.emitSafe("packetReceived", bulle, packet);
			});
			bulle.once("closed", () => {
				bulle.removeAllListeners();
				this.bulle = undefined;
			});
			this.emitSafe("bulleConnect", bulle, prevBulle);
		}
	}
}

export type { Session };

export class Sniffer extends EventEmitter<{
	newSession: (session: Session) => void;
	//packetReceivedWithoutSession: (connection: Connection, packet: ByteArray) => void;
	//packetSentWithoutSession: (connection: Connection, packet: ByteArray) => void;
	error: (e: any) => void;
}> {
	scanner: Scanner;
	mainSocketScanner?: ConnectionScanner;

	constructor() {
		super();
		this.scanner = new Scanner();
	}

	protected handleMainOutgoingPacket(conn: Connection, packet: ByteArray) {
		try {
			const fp = packet.readByte();
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			//console.error("error readCode", e);
			return;
		}

		if (ccc == BulleIdentifier.handshake) {
			// Create a new session
			const session = new Session(this, conn);
			this.emitSafe("newSession", session);
		}
	}

	async start() {
		const scanner = new Scanner();
		const mainIp = await Client.fetchIP();
		const mainScanner = scanner.task(mainIp.ip);
		const mainSockScanner = new ConnectionScanner(mainScanner);
		mainSockScanner.on("packetSent", (conn, packetFactory) =>
			this.handleMainOutgoingPacket(conn, packetFactory.create()),
		);
		mainSockScanner.start();
		this.mainSocketScanner = mainSockScanner;
	}
}
