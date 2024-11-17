import { Identifier, IdentifierSplit, type ByteArray } from "@cheeseformice/transformice.js";
import type { Connection } from "./lib/connection";
import type { SessionProxy, UserPlugin } from "./lib/plugin";
import zlib from "node:zlib";

class CustomPlugin {
	onPacketReceived(session: SessionProxy, conn: Connection, packet: ByteArray) {
		try {
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			return;
		}

		if (
			![Identifier(60, 3), Identifier(28, 6), Identifier(4, 9), Identifier(144, 48)].includes(
				ccc,
			) ||
			conn === session.bulle
		)
			console.log(
				`new packet ${IdentifierSplit(ccc)} from ${conn === session.main ? "monde" : "bulle"}`,
			);

		switch (ccc) {
			case Identifier(5, 2): {
				let mapCode = packet.readInt();
				let playerCount = packet.readShort();
				let roundCode = packet.readByte();
				let enclen = packet.readInt();

				console.log("map_code", mapCode);
				console.log("# of players", playerCount);
				console.log("round number", roundCode);

				if (enclen > 0) {
					let encxml = packet.readBufBytes(enclen);
					console.log("length encxml:", encxml.length);
					console.log(zlib.inflateSync(encxml).toString());
				}

				console.log("author", packet.readUTF());
				console.log("perm", packet.readByte());
				//console.log("? bool", packet.readBool());
				break;
			}
			case Identifier(5, 21): {
				let official = packet.readBoolean(); // is the room official?
				let name = packet.readUTF();

				console.log("room:", name, official ? "(official)" : "");
				console.log("bulle ip:", session.bulle?.server);
				break;
			}
			case Identifier(28, 6): {
				console.log("s-ping req id", packet.readByte());
				console.log("s-ping need reply to: ", packet.readBoolean() ? "main" : "bulle");
				break;
			}
		}
	}

	onPacketSent(session: SessionProxy, conn: Connection, packet: ByteArray, fp: number) {
		try {
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			return;
		}

		if (
			![Identifier(149, 26), Identifier(28, 6), Identifier(26, 26)].includes(ccc) ||
			conn === session.bulle
		)
			console.log(
				`send packet ${IdentifierSplit(ccc)} to ${conn === session.main ? "monde" : "bulle"}`,
			);

		switch (ccc) {
			case Identifier(8, 30): {
				//console.log("ping send", packet.readByte())
				break;
			}
            case Identifier(28, 6): {
                console.log("s-ping send reply req id", packet.readByte(), conn === session.main ? "(main conn)": "(bulle conn)");
				break;
			}
		}
	}
}

const plugin = new CustomPlugin();
export default {
	eventNewSession(session) {
		console.log("new session");
		session.on("packetReceived", async (conn, packetFactory) =>
			plugin.onPacketReceived(session, conn, packetFactory.create()),
		);
		session.on("packetSent", (conn, packetFactory, fp) =>
			plugin.onPacketSent(session, conn, packetFactory.create(), fp),
		);
		session.on("bulleConnect", (conn) => {
			console.log("bulle connection", conn.server);
		});
		session.on("error", (e) => {
			console.error(e);
		});
	},
} as UserPlugin;
