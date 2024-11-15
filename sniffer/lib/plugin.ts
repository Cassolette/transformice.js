import { ByteArray } from "@cheeseformice/transformice.js";
import { Connection } from "@cheeseformice/transformice.js/dist/utils";
import { Sniffer } from "./sniffer";

export interface UserPluginHandler {
	onPacketReceived: (conn: Connection, packet: ByteArray) => void;
	onPacketSent: (conn: Connection, packet: ByteArray) => void;
}

export interface UserPlugin {
	init: (sniffer: Sniffer) => UserPluginHandler;
}
