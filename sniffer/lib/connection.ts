import { ByteArray, IdentifierSplit } from "@cheeseformice/transformice.js";
import { TypedEmitter } from "./utils/typed-emitter";
import { Cap, decoders } from "cap";

const PROTOCOL = decoders.PROTOCOL;

export class Host {
	constructor(
		public addr: string,
		public port: number,
	) {}

	equals(host: Host) {
		return host.addr == this.addr && host.port == this.port;
	}

	toString() {
		return `<Host (${this.addr}:${this.port})>`;
	}
}

class ScanTask extends TypedEmitter<{
	data: (buf: Buffer, isOutgoing: boolean, src: Host, dest: Host) => void;
	stopped: () => void;
}> {
	protected bufSize = 10 * 1024 * 1024;
	protected caps: Cap[];
	protected active: boolean;

	/**
	 * @param ip The IP to filter during scan.
	 * @-param deviceIp Scans only a device found associated with this IP. If not found or unspecified, will scan all devices known at task creation.
	 */
	constructor(public ip: string) {
		super();

		this.caps = [];

		const devices = Cap.deviceList();
		for (let deviceInfo of devices) {
			if (deviceInfo.flags === "PCAP_IF_LOOPBACK") continue;

			const cap = new Cap();
			const buffer = Buffer.alloc(65535);
			const filter = `src ${ip} or dst ${ip}`;

			let capOk = true;
			try {
				const linkType = cap.open(deviceInfo.name, filter, this.bufSize, buffer);
				if (linkType !== "ETHERNET") throw "couldn't find the right device.";
				cap.setMinBytes?.(0);
			} catch (e) {
				capOk = false;
			}

			if (!capOk) {
				cap.close();
				continue;
			}

			cap.on("packet", (nbytes, trunc) => {
				let ret = decoders.Ethernet(buffer);

				if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) {
					//console.log("Caught not IPV4 packet.. ignoring");
					return;
				}

				// Decode IPV4
				ret = decoders.IPV4(buffer, ret.offset);
				//console.log('from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr);
				const srcaddr = ret.info.srcaddr;
				const dstaddr = ret.info.dstaddr;

				if (ret.info.protocol !== PROTOCOL.IP.TCP) {
					//console.log("Caught not TCP packet.. ignoring");
					return;
				}

				let datalen = ret.info.totallen - ret.hdrlen;

				// Decode TCP
				ret = decoders.TCP(buffer, ret.offset);
				//console.log(' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
				datalen -= ret.hdrlen;

				const src = new Host(srcaddr, ret.info.srcport);
				const dst = new Host(dstaddr, ret.info.dstport);
				this.emit(
					"data",
					buffer.slice(ret.offset, ret.offset + datalen),
					dstaddr == ip,
					src,
					dst,
				);
			});

			this.caps.push(cap);
		}

		this.active = true;
	}

	stop() {
		for (let cap of this.caps) {
			cap.close();
			cap.removeAllListeners();
		}
		this.active = false;
		this.emit("stopped");
	}
}

export type { ScanTask };

/**
 * Manages all raw data scans against different IPs.
 */
export class Scanner {
	public scanners: Map<string, ScanTask>;

	constructor() {
		this.scanners = new Map();
	}

	/**
	 * Creates or retrieves an existing task that scans `ip`.
	 * @param ip
	 * @returns
	 */
	task(ip: string) {
		const existing = this.scanners.get(ip);
		if (existing) return existing;

		const task = new ScanTask(ip);
		this.scanners.set(ip, task);
		task.on("stopped", () => {
			this.scanners.delete(ip);
		});

		return task;
	}
}

class PacketReader extends TypedEmitter<{
	/**
	 * @param packet Emitted when a new packet received from main or bulle connection.
	 */
	new: (packet: ByteArray) => void;
}> {
	protected buffer: Buffer;
	protected length: number;

	constructor(public extra = 0) {
		super();
		this.buffer = Buffer.alloc(0);
		this.length = 0;
	}

	consume(data: Buffer) {
		this.buffer = Buffer.concat([this.buffer, data]);
		while (this.buffer.length > this.length) {
			if (this.length == 0) {
				let flag = false;
				for (let i = 0; i < 5; i++) {
					const byte = this.buffer.slice(0, 1)[0];
					this.buffer = this.buffer.slice(1);
					this.length |= (byte & 127) << (i * 7);

					if (!(byte & 0x80)) {
						flag = true;
						break;
					}
				}

				if (!flag) throw "Malformed TFM Packet";

				this.length += this.extra;
			}

			if (this.buffer.length >= this.length) {
				this.emit("new", new ByteArray(this.buffer.slice(0, this.length)));
				this.buffer = this.buffer.slice(this.length);
				this.length = 0;
			}
		}
	}
}

