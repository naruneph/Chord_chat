const Settings = require("./settings"),
      SMP = require("./smp"),
      CSMP = require("./csmp"),
      DGS = require("./dgs"), 
      ChainOfGroups = require("./chainOfGroups"),
      Chains = require("./chains"),
      CircleChains = require("./circleChains");

const settings = new Settings();


exports.settings = settings;
exports.main = function($_, time) {
/**
     * Round class.
     * Yup, class in JS!
     * @returns {Round}
     */
    function Round(number) {
        this.number = number
    }

    /**
     * Indicates if round data was sended.
     * Is used for debug purposes.
     * @type Boolean
     */
    Round.prototype.sended = false;

    /**
     * Method to reset all Round settings
     */
    Round.prototype.reset = function() {
        this.sended = false;
    };

    /**
     * Sets context of round to not to pass it every time
     * @param {mpOTRContext} context
     */
    Round.prototype.setContext = function(context) {
        this.context = context;
    };

    /**
     * Simple wrapper for unified processing of
     * authentication round result.
     * @param {Object} result object with results of auth round.
     * Must contain key "status". "OK" is value for success.
     * Other ones are treated as error messages.
     * @returns {boolean}
     */
    Round.prototype.process = function(result) {
        if (result["status"] === "OK") {
            $.extend(true, this.context, result["update"]);

            return true;
        } else {
            alert("mpOTR error: " + result["status"]); // TODO something more adequate

            return false;
        }
    };

    /**
     * Processes incoming auth message by executing corresponding
     * "receive" function and interpreting the result.
     * @param {String} peer Peer's ID
     * @param {String} msg Current round's authentication message
     * @returns {boolean} true if processing was successful
     */
    Round.prototype.recv = function (peer, msg) {
        return this.process(this._recv(peer, msg));
    };

    /**
     *
     * @returns {boolean}
     */
    Round.prototype.send = function () {
        return this.process(this._send())
    };

    let round1 = new Round(1);

    round1._send = function () {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };
        let my_k = new Array(settings.len_sid_random);
        settings.random.nextBytes(my_k);

        my_k = my_k.map(function (el) {
            return String.fromCharCode(el);
        }).join("");

        let my_k_hashed = sha256.hex(my_k);

        let longterm = chat.key;
        let pub_longterm = chat.key_pub;

        let eph_pair = settings.generatePair();
        let eph = eph_pair[0];
        let pub_eph = eph_pair[1];

        result["update"]["myLongPubKey"] = pub_longterm;
        result["update"]["myLongPrivKey"] = longterm;
        result["update"]["myEphPrivKey"] = eph;
        result["update"]["myEphPubKey"] = pub_eph;
        result["update"]["k_i"] = my_k;

        result["update"]["hashedNonceList"] = {};
        result["update"]["longtermPubKeys"] = {};
        result["update"]["ephPubKeys"] = {};
        result["update"]["hashedNonceList"][context.chord.id] = my_k_hashed;
        result["update"]["longtermPubKeys"][context.chord.id] = pub_longterm;
        result["update"]["ephPubKeys"][context.chord.id] = pub_eph;

        let message = [
            context.room.id, "auth", this.number, context.chord.id,
            String(my_k_hashed), String(pub_longterm), String(pub_eph)
        ];
        context.chord.publish(context.room.id, $_.MSG.MPOTR_AUTH, message);
        this.sended = true;

        return result;
    };

    round1._recv = function (peer, msg) {
        let result = {
            "update": {},
            "status": "OK"
        };

        result["update"]["hashedNonceList"] = {};
        result["update"]["longtermPubKeys"] = {};
        result["update"]["ephPubKeys"] = {};
        result["update"]["hashedNonceList"][peer] = msg[0];
        result["update"]["longtermPubKeys"][peer] = new BigInteger(msg[1]);
        result["update"]["ephPubKeys"][peer] = msg[2];

        return result;
    };

    let round2 = new Round(2);

    round2._send = function () {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };
        let sid_raw = "";

        let hn = context.hashedNonceList;
        let hna = Object.keys(context.hashedNonceList);
        // I HATE JAVASCRIPT
        // THIS SHIT ITERATE DICT IN THE ORDER OF ADDING KEYS
        // so sort and iterate in alphabetic order
        // TODO: think about rewriting in array [{key1:value1}, {key2:value2}, ...]
        hna.sort();
        for (let i = 0; i < hna.length; ++i) {
            sid_raw = sid_raw + hn[hna[i]];
        }

        let sid = sha256.hex(sid_raw);
        result.update.sid = sid;

        let auth_pair = settings.generateExpPair();
        let r_i = auth_pair[0];
        let exp_r_i = auth_pair[1];
        result.update.r_i = r_i;
        result.update.exp_r_i = exp_r_i;

        let message = [
            context.room.id, "auth", this.number, context.chord.id,
            String(sid), String(exp_r_i)
        ];
        result["update"]["expAuthNonce"] = {};
        result["update"]["expAuthNonce"][context.chord.id] = exp_r_i;
        context.chord.publish(context.room.id, $_.MSG.MPOTR_AUTH, message);
        this.sended = true;

        return result;
    };

    round2._recv = function (peer, msg) {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };

        if ((msg[0] !== context.sid) && (context.sid !== undefined)) {
            // sid can be still undefined;
            // in that case this check will fail
            // in another place. TODO: check in sid generation
            result["status"] = "WRONG SESSION ID";
        } else {
            result["update"]["expAuthNonce"] = {};
            result["update"]["expAuthNonce"][peer] = new BigInteger(msg[1]);
        }

        return result;
    };

    let round3 = new Round(3);

    let xor = function (a, b) {
        let result = "";


        for (let i = 0; (i < a.length) && (i < b.length); ++i) {
            let c = a.charCodeAt(i);
            let d = b.charCodeAt(i);
            result += String.fromCharCode(c ^ d);
        }
        return result;
    };

    round3._send = function () {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };

        let lpk = context.longtermPubKeys;
        let lpka = Object.keys(lpk);
        lpka.sort();
        let left_pub_key;
        let right_pub_key;
        for (let i = 0; i < lpka.length; ++i) {
            if (lpka[i] === context.chord.id) {
                let num_left = i - 1;                             // URRR, -1 % 3 === -1
                while (num_left < 0) {
                    num_left += lpka.length;
                }
                left_pub_key = lpk[lpka[num_left]];
                let num_right = (i + 1) % lpka.length;
                right_pub_key = lpk[lpka[(i + 1) % lpka.length]];
            }
        }

        let bigIntLPK = new BigInteger(context.myLongPrivKey.toString(), 10);
        let t_left_raw = left_pub_key.modPow(bigIntLPK, settings.pmod);
        let t_right_raw = right_pub_key.modPow(bigIntLPK, settings.pmod);
        let t_left_hashed = sha256.hex(t_left_raw.toString());
        let t_right_hashed = sha256.hex(t_right_raw.toString());
        let bigT = xor(t_left_hashed, t_right_hashed);
        let xoredNonce = xor(context.k_i, t_right_hashed);

        result.update["my_t_left"] = t_left_hashed;
        result.update["my_t_right"] = t_right_hashed;
        result.update["xoredNonce"] = {};
        result.update["xoredNonce"][context.chord.id] = xoredNonce;
        result.update["bigT"] = {};
        result.update["bigT"][context.chord.id] = bigT;
        result.update["myBigT"] = bigT;

        let s = [
            context.room.id, "auth", this.number, context.chord.id,
            String(xoredNonce), String(bigT)
        ];
        context.chord.publish(context.room.id, $_.MSG.MPOTR_AUTH, s);
        this.sended = true;

        return result;
    };

    round3._recv = function (peer, msg) {
        let result = {
            "update": {},
            "status": "OK"
        };

        result["update"]["xoredNonce"] = {};
        result["update"]["bigT"] = {};
        result["update"]["xoredNonce"][peer] = msg[0];
        result["update"]["bigT"][peer] = msg[1];

        return result;
    };

    let round4 = new Round(4);

    round4._send = function () {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };
        // decrypt nonces here
        let xored_nonces = context.xoredNonce;
        let xored_nonces_keys = Object.keys(xored_nonces);
        xored_nonces_keys.sort();
        let nonces = {};

        let t_R = context.my_t_right;
        let i = xored_nonces_keys.indexOf(context.chord.id);
        for (let j = i; (j - i) < xored_nonces_keys.length; ++j) {
            let peer_name = xored_nonces_keys[(j + 1) % xored_nonces_keys.length];
            t_R = xor(t_R, context.bigT[peer_name]);
            nonces[peer_name] = xor(xored_nonces[peer_name], t_R);
        }

        for (let i in nonces) {
            if (sha256.hex(nonces[i]) !== context.hashedNonceList[i]) {
                result["status"] = "NONCE HASH CHECK FAILED";
                return result;
            }
        }

        let bigTx = context.myBigT;
        for (let i in context.bigT) {
            bigTx = xor(bigTx, context.bigT[i]);
        }
        if (bigTx !== context.myBigT) {
            result["status"] = "BIG T XOR SUM IS NOT NULL";
        }

        if (result["status"] !== "OK") {
            return result;
        }

        let n = "";
        let sconf = "";
        n += nonces[xored_nonces_keys[0]];
        sconf += "," + context.longtermPubKeys[xored_nonces_keys[0]] + ",";
        sconf += nonces[xored_nonces_keys[0]] + "," + context.ephPubKeys[xored_nonces_keys[0]];
        for (let i = 1; i < xored_nonces_keys.length; ++i) {
            n += nonces[xored_nonces_keys[i]];
            sconf += "," + context.longtermPubKeys[xored_nonces_keys[i]] + ",";
            sconf += nonces[xored_nonces_keys[i]] + "," + context.ephPubKeys[xored_nonces_keys[i]];
        }

        sconf = sha256.hex(sconf);
        let c_i_raw = context.sid + sconf;
        let c_i_hashed = sha256.hex(c_i_raw);
        let c_i_int = new BigInteger(c_i_hashed);
        c_i_int = c_i_int.mod(settings.qmod);
        c_i_hashed = c_i_int.toString();
        let d_i = context.r_i.subtract(context.myLongPrivKey.multiply(c_i_int).mod(settings.qmod)).mod(settings.qmod);
        let sig = context.myEphPrivKey.signStringWithSHA256(c_i_hashed);

        // Adding first session key
        context.bd.session_keys[0] = {
            key: sha256.hex(n).slice(0, 32),
            received_from: {}
        };

        result.update["nonce"] = nonces;
        result.update["sconf"] = sconf;
        result.update["d_i"] = d_i;
        result.update["sig"] = sig;
        result.update["c_i"] = c_i_hashed;

        let s = [
            context.room.id, "auth", this.number, context.chord.id,
            String(d_i), String(sig)
        ];
        context.chord.publish(context.room.id, $_.MSG.MPOTR_AUTH, s);
        this.sended = true;

        return result;
    };

    round4._recv = function (peer, msg) {
        let context = this.context;
        let result = {
            "update": {},
            "status": "OK"
        };

        let d_i = new BigInteger(msg[0], 10);
        let exp1 = settings.g.modPow(d_i, settings.pmod);

        let BigIntC_I = new BigInteger(context.c_i, 10);
        let exp2 = context.longtermPubKeys[peer].modPow(BigIntC_I, pmod);
        let d_check = exp1.multiply(exp2).mod(settings.pmod);

        if (d_check.toString() !== context.expAuthNonce[peer].toString()) {
            result["status"] = "D CHECK FAILED";
            return result;
        }

        let pk = cryptico.publicKeyFromString(context.ephPubKeys[peer]);

        if (!pk.verifyString(context.c_i, msg[1])) {
            result["status"] = "SIGNATURE VERIFYING FAILED";
            return result;
        }

        return result;
    };


    /**
     * Singleton for mpOTR context
     * @param {Object} chord Chord
     * @param {Object} room Current room
     * @returns {mpOTRContext}
     */
    function mpOTRContext(chord, room) {

        this.chord = chord;
        this.room = room;


        this["status"] = $_.STATUS.UNENCRYPTED;

        this.rounds = {
            1: round1,
            2: round2,
            3: round3,
            4: round4
        };

        for (let i in this.rounds) {
            this.rounds[i].setContext(this);
        }

        /**
         * Initiates mpOTR session
         */
        this.start = function() {
            if (this.room.users.length > 0) {
                this.chord.publish(this.room.id, $_.MSG.MPOTR_INIT, [this.room.id, "init"]);
                this.mpOTRInit();
            } else {
                alert("No peers were added");
                $_.ee.emitEvent($_.EVENTS.MPOTR_SHUTDOWN_FINISH);
            }
        };

        /**
         * Resets all crypto-properties and rounds
         */
        this.reset = function () {
            this["status"] = $_.STATUS.UNENCRYPTED;
            this.shutdown_sended = false;
            this.myLongPubKey = undefined;
            this.myLongPrivKey = undefined;
            this.myEphPrivKey = undefined;
            this.myEphPubKey = undefined;
            this.k_i = undefined;
            this.hashedNonceList = {};
            this.longtermPubKeys = {};
            this.ephPubKeys = {};
            this.expAuthNonce = {};
            this.my_t_left = undefined;
            this.my_t_right = undefined;
            this.xoredNonce = {};
            this.bigT = {};
            this.myBigT = undefined;
            this.nonce = undefined;
            this.sconf = undefined;
            this.d_i = undefined;
            this.sig = undefined;
            this.c_i = undefined;

            this.ready_for_dgs = [];


            // Circle SMP Auth
            this.csmp = undefined;
            //for SMP
            this.secret = undefined;
            this.smList = {};
            for (var i = 0; i < this.room.users.length; i++){
                this.smList[this.room.users[i]] = new SMP($_, this, settings);
            }


            // Circle chains Auth
            this.chains = undefined; //answers if auth is possible or not, if possible - creates circle
            this.circleChains = undefined;
            //for ChainOfGroups
            this.cgList = {};
            for (var i = 0; i < this.room.users.length; i++){
                this.cgList[this.room.users[i]] = new ChainOfGroups($_, this);
            }

            

        

            // OldBlue buffers
            this.frontier = [];
            this.lostMsg = [];
            this.delivered = [];
            this.undelivered = [];

            for (let i in this.rounds) {
                this.rounds[i].reset();
            }

            this.shutdown_received = {};
            for (let peer of this.room.users) {
                this.shutdown_received[peer] = false;
            }

            this.bd.session_keys = {};
        };

        this.broadcastOldBlue = (data) => {
            data["data"] = this.encryptMessage(data["data"]);
            data["key_id"] = this.bd.current_key_id;
            data["from"] = this.chord.id;
            data["room"] = this.room.id;

            // OldBlue starts
            data["parentsIDs"] = this.frontier.slice();
            data["messageID"] = sha256.hex(
                this.chord.id +
                this.frontier.toString() +
                data["data"]
            );
            this.signMessage(data);
            // self-deliver
            this.receiveMessage(data);
            // OldBlue ends

            this.chord.publish(this.room.id, $_.MSG.BROADCAST, data);
        };

        /**
         * Sends broadcast request to retrieve
         * a lost message in response
         */
        this.deliveryRequest = function () {
            let data = {
                "type": $_.MSG.MPOTR_LOST_MSG,
                "sid": this.sid,
                "from": chord.id
            };

            for (let id of this.lostMsg) {
                data["lostMsgID"] = id;
                this.signMessage(data);

                this.chord.publish(this.room, $_.MSG.BROADCAST, data);
            }
        };

        /**
         * Searches a lost message in message pools.
         * Will return the lost message if founds one.
         * Otherwise returns undefined.
         * @param {object} data Message delivery request
         * @returns {object} Message delivery response
         */
        this.deliveryResponse = function (data) {
            // Searching in undelivered messages
            let idx = this.undelivered.map(function (elem) {
                return elem["messageID"];
            }).indexOf(data["lostMsgID"]);
            if (idx !== -1) {
                return this.undelivered[idx];
            }

            // Searching in delivered messages
            idx = this.delivered.map(function (elem) {
                return elem["messageID"];
            }).indexOf(data["lostMsgID"]);
            if (idx !== -1) {
                return this.delivered[idx];
            }

            // Not found
            return undefined;
        };

        this.sendMessage = function (text) {
            let data = {};
            data["type"] = $_.MSG.MPOTR_CHAT;
            data["sid"] = this.sid;
            data["data"] = escape(text);

            this.broadcastOldBlue(data);
        };

        this.receiveMessage = function (data) {
            if (!this.checkSig(data, data["from"])) {
                alert("Signature check fail");
                return;
            }

            // OldBlue

            // Ignore duplicates
            if (this.delivered.filter((elem) => {
                    return elem["messageID"] === data["messageID"];
                }).length > 0 || this.undelivered.filter((elem) => {
                    return elem["messageID"] === data["messageID"];
                }).length > 0) {
                return;
            }

            let index = this.lostMsg.indexOf(data["messageID"]);

            if (index > -1) {
                this.lostMsg.splice(index, 1);
            }

            // Lost message delivery request
            for (let id of data["parentsIDs"]) {
                if (this.delivered.filter((elem) => {
                        return elem["messageID"] === id;
                    }).length === 0 && this.undelivered.filter((elem) => {
                        return elem["messageID"] === id;
                    }).length === 0) {
                    this.lostMsg.push(id);
                }
            }

            this.deliveryRequest();

            this.undelivered.push(data);

            // Looking in undelivered buffer for messages that can be delivered
            // Means all its parents was delivered
            for (let i = this.undelivered.length - 1; i >= 0; --i) {
                let candidateToDelivery = this.undelivered[i];
                let canBeDelivered = true;

                // Looking for parents of current message in delivered messages
                for (let parent of candidateToDelivery["parentsIDs"]) {
                    let parentWasDelivered = false;

                    for (let deliveredMsg of this.delivered) {
                        if (deliveredMsg["messageID"] === parent) {
                            parentWasDelivered = true;
                            break;
                        }
                    }

                    if (!parentWasDelivered) {
                        canBeDelivered = false;
                        break;
                    }
                }

                if (canBeDelivered) {
                    // Removing parents from frontier
                    for (let parent of candidateToDelivery["parentsIDs"]) {
                        let j = this.frontier.indexOf(parent);

                        if (j > -1) {
                            this.frontier.splice(j, 1);
                        }
                    }
                    // Delivered message now in frontier
                    this.frontier.push(candidateToDelivery["messageID"]);
                    // And officially delivered :)
                    this.delivered.unshift(candidateToDelivery);
                    this.undelivered.splice(i, 1);

                    // Deliver message
                    this.deliverMessage(candidateToDelivery);
                }
            }
            // OldBlue ends
        };

        this.deliverMessage = (msg) => {
            let text = this.decryptMessage(msg["data"], msg["key_id"]);

            switch (msg["type"]) {

                case $_.MSG.MPOTR_CHAT:
                    let author = msg["from"];
                    $_.ee.emitEvent("message", [{
                        room: msg["room"], from: msg["from"], date: msg["date"],
                        text: unescape(text)
                    }]);
                    //this.client.writeToChat(author, text);
                    console.log(`got "${text}" from ${author}`);
                break;

                case $_.MSG.MPOTR_SHUTDOWN:
                    if (typeof(msg["data"]) !== typeof("")) {
                        alert(`Got empty MPOTR_SHUTDOWN msg from ${msg["from"]}`);
                        return;
                    }

                    if (this.receiveShutdown(msg["from"], text)) {
                        $_.ee.emitEvent($_.EVENTS.MPOTR_SHUTDOWN_FINISH);
                        console.log("mpOTRContext reset");
                    }
                break;

                case $_.MSG.BD_KEY_RATCHET:
                    let round = msg["round"];
                    let from = msg["from"];
                    let new_key_id = msg["new_key_id"];

                    this.bd.handleBDMessage(round, from, text, new_key_id);
                break;

                default:
                    console.log(`Got unexpected type of message: ${msg["type"]}`);
                    console.log(msg);
            }

            // It is senseless to notify about message delivery after successful shutdown
            if ([$_.STATUS.UNENCRYPTED, $_.STATUS.AUTH].indexOf(this.status) === -1) {
                $_.ee.emitEvent($_.EVENTS.OLDBLUE_MSG_DELIVERED, [msg]);
            }
        };

        this.decryptMessage = function (text, key_id) {
            return cryptico.decryptAESCBC(text, this.bd.session_keys[key_id].key);
        };

        this.encryptMessage = function (text) {
            return cryptico.encryptAESCBC(
                text,
                this.bd.session_keys[this.bd.current_key_id].key
            );
        };

        /**
         * Takes object, signs it and adds property 'sig'
         * @param {object} data Object to sign
         */
        this.signMessage = function (data) {
            if ("sig" in data) {
                delete data["sig"];
            }

            let keys = Object.keys(data);
            keys.sort();

            let result = "";
            for (let key of keys) {
                result += data[key];
            }

            data['sig'] = this.myEphPrivKey.signStringWithSHA256(result);
        };

        this.checkSig = function (data, peer) {
            let pk = cryptico.publicKeyFromString(this.ephPubKeys[peer]);
            let keys = Object.keys(data);
            keys.splice(keys.indexOf('sig'), 1);
            keys = keys.sort();

            let result = "";
            for (let key of keys) {
                result += data[key];
            }

            return pk.verifyString(result, data["sig"]);
        };

        /**
         * A decorator to use with event callbacks. For example:
         *
         * $_.ee.addListener("EventSpecificForTheAuthPhase", checkStatus(
         *   [ $_.STATUS.AUTH ],
         *   callbackForTheEvent
         * )
         *
         * The callback will be triggered if and only if the current
         * chat's status is among the supplied ones
         *
         * @param {String[]} statuses An array of permitted statuses
         * @param {Function} func A function to decorate
         * @returns {Function}
         */
        this.checkStatus = (statuses, func) => {
            let self = this;

            return function() {
                if (statuses.indexOf(self.status) > -1) {
                    func.apply(null, arguments);
                }
            }
        };

        this.sendShutdown = function () {
            // TODO: think about keylength 64
            let secret = `p=${this.myEphPrivKey.p}, q=${this.myEphPrivKey.q}, e=${this.myEphPrivKey.e}`;

            let data = {};
            data["type"] = $_.MSG.MPOTR_SHUTDOWN;
            data["sid"] = this.sid;
            data["data"] = secret;

            this.broadcastOldBlue(data);

            this.shutdown_sended = true;
        };

        this.receiveShutdown = (from, keys) => {
            if (from !== this.chord.id && !this.shutdown_sended) {
                this.stopChat();
            }

            if (keys === null) {
                console.log(`${from} was disconnected`);
            } else {
                // TODO: Publish keys
                console.log(`shutdown from ${from} received: ${keys}`);
            }

            this.shutdown_received[from] = true;

            return Object.values(this.shutdown_received).indexOf(false) === -1;
        };

        this.stopLocal = function() {
            this.status = $_.STATUS.SHUTDOWN;

            $_.ee.emitEvent($_.EVENTS.MPOTR_SHUTDOWN_START);
            $_.ee.emitEvent($_.EVENTS.BLOCK_CHAT);
        };

        this.stopChat = function () {

            this.stopLocal();

            this.sendShutdown();
        };

        this.mpOTRInit = () => {
            this.reset();
            this.bd.reset();

            this.status = $_.STATUS.AUTH;

            // Initiating authentication phase
            let authenticationPhase = this.InitAuthenticationPhase();

            authenticationPhase.then(() => {
                console.log('mpOTR: Success!');
            }).catch((err) => {
                //alert(err);
                console.log(err);
            });

            $_.ee.emitEvent($_.EVENTS.MPOTR_INIT);
        };

        // Change status on start of chat
        $_.ee.addListener($_.EVENTS.MPOTR_START, () => {
            this.status = $_.STATUS.MPOTR;
            

            // if someone leaved recompute group secret
            if(chat.dgsList.has(this.room.id) && chat.leaved){
                chat.dgsList.get(this.room.id).removeUser(chat.leaved);
            }

        });

        // Reset context on chat shutdown
        $_.ee.addListener($_.EVENTS.MPOTR_SHUTDOWN_FINISH, () => {
            this.reset();   
            
            if (this.amILeader()) {
                this.start();
            }
        });

        // Init received! Checking current chat status and starting new one!
        $_.ee.addListener($_.MSG.MPOTR_INIT, this.checkStatus([$_.STATUS.UNENCRYPTED, $_.STATUS.MPOTR], (data) => {
                this.mpOTRInit();

        }));

        $_.ee.addListener($_.MSG.MPOTR_CHAT, this.checkStatus([$_.STATUS.MPOTR], (data) => {
                this.receiveMessage(data);
        }));

        $_.ee.addListener($_.MSG.MPOTR_SHUTDOWN, this.checkStatus([$_.STATUS.MPOTR, $_.STATUS.SHUTDOWN], (data) => {
                this.receiveMessage(data);
        }));

        $_.ee.addListener("stopChat", this.checkStatus([$_.STATUS.MPOTR], (data) => {
                this.stopChat();
        }));

        $_.ee.addListener($_.MSG.MPOTR_LOST_MSG, this.checkStatus([$_.STATUS.MPOTR], (data) => {

            if (!this.checkSig(data, data["from"])) {
                alert("Signature check fail");
                return;
            }

            let response = this.deliveryResponse(data);

            if (response) {
                conn.send(response);
            }
            
        }));

        this.amILeader = function() { 
            let me = this.chord.id,
                users = this.room.users,
                result = true;

            for(let i=0; i<users.length; ++i)
                if(users[i] > me) {
                    result = false;
                    break;
                }

            return result;
        };

        $_.ee.addListener($_.EVENTS.CONN_LIST_REMOVE, this.checkStatus([$_.STATUS.MPOTR, $_.STATUS.SHUTDOWN], (conn) => {

            if (this.receiveShutdown(conn.from, null)) { 
                $_.ee.emitEvent($_.EVENTS.MPOTR_SHUTDOWN_FINISH);
                console.log("mpOTRContext reset");
            }
 
        }));

    	$_.ee.addListener($_.MSG.CSMP_RESULT, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            if (!this.checkSig(data, data["data"]["from"])) {
                alert("Signature check fail");
                return;
            }
            this.csmp.handleMessage(data['data']['from'], data['data']['results']);
        }));

        $_.ee.addListener($_.MSG.CSMP_INIT, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            if (this.csmp === undefined){
                this.csmp = new CSMP($_, this);
                this.csmp.init();
            }
            if (this.csmp.choose_aim()){
                this.smp_start(this.csmp.aim, 1, 0);
            } else {
                this.csmp.sendResults();
            }
        }));

        $_.ee.addListener($_.MSG.SMP_STEP1, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            
            if (chat.id === data["data"]["to"]){
                if (!this.checkSig(data, data["data"]["from"])) {
                    alert("Signature check fail");
                    return;
                }
                var msg = data['data'];
                // To accept SMP or not
                if (this.csmp.aim === msg["from"]){
                    if (chat.id < msg["from"] && (this.smList[this.csmp.aim].nextExpected === "SMP_EXPECT3"
                        || this.smList[msg["from"]].nextExpected === "SMP_EXPECT1" )){ 
                        this.smp_start(msg["from"], 0, msg["data"]);
                        return;
                    }
                } else{
                    this.smp_start(msg["from"], 0, msg["data"]);
                }
            }
        }));

        $_.ee.addListener($_.MSG.SMP_STEP2, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            
            if (chat.id === data["data"]["to"]){
                if (!this.checkSig(data, data["data"]["from"])) {
                    alert("Signature check fail");
                    return;
                }
                let msg = data["data"];
                if (this.smList[msg["from"]].nextExpected !== "SMP_EXPECT3")
                    {alert("receive wrong step "+this.smList[msg["from"]].nextExpected + " expected " + "SMP_EXPECT3"); return ;}
                this.smList[msg["from"]].smp_auth(msg["data"], 3);
            }
        }));

        $_.ee.addListener($_.MSG.SMP_STEP3, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            
            if (chat.id === data["data"]["to"]){
                if (!this.checkSig(data, data["data"]["from"])) {
                    alert("Signature check fail");
                    return;
                }
                let msg = data["data"];
                if (this.smList[msg["from"]].nextExpected !== "SMP_EXPECT4")
                    {alert("receive wrong step " + this.smList[msg["from"]].nextExpected + " expected " + "SMP_EXPECT4"); return ;}
                this.smList[msg["from"]].smp_auth(msg["data"], 4);
            }
        }));

        $_.ee.addListener($_.MSG.SMP_STEP4, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            
            if (chat.id === data["data"]["to"]){
                if (!this.checkSig(data, data["data"]["from"])) {
                    alert("Signature check fail");
                    return;
                }
                let msg = data["data"];
                if (this.smList[msg["from"]].nextExpected !== "SMP_EXPECT5") {
                    alert("receive wrong step "+this.smList[msg["from"]].nextExpected + "expected" + "SMP_EXPECT5");
                    return ;
                }
                this.smList[msg["from"]].smp_auth(msg["data"], 5);
            }
        }));

        this.smp_start = function(friend, init, input) {
        	if (this.secret === undefined){
        		this.secret = prompt('Пароль', '');

        	}
        	if (this.csmp === undefined){
        		this.csmp = new CSMP($_, this);
        		this.csmp.init();
        	}
        	this.csmp.result[friend]= $_.CSMP_RESULTS.IN_PROCESS;
        	if (init === 1){
        		this.csmp.status = $_.CSMP_STATUS.CHECKING;
        	}
        	this.smList[friend].smpInit(this.secret, friend, init, input);
        };



        $_.ee.addListener($_.MSG.CHAINS_INIT, this.checkStatus([$_.STATUS.MPOTR], () => {
 
            if (this.chains === undefined){
                this.chains = new Chains($_, this); 
                this.chains.init();
            }    
        
        }));

        $_.ee.addListener($_.EVENTS.CHAINS_SUCCESS, this.checkStatus([$_.STATUS.MPOTR], (data) => {
 
            if (this.circleChains === undefined){

                this.circleChains = new CircleChains($_, this);
                this.circleChains.init(data.circle, data.aim);

                var new_data = [data.aim, this.room.id, data.chains];

                E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_INIT, [new_data]);
            }   
             
        }));

        $_.ee.addListener($_.MSG.CC_RESULT, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            if (!this.checkSig(data, data["data"]["from"])) {
                alert("Signature check fail");
                return;
            }
            this.circleChains.handleMessage(data['data']['from'], data['data']['results']);
        }));

        $_.ee.addListener($_.MSG.CHAINS_PROOF, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            if(!chat.mailBuf.length){
                chat.mailBuf.push(data);
                E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_START);
            } else {
                chat.mailBuf.push(data);
            }
        }));  

        $_.ee.addListener($_.EVENTS.CHAINS_PROOF, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            
            if (!this.checkSig(data, data["from"])) {
                alert("Signature check fail");
                return;
            }
            delete data['sig'];

            check_proof(data, this.room);


        }));


        async function check_proof(data, curRoom){

            var from = data["from"];
            var user_id = data["data"]["id"];
            var user_pubKey_fingerprint = data["data"]["pubKey_fingerprint"];
            var aim = data["data"]["aim"];
            var auth_room = data["data"]["auth_room"];
            var chain = data["data"]["chain"];

            var rooms = Object.keys(chat.rooms);
            var idx = chain.indexOf(curRoom.id);

            if(idx !== chain.length - 1){
                if(!rooms.includes(chain[idx + 1])){
                    return;
                }
            } else {
                if(chat.id !== aim){
                    return;
                }
            }

            var data_copy = JSON.parse(JSON.stringify(data));
            var result = true;


            for(var i = idx; i >= 0; i--){

                var groupInfo = await chord.get(`groupPubKey${chain[i]}`);

                if(settings.checkGroupSignature(groupInfo, data)){
                    delete data["data"][chain[i]];
                } else {
                    result = false; 
                    break;
                }

            }

            if(idx === 0){

                if(chat.validUsers.has(user_id)){
                    if(!user_pubKey_fingerprint === cryptico.publicKeyID(chat.validUsers.get(user_id))){
                        result = false;
                    }
                } else {
                    result = false;
                }

                if(result){
                    if(idx !== chain.length - 1){
                        if(rooms.includes(chain[idx + 1])){

                            var new_data = {
                                "data": data_copy,
                                "room": chain[idx + 1]
                            };
                                
                            E.ee.emitEvent(E.EVENTS.CHAINS_SEND_MSG, [new_data]);
                        }
                    } else {
                        //в одной комнате
                        //доделать
                    }
                }

            } else if(idx !== chain.length - 1){

                if(result){

                    var prevGroupInfo = await chord.get(`groupPubKey${chain[idx - 1]}`);
                    
                    var prevUsers = prevGroupInfo.idList.filter(el => curRoom.users.includes(el));

                    if(prevUsers.includes(from)){

                        var key = sha256.hex(JSON.stringify(chain) + user_id + aim);

                        if(!Object.keys(chat.dataToCheck).includes(key)){
                            chat.dataToCheck[key] = {};
                        }
                        chat.dataToCheck[key][from] = user_pubKey_fingerprint;

                        var users = Object.keys(chat.dataToCheck[key]);

                        if(users.length === prevUsers.length){

                            var fingerprint  = chat.dataToCheck[key][users[0]];
                            var flag = true;

                            for(var user of users){
                                if(chat.dataToCheck[key][user] !== fingerprint){
                                    flag = false;
                                    break;
                                }
                            }

                            delete chat.dataToCheck[key];

                            if(flag){
    
                                var new_data = {
                                    "data": data_copy,
                                    "room": chain[idx + 1]
                                };
                                E.ee.emitEvent(E.EVENTS.CHAINS_SEND_MSG, [new_data]);
                            }

                        }     
                    }
    
                }

            } else {
                if(result){


                    var prevGroupInfo = await chord.get(`groupPubKey${chain[idx - 1]}`);
                    
                    var prevUsers = prevGroupInfo.idList.filter(el => curRoom.users.includes(el));

                    if(prevUsers.includes(from)){

                        var key = sha256.hex(JSON.stringify(chain) + user_id + aim);

                        if(!Object.keys(chat.dataToCheck).includes(key)){
                            chat.dataToCheck[key] = {};
                        }
                        chat.dataToCheck[key][from] = user_pubKey_fingerprint;

                        var users = Object.keys(chat.dataToCheck[key]);

                        if(users.length === prevUsers.length){

                            var fingerprint  = chat.dataToCheck[key][users[0]];
                            var flag = true;

                            for(var user of users){
                                if(chat.dataToCheck[key][user] !== fingerprint){
                                    flag = false;
                                    break;
                                }
                            }

                            delete chat.dataToCheck[key];

                            if(flag){
                                
                                E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_RECEIVED, [data]);

                            }

                        }     
                    }
                    
                }
            }

            E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_FINISH);
        }

      
        $_.ee.addListener($_.EVENTS.DGS_INIT, this.checkStatus([$_.STATUS.MPOTR], () => { 
            if (!chat.dgsList.has(this.room.id)){
                chat.dgsList.set(this.room.id, new DGS($_, this, settings));
                chat.dgsList.get(this.room.id).setup();
            }
        }));

        $_.ee.addListener($_.EVENTS.AUTH_FINISH, this.checkStatus([$_.STATUS.MPOTR], () =>{
            console.warn("AUTH FINISHED");

            GUI.updateUsers();

            var flag = true;
            for(var i = 0; i < this.room.users.length; i++){
                if(!chat.validUsers.has(this.room.users[i])){
                    flag = false;
                }
            }
            if(!flag){
                GUI.showNotification(`Беседа "${this.room.name}" небезопасна`, 3000);
                E.ee.emitEvent(E.EVENTS.QUIT_ROOM, [this.room.id]);
            } else {
                GUI.showNotification(`Аутентификация в беседе "${this.room.name}" прошла успешно`, 3000);
                
                var msg = {
                    "type": $_.MSG.READY_FOR_DGS,
                    "data": 'MSG.READY_FOR_DGS',
                    "from": chat.id,
                    "room": this.room.id
                };

                this.signMessage(msg); 
                this.chord.publish(this.room.id, $_.MSG.BROADCAST, msg);

                this.ready_for_dgs.push(chat.id);

                if(this.ready_for_dgs.length === this.room.users.length + 1){
                    console.log("DGS: start");
                    $_.ee.emitEvent($_.EVENTS.DGS_INIT);
                }
                
            } 
        }));

        $_.ee.addListener($_.MSG.READY_FOR_DGS, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            if (!this.checkSig(data, data["from"])) {
                alert("Signature check fail");
                return;
            }

            this.ready_for_dgs.push(data["from"]);

            if(this.ready_for_dgs.length === this.room.users.length + 1){
                console.log("DGS: start");
                $_.ee.emitEvent($_.EVENTS.DGS_INIT);
            }
        }));





















        this.InitAuthenticationPhase = function () {
            let currentRound = 1;

            //time.start(`authentification phase`);

            /**
             * Queue for storing auth messages for future processing
             */
            let roundsQueue =  {
                1: [],
                2: [],
                3: [],
                4: []
            };

            // TODO: Move timeout to client or context
            let timeout = 10 * 1000;

            let authMessageListener = this.checkStatus([$_.STATUS.AUTH], (payload) => {
                // Check Message
                let processMessage = (peer, data) => {
                    let result = this.rounds[currentRound].recv(peer, data);
                    //time.end(`auth round ${currentRound}`);

                    if (result) {
                        // TODO: check for double submit
                        roundsRcvd[currentRound][peer] = true;

                        if (roundsRcvd.check(currentRound)) {
                            if (currentRound === 4) {
                                return true;
                            }

                            currentRound += 1;
                            if (!this.rounds[currentRound].send()) {
                                return false;
                            }
                           // time.start(`auth round ${currentRound}`);

                            // Process the whole queue
                            for (let msg of roundsQueue[currentRound]) {
                                if (!processMessage.apply(this, msg)) {
                                    return false;
                                }
                            }
                        }
                    } else {
                        return false;
                    }

                    return true;
                };

                // TODO: data should be a dict!!!
                if (payload[2] === currentRound) {
                    if (!processMessage(payload[3], payload.slice(4))) {
                        fail("processMessage failed");
                        return;
                    }

                    if (currentRound === 4) {
                        success();
                       // time.end(`authentification phase`);
                    }
                } else if (payload[2] === currentRound + 1 && payload[2] < 5) {
                    roundsQueue[payload[2]].push([payload[3], payload.slice(4)]);
                } else {
                    fail("Wrong round number");
                }
            });

            /**
             * Dict with error/success callbacks
             * @type {{resolve: Function, reject: Function}}
             */
            let cb = {};

            let cleanup = () => {
                $_.ee.removeListener($_.MSG.MPOTR_AUTH, authMessageListener);
                clearTimeout(authenticationTimeout);
            };

            /**
             * Callback for unsuccessful authentication
             * @param err Error description
             */
            let fail = (err) => {
                cb["reject"](err);

                cleanup();
            };

            /*
             * There is a bug with setTimeout. If CPU is overloaded
             * setTimeout will be possibly triggered earlier.
             */
            let startTime = Date.now();
            let authenticationTimeout = setTimeout(() => {
                fail('Timeout: ' + (Date.now() - startTime));
            }, timeout);

            /**
             * Callback for success authentication
             */
            let success = () => {
                $_.ee.emitEvent($_.EVENTS.MPOTR_START);
                cb["resolve"]();

                cleanup();
            };

            /**
             * Promise which resolves when auth completes.
             * Can be rejected by timeout or protocol error.
             * @type {Promise}
             */
            let authenticationPhase = new Promise((resolve, reject) => {
                cb["resolve"] = resolve;
                cb["reject"] = reject;
            });

            /**
             * Dict containing status of auth messagess from all peers.
             * true - message was received and processed, false - vice-versa
             */
            let roundsRcvd = {
                1: {},
                2: {},
                3: {},
                4: {}
            };

            /**
             * Check for were all messages received in specified round
             * @param currentRound
             * @returns {boolean}
             */
            roundsRcvd.check = function(currentRound) {
                for (let key in this[currentRound]) {
                    if (!this[currentRound][key]) {
                        return false;
                    }
                }

                return true;
            };

            // In the beginning none of messages are received
            for (let client of this.room.users) {
                for (let round in this.rounds) {
                    roundsRcvd[round][client] = false;
                }
            }

            // Subscribing main listener for auth messages
            $_.ee.addListener($_.MSG.MPOTR_AUTH, authMessageListener);

            this.rounds[currentRound].send();
            //time.start(`auth round ${currentRound}`);

            return authenticationPhase;
        };

        this.bd = {
            MAX_MSGS_ON_THE_KEY: 100,
            KEY_TTL: 60 * 1000
        };

        this.bd.reset = (update_key_id) => {
            this.bd.ratcheting_now = false;
            this.bd.sent_r1 = false;
            this.bd.sent_r2 = false;

            this.bd.n = this.room.users.length + 1;
            this.bd.n_bi = new BigInteger(this.bd.n.toString(), 10);
            this.bd.messages_on_this_key = 0;

            if (update_key_id) {
                this.bd.current_key_id += 1;
            } else {
                this.bd.current_key_id = 0;
            }

            this.bd.x = NaN;
            this.bd.ks = {};
            this.bd.Ks = {};

            this.bd.sorted_peers = this.room.users.slice();
            this.bd.sorted_peers.push(this.chord.id);
            this.bd.sorted_peers.sort();

            this.bd.k = this.bd.sorted_peers.indexOf(this.chord.id);
            this.bd.left = this.bd.sorted_peers[(this.bd.k - 1 + this.bd.n) % this.bd.n];
            this.bd.right = this.bd.sorted_peers[(this.bd.k + 1) % this.bd.n];
            this.bd.last_kr_time = performance.now();
        };

        this.bd.sendRound1 = () => {
            console.log(
                `Updating session keys:\n` +
                `${this.bd.messages_on_this_key} messages were already sent with the current key\n` +
                `${performance.now() - this.bd.last_kr_time} ms elapsed since the last Key Ratcheting`
            );

            this.bd.ratcheting_now = true;
            this.bd.x = settings.generateNumber().mod(settings.qmod);
            this.bd.ks[this.chord.id] = settings.g.modPow(this.bd.x, settings.pmod);

            this.broadcastOldBlue({
                type: $_.MSG.BD_KEY_RATCHET,
                round: 1,
                new_key_id: this.bd.current_key_id + 1,
                data: this.bd.ks[this.chord.id].toString()
            });

            this.bd.sent_r1 = true;
        };

        this.bd.sendRound2 = () => {
            let left = this.bd.ks[this.bd.left];
            let right = this.bd.ks[this.bd.right];
            this.bd.Ks[this.chord.id] = (right.multiply(left.modInverse(settings.pmod))).modPow(this.bd.x, settings.pmod);

            this.broadcastOldBlue({
                type: $_.MSG.BD_KEY_RATCHET,
                round: 2,
                new_key_id: this.bd.current_key_id + 1,
                data: this.bd.Ks[this.chord.id].toString()
            });

            this.bd.sent_r2 = true;
        };

        this.bd.handleBDMessage = (round, from, data, new_key_id) => {
            let left, right;

            // OldBlue self-delivery
            if (from === this.chord.id) {
                return;
            }

            if (new_key_id !== this.bd.current_key_id + 1) {
                console.log(`Got wrong key_id during Key Ratcheting: ` +
                    `got ${new_key_id}, expected ${this.bd.current_key_id + 1}`);
                return;
            }

            switch (round) {
                case 1:
                    if (!this.bd.sent_r1) {
                        this.bd.sendRound1();
                    }

                    this.bd.ks[from] = new BigInteger(data, 10);

                    left = this.bd.ks[this.bd.left];
                    right = this.bd.ks[this.bd.right];

                    if (left && right) {
                        if (!this.bd.sent_r2) {
                            this.bd.sendRound2();
                        }
                    }

                    break;
                case 2:
                    this.bd.Ks[from] = new BigInteger(data, 10);

                    if (Object.keys(this.bd.Ks).length === this.bd.n) {
                        left = this.bd.ks[this.bd.left];
                        let shared_secret = left.modPow(this.bd.x.multiply(this.bd.n_bi), settings.pmod);

                        for (let i = 0; i < this.bd.n - 1; ++i) {
                            let d = this.bd.n_bi.subtract(new BigInteger((i + 1).toString(), 10));

                            shared_secret = shared_secret
                                .multiply(this.bd.Ks[this.bd.sorted_peers[(this.bd.k + i) % this.bd.n]]
                                    .modPow(d, settings.pmod)).mod(settings.pmod);
                        }

                        this.bd.reset(true);
                        this.bd.session_keys[new_key_id] = {
                            key: sha256.hex(shared_secret.toString()).slice(0, 32),
                            received_from: {}
                        };
                    }

                    break;
                default:

            }
        };

        /**
         * When the time since the last Key Ratcheting will
         * be more than KEY_TTL a new one will be triggered
         */
        $_.ee.addListener($_.EVENTS.MPOTR_START, () => {
            this.bd.reset();
        });

        /**
         * When messages_on_this_key > MAX_MSGS_ON_KEY
         * Key Ratcheting will start.
         */
        $_.ee.addListener($_.EVENTS.OLDBLUE_MSG_DELIVERED, (msg) => {
            //if(msg.room != this.room.id)
            //    return;

            let key_id = msg["key_id"];
            let from = msg["from"];

            this.bd.messages_on_this_key += 1;

            this.bd.session_keys[key_id].received_from[from] = true;

            if (Object.values(this.bd.session_keys[key_id].received_from).length === this.bd.n) {
                for (let key_id_to_delete of Object.keys(this.bd.session_keys)) {
                    if (key_id_to_delete < key_id) {
                        delete this.bd.session_keys[key_id_to_delete];
                    }
                }
            }
        });

        /**
         * OldBlue listener for Key Ratcheting messages
         */
        $_.ee.addListener($_.MSG.BD_KEY_RATCHET, this.checkStatus([$_.STATUS.MPOTR], (data) => {
            //if(data.room != this.room.id)
                this.receiveMessage(data);
        }));

        /**
         * Daemon.
         *
         * Daemon is responsible for performing periodic tasks, like a
         * key renewal or requesting for lost messages
         */
        this.daemon = setInterval(() => {
            // Заменить на emitEvent
            switch(this.status) {
                case $_.STATUS.MPOTR:
                    if (!this.bd.ratcheting_now) {
                        let elapsed_since_last_kr = performance.now() - this.bd.last_kr_time;
                        if (this.bd.messages_on_this_key > this.bd.MAX_MSGS_ON_THE_KEY || elapsed_since_last_kr > this.bd.KEY_TTL) {
                            this.bd.sendRound1();
                        }
                    }

                break;
                default:

                break;
            }
        }, 3000);
    }

    return mpOTRContext;
};