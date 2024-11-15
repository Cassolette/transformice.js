import { ByteArray } from "@cheeseformice/transformice.js";
import { TypedEmitter } from "tiny-typed-emitter";
import { Cap, decoders } from "cap";

const PROTOCOL = decoders.PROTOCOL;

class Host {
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

class Scanner extends TypedEmitter<{
	data: (buf: Buffer, isOutgoing: boolean, src: Host, dest: Host) => void;
}> {
	protected bufSize = 10 * 1024 * 1024;
	protected buffer: Buffer;
	protected cap: Cap;

	/**
	 * @param ip The IP to filter during scan.
	 * @param device The device name to find. Leave unspecified to determine based on the first non-loopback device.
	 */
	constructor(
		protected ip: string,
		device?: string,
	) {
		super();

		this.cap = new Cap();
		this.buffer = Buffer.alloc(65535);

		var filter = `src ${ip} or dst ${ip}`;
		var linkType = this.cap.open(Cap.findDevice(device), filter, this.bufSize, this.buffer);

		if (linkType !== "ETHERNET") throw "couldn't find the right device.";

		this.cap.setMinBytes && this.cap.setMinBytes(0);

		var buffer = this.buffer;
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
	}
}


class PacketReader extends TypedEmitter<{
	/**
	 * @param packet Emitted when a new packet received from main or bulle connection.
	 */
	new: (packet: ByteArray) => void
}> {
	protected buffer: Buffer
	protected length: number
	
    constructor(public extra = 0) {
        super();
        this.buffer = Buffer.alloc(0);
		this.length = 0;
    }

    consume(data: Buffer) {
        this.buffer = Buffer.concat([this.buffer, data]);
        while (this.buffer.length > this.length){
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

            if (this.buffer.length >= this.length){
                this.emit('new', new ByteArray(this.buffer.slice(0, this.length)));
                this.buffer = this.buffer.slice(this.length);
                this.length = 0;
            }
        }
    }
}

interface ConnectionEvents {
	dataIncoming: (this: this, data: ByteArray) => void;
	dataOutgoing: (this: this, data: ByteArray) => void;
}

/**
 * Represents a client's connection to a Transformice server.
 */
export default class Connection extends TypedEmitter<ConnectionEvents> {
	fingerprint: number;
	inbound: PacketReader;
	outbound: PacketReader;

	constructor(protected scanner: Scanner) {
		super();
		this.fingerprint = 0;
		this.inbound = new PacketReader(0);
		this.outbound = new PacketReader(1);
	
		scanner.on("data", (data, isOutgoing, src, dest) => {
			// Consume payload
			const reader = isOutgoing ? this.outbound : this.inbound;
			reader.consume(data);
		});

		this.inbound.on("new", (packet) => {
			this.emit("dataIncoming", packet)
		});

		this.outbound.on("new", (packet) => {

			var fp, ccc;
			try {
				fp = packet.readShort();
				ccc = packet.read();
			} catch (e) {
				//console.log("error readCode", e);
			}

			if (ccc == identifiers.handshake) {
				// Create a new client if connection is bound for main
				if (_this.name == "main") {
					let client = new Client(this);
					_this.client = client;
					/** 
					 * Emitted when a new client is created
					 * @event Connection#newClient
					 * @property {Client} client
					 */
					_this.emit('newClient', client);
				}
			} else if (ccc == identifiers.bulleConnection) {
				let timestamp = packet.readUnsignedInt();
				let playerId = packet.readUnsignedInt();
				let pcode = packet.readUnsignedInt();
				/**
				 * @event Connection#bulleConnection
				 * @type {object}
				 * @property {int} timestamp
				 * @property {int} playerId
				 * @property {int} pcode
				 */
				_this.emit('bulleConnection', {
					timestamp: timestamp,
					playerId: playerId,
					pcode: pcode
				});
			}

			this.emit("dataOutgoing", new ByteArray(packet.buffer));
		});

		// close and error TBC
	}

	/**
	 * Close the connection.
	 */
	close() {
		//
}
