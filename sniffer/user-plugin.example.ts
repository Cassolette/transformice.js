import { ByteArray, Identifier, IdentifierSplit } from "@cheeseformice/transformice.js";
import zlib from "node:zlib";
import type { ConnectionProxy, SessionProxy, UserPlugin } from "./lib/plugin";

class CustomPlugin {
	onPacketReceived(session: SessionProxy, conn: ConnectionProxy, packet: ByteArray) {
		try {
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			return;
		}

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

	onPacketSent(session: SessionProxy, conn: ConnectionProxy, packet: ByteArray, fp: number) {
		try {
			var ccc = packet.readUnsignedShort();
		} catch (e) {
			return;
		}

		console.log(
			`send packet ${IdentifierSplit(ccc)} to ${conn === session.main ? "monde" : "bulle"}`,
		);

		switch (ccc) {
			case Identifier(6, 26): {
				if (session.msgKeys === undefined) {
					console.log("send command", packet.readUTF());
					console.log(
						"- no msg keys to decipher command, try sending a room message > 20 chars first to calculate it",
						packet.buffer,
					);
				} else {
					console.log(
						"send command (decipher)",
						new ByteArray(packet.readBufBytes(packet.bytesAvailable))
							.xorCipher(session.msgKeys, fp)
							.readUTF(),
					);
				}
				break;
			}
			case Identifier(28, 6): {
				console.log(
					"s-ping send reply req id",
					packet.readByte(),
					conn === session.main ? "(main conn)" : "(bulle conn)",
				);
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
		session.on("messageKeys", (msgKeys) => {
			console.log("derived msg keys", msgKeys);
		});
		session.on("error", (e) => {
			console.error(e);
		});
	},
} as UserPlugin;
