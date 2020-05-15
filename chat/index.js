const ChordModule = require("../lib/chord/chord"),
	  ChatModule = require("./chat"),
	  TimeModule = require("./time"),
	  GUIModule = require("./gui"),
	  EventModule = require("./events"),
	  toClipboard = require("./clipboard"),
	  CryptoModule = require("./crypto"),
	  BigInt = require("big-integer"),
	  CSMP = require("./csmp"),
	  Chains = require("./chains");

const
	chat = new ChatModule(),
	time = new TimeModule(),
	GUI = new GUIModule(document.getElementsByClassName("chatContainer")[0],
						chat,
						chat.getName.bind(chat)),
	E = EventModule();

let CONTEXTS = {},
	EMITTERS = {},
	chord;


//////////////////////////////////////////////////////////////
// GLOBAL OBJECTS
//////////////////////////////////////////////////////////////

global.E = E;
global.GUI = GUI;
global.EMITTERS = EMITTERS;
global.chat = chat;



//////////////////////////////////////////////////////////////
// FUNCTIONS
//////////////////////////////////////////////////////////////

chat.getGlobalName = function(id) {
	let query = chord.get(`id${id}`);

	query.then((name) => {
		if(name) {
			chat.names[id] = name;
			GUI.buildDialog(chat.getRoom());
		}
	});

	return id;
};


function putMyData() {
	chord.put(`id${chord.id}`, chat.name);
	chord.put(`mail${chat.mail}`, chord.id);
}

function final() {
	GUI.showChat();
	putMyData();

	setTimeout(function() {
		for(var rid in chat.rooms)
			chord.subscribe(rid);

		putMyData();
	}, 5000);
}


function initialize(id) {
	GUI.hideDialog();

	GUI.promptSubmit.onclick = () => {
		let name = GUI.promptText.value;
		GUI.idBlock.innerText = `Мой id: ${id}\nМой ник: ${name}`;

		chat.id = id;
		chat.name = name;
		chat.names[id] = name;
		GUI.promptSubmit.onclick = () => {
			chat.mail = GUI.promptText.value;

			var k_pair = CryptoModule.settings.generateExpPair();
			chat.key = k_pair[0];
			chat.key_pub = k_pair[1];

			final();
		};

		GUI.showPrompt("Введите вашу почту");
	};

	GUI.showPrompt("Введите ваш ник");
}

function changeMPOTR() {
	let c = CONTEXTS[chat.getRoom().id];

	console.log(c, arguments);
	
	switch(c.status) {	
		case E.STATUS.AUTH:
			GUI.mpOTR.disabled = true;
			GUI.mpOTR.value = "Включение mpOTR...";
			GUI.authentication.disabled = true;
			break;
		case E.STATUS.MPOTR:
			GUI.mpOTR.value ="Остановить mpOTR";
			GUI.mpOTR.disabled = false;
			GUI.authentication.disabled = false;
			break;
		case E.STATUS.SHUTDOWN:
			GUI.mpOTR.disabled = true;
			GUI.mpOTR.value ="Завершение mpOTR...";
			GUI.authentication.disabled = true;
			break;
		case E.STATUS.UNENCRYPTED:
			GUI.mpOTR.value ="Включить mpOTR";
			GUI.mpOTR.disabled = false;
			GUI.authentication.disabled = true;
			break;
	}
};

function sendMessage(text) {
	let c = CONTEXTS[chat.getRoom().id];

	if(c) {
		if(c.status == E.STATUS.MPOTR) {
			c.sendMessage(text);
		} else {
			let msg = chat.makeMessage(text);
			msg.type = E.MSG.UNENCRYPTED;

			chord.publish(chat.currentRoom, "-message-", msg);
			GUI.buildDialog(chat.getRoom());
		}
	}
}

