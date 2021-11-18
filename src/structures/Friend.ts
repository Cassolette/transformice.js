import { ByteArray } from "../utils";
import { Gender } from "../enums";
import Client from "../client";
import Player from "./Player";

/** Represents a friend from the friend list */
export default class Friend extends Player {
	/**
	 * The player's id
	 */
	id: number;
	/**
	 * The player's gender
	 */
	gender: Gender;
	/**
	 * If the player is the soulmate of the client
	 */
	isSoulmate: boolean;
	/**
	 * If the player has added the client back
	 */
	hasAddedBack: boolean;
	/**
	 * If the player is connected
	 */
	isConnected: boolean;
	/**
	 * The community of the player
	 */
	community: number;
	/**
	 * The room name of the player (if they are online)
	 */
	roomName: string;
	/**
	 * The player's last connection time
	 */
	lastConnection: number;

	/**
	 * @hidden
	 */
	constructor(client: Client) {
		super(client);
		this.id = 0;
		this.gender = 0;
		this.isSoulmate = false;
		this.hasAddedBack = false;
		this.isConnected = false;
		this.community = 0;
		this.roomName = "";
		this.lastConnection = 0;
	}

	/**
	 * Returns friend data from a packet
	 *
	 * @hidden
	 */
	read(packet: ByteArray, isSoulmate: boolean) {
		this.id = packet.readInt();
		this.name = packet.readUTF();
		this.gender = packet.readByte();
		packet.readInt(); // ?
		this.isSoulmate = isSoulmate;
		this.hasAddedBack = packet.readBoolean();
		this.isConnected = packet.readBoolean();
		this.community = packet.readInt();
		this.roomName = packet.readUTF();
		this.lastConnection = packet.readInt();
		return this;
	}
}
