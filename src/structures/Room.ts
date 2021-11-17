import { ValueOf } from "../utils";
import { RoomPlayer, Base } from ".";
import Client from "../client";
import { Language } from "../enums";

/** Represents a room. */
export default class Room extends Base {
	/**
	 * The room name.
	 */
	name: string;
	/**
	 * All of the {@link Player} that are in the room.
	 */
	playerList: RoomPlayer[];
	/**
	 * Whether or not the room is a public.
	 */
	isPublic: boolean;
	/**
	 * The room language.
	 */
	language: ValueOf<typeof Language>;
	/**
	 * Whether or not the room is a tribe house.
	 */
	isTribeHouse: boolean;

	/**
	 * @hidden
	 */
	constructor(
		client: Client,
		isPublic: boolean,
		name: string,
		language: ValueOf<typeof Language>
	) {
		super(client);
		this.client = client;
		this.name = name;
		this.playerList = [];
		this.isPublic = isPublic;
		this.language = language;
		this.isTribeHouse = name.charCodeAt(1) === 3;
	}

	/**
	 * Get a player by the pcode or name.
	 *
	 * @example
	 * ```js
	 * const player = client.room.getPlayer('Name#0000');
	 * console.log(player.look);
	 * ```
	 */
	getPlayer(name: string): RoomPlayer | undefined;
	getPlayer(pcode: number): RoomPlayer | undefined;
	getPlayer(value: string | number) {
		if (typeof value === "number") return this.playerList.find((p) => p.pcode === value);
		else if (typeof value === "string") return this.playerList.find((p) => p.name === value);
	}

	/**
	 * Removes player from playerList.
	 *
	 * @hidden
	 */
	removePlayer(pcode: number) {
		const index = this.playerList.findIndex((p) => p.pcode === pcode);
		if (index === -1) return;
		return this.playerList.splice(index, 1)[0];
	}

	/**
	 * Add player to player list
	 */
	addPlayer(player: RoomPlayer) {
		const exists = this.playerList.some((p) => p.pcode === player.pcode);
		if (exists) return;
		this.playerList.push(player);
	}

	/**
	 * Adds or updates the player in room playerList.
	 *
	 * @hidden
	 */
	updatePlayer(player: RoomPlayer) {
		let playerToUpdate = this.getPlayer(player.pcode);
		playerToUpdate = player;
		return playerToUpdate;
	}

	/**
	 * Sends a message to the room.
	 */
	sendMessage(message: string) {
		this.client.sendRoomMessage(message);
	}
}