function onMessage(message) {
	let tstr = `message in room ${message.room}`
	time.begins[tstr] = message.date;
	time.end(tstr);

	message.text = message.text;
	chat.addMessage(message);

	if(chat.currentRoom == message.room)
		GUI.buildDialog(chat.getRoom());
}

function newRoom(rid, name, status) {
	if(!chat.getRoom(rid)) {
		if(status == E.STATUS.MPOTR)
			chord.publish(rid, E.MSG.BROADCAST, {type: "stopChat", room: rid});

		let $_ = new EventModule(),
			mpOTR = CryptoModule.main($_, time);

		CONTEXTS[rid] = new mpOTR(chord, chat.addRoom(rid, name));

		EMITTERS[rid] = $_;

		$_.ee.addListener("message", onMessage);

		$_.ee.addListener($_.EVENTS.MPOTR_INIT, changeMPOTR);
		$_.ee.addListener($_.EVENTS.MPOTR_START, changeMPOTR);
		$_.ee.addListener($_.EVENTS.MPOTR_SHUTDOWN_START, changeMPOTR);
		$_.ee.addListener($_.EVENTS.MPOTR_SHUTDOWN_FINISH, changeMPOTR);

		chord.subscribe(rid);
		chord.publish(rid, "-whatIsYourID-", {uid: chord.id, rid: rid});

		GUI.showNotification(`Беседа "${name}" создана`, 3000);
		
	}
}

function quitRoom(rid) {
	let room = chat.getRoom(rid);

	if(room) {
		let c = CONTEXTS[room.id];
		if(c.status == E.STATUS.MPOTR) 
			c.stopChat();

		chord.publish(room.id, E.MSG.CONN_LIST_REMOVE, { 
			room: room.id,
			from: chord.id
		});

		chord.unsubscribe(room.id);
		delete CONTEXTS[room.id];
		delete EMITTERS[room.id];
		
		if(chat.dgsList.has(room.id)){
			chat.dgsList.delete(room.id);
		}


		chat.deleteRoom(room.id);
		GUI.buildRooms(chat.rooms);
		GUI.hideDialog();
	}
}

function newPeer(id) {
	chord.get(`id${id}`).then((name) => {
		name = name || id;

		let rid =  BigInt.randBetween(0, 1e40).toString(16);

		newRoom(rid, name);

		chord.send(id, "-newRoom-", {rid: rid, name: chat.name});
		GUI.buildRooms(chat.rooms);
		GUI.showChat();

		GUI.showNotification(`Пользователь с id ${id} подключен`, 2000);
	});
}



//////////////////////////////////////////////////////////////
// GUI EVENTS
//////////////////////////////////////////////////////////////


window.addEventListener("beforeunload", function beforeUnload(event) {
	for(let rid in chat.rooms)
		quitRoom(rid);
});

GUI.quitRoom.addEventListener("click", () => quitRoom(chat.currentRoom));

GUI.findIdButton.addEventListener("click", () => {
	GUI.promptSubmit.onclick = () => {
		let mail = GUI.promptText.value;

		chord.get(`mail${mail}`).then((id) => {
			GUI.showNotification(`У человека с почтой ${mail} id равен \n${id}`, 7000);
			GUI.showChat();
		});
	};

	GUI.showPrompt("Введите почту пользователя");
});

GUI.connNodeButton.addEventListener("click", function(event) {
	GUI.showPrompt("Вставьте Offer");

	GUI.promptSubmit.onclick = () => {
		chord.makeWebRTCconnection(
			GUI.promptText.value,
			p => toClipboard(
				p.connText,
				alert,
				() => GUI.showNotification("Скопировано в буфер обмена")
			),
			() => GUI.showChat()
		);
	};
});

GUI.addNodeButton.addEventListener("click", function(event) {
	GUI.showPrompt("Вставьте Answer");

	time.start("peer addition");

	chord.makeWebRTCconnection(null, function(p) {
		toClipboard(
			p.connText,
			alert,
			() => GUI.showNotification("Скопировано в буфер обмена")
		);

		GUI.promptSubmit.onclick = () => p.getAnswer(GUI.promptText.value);
	},
	() => GUI.showChat(),
	id => {
		time.end("peer addition");
		setTimeout(() => newPeer(id), 3000);
	});
});

