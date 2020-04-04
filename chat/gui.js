function getElems(container, chat, getName = function(id){return id}) {
	var r = {};

	r.container = container;

	r.chatBlock = container.getElementsByClassName("chatBlock")[0];
	r.roomsBlock = r.chatBlock.getElementsByClassName("roomsBlock")[0];

	r.idBlock = r.chatBlock.getElementsByClassName("idBlock")[0];

	r.connActBlock = r.chatBlock.getElementsByClassName("connActions")[0];
	r.connNodeButton = r.connActBlock.getElementsByTagName("input")[0];
	r.addNodeButton = r.connActBlock.getElementsByTagName("input")[1];
	r.getRoomsButton = r.connActBlock.getElementsByTagName("input")[2];
	r.findIdButton = r.connActBlock.getElementsByTagName("input")[3];

	r.roomsList = r.chatBlock.getElementsByClassName("chatRooms")[0];

	r.mesBlock = r.chatBlock.getElementsByClassName("chatMsgs")[0];
	r.roomHead = r.mesBlock.getElementsByClassName("chatRoomName")[0];
	r.mList = r.mesBlock.getElementsByClassName("chatMsgList")[0];
	r.uList = r.mesBlock.getElementsByClassName("usersList")[0];
	r.peerAdd = r.mesBlock.getElementsByClassName("peerAdd")[0];
	r.quitRoom = r.mesBlock.getElementsByClassName("quitRoom")[0];
	r.mpOTR = r.mesBlock.getElementsByClassName("mpotr")[0];
	r.authentication = r.mesBlock.getElementsByClassName("authentication")[0];

	r.authBlock = document.getElementById("authBlock");
	r.authBySMP = r.authBlock.getElementsByTagName("input")[0];
	r.authByCommunities = r.authBlock.getElementsByTagName("input")[1];
	r.authCancel = r.authBlock.getElementsByTagName("input")[2];

	r.mngBlock = r.mesBlock.getElementsByClassName("chatMngBlock")[0];
	r.msgText = r.mngBlock.getElementsByTagName("textarea")[0];
	r.msgSubmit = r.mngBlock.getElementsByTagName("input")[0];

	r.promptBlock = container.getElementsByClassName("promptBlock")[0];
	r.promptText = r.promptBlock.getElementsByTagName("textarea")[0];
	r.promptSubmit = r.promptBlock.getElementsByTagName("input")[0];
	r.promptCancel = r.promptBlock.getElementsByTagName("input")[1];
	
	r.notifBlock = container.getElementsByClassName("chatNotification")[0];

	r.promptCancel.addEventListener("click", e => r.showChat());
	r.authCancel.addEventListener("click", e => {r.authBlock.style.display = "none";});

	r.showDialog = function() {
		r.mesBlock.style.left = "50%";
		r.roomsBlock.style.width = "50%";
	};

	r.hideDialog = function() {
		r.mesBlock.style.left = "110%";
		r.roomsBlock.style.width = "100%";
	};

	r.makeOption = function(text) {
		return `<option>${text}</option>`;
	};

	r.makeOption_green = function(text) {
		return `<option style="background: #5cb85c; color: #fff;">${text}</option>`;
	};

	r.makeOption_red = function(text) {
		return `<option style="background: #c93a3a; color: #fff;">${text}</option>`;
	};

	r.updateUsers = function(users = (chat.getRoom() || {users: []}).users, validUsers = chat.validUsers) {
		let html = "";

		html = r.makeOption("Мои собеседники");

		for(var uid of users) {
			if(validUsers instanceof Map && validUsers.has(uid)){
				html += r.makeOption_green(`${getName(uid)} (${uid})`);
			} else {
				html += r.makeOption_red(`${getName(uid)} (${uid})`);
			}
		}

		r.uList.innerHTML = html;
		
		return r.uList;
	};

	r.uList.addEventListener("input", e => r.uList.value = "Список пользователей");

	r.showChat = function() {
		this.promptBlock.style.display = "none";
		this.chatBlock.style.display = "block";
	};
	
	r.showPrompt = function(placeholder = "", text = "") {
		this.promptBlock.style.display = "block";
		this.chatBlock.style.display = "none";
	
		this.promptText.placeholder = placeholder;
		this.promptText.value = text;

		this.promptText.focus();
	};

	r.showNotification = function(text, duration = 1200) {
		this.notifBlock.innerText = text;
		this.notifBlock.style.transform = "translate(-50%, 0%)";

		setTimeout(function() {
			this.notifBlock.style.transform = "translate(-50%, -110%)";
		}.bind(this), duration);
	};


	r.getName = getName;

	r.buildMsg = function(msg) {
		return `<div class="author">${this.getName(msg.from)}</div>
				<div class="message">${msg.text.replace(/\n/g, "<br />")}</div>`;
	}
	
	r.buildMsgs = function(msgs) {
		var res = "";
	
		for(var m of msgs)
			res += this.buildMsg(m);
	
		return res;
	}
	
	r.buildDialog = function(room) {		
		this.roomHead.value = room.name;
		this.mList.innerHTML = this.buildMsgs(room.messages);
		this.mList.scrollTop = this.mList.scrollHeight;

		r.updateUsers(room.users);

		r.showDialog();
	}
	
	r.buildRoom = function(room) {
		return `<div title="${room.id}">${room.name}</div>`;
	}
	
	r.buildRooms = function(rooms) {
		var text = "";
	
		for(var rid in rooms)
			text += this.buildRoom(rooms[rid]);
	
		r.roomsList.innerHTML = text;
	}

	return r;
}

module.exports = getElems;