export class ByteArrayFactory {
	buffer: Buffer;
	writePosition: number;
	readPosition: number;
	constructor(packet: ByteArray) {
		this.buffer = packet.buffer;
		this.writePosition = packet.writePosition;
		this.readPosition = packet.readPosition;
	}
	create() {
		const packet = new ByteArray(this.buffer);
		packet.writePosition = this.writePosition;
		packet.readPosition = this.readPosition;
		return packet;
	}
}

/**
 * Emulates a socket connection.
 */
export class Connection extends TypedEmitter<{
	packetReceived: (packetFactory: ByteArrayFactory) => void;
	packetSent: (packetFactory: ByteArrayFactory) => void;
	closed: () => void;
}> {
	inbound: PacketReader;
	outbound: PacketReader;
	active: boolean = true;
	/** The amount of time in milliseconds without incoming data before a socket connection is considered closed */
	aliveTimeout: number = 20000;
	protected latestTimeConsideredAlive?: number;

	constructor(
		public client: Host,
		public server: Host,
	) {
		super();
		this.inbound = new PacketReader(0);
		this.outbound = new PacketReader(1);

		this.inbound.on("new", (packet) => {
			this.emit("packetReceived", new ByteArrayFactory(packet));
		});

		this.outbound.on("new", (packet) => {
			this.emit("packetSent", new ByteArrayFactory(packet));
		});
	}

	consume(data: Buffer, isOutgoing: boolean) {
		if (!this.active) throw new Error("Tried to consume buffer on inactive socket?");

		// Consume payload
		const reader = isOutgoing ? this.outbound : this.inbound;
		reader.consume(data);

		this.latestTimeConsideredAlive = Date.now() + this.aliveTimeout;
	}

	close() {
		this.active = false;
		this.emit("closed");
	}

	aliveTick() {
		if (
			this.active &&
			this.latestTimeConsideredAlive &&
			Date.now() > this.latestTimeConsideredAlive
		) {
			this.close();
		}
	}
}

export interface ConnectionScannerEvents {
	new: (conn: Connection) => void;
	packetReceived: (conn: Connection, packetFactory: ByteArrayFactory) => void;
	packetSent: (conn: Connection, packetFactory: ByteArrayFactory) => void;
}

/**
 * Manages list of known socket connections found by `Connection`.
 */
export class ConnectionScanner extends TypedEmitter<ConnectionScannerEvents> {
	sockets: Map<string, Connection>;
	started: boolean;
	private loopTimer?: ReturnType<typeof setInterval>;

	constructor(public scanner: ScanTask) {
		super();
		this.sockets = new Map();
		this.started = false;
	}

	public start() {
		this.scanner.on("data", (data, isOutgoing, src, dest) => {
			//console.debug("tcpdata", isOutgoing, src, dest);
			const client = isOutgoing ? src : dest;
			const server = isOutgoing ? dest : src;
			this.getSocket(client, server).consume(data, isOutgoing);
		});

		this.loopTimer = setInterval(() => {
			this.sockets.forEach((socket) => socket.aliveTick());
		}, 2000);
	}

	public stop() {
		this.sockets.forEach((socket) => {
			socket.close();
			socket.removeAllListeners();
		});
		this.sockets.clear();
	}

	protected socketIdentifier(client: Host, server: Host) {
		return `${client.addr}:${client.port}-${server.addr}:${server.port}`;
	}

	protected getSocket(client: Host, server: Host) {
		const id = this.socketIdentifier(client, server);
		const existing = this.sockets.get(id);
		if (existing) return existing;

		//console.debug("new conn detected", client, server);
		const socket = new Connection(client, server);
		this.sockets.set(id, socket);
		socket.on("packetReceived", (packet) => this.emit("packetReceived", socket, packet));
		socket.on("packetSent", (packet) => this.emit("packetSent", socket, packet));
		socket.on("closed", () => {
			this.sockets.delete(id);
			socket.removeAllListeners();
			//console.debug("dead conn", client, server);
		});
		this.emit("new", socket);

		return socket;
	}
}