GUI.getRoomsButton.addEventListener("click", function(event) {
	GUI.showPrompt("Введите ID");

	GUI.promptSubmit.onclick = function () {
		let uid = GUI.promptText.value;

		GUI.showPrompt("Введите название беседы");

		GUI.promptSubmit.onclick = function () {
			let rid =  BigInt.randBetween(0, 1e40).toString(16),
				name = GUI.promptText.value;
			newRoom(rid, name);

			chord.send(uid, "-newRoom-", {rid: rid, name: name});
			GUI.buildRooms(chat.rooms);
			GUI.showChat();
		};
	};
});

GUI.roomHead.addEventListener("input", function(event) {
	chat.getRoom().name = GUI.roomHead.value;
	GUI.buildRooms(chat.rooms);
});

GUI.msgSubmit.addEventListener("click", function(event) {
	sendMessage(GUI.msgText.value);
	GUI.msgText.value = "";
	GUI.msgText.focus();
});

GUI.roomsList.addEventListener("click", function(event) {
	let target = event.target, room;

	if(target != GUI.roomsList) {
		room = chat.setRoom(target.title);

		GUI.buildDialog(room);
		GUI.updateUsers(room.users);
		changeMPOTR();
		GUI.msgText.focus();
	}
});

GUI.peerAdd.addEventListener("click", function(event) {
	GUI.showPrompt("Введите id");

	GUI.promptSubmit.onclick = function () {
		chord.send(GUI.promptText.value, "-newRoom-", {
			rid: chat.currentRoom,
			name: chat.getRoom(chat.currentRoom).name,
			status: CONTEXTS[chat.currentRoom].status
		});

		GUI.showChat();
	};
});

GUI.mpOTR.addEventListener("click", function(event) {
	let c = CONTEXTS[chat.getRoom().id];

	if(c) {
        switch (c.status) {
            case E.STATUS.MPOTR:
                c.stopChat();
                break;
            case E.STATUS.UNENCRYPTED:
                c.start();
                break;
            default:
                console.log("Somehow the button was clicked");
        }
	}
});

GUI.authentication.addEventListener("click", function(event) {
	GUI.authBlock.style.display = "block";
});

GUI.authBySMP.addEventListener("click", function(event) {
	GUI.authBlock.style.display = "none";
	let c = CONTEXTS[chat.getRoom().id];
	let $_ = EMITTERS[chat.getRoom().id];

	let data = {
		"type": $_.MSG.CSMP_INIT,
		"data": 'CSMP_INIT',
		"room": chat.getRoom().id
	};
	chord.publish(chat.getRoom().id, $_.MSG.BROADCAST, data);		

	if (c.csmp === undefined){
		c.csmp = new CSMP($_, c);
		c.csmp.init();
	}
	c.csmp.stime = +new Date();

	if (c.csmp.choose_aim()){
		c.smp_start(c.csmp.aim, 1, 0);
	} else {
	   c.csmp.sendResults();
	}
	
});

GUI.authByGroups.addEventListener("click", function(event) {
	GUI.authBlock.style.display = "none";
	let c = CONTEXTS[chat.getRoom().id];
	let $_ = EMITTERS[chat.getRoom().id];

	let data = {
		"type": $_.MSG.CHAINS_INIT,
		"data": 'CHAINS_INIT',
		"room": chat.getRoom().id
	};
	chord.publish(chat.getRoom().id, $_.MSG.BROADCAST, data);

	if (c.chains === undefined){
		c.chains = new Chains($_, c);
		c.chains.init();
	}

});


//////////////////////////////////////////////////////////////
// CHORD EVENTS
//////////////////////////////////////////////////////////////


