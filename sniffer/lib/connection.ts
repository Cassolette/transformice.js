import { ByteArray, IdentifierSplit } from "@cheeseformice/transformice.js";
import { EventEmitter } from "./utils/emit-mod";
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

class ScanTask extends EventEmitter<{
	data: (buf: Buffer, isOutgoing: boolean, src: Host, dest: Host) => void;
	stopped: () => void;
	error: (e: any) => void;
}> {
	/**
	 * The max size of `Buffer` to allow pcap to memcpy to during each packet capture dispatch.
	 * Minimally should be snaplen plus any potential padding. Too low values will result in
	 * truncated packets and bring the stream of buffers out of alignment and possibly stop the
	 * program from working properly.
	 */
	// TCP IPV4 snaplen + bpfhdr_len
	protected capBufSize = 65535 + 18;
	/**
	 * Internal buffer size used by pcap to store captured bufs.
	 */
	protected pcapInternalBufSize = 10 * 1024 * 1024;
	protected caps: Cap[];
	protected active: boolean;

	/**
	 * @param ip The IP to filter during scan.
	 */
	constructor(public ip: string) {
		super();

		this.caps = [];

		for (const deviceInfo of Cap.deviceList()) {
			if (deviceInfo.flags === "PCAP_IF_LOOPBACK") continue;

			const cap = new Cap();
			const buffer = Buffer.alloc(this.capBufSize);
			const filter = `src ${ip} or dst ${ip}`;

			let capOk = true;
			try {
				const linkType = cap.open(
					deviceInfo.name,
					filter,
					this.pcapInternalBufSize,
					buffer,
				);
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
				if (trunc) {
					this.emitSafe(
						"error",
						Error(
							`Critical error! Found truncated TCP packet which could corrupt the stream. This can usually be fixed by increasing the \`Buffer\` allocation (\`capBufSize\`) higher than the TCP capture length.`,
						),
					);
				}
				try {
					const decoded = this.#parseTcpPacket(buffer);
					if (decoded) {
						this.emit(
							"data",
							decoded.data,
							decoded.dst.addr == ip,
							decoded.src,
							decoded.dst,
						);
					}
				} catch (e) {
					this.emit("error", e);
				}
			});

			this.caps.push(cap);
		}

		this.active = true;
	}

	#parseTcpPacket(buffer: Buffer) {
		let ret = decoders.Ethernet(buffer);

		if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) {
			//console.log("Caught not IPV4 packet.. ignoring");
			return null;
		}

		// Decode IPV4
		ret = decoders.IPV4(buffer, ret.offset);
		//console.log('from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr);
		const srcaddr = ret.info.srcaddr;
		const dstaddr = ret.info.dstaddr;

		if (ret.info.protocol !== PROTOCOL.IP.TCP) {
			//console.log("Caught not TCP packet.. ignoring");
			return null;
		}

		let datalen = ret.info.totallen - ret.hdrlen;

		// Decode TCP
		ret = decoders.TCP(buffer, ret.offset);
		//console.log(' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
		datalen -= ret.hdrlen;

		const src = new Host(srcaddr, ret.info.srcport);
		const dst = new Host(dstaddr, ret.info.dstport);

		return {
			src,
			dst,
			data: Buffer.from(buffer.subarray(ret.offset, ret.offset + datalen)),
		};
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

class PacketReader extends EventEmitter<{
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
		//console.debug("==============")
		//console.debug("a", this.extra, data.length)
		//console.debug("acont", [...this.buffer].toString())
		while (this.buffer.length > 0 && this.buffer.length >= this.length) {
			//console.debug("pcmp", this.buffer.length, this.length)
			if (this.length == 0) {
				let flag = false;
				for (let i = 0; i < 5; i++) {
					const byte = this.buffer.subarray(0, 1)[0];
					this.buffer = this.buffer.subarray(1);
					this.length |= (byte & 127) << (i * 7);

					if (!(byte & 0x80)) {
						flag = true;
						break;
					}
				}

				if (!flag) throw "Malformed TFM Packet";

				this.length += this.extra;
			}

			//console.debug("cmp", this.buffer.length, this.length)
			if (this.buffer.length >= this.length) {
				//console.debug("tfmpack", [...this.buffer.subarray(0, this.length)].toString())
				this.emit("new", new ByteArray(this.buffer.subarray(0, this.length)));
				this.buffer = this.buffer.subarray(this.length);
				this.length = 0;
				//console.debug("lcont", [...this.buffer].toString())
			}
			//console.debug("lcmp", this.buffer.length, this.length)
		}
	}
}

export class ByteArrayFactory {
	#buffer: Buffer;
	#writePosition: number;
	#readPosition: number;
	constructor(packet: ByteArray) {
		this.#buffer = Buffer.from(packet.buffer);
		this.#writePosition = packet.writePosition;
		this.#readPosition = packet.readPosition;
	}
	create() {
		const packet = new ByteArray(Buffer.from(this.#buffer)); // tbc tfm.js does not copy buffer.
		packet.writePosition = this.#writePosition;
		packet.readPosition = this.#readPosition;
		return packet;
	}
	get buffer() {
		return Buffer.from(this.#buffer);
	}
	get writePosition() {
		return this.#writePosition;
	}
	get readPosition() {
		return this.#readPosition;
	}
}

export interface ConnectionEvents {
	/** Packet received (0 offset read) */
	packetReceived: (packetFactory: ByteArrayFactory) => void;
	/** Packet sent (0 offset read) */
	packetSent: (packetFactory: ByteArrayFactory) => void;
	closed: () => void;
	error: (e: any) => void;
}

/**
 * Emulates a socket connection.
 */
export class Connection extends EventEmitter<ConnectionEvents> {
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
			this.emitSafe("packetReceived", new ByteArrayFactory(packet));
		});

		this.outbound.on("new", (packet) => {
			this.emitSafe("packetSent", new ByteArrayFactory(packet));
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
		if (!this.active) return;
		this.active = false;
		this.emitSafe("closed");
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
export class ConnectionScanner extends EventEmitter<ConnectionScannerEvents> {
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
		socket.on("packetReceived", (packetFactory) =>
			this.emitSafe("packetReceived", socket, packetFactory),
		);
		socket.on("packetSent", (packetFactory) =>
			this.emitSafe("packetSent", socket, packetFactory),
		);
		socket.on("closed", () => {
			this.sockets.delete(id);
			socket.removeAllListeners();
			//console.debug("dead conn", client, server);
		});
		this.emitSafe("new", socket);

		return socket;
	}
}
