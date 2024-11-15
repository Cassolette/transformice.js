import type { ByteArray } from "@cheeseformice/transformice.js";
import type { Connection } from "@cheeseformice/transformice.js/dist/utils";
import type { UserPlugin, UserPluginHandler } from "./lib/plugin";
import type { Sniffer } from "./lib/sniffer";

class CustomPlugin implements UserPluginHandler {
	constructor(protected sniffer: Sniffer) {}
    onPacketReceived(conn: Connection, packet: ByteArray) {
        console.log("aylmao");
    }

    onPacketSent(conn: Connection, packet: ByteArray) {
    }
}

export default {
	init(sniffer) {
        return new CustomPlugin(sniffer);
    },
} as UserPlugin;
