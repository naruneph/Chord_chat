const CCEGK = require("./ccegk");

function DGS ($_, context, settings) {

    this.context = context;
    this.myID = chat.id;
    this.ccegk = undefined;

    this.mySecret = undefined;
    this.groupPrivKey = undefined;
    this.groupPubKey = undefined;
    
    this.checkedPeers = undefined;

    

    this.setup = function () {

        if (this.ccegk === undefined){
            this.ccegk = new CCEGK($_, context, settings);
            this.ccegk.init();
        }

    };

    this.confirmPubKey = function () {
        var idList = Array.from(this.groupPubKey[1].keys()); 
        var bsList = [];
        Array.from(this.groupPubKey[1].values()).forEach(element => bsList.push(element.toString(16))); 

        var msg = {
            "type": $_.MSG.DGS_PUBKEY_CHECK,
            "data": {
                from: this.myID,
                blindedSecret: this.groupPubKey[0].toString(16),
                idList: idList,
                bsList: bsList
            },
            "room": this.context.room.id
        };


        let keys = Object.keys(msg);
        keys.sort();
        let result = "";
        for (let key of keys) {
            result += msg[key];
        }

        let sig1 = SK_LOG(result, this.groupPrivKey); 
        let sig2 = SK_LOG(result, this.mySecret); 

        msg['sk_groupPrivKey'] = [sig1[0].toString(16), sig1[1].toString(16)];
        msg['sk_memberSecret'] = [sig2[0].toString(16), sig2[1].toString(16)];


        this.context.signMessage(msg);
        this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, msg);
    };

    this.checkPubKey = function (msg) {

        let from = msg["data"]["from"];
        let blindedSecret = new BigInteger(msg["data"]["blindedSecret"], 16);
        let idList = msg["data"]["idList"];
        let bsList = [];
        for (let i = 0; i < msg["data"]["bsList"].length; i++){
            bsList.push(new BigInteger(msg["data"]["bsList"][i], 16));
        }
        

        if (blindedSecret.compareTo(this.groupPubKey[0]) !== 0){
            return false;
        }

        let myidList = Array.from(this.groupPubKey[1].keys());

        if(myidList.length !== idList.length){
            return false;
        } else {
            for(let i = 0; i < idList.length; i++){
                if (myidList[i] !== idList[i]){
                    return false;
                }
            }
        }

        var mybsList = Array.from(this.groupPubKey[1].values());

        if(mybsList.length !== bsList.length){
            return false;
        } else {
            for(let i = 0; i < bsList.length; i++){
                if (mybsList[i].compareTo(bsList[i]) !== 0){
                    return false;
                }
            }
        }
        
        let c1 = new BigInteger(msg['sk_groupPrivKey'][0],16);
        let s1 = new BigInteger(msg['sk_groupPrivKey'][1],16); 

        let c2 = new BigInteger(msg['sk_memberSecret'][0],16); 
        let s2 = new BigInteger(msg['sk_memberSecret'][1],16);

        delete msg['sk_groupPrivKey'];
        delete msg['sk_memberSecret'];

        let keys = Object.keys(msg);
        keys.sort();
        let data = "";
        for (let key of keys) {
            data += msg[key];
        }

        let res1 = check_SK_LOG (c1, s1, data, this.groupPubKey[0]);
        let res2 = check_SK_LOG (c2, s2, data, this.groupPubKey[1].get(from));

        return res1 && res2;
    };

    this.sign = function (msg) {
        let r = settings.randomExponent();
        let g_wave = settings.GENERATOR.modPow(r, settings.MODULUS);

        let temp = this.groupPubKey[0].modPow(r, settings.MODULUS); 
        let myZ = this.groupPubKey[1].get(this.myID); 
        let y_wave = temp.multiply(myZ).mod(settings.MODULUS); 

        let peersNumber = Array.from(this.groupPubKey[1].keys()).length; 
        let myI = Array.from(this.groupPubKey[1].keys()).indexOf(this.myID); 

        let Ru = [];
        let Rv = [];
        let C = [];
        for (let i = 0; i < peersNumber; i++){
            Ru[i] = settings.randomExponent();
            Rv[i] = settings.randomExponent();
            C[i] = new BigInteger(sha256.hex(settings.generateNumber().toString(16)),16);
        } 

        let u = [];
        let v = [];
        let w = [];
        let z = Array.from(this.groupPubKey[1].values());
        for (let i = 0; i < peersNumber; i++){
            if (i === myI){
                u[i] = this.groupPubKey[0].modPow(Ru[i], settings.MODULUS);
                v[i] = settings.GENERATOR.modPow(Rv[i], settings.MODULUS);
                w[i] = settings.GENERATOR.modPow(Ru[i], settings.MODULUS);
            } else {
                let t1 = y_wave.modPow(C[i], settings.MODULUS);
                let t2 = this.groupPubKey[0].modPow(Ru[i], settings.MODULUS);
                let t3 = settings.GENERATOR.modPow(Rv[i], settings.MODULUS);

                u[i] = t1.multiply(t2.multiply(t3).mod(settings.MODULUS)).mod(settings.MODULUS);

                let zc = z[i].modPow(C[i], settings.MODULUS);
                v[i] = zc.multiply(t3).mod(settings.MODULUS);

                let gwc = g_wave.modPow(C[i], settings.MODULUS);
                let gru = settings.GENERATOR.modPow(Ru[i], settings.MODULUS);
                w[i] = gwc.multiply(gru).mod(settings.MODULUS);   
            }
        } 

        let result = "";
        result += this.groupPubKey[0].toString(16);
        result += g_wave.toString(16);
        result += y_wave.toString(16);
        for (let i = 0; i < peersNumber; i++){
            if(i === myI){
                result += u[i].multiply(v[i]).mod(settings.MODULUS).toString(16);
            } else {
                result += u[i].toString(16);
            }
        }
        for (let i = 0; i < peersNumber; i++){
            result += v[i].toString(16);
        }
        for (let i = 0; i < peersNumber; i++){
            result += w[i].toString(16);
        }
        result += msg;


        C[myI] = new BigInteger(sha256.hex(result),16); 

        for (let i = 0; i < peersNumber; i++){
            if(i !== myI){
                C[myI] = C[myI].xor(C[i]);
            }
        }

        let Su = [];
        let Sv = [];
        for (let i = 0; i < peersNumber; i++){
            if (i === myI){
                let t1 = C[i].multiply(r).mod(settings.ORDER);
                Su[i] = Ru[i].subtract(t1).mod(settings.ORDER);

                let t2 = C[i].multiply(this.mySecret).mod(settings.ORDER);
                Sv[i] = Rv[i].subtract(t2).mod(settings.ORDER);
            } else {
                Su[i] = Ru[i];
                Sv[i] = Rv[i];
            }
        }

        return [g_wave, y_wave, C, Su, Sv];
    };

    this.publish_groupPubKey = function () {
        var idList = Array.from(this.groupPubKey[1].keys()); 
        var bsList = [];
        Array.from(this.groupPubKey[1].values()).forEach(element => bsList.push(element.toString(16))); 

        var pubKeyInfo = {
            "blindedSecret": this.groupPubKey[0].toString(16),
            "idList": idList,
            "bsList": bsList
        };

        let keys = Object.keys(pubKeyInfo);
        keys.sort();
        let result = "";
        for (let key of keys) {
            result += pubKeyInfo[key];
        }

        pubKeyInfo["group_sig"] = serialize_group_sig(this.sign(result)); 

        this.context.chord.put(`groupPubKey${this.context.room.id}`, pubKeyInfo);
    };

    this.removeUser = function (user) {
        this.ccegk.startRemoving(user); 
    };






    async function get_groupPubKey (rid, myPubKey){

        let pubKeyInfo = await chord.get(`groupPubKey${rid}`);

        let sig = settings.deserialize_group_sig(pubKeyInfo["group_sig"]);

        let keys = Object.keys(pubKeyInfo);
        keys.sort();
        let result = "";
        for (let key of keys) {
            if(key !== "group_sig"){
                result += pubKeyInfo[key];
            }
        }

        let groupPubKey = [];
        groupPubKey[0] = new BigInteger(pubKeyInfo["blindedSecret"], 16);
        groupPubKey[1] = new Map();
        for (let i = 0; i < pubKeyInfo["idList"].length; i++){
            groupPubKey[1].set(pubKeyInfo["idList"][i], new BigInteger(pubKeyInfo["bsList"][i], 16));
        }

        res1 = comp(groupPubKey, myPubKey);

        res2 = settings.verify(groupPubKey, result, sig["g_wave"], sig["y_wave"], sig["C"], sig["Su"], sig["Sv"]);

    
        if (res1 && res2){
            chat.groupsInfo.set(rid, groupPubKey);

            let data = [rid];
            E.ee.emitEvent(E.EVENTS.NEW_GROUP, [data]);
        }
    };

 
    function comp (groupPubKey, myPubKey){
        if(groupPubKey[0].compareTo(myPubKey[0]) !== 0){
            return false;
        }

        var idList1 = Array.from(groupPubKey[1].keys()); 
        var bsList1 = Array.from(groupPubKey[1].values());

        var idList2 = Array.from(myPubKey[1].keys()); 
        var bsList2 = Array.from(myPubKey[1].values());

        if(idList1.length !== idList2.length){
            return false;
        }

        for(let i = 0; i < idList1.length; i++){
            if( (idList1[i] !== idList2[i]) || (bsList1[i].compareTo(bsList2[i]) !== 0) ){
                return false;
            }
        }

        return true;
    };

    function SK_LOG (msg, x){ 
        let output = [];

        let r = settings.randomExponent(); 
        let t = settings.GENERATOR.modPow(r, settings.MODULUS); 

        let c = new BigInteger(sha256.hex(t.toString(16) + msg),16); 

        let cx = x.multiply(c).mod(settings.ORDER);
        let s = r.subtract(cx).mod(settings.ORDER);

        output.push(c);
        output.push(s);

        return output;
    }

    function check_SK_LOG (c, s, msg, gx){
        let gs = settings.GENERATOR.modPow(s, settings.MODULUS);
        let gxc = gx.modPow(c, settings.MODULUS);

        let gr = gs.multiply(gxc).mod(settings.MODULUS);

        let value = new BigInteger(sha256.hex(gr.toString(16) + msg),16);

        let comp = value.compareTo(c) === 0;

        return comp;
    }

    function serialize_group_sig (sig){
        let C = [];
        for (let i = 0; i < sig[2].length; i++){
            C.push(sig[2][i].toString(16));
        }

        let Su = [];
        for (let i = 0; i < sig[3].length; i++){
            Su.push(sig[3][i].toString(16));
        }

        let Sv = [];
        for (let i = 0; i < sig[4].length; i++){
            Sv.push(sig[4][i].toString(16));
        }

        let output = {
            "g_wave": sig[0].toString(16),
            "y_wave": sig[1].toString(16),
            "C": C,
            "Su": Su,
            "Sv": Sv
        }

        return output;
    }


    $_.ee.addListener($_.EVENTS.CCEGK_FINISH, this.context.checkStatus([$_.STATUS.MPOTR], () => {
        this.mySecret = this.ccegk.secret;

        this.groupPrivKey = this.ccegk.group.value;

        this.groupPubKey = [];
        this.groupPubKey[0] = settings.GENERATOR.modPow(this.groupPrivKey, settings.MODULUS);
        let val = this.ccegk.group.leavesInfo();
        val.set(this.myID, settings.GENERATOR.modPow(this.ccegk.secret, settings.MODULUS));
        this.groupPubKey[1] = val;

        this.checkedPeers = {
            "GOOD": [],
            "BAD" : []
        };
        this.confirmPubKey();
    }));

    $_.ee.addListener($_.MSG.DGS_PUBKEY_CHECK, this.context.checkStatus([$_.STATUS.MPOTR], (data) => {
        
        if (!this.context.checkSig(data, data["data"]["from"])) {
            alert("Signature check fail");
            return;
        }
        delete data['sig'];

        
        if(this.checkPubKey(data)){
            this.checkedPeers["GOOD"].push(data["data"]["from"]);
        } else {
            this.checkedPeers["BAD"].push(data["data"]["from"]);
        }

        let peersNumber = Array.from(this.groupPubKey[1].keys()).length;
        
        
        if(this.checkedPeers["GOOD"].length + this.checkedPeers["BAD"].length + 1 === peersNumber){
            if(this.checkedPeers["BAD"].length){
                alert("Another group pubkey view", this.checkedPeers["BAD"]);
                return;
            } else {
              
                console.warn("договорились");

                if(this.ccegk.group.leaderID() === this.myID){
                    this.publish_groupPubKey();
                }

                setTimeout(get_groupPubKey, 3000, this.context.room.id, this.groupPubKey);

            }
        }

    }));



}
module.exports = DGS;



