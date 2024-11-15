import { ByteArray } from "@cheeseformice/transformice.js";
import { TypedEmitter } from "tiny-typed-emitter";
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
	protected buffer: Buffer;
	protected cap: Cap;
	protected active: boolean;

	/**
	 * @param ip The IP to filter during scan.
	 * @param device The device name to find. Leave unspecified to determine based on the first non-loopback device.
	 */
	constructor(
		public ip: string,
		device?: string,
	) {
		super();

		this.cap = new Cap();
		this.buffer = Buffer.alloc(65535);

		const filter = `src ${ip} or dst ${ip}`;
		const linkType = this.cap.open(Cap.findDevice(device), filter, this.bufSize, this.buffer);

		if (linkType !== "ETHERNET") throw "couldn't find the right device.";

		this.cap.setMinBytes && this.cap.setMinBytes(0);

		const buffer = this.buffer;
		this.cap.on("packet", (nbytes, trunc) => {
			var ret = decoders.Ethernet(buffer);

			if (ret.info.type !== PROTOCOL.ETHERNET.IPV4) {
				//console.log("Caught not IPV4 packet.. ignoring");
				return;
			}

			// Decode IPV4
			ret = decoders.IPV4(buffer, ret.offset);
			//console.log('from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr);
			var srcaddr = ret.info.srcaddr;
			var dstaddr = ret.info.dstaddr;

			if (ret.info.protocol !== PROTOCOL.IP.TCP) {
				console.log("Caught not TCP packet.. ignoring");
				return;
			}

			var datalen = ret.info.totallen - ret.hdrlen;

			// Decode TCP
			ret = decoders.TCP(buffer, ret.offset);
			//console.log(' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
			datalen -= ret.hdrlen;

			var src = new Host(srcaddr, ret.info.srcport);
			var dst = new Host(dstaddr, ret.info.dstport);
			this.emit(
				"data",
				buffer.slice(ret.offset, ret.offset + datalen),
				dstaddr == ip,
				src,
				dst,
			);
		});

		this.active = true;
	}

	stop() {
		this.cap.close();
		this.cap.removeAllListeners();
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

	constructor(public device?: string) {
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

		const task = new ScanTask(ip, this.device);
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
	packetReceived: (packet: ByteArrayFactory) => void;
	packetSent: (packet: ByteArrayFactory) => void;
	closed: () => void;
}> {
	fingerprint: number;
	inbound: PacketReader;
	outbound: PacketReader;
	active: boolean = true; // tbc - socket inactive after timeout detect

	constructor(
		public client: Host,
		public server: Host,
	) {
		super();
		this.fingerprint = 0;
		this.inbound = new PacketReader(0);
		this.outbound = new PacketReader(1);

		this.inbound.on("new", (packet) => {
			this.emit("packetReceived", new ByteArrayFactory(packet));
		});

		this.outbound.on("new", (packet) => {
			this.emit("packetSent", new ByteArrayFactory(packet));
		});
		// close and error TBC
	}

	consume(data: Buffer, isOutgoing: boolean) {
		if (!this.active) throw new Error("Tried to consume buffer on inactive socket?");

		// Consume payload
		const reader = isOutgoing ? this.outbound : this.inbound;
		reader.consume(data);
	}
}

/**
 * Manages list of known socket connections found by `ScanTask`.
 */
export class ConnectionScanner extends TypedEmitter<{
	new: (conn: Connection) => void;
}> {
	sockets: Map<string, Connection>;

	constructor(public scanner: ScanTask) {
		super();

		this.sockets = new Map();

		scanner.on("data", (data, isOutgoing, src, dest) => {
			const client = isOutgoing ? src : dest;
			const server = isOutgoing ? dest : src;
			this.getSocket(client, server).consume(data, isOutgoing);
		});
	}

	protected socketIdentifier(client: Host, server: Host) {
		return `${client.addr}:${client.port}-${server.addr}:${server.port}`;
	}

	protected getSocket(client: Host, server: Host) {
		const id = this.socketIdentifier(client, server);
		const existing = this.sockets.get(id);
		if (existing) return existing;

		const socket = new Connection(client, server);
		this.sockets.set(id, socket);
		socket.on("closed", () => {
			this.sockets.delete(id);
		});

		return socket;
	}
}
