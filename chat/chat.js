class Chat {
	constructor(id, name = id, mail = name) {
		this.currentRoom = "";
		this.rooms = {};

		this.id = id;
		this.name = name;
		this.mail = mail;
		this.names = {};

		this.key = null;
		this.key_pub = null;

		this.validUsers = new Map(); // {id: pub_key}
		
		this.getGlobalName = function(id) {
			return id;
		};
	}

	getName(id) {
		return this.names[id] || this.getGlobalName(id) || id;
	}

	deleteRoom(id) {
		if(this.rooms[id]) {
			delete this.rooms[id];
			this.currentRoom = undefined;
		}

		return this;
	}

	addRoom(id, name = id) {
		return this.rooms[id] = {
				id: id,
				name: name,
				groupPubKey: null,
				users: [],
				messages: [],
				addUser: function(u) {
					if(this.users.indexOf(u) < 0)
						this.users.push(u);
				}
			};
	}

	tryAddRoom(id, name) {
		var r = this.rooms[id];

		if(!r)
			r = this.addRoom(id, name);

		return r;
	}

	addMessage(m) {
		this.tryAddRoom(m.room).messages.push({
			from: m.from,
			text: m.text,
			date: m.date
		});
	}

	getRoom(room = this.currentRoom) {
		return this.rooms[room];
	}

	setRoom(room = this.currentRoom) {
		this.currentRoom = room;

		return this.rooms[room];
	}

	clearRoomUsers(rid) {
		var room = this.getRoom(rid);

		room.users.length = 0;

		return room;
	}

	addUserToRoom(uid, rid) {
		var room = this.getRoom(rid);

		room.users.push(uid);

		return room;
	}

	removeUserFromRoom(uid, rid) {
		var room = this.getRoom(rid),
			index = room.users.indexOf(uid);

		if(index > -1)
			room.users.splice(index, 1);

		return room;
	}

	getRoomsNames() {
		var rooms = {};

		for(var r in this.rooms)
			rooms[r] = this.rooms[r].name;

		return rooms;
	}

	makeMessage(text, roomId = this.currentRoom) {
		var m = {
				room: roomId,
				from: this.id,
				text: text,
				date: Date.now()
			};

		this.addMessage(m);

		return m;
	}
};

module.exports = Chat;