ChordModule.prototype.getWRTCString(function(str) {
	chord = new ChordModule(
		{
			subscribePrefix: '-our-chord-',
			id: str
		},
		true
	);

	global.chord = chord;

	initialize(chord.id);

	chord.on("-message-", function(message) {
		if(message.type == E.MSG.UNENCRYPTED)
			if(EMITTERS[message.room])
				EMITTERS[message.room].ee.emitEvent("message", [message]);
	});

	chord.on("-whatIsYourID-", function(obj) {
		chat.getRoom(obj.rid).addUser(obj.uid);
		obj.uid = chord.id;
		chord.publish(obj.rid, "-takeMyID-", obj);
	});

	chord.on("-takeMyID-", function(obj) {
		let room = chat.getRoom(obj.rid);

		room.addUser(obj.uid);

		if(room.id == chat.currentRoom)
			GUI.updateUsers(room.users);
	});

	chord.on(E.MSG.CONN_LIST_REMOVE, function(data) { 
		let e = EMITTERS[data.room],
			room = chat.removeUserFromRoom(data.from, data.room);


		GUI.showNotification(`Пользователь ${chat.getName(data.from)} отключился`);

		if(room.id == chat.currentRoom)
			GUI.updateUsers(room.users);


		if(e)
			e.ee.emitEvent(E.EVENTS.CONN_LIST_REMOVE, [data]);

	})

	chord.on(E.MSG.MPOTR_AUTH, function(data) {
		let e = EMITTERS[data[0]];

		if(e)
			e.ee.emitEvent(E.MSG.MPOTR_AUTH, [data]);
	});

	chord.on(E.MSG.MPOTR_INIT, function(data) {
		let e = EMITTERS[data[0]];

		if(e)
			e.ee.emitEvent(E.MSG.MPOTR_INIT, [data]);
	});

	chord.on(E.MSG.BROADCAST, function(data) {

		let event = EMITTERS[data.room];

		if(event)
			event.ee.emitEvent(data.type, [data]);
	});

	chord.on(E.MSG.SMP_STEP1, data => {
		let e = EMITTERS[data.roomId];
		
		if(e)
			e.ee.emitEvent(E.MSG.SMP_STEP1, [data]);

	});

	chord.on(E.MSG.SMP_STEP2, data => {
		let e = EMITTERS[data.roomId];

		if(e)
			e.ee.emitEvent(E.MSG.SMP_STEP2, [data]);

	});

	chord.on(E.MSG.SMP_STEP3, data => {
		let e = EMITTERS[data.roomId];

		if(e)
			e.ee.emitEvent(E.MSG.SMP_STEP3, [data]);
	});

	chord.on(E.MSG.SMP_STEP4, data => {
		let e = EMITTERS[data.roomId];

		if(e)
			e.ee.emitEvent(E.MSG.SMP_STEP4, [data]);

	});

	chord.on(E.MSG.CCEGK, data => {
		let e = EMITTERS[data.room];
		if(e)
			e.ee.emitEvent(E.MSG.CCEGK, [data]);
	});

	chord.on("-newRoom-", function(room) {
		newRoom(room.rid, room.name, room.status);

		GUI.buildRooms(chat.rooms);
	});

});


E.ee.addListener(E.EVENTS.QUIT_ROOM, (rid) => {
	//quitRoom(rid);
});

E.ee.addListener(E.EVENTS.CHAINS_PROOF_INIT, (data) =>{

	var aim = data[0];
	var auth_room = data[1];
	var chains = data[2];


	for(var chain of chains){

		var rids = [];
		for(var group of chain){
			rids.push(group.roomId);
		}

		var c = CONTEXTS[rids[0]];
		var $_ = EMITTERS[rids[0]];

		var msg = {
			"type": $_.MSG.CHAINS_PROOF,
			"from": chat.id,
			"data":{
				id: chat.id,
				pubKey_fingerprint: cryptico.publicKeyID(chat.key_pub.toString(16)),
				aim: aim,
				auth_room: auth_room,
				chain: rids
			},
			"room": rids[0]
		};

		chat.dgsList.get(rids[0]).createSignature(msg);

		c.signMessage(msg); 
		chord.publish(rids[0], $_.MSG.BROADCAST, msg);

	}

});

