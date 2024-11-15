import { ByteArray, Client } from "@cheeseformice/transformice.js";
import { BulleIdentifier } from "@cheeseformice/transformice.js/dist/enums";
import { TypedEmitter } from "tiny-typed-emitter";
import { Connection, ConnectionScanner, Scanner } from "./connection";

class Session extends TypedEmitter<{
	packetReceived: (connection: Connection, packet: ByteArray) => void;
	packetSent: (connection: Connection, packet: ByteArray) => void;
	/**
	 * Emitted when a connection with the game server (bulle) is established.
	 */
	bulleConnect: (connection: Connection) => void;
}> {
	public bulle?: Connection;

	constructor(
		public sniffer: Sniffer,
		public main: Connection,
	) {
		super();
		main.on("packetSent", (packet) => this.handlePacketSent(main, packet.create()));
		main.on("packetReceived", (packet) => this.handlePacketReceived(main, packet.create()));
	}

	protected handlePacketReceived(conn: Connection, packet: ByteArray) {
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

			bulleScanner.on("new", (bulleConn) => {// WIP onetime sent bulle keys
				bulleConn.on("packetSent", (packet) =>
					this.handlePacketSent(bulleConn, packet.create()),
				);
				bulleConn.on("packetReceived", (packet) =>
					this.handlePacketReceived(bulleConn, packet.create()),
				);
			});
		}
	}

	protected handlePacketSent(conn: Connection, packet: ByteArray) {
		try {
			var fp = packet.readShort();
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			//console.log("error readCode", e);
			return;
		}

		if (ccc == BulleIdentifier.handshake) {
			// Create a new session
		} else if (ccc == BulleIdentifier.bulleConnection) {
			const timestamp = packet.readUnsignedInt();
			const playerId = packet.readUnsignedInt();
			const pcode = packet.readUnsignedInt();
		}
	}
}

class Sniffer extends TypedEmitter<{
	newSession: (session: Session) => void;
	//packetReceivedWithoutSession: (connection: Connection, packet: ByteArray) => void;
	//packetSentWithoutSession: (connection: Connection, packet: ByteArray) => void;
}> {
	scanner: Scanner;
	mainSocketScanner?: ConnectionScanner;

	constructor() {
		super();
		this.scanner = new Scanner();
	}

	protected handleMainOutgoingPacket(conn: Connection, packet: ByteArray) {
		try {
			var fp = packet.readShort();
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			//console.log("error readCode", e);
			return;
		}

		if (ccc == BulleIdentifier.handshake) {
			// Create a new session
			const session = new Session(this, conn);
			this.emit("newSession", session);
		}
	}

	async start() {
		const scanner = new Scanner();
		const mainIp = await Client.fetchIP();
		const mainScanner = scanner.task(mainIp.ip);
		const mainSockScanner = new ConnectionScanner(mainScanner);
		this.mainSocketScanner = mainSockScanner;

		mainSockScanner.on("new", (conn) => {
			conn.on("packetSent", (packet) => this.handleMainOutgoingPacket(conn, packet.create()));
		});

		// this.main = new Connection(mainScanner);
		// this.main.on("dataIncoming", (data) => {
		// 	this.emit("packetReceived", main, new ByteArray(data.buffer));
		// });
		// this.main.on("dataOutgoing", (data) => {
		// 	this.handleOutgoingPacket(data);
		// 	this.emit("packetSent", this.main, new ByteArray(data.buffer));
		// });
	}
}

export { Sniffer };
