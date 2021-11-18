import { Connection, ByteArray } from "../utils";
import {
	ChannelMessage,
	Friend,
	Member,
	Message,
	Player,
	Profile,
	Room,
	RoomMessage,
	RoomPlayer,
	Tribe,
	WhisperMessage,
} from "../structures";
import { Language } from "../enums";

interface ClientEvents {
	/* -------------------------------------------------------------------------- */
	/*                                   General                                  */
	/* -------------------------------------------------------------------------- */

	/**
	 * Emitted when a new old packet received.
	 */
	rawOldPacket: (connection: Connection, ccc: number, data: string[]) => void;
	/**
	 * Emitted when the client can login on the game.
	 */
	loginReady: () => void;
	/**
	 * Emitted when the client has logged in.
	 */
	login: (name: string, pcode: number) => void;
	/**
	 * Emitted when the client failed to log in.
	 */
	loginError: (code: number, error1: string, error2: string) => void;
	/**
	 * Emitted when connection failed
	 */
	connectionError: (err: Error) => void;
	/**
	 * Emitted when client is attempting to restart the connection
	 */
	restart: () => void;
	/**
	 * Emitted when the client is connected to the community platform.
	 */
	ready: () => void;
	/**
	 * Emitted when a new packet received from main or bulle connection.
	 */
	rawPacket: (conn: Connection, ccc: number, packet: ByteArray) => void;
	/**
	 * Emitted when a language is changed.characters or not.
	 */
	languageChange: (
		language: Language,
		country: string,
		readRight: boolean,
		readSpecialChar: boolean
	) => void;
	/**
	 * Emitted when a new community platform packet received.
	 */
	rawTribulle: (code: number, packet: ByteArray) => void;
	/**
	 * Emitted when the client has disconnect.
	 */
	disconnect: () => void;
	/**
	 * Emitted when a connection with the main server is established.
	 */
	connect: (connection: Connection) => void;
	/**
	 * Emitted when a connection with the game server (bulle) is established.
	 */
	bulleConnect: (connection: Connection) => void;
	/**
	 * Emitted when data received from /profile
	 */
	profile: (profile: Profile) => void;

	/* -------------------------------------------------------------------------- */
	/*                                    Room                                    */
	/* -------------------------------------------------------------------------- */

	/**
	 * Emitted when the client receives lua logs or errors from `#Lua` chat.
	 */
	luaLog: (log: string) => void;
	/**
	 * Emitted when a player sends a message in the room.
	 */
	roomMessage: (message: RoomMessage) => void;
	/**
	 * Emitted when the room is changed.
	 *
	 * @example
	 * ```js
	 * client.on('roomChange', (after, before) => {
	 * 	console.log('The room changed from '+before.name+' to '+after.name);
	 * })
	 * ```
	 */
	roomChange: (after: Room, before: Room) => void;
	/**
	 * Emitted when the room playerList is updated.
	 */
	roomPlayersUpdate: (after: RoomPlayer[], before: RoomPlayer[]) => void;
	/**
	 * Emitted when the room playerList is updated.
	 */
	roomPlayerUpdate: (after: RoomPlayer, before: RoomPlayer | undefined) => void;
	/**
	 * Emitted when a player left the room.
	 */
	roomPlayerLeave: (player: Player) => void;
	/**
	 * Emitted when a new player entered the room.
	 */
	roomPlayerEnter: (player: RoomPlayer) => void;
	/**
	 * Emitted when a player dies
	 */
	roomPlayerDie: (player: RoomPlayer) => void;
	/**
	 * Emitted when a player get the cheese
	 */
	roomPlayerGetCheese: (player: RoomPlayer) => void;
	/**
	 * Emitted when a player enters the hole
	 */
	roomPlayerEnterHole: (player: RoomPlayer, order: number, time: number) => void;

	/* -------------------------------------------------------------------------- */
	/*                                   Friend                                   */
	/* -------------------------------------------------------------------------- */

	/**
	 * Emitted when the client received the friend list
	 */
	friendList: (friends: Friend[]) => void;
	/**
	 * Emitted when a friend is added to friend list
	 */
	friendAdd: (friend: Player) => void;
	/**
	 * Emitted when a friend is removed from friend list
	 */
	friendRemove: (friend: Player) => void;
	/**
	 * Emitted when a friend is connected
	 */
	friendConnect: (name: string) => void;
	/**
	 * Emitted when a friend is disconnected
	 */
	friendDisconnect: (name: string) => void;
	/**
	 * Emitted when friend state is changed (e.g. room, gender)
	 */
	friendUpdate: (friend: Friend) => void;

	/* -------------------------------------------------------------------------- */
	/*                                Chat Channel                                */
	/* -------------------------------------------------------------------------- */

	/**
	 * Emitted when received /who result
	 */
	channelWho: (channelName: string, players: Player[], fingerprint: number) => void;
	/**
	 * Emitted when client joined a chat channel
	 */
	channelJoin: (channelName: string) => void;
	/**
	 * Emitted when client left a chat channel
	 */
	channelLeave: (channelName: string) => void;
	/**
	 * Emitted when a message is sent to a channel
	 */
	channelMessage: (channelMessage: ChannelMessage) => void;

	/* -------------------------------------------------------------------------- */
	/*                                    Tribe                                   */
	/* -------------------------------------------------------------------------- */

	/**
	 * Emitted when a tribe member updated
	 */
	tribeMemberUpdate: (member: Member) => void;
	/**
	 * Emitted when a tribe message is received
	 */
	tribeMessage: (message: Message) => void;
	/**
	 * Emitted when a tribe member connected
	 */
	tribeMemberConnect: (name: string) => void;
	/**
	 * Emitted when a tribe member disconnected
	 */
	tribeMemberDisconnect: (name: string) => void;
	/**
	 * Emitted when tribe information received
	 */
	tribe: (tribe: Tribe | null) => void;

	/**
	 * Emitted when a player sends a whisper message to the client.
	 */
	whisper: (message: WhisperMessage) => void;
}

export default ClientEvents;