E.ee.addListener(E.EVENTS.CHAINS_SEND_MSG, (data) =>{

	var msg = data.data;
	var nextRoom = data.room;

	var c = CONTEXTS[nextRoom];
	var $_ = EMITTERS[nextRoom];

	msg["type"] = $_.MSG.CHAINS_PROOF;
	msg["from"] = chat.id;
	msg["room"] = nextRoom;
	
	chat.dgsList.get(nextRoom).createSignature(msg);

	c.signMessage(msg); 
	chord.publish(nextRoom, $_.MSG.BROADCAST, msg);

});

E.ee.addListener(E.EVENTS.CHAINS_PROOF_START, () =>{
	data = chat.mailBuf[0];
	var $_ = EMITTERS[data["room"]];
	$_.ee.emitEvent($_.EVENTS.CHAINS_PROOF, [data]);
});

E.ee.addListener(E.EVENTS.CHAINS_PROOF_FINISH, () =>{
	chat.mailBuf.shift();
	if(chat.mailBuf.length){
		E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_START);
	}
});

E.ee.addListener(E.EVENTS.CHAINS_PROOF_RECEIVED, (data) =>{

	var user_id = data["data"]["id"];
	var user_pubKey_fingerprint = data["data"]["pubKey_fingerprint"];

	var auth_room = data["data"]["auth_room"];

	var chain = data["data"]["chain"];
	chain.reverse();

	if(Object.keys(chat.rooms).includes(auth_room)){

		var c = CONTEXTS[auth_room];
		var $_ = EMITTERS[auth_room];
		 
		if(c.chains.myTargets[user_id]){//my target
			if(c.chains.myTargets[user_id][chain] === null){

				c.chains.myTargets[user_id][chain] = user_pubKey_fingerprint;
				if(!Object.values(c.chains.myTargets[user_id]).includes(null)){

					var info = [user_id, true];

					$_.ee.emitEvent($_.EVENTS.CHAINS_CHECK_PROOFS, [info]);
				}

			}
		} else {// i am target

			if(!c.chains.iAmTarget[user_id]){

				c.circleChains.result[user_id] = $_.CC_RESULTS.IN_PROCESS;

				c.cgList[user_id].init(user_id, c.chains.groupsInfo);

				c.chains.iAmTarget[user_id] = {};
				c.cgList[user_id].chains.forEach(chain => {
					var rids = [];
					for(var group of chain){
						rids.push(group.roomId);
					}
					c.chains.iAmTarget[user_id][rids] = null;
				});
				
			}

			if(c.chains.iAmTarget[user_id][chain] === null){

				c.chains.iAmTarget[user_id][chain] = user_pubKey_fingerprint;
				if(!Object.values(c.chains.iAmTarget[user_id]).includes(null)){

					var info = [user_id, false];
					$_.ee.emitEvent($_.EVENTS.CHAINS_CHECK_PROOFS, [info]);
				}

				c = CONTEXTS[chain[0]];
				$_ = EMITTERS[chain[0]];

				var msg = {
					"type": $_.MSG.CHAINS_PROOF,
					"from": chat.id,
					"data":{
						id: chat.id,
						pubKey_fingerprint: cryptico.publicKeyID(chat.key_pub.toString(16)),
						aim: user_id,
						auth_room: auth_room,
						chain: chain
					},
					"room": chain[0]
				}
				
				chat.dgsList.get(chain[0]).createSignature(msg);
				c.signMessage(msg); 
				chord.publish(chain[0], $_.MSG.BROADCAST, msg);

			}
		}
	}

});

  