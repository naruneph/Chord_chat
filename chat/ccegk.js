function Tree (id, value, left, right) {
    this.id = id || null; 
    this.value = value || null;

    this.left = left || null;
    this.right = right || null;

    this.leaderID = function(){
        let t = this;
        while (t.right){
            t = t.right;
        }
        return t.id;
    }; 

    this.leavesInfo = function() {
       var output = new Map();
       searchLeaves(this, output);
       return output;
    };

    this.fillLeaves = function(idList, bsList){
        var input = new Map();
        for(var i = 0; i < idList.length; i++){
            input.set(idList[i], bsList[i]);
        }
        fillLeaves (this, input);
    };
 
}

function searchLeaves (tree, output) {
    if(tree.left) {
        searchLeaves(tree.left, output);
    }
       
    if(!tree.left && !tree.right){
        output.set(tree.id, tree.value);
    }

    if(tree.right) {
        searchLeaves(tree.right, output);
    }
    
}

function fillLeaves (tree, input){
    if(tree.left) {
        fillLeaves(tree.left, input);
    }

    if(!tree.left && !tree.right){
        tree.value =  input.get(tree.id);
    }

    if(tree.right) {
        fillLeaves(tree.right, input);
    }
    
}

function findLeafSibling (tree, userID, sibling){
    if(tree.left){
        if(tree.left.id === userID){
            sibling.push(tree.right);
            return;
        } else {
            findLeafSibling(tree.left, userID, sibling);
        }
    }

    if(tree.right){
        if(tree.right.id === userID){
            sibling.push(tree.left);
            return;
        } else {
            findLeafSibling(tree.right, userID, sibling);
        }
    }
}

function set_leader_value (tree, val){
    if(tree.right){
        set_leader_value(tree.right, val);
    } else {
        tree.value = val;
    }
}


