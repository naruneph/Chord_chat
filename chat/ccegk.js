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


function CCEGK ($_, context, settings) {

    this.context = context;
    this.myID = chat.id;
    this.secret = settings.randomExponent();

    this.init = function() {

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


    this.handleMessage = function(from, blindedSecret, idList, bsList, level){

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

    this.createAndSendMsg = function(target){
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

    this.findSiblingGroupIndex = function(){
        var sibling = null;
        if ((this.myIndex % 2 === 0) && this.subgroups[this.myIndex + 1]){  
            sibling = this.myIndex + 1;
        } else if ((this.myIndex % 2 === 1)){  
            sibling = this.myIndex - 1;
        }
        return sibling;
    };

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

}

module.exports = CCEGK;