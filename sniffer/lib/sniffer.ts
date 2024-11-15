import { ByteArray, Client } from "@cheeseformice/transformice.js";
import type { Connection } from "@cheeseformice/transformice.js/dist/utils";
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

interface SnifferEvents {
	/**
	 * Emitted when a new old packet received.
	 */
	packetReceived: (connection: Connection, packet: ByteArray) => void;
}

class Sniffer extends TypedEmitter<SnifferEvents> {
	async start() {
		const mainIp = await Client.fetchIP();

		const mainScanner = new Scanner(mainIp.ip);
	}
}

export { Sniffer };