function CCEGK ($_, context, settings) {

    this.context = context;
    this.myID = chat.id;
    this.secret = settings.randomExponent(); 

    this.init = function (){

        this.group = null;
        this.level = 0;
        this.mail = new Map();

        this.subgroups = [];
        var members = ([this.myID].concat(context.room.users)).sort();
        for (var i = 0; i < members.length; i++){
            this.subgroups.push(new Tree(members[i]));
        }

        this.myIndex = members.indexOf(this.myID);
        this.subgroups[this.myIndex].value = this.secret;

        var siblingGroupIdx = this.findSiblingGroupIndex();

        if(this.subgroups[siblingGroupIdx]){
            this.createAndSendMsg(this.subgroups[siblingGroupIdx]);
        } else {
            while(this.subgroups.length % 2 !== 0){
                var tempList = [];
                for (var i = 0; i < this.subgroups.length; i = i + 2){
                    if(i + 1 < this.subgroups.length){
                        tempList.push(new Tree(null, null, this.subgroups[i], this.subgroups[i+1]));
                    } else {
                        tempList.push(this.subgroups[i]);
                    }
                }                                                
                this.subgroups = tempList;                      
                this.level++;
                this.myIndex = this.myIndex / 2; 
            }

            siblingGroupIdx = this.findSiblingGroupIndex();
            this.createAndSendMsg(this.subgroups[siblingGroupIdx]);
        }    
    };

    this.handleMessage = function (from, blindedSecret, idList, bsList, level){

        if (this.level === level){

            var siblingGroupIdx = this.findSiblingGroupIndex();               
            if(this.subgroups[siblingGroupIdx].leaderID() !== from){ 
                alert("Wrong CCEGK message");
            } 
            this.subgroups[siblingGroupIdx].value = blindedSecret; 
            this.subgroups[siblingGroupIdx].fillLeaves(idList, bsList); 
 
            var tempList = []; 
            for (var i = 0; i < this.subgroups.length; i = i + 2){
                if(i + 1 < this.subgroups.length){
                    if(this.myIndex === i  || this.myIndex === i+1){
                        let val = (this.subgroups[siblingGroupIdx].value).modPow(this.subgroups[this.myIndex].value, settings.MODULUS);
                        tempList.push(new Tree(null, val, this.subgroups[i], this.subgroups[i+1]));
                    } else {
                        tempList.push(new Tree(null, null, this.subgroups[i], this.subgroups[i+1]));
                    }
                } else {
                    tempList.push(this.subgroups[i]);
                }                                 
            }
            this.subgroups = tempList; 

            if (this.myIndex % 2 === 0){
                this.myIndex = this.myIndex / 2;
            } else {
                this.myIndex = (this.myIndex - 1)  / 2;   
            }

            this.level++;

            if (this.subgroups.length === 1){ 

                this.group = this.subgroups[0];
                $_.ee.emitEvent($_.EVENTS.CCEGK_FINISH);

            } else {
                var nextSiblingGroupIdx = this.findSiblingGroupIndex();

                if (this.subgroups[nextSiblingGroupIdx]){
                    if(this.subgroups[this.myIndex].leaderID() === this.myID){
                        this.createAndSendMsg(this.subgroups[nextSiblingGroupIdx]);
                    }
                } else {
                    while(this.subgroups.length % 2 !== 0){
                        var tempList = [];
                        for (var i = 0; i < this.subgroups.length; i = i + 2){
                            if(i + 1 < this.subgroups.length){
                                tempList.push(new Tree(null, null, this.subgroups[i], this.subgroups[i+1]));
                            } else {
                                tempList.push(this.subgroups[i]);
                            }
                        }
                        this.subgroups = tempList;
                        this.level++;
                        this.myIndex = this.myIndex / 2; 
                    }

                    nextSiblingGroupIdx = this.findSiblingGroupIndex();
                    if(this.subgroups[this.myIndex].leaderID() === this.myID){
                        this.createAndSendMsg(this.subgroups[nextSiblingGroupIdx]);
                    }

                }       
            }

        } else {
            this.mail.set(level, [from, blindedSecret, idList, bsList]); 
        }

        if (this.mail.has(this.level)) {
            let msg = this.mail.get(this.level);
            this.mail.delete(this.level);
            let from = msg[0];
            let blindedSecret = msg[1];
            let idList = msg[2];
            let bsList = msg[3];
            
            this.handleMessage(from, blindedSecret, idList, bsList, this.level);

        }
    };

    this.createAndSendMsg = function (target){
        var leavesInfo = this.subgroups[this.myIndex].leavesInfo();

        var idList = Array.from(leavesInfo.keys());

        var bsList = [];
        Array.from(leavesInfo.values()).forEach(element => bsList.push(element.toString(16)));
        bsList[idList.indexOf(this.myID)] = settings.GENERATOR.modPow(this.secret, settings.MODULUS).toString(16); 
        
        var msg = {
            "type": $_.MSG.CCEGK,
            "data": {
                from: this.myID,
                blindedSecret: settings.GENERATOR.modPow(this.subgroups[this.myIndex].value, settings.MODULUS).toString(16),
                idList: idList,
                bsList: bsList,
                level: this.level.toString()
            },
            "room": this.context.room.id
        };

        this.context.signMessage(msg);

        Array.from(target.leavesInfo().keys()).forEach(user =>  
            this.context.chord.send(user, msg.type, msg)
        );
        
    };

    this.findSiblingGroupIndex = function (){
        var sibling = null;
        if ((this.myIndex % 2 === 0) && this.subgroups[this.myIndex + 1]){  
            sibling = this.myIndex + 1;
        } else if ((this.myIndex % 2 === 1)){  
            sibling = this.myIndex - 1;
        }
        return sibling;
    };




    this.startRemoving = function (leavedUser){ 

        chat.leaved = null;
     
        var sibling = [];
        findLeafSibling(this.group, leavedUser, sibling);
        
        if(sibling[0].leaderID() === this.myID){  

            var bsList = [];

            this.secret = settings.randomExponent(); 
            local_update_asLeader(sibling[0], this.secret, bsList); 

            var flag = [];
            flag.push(false);

           
            global_update_asLeader(this.group, leavedUser, this.myID, bsList, flag); 

            var msg = {
                "type": $_.MSG.CCEGK_REMOVING,
                "leavedUser": leavedUser,
                "leaderID": this.myID,
                "bsList": bsList,
                "room": this.context.room.id
            } 
    
 
            this.context.signMessage(msg); 
            this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, msg); 

            $_.ee.emitEvent($_.EVENTS.CCEGK_FINISH);
        } 
    };

    function local_update_asLeader (tree, val, bsList){ 
        if(tree.right && tree.left){ 
            if(tree.right.right){
                local_update_asLeader(tree.right, val, bsList);
            } else {
                tree.right.value = val;
                bsList.push(settings.GENERATOR.modPow(tree.right.value, settings.MODULUS).toString(16));  
            }
            tree.value = tree.left.value.modPow(tree.right.value, settings.MODULUS);
            bsList.push(settings.GENERATOR.modPow(tree.value, settings.MODULUS).toString(16)); 
        } else {
            tree.value = val;
            bsList.push(settings.GENERATOR.modPow(tree.value, settings.MODULUS).toString(16));
        }
    }

    function global_update_asLeader (tree, leavedUserID, myID, bsList, flag){
        if(tree.left && !flag[0]){
            if(tree.left.id === leavedUserID){

                                
                tree.left = tree.right.left;                
                tree.value = tree.right.value;
                tree.id = tree.right.id;

                tree.right = tree.right.right;

                flag.pop();
                flag.push(true); 

                return;
            } else {
                global_update_asLeader(tree.left, leavedUserID, myID, bsList, flag); 
            }

            if(flag[0]){
                
                if(tree.left.leavesInfo().has(myID)){ 
                    tree.value = tree.right.value.modPow(tree.left.value, settings.MODULUS);
                } else {
                    tree.value = tree.left.value.modPow(tree.right.value, settings.MODULUS);
                }

                bsList.push(settings.GENERATOR.modPow(tree.value, settings.MODULUS).toString(16));
            } 

        }

        if(tree.right && !flag[0]){
            if(tree.right.id === leavedUserID){

                                            
                tree.right = tree.left.right;
                tree.value = tree.left.value;
                tree.id = tree.left.id;

                tree.left = tree.left.left; 

                flag.pop();
                flag.push(true);
                return;

            } else {
                global_update_asLeader(tree.right, leavedUserID, myID, bsList, flag);  
            }

            if(flag[0]){

                if(tree.right.leavesInfo().has(myID)){
                    tree.value = tree.left.value.modPow(tree.right.value, settings.MODULUS);
                } else {
                    tree.value = tree.right.value.modPow(tree.left.value, settings.MODULUS);
                }

                bsList.push(settings.GENERATOR.modPow(tree.value, settings.MODULUS).toString(16)); 
            }
        }
    }

    function update_structure (tree, leavedUserID, bsList, flag){
        if(tree.left && !flag[0]){
            if(tree.left.id === leavedUserID){ 
               
                tree.left = tree.right.left;                
                tree.value = tree.right.value;
                tree.id = tree.right.id;

                tree.right = tree.right.right;

                set_leader_value(tree, bsList[0]);

                flag.pop();
                flag.push(true); 
                return;

            } else {
                update_structure(tree.left, leavedUserID, bsList, flag);
            }

        }

        if(tree.right && !flag[0]){
            if(tree.right.id === leavedUserID){ 

                tree.right = tree.left.right;
                tree.value = tree.left.value;
                tree.id = tree.left.id;

                tree.left = tree.left.left; 

                set_leader_value(tree, bsList[0]);

                flag.pop();
                flag.push(true);
                return;

            } else {
                update_structure(tree.right, leavedUserID, bsList, flag);
            }

        }

    }

    function update_data (tree, leaderID, myID, bsList, flag){
        
        if (!flag[0]){
            let leaves = tree.leavesInfo();
            if (leaves.has(leaderID) && leaves.has(myID)){
                bsList.pop(); 
                update_data(tree.left, leaderID, myID, bsList, flag);
            } else if (leaves.has(leaderID)) {  
           
                tree.value = bsList.pop();
                
                flag.pop();
                flag.push(true);
                return;
            }

            if(flag[0]){
                if(tree.left.leavesInfo().has(myID)){
                    tree.value = tree.right.value.modPow(tree.left.value, settings.MODULUS); 
                } else {
                    tree.value = tree.left.value.modPow(tree.right.value, settings.MODULUS); 
                }
            }
        }

        if (!flag[0]){
            let leaves = tree.leavesInfo();
            if (leaves.has(leaderID) && leaves.has(myID)){

                update_data(tree.right, leaderID, myID, bsList, flag);
            } else if (leaves.has(leaderID)) {
                
                tree.value = bsList.pop()
                
                flag.pop();
                flag.push(true);
                return;
            }

            if(flag[0]){ 
                if(tree.right.leavesInfo().has(myID)){
                    tree.value = tree.left.value.modPow(tree.right.value, settings.MODULUS); 
                } else {
                    tree.value = tree.right.value.modPow(tree.left.value, settings.MODULUS); 
                }
            }
        }
    }






    $_.ee.addListener($_.MSG.CCEGK, this.context.checkStatus([$_.STATUS.MPOTR], (data) => {

        if (!this.context.checkSig(data, data["data"]["from"])) {
            alert("Signature check fail");
            return;
        }

        let from = data["data"]["from"];
        let blindedSecret = new BigInteger(data["data"]["blindedSecret"], 16);
        let idList = data["data"]["idList"];
        let bsList = [];
        for (let i = 0; i < data["data"]["bsList"].length; i++){
            bsList.push(new BigInteger(data["data"]["bsList"][i], 16));
        }
        let level = Number(data["data"]["level"]);

        this.handleMessage(from, blindedSecret, idList, bsList, level);
    }));

    $_.ee.addListener($_.MSG.CCEGK_REMOVING, this.context.checkStatus([$_.STATUS.MPOTR], (data) => { 

        if (!this.context.checkSig(data, data["leaderID"])) {
            alert("Signature check fail");
            return;
        }
    
        var bsList = [];
        data["bsList"].forEach(element => bsList.push(new BigInteger(element, 16)));

        var flag1 = [];
        flag1.push(false);
        update_structure(this.group, data["leavedUser"], bsList, flag1);

        var flag2 = [];
        flag2.push(false);
        update_data(this.group, data["leaderID"], this.myID, bsList, flag2);

      
        $_.ee.emitEvent($_.EVENTS.CCEGK_FINISH);
    }));
}

module.exports = CCEGK;