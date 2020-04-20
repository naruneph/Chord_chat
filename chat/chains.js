function Chains ($_, context){

    this.context = context;
    this.myID = chat.id;
    this.subgroups = []; 
    this.unreachableUsers = [];  
    this.myBlackList = []; 
    this.othersBlackList = [];
    this.mail = new Map();
    this.groupsInfo = undefined;
    this.chains = new Map(); // uid1 : [{uid2, chains}, ...]
    this.circle = undefined;

    this.myTargets = {}; // uid: ({chain: info})
    this.iAmTarget = {}; // uid: ({chain: info})


    this.init = function(){ 

        var users = [this.myID].concat(this.context.room.users);
        users.sort();
        var me = users.indexOf(this.myID);
        users = users.splice(me + 1).concat(users);

        users.forEach(el => this.subgroups.push([el]));

        this.circle = users.slice(0, users.length - 1);
        
        this.context.chord.get_groupPubKeys().then( groupsInfo => {


            groupsInfo.forEach(item => {
                if(item.idList.includes(this.myID) && !chat.dgsList.has(item.roomId)){
                    this.myBlackList.push(item.roomId);
                } 
            });

            groupsInfo.filter(el => !this.myBlackList.includes(el.roomId));
        
            this.groupsInfo = groupsInfo;

            var msg = {
                "type": $_.MSG.CHAINS_BLACK_LIST,
                "from": this.myID,
                "blackList": this.myBlackList,
                "room": this.context.room.id
            };
    
            this.context.signMessage(msg); 
            this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, msg);
            
        });



    };

    this.search = function(){ 
        for(let target of this.subgroups){

            if(!target.includes(this.myID)){
                for(let t of target){
                    if(!this.unreachableUsers.includes(t)){

                        this.context.cgList[t].init(t, this.groupsInfo);

                        if(!this.context.cgList[t].chains.length){
                            this.unreachableUsers.push(t);
                        } else {
                            let tmp;
                            if(this.chains.has(this.myID)){
                                tmp = this.chains.get(this.myID);
                            } else {
                                tmp = [];
                            }
                            tmp.push({"id": t, "chains": this.context.cgList[t].chains})
                            this.chains.set(this.myID, tmp);
                            return;  
                        }

                    } 
                }
            } 
        }
        if(!this.chains.has(this.myID)){
            this.chains.set(this.myID, []);
        }
    }

    this.checkChain = function(fromID, targetID, chain){

        var prevIdList, intersection, group;

        for(var i = 0; i < chain.length; i++){

            if(this.myBlackList.includes(chain[i]) || this.othersBlackList.includes(chain[i])){
                return false;
            }

            for(gr of this.groupsInfo){
                if(gr.roomId === chain[i]){
                    group = gr;
                    break;
                }
            }

            if(i === 0){

                if(!group.idList.includes(fromID)){
                    return false;
                }

                prevIdList = group.idList;

            } else if(i === chain.length - 1){

                if(!group.idList.includes(targetID)){
                    return false;
                }

                intersection = prevIdList.filter(el => group.idList.includes(el));

                if(intersection.length === 0){
                    return false;
                }

            } else {

                intersection = prevIdList.filter(el => group.idList.includes(el));

                if(intersection.length === 0){
                    return false;
                }

                prevIdList = group.idList;
            }
        
        }

        return true;
    }

    $_.ee.addListener($_.MSG.CHAINS_BLACK_LIST, this.context.checkStatus([$_.STATUS.MPOTR], (data) => {
        if (!this.context.checkSig(data, data["from"])) {
            alert("Signature check fail");
            return;
        }
        delete data['sig'];

        this.mail.set(data["from"], data["blackList"]);

        if(this.mail.size === this.context.room.users.length){
            $_.ee.emitEvent($_.EVENTS.CHAINS_BLACK_LIST);
        }
    }));

    $_.ee.addListener($_.EVENTS.CHAINS_BLACK_LIST, this.context.checkStatus([$_.STATUS.MPOTR], () => {

        Array.from(this.mail.values()).forEach( el => this.othersBlackList = [...this.othersBlackList.concat(el)]);
        this.mail.clear();


        this.groupsInfo = this.groupsInfo.filter(item => !this.othersBlackList.includes(item.roomId));


        this.search();

        var chainsInfo = []; 

        this.chains.get(this.myID).forEach(el => {  
           
            var targetID = el.id;
            var chains = [];

            el.chains.forEach(chain => {
                let tmp = [];
                for(let group of chain){
                    tmp.push(group.roomId);
                }
                chains.push(tmp);
            });

            chainsInfo.push({"id": targetID, "chains": chains});
        });

        var msg = {
            "type": $_.MSG.CHAINS_SEARCH,
            "from": this.myID,
            "chainsInfo": chainsInfo, //  [] / [ {"id": uid, "chains": [[rids], ...]}, ... ]   
            "room": this.context.room.id
        };

        this.context.signMessage(msg); 
        this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, msg); 

    }));

    $_.ee.addListener($_.MSG.CHAINS_SEARCH, this.context.checkStatus([$_.STATUS.MPOTR], (data) => {
        if (!this.context.checkSig(data, data["from"])) {
            alert("Signature check fail");
            return;
        }
        delete data['sig'];

        this.mail.set(data["from"], data["chainsInfo"]);

        if(this.mail.size === this.context.room.users.length){
            $_.ee.emitEvent($_.EVENTS.CHAINS_SEARCH);
        }
    }));

    $_.ee.addListener($_.EVENTS.CHAINS_SEARCH, this.context.checkStatus([$_.STATUS.MPOTR], () => {

        var old_subgroups_amount = this.subgroups.length;

        for(var msg of this.mail) {         //msg[0] = from   msg[1] =  [] / [ {"id": uid, "chains": [[rids], ...]}, ... ]  
            
            var fromID = msg[0];
            var chainsInfo = msg[1];

            var old;
            var oldTargets = [];

            if(this.chains.has(fromID)){

                if(chainsInfo.length === 0){
                    continue;
                }
                old = this.chains.get(fromID);
                old.forEach(el => oldTargets.push(el.id));

            } else {

                if(chainsInfo.length === 0){
                    this.chains.set(fromID, []);
                    continue;
                }
                old = [];

            }

            for(var info of chainsInfo){

                if(oldTargets.includes(info.id)){
                    continue;
                }

                var checkedChains = [];

                for(var chain of info.chains){
                    if(this.checkChain(fromID, info.id, chain)){
                        checkedChains.push(chain);
                    }
                }

                old.push({"id": info.id, "chains": checkedChains});



                var subgroup_from, subgroup_target, idx_f, idx_t, flag;

                for(var i = 0; i < this.subgroups.length; i++){

                    if(this.subgroups[i].includes(fromID) && this.subgroups[i].includes(info.id)){
                        flag = false;
                    } else if(this.subgroups[i].includes(fromID)){
                        idx_f = i;
                        subgroup_from = this.subgroups[i];
                        flag = true;
                        break;
                    }
                }

                if(flag){
                    this.subgroups.splice(idx_f, 1);
                    for(var i = 0; i < this.subgroups.length; i++){
                        if(this.subgroups[i].includes(info.id)){
                            idx_t = i;
                            subgroup_target = this.subgroups[i];
                            break;
                        }
                    }
                    this.subgroups.splice(idx_t, 1);
                    var new_subgroup = subgroup_from.concat(subgroup_target);
                    this.subgroups.push(new_subgroup);
                }
            }
            
            this.chains.set(fromID, old);
            
        }

        this.subgroups.sort();

        var my_subgroup;
        for(var i = 0; i < this.subgroups.length; i++){
            if(this.subgroups[i].includes(this.myID)){
                my_subgroup = i;
                break;
            }
        }

        this.subgroups = this.subgroups.splice(my_subgroup + 1).concat(this.subgroups);

        this.mail.clear();

        if(this.subgroups.length === 1){ 

            console.warn("Chains: Success");

            var targets = this.chains.get(this.myID);

            this.myTargets[targets[0].id] = {};

            targets[0].chains.forEach(chain => {
                var rids = [];
                for(var group of chain){
                    rids.push(group.roomId);
                }
                this.myTargets[targets[0].id][rids] = null;
            });

            


            var data = {
                "circle": this.circle,
                "aim": targets[0].id,
                "chains": targets[0].chains
            };

            $_.ee.emitEvent($_.EVENTS.CHAINS_SUCCESS, [data]);

        } else if (this.subgroups.length === old_subgroups_amount){ 

            console.warn("Chains: Fail");

            this.circle = undefined;

            var rslt = "";

            for(var target of this.subgroups){
                for(var t of target){

                    rslt += chat.names[t];
                    rslt += '<-->';

                }

                rslt = rslt.slice(0, -4);
                rslt += '    ';
            }
            rslt = rslt.slice(0, -4);

            
            GUI.showNotification(`Не удалось объединить всех участников беседы "${this.context.room.name}", результаты:\n "${rslt}"`, 8000);

        } else {
            this.search();

            var chainsInfo = []; 
    
            this.chains.get(this.myID).forEach(el => {  
               
                var targetID = el.id;
                var chains = [];
    
                el.chains.forEach(chain => {
                    let tmp = [];
                    for(let group of chain){
                        tmp.push(group.roomId);
                    }
                    chains.push(tmp);
                });
    
                chainsInfo.push({"id": targetID, "chains": chains});
            });
    
            var msg = {
                "type": $_.MSG.CHAINS_SEARCH,
                "from": this.myID,
                "chainsInfo": chainsInfo, //[] / [ {"id": uid, "chains": [[rids], ...]}, ... ]  
                "room": this.context.room.id 
            };
    
            this.context.signMessage(msg); 
            this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, msg); 
        }

    }));

    $_.ee.addListener($_.EVENTS.CHAINS_CHECK_PROOFS, this.context.checkStatus([$_.STATUS.MPOTR], (data) => {

        var user_id = data[0];
        var init = data[1];


        var myInfo = cryptico.publicKeyID(this.context.longtermPubKeys[user_id].toString(16));
        var fingerprints;
        if(init){
            fingerprints = Object.values(this.myTargets[user_id]);
        } else {
            fingerprints = Object.values(this.iAmTarget[user_id]);
        }

        var result = true;

        for(var val of fingerprints){
            if(val !== myInfo){
                result = false;
            }
        }

        if(init){

            if(result){

                if(!chat.validUsers.has(user_id)){
                    chat.validUsers.set(user_id, this.context.longtermPubKeys[user_id].toString(16));
                }

                this.context.circleChains.result[user_id] = $_.CC_RESULTS.GOOD;
                this.context.circleChains.status = $_.CC_STATUS.DONE;


                this.context.circleChains.groups[user_id] = this.myID;
                this.context.circleChains.amount_unknown -= 1;

                
                this.context.circleChains.checked_by_me.push(user_id);

                if (this.context.circleChains.ready_to_send_res() === 1){
                    this.context.circleChains.sendResults();
                }
                if (this.context.circleChains.mail[user_id] !== undefined){
                    this.context.circleChains.handleMessage(user_id, this.context.circleChains.mail[user_id]);
                }



            } else {

                if(chat.validUsers.has(user_id) && (chat.validUsers.get(user_id) === this.context.longtermPubKeys[user_id].toString(16))){
                    chat.validUsers.delete(user_id);
                }
                this.context.circleChains.result[user_id] = $_.CC_RESULTS.BAD;
                this.context.circleChains.status = $_.CC_STATUS.FREE;
                this.context.circleChains.groups[user_id] = user_id;
                this.context.circleChains.amount_unknown -= 1;

                this.context.circleChains.checked_by_me.push(user_id);
                if (this.context.circleChains.ready_to_send_res() === 1){
                    this.context.circleChains.sendResults();
                }
                if (this.context.circleChains.mail[user_id] !== undefined){
                    this.context.circleChains.handleMessage(user_id, this.context.circleChains.mail[user_id]);
                }


                if (this.context.circleChains.status === $_.CC_STATUS.FREE){
                    if (this.context.circleChains.choose_aim()){  
                        
                        var aim = this.context.circleChains.aim;
                        
                        this.context.circleChains.result[aim]= $_.CC_RESULTS.IN_PROCESS;
                        this.context.circleChains.status = $_.CC_STATUS.CHECKING;

                        
                        this.context.cgList[aim].init(aim, this.groupsInfo);

                        this.myTargets[aim] = {};
                        this.context.cgList[aim].chains.forEach(el => this.myTargets[aim][el] = null);

                    
                        var new_data = [aim, this.context.cgList[aim].chains];

                        E.ee.emitEvent(E.EVENTS.CHAINS_PROOF_INIT, [new_data]);

                    }

                }

            }
        } else {
            if(result){
                if(!chat.validUsers.has(user_id)){
                    chat.validUsers.set(user_id, this.context.longtermPubKeys[user_id].toString(16));
                }
                this.context.circleChains.result[user_id] = $_.CSMP_RESULTS.GOOD;
                this.context.circleChains.groups[user_id] = this.myID;
            } else {
                if(chat.validUsers.has(user_id) && (chat.validUsers.get(user_id) === this.context.longtermPubKeys[user_id].toString(16))){
                    chat.validUsers.delete(user_id);
                }
                this.context.circleChains.result[user_id] = $_.CC_RESULTS.BAD;
                this.context.circleChains.groups[user_id] = user_id;
            }

            this.context.circleChains.amount_unknown -= 1;
            this.context.circleChains.checked_by_me.push(user_id);

            if (this.context.circleChains.ready_to_send_res() === 1){
                this.context.circleChains.sendResults();
            }
            if (this.context.circleChains.mail[user_id] !== undefined){
                this.context.circleChains.handleMessage(user_id, this.context.circleChains.mail[user_id]);
            }

        }
        GUI.updateUsers();
    }));


}

module.exports = Chains;
