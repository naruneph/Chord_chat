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


    const MODULUS = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF", 16),
          //ORDER =   new BigInteger("7FFFFFFFFFFFFFFFE487ED5110B4611A62633145C06E0E68948127044533E63A0105DF531D89CD9128A5043CC71A026EF7CA8CD9E69D218D98158536F92F8A1BA7F09AB6B6A8E122F242DABB312F3F637A262174D31BF6B585FFAE5B7A035BF6F71C35FDAD44CFD2D74F9208BE258FF324943328F6722D9EE1003E5C50B1DF82CC6D241B0E2AE9CD348B1FD47E9267AFC1B2AE91EE51D6CB0E3179AB1042A95DCF6A9483B84B4B36B3861AA7255E4C0278BA36046511B993FFFFFFFFFFFFFFFF", 16),
          GENERATOR = new BigInteger("2", 16);

    this.randomExponent = function(){
        return settings.generateNumber().mod(MODULUS);
    } 

    this.init = function() {
        this.context = context;
        this.myID = chat.id;
        this.secret = this.randomExponent();
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
                        let val = (this.subgroups[siblingGroupIdx].value).modPow(this.subgroups[this.myIndex].value, MODULUS);
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
                // событие: выработан общий секрет: ФИНИШ
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
        bsList[idList.indexOf(this.myID)] = GENERATOR.modPow(this.secret, MODULUS).toString(16); 
        
        var msg = {
            "type": $_.MSG.CCEGK,
            "data": {
                from: this.myID,
                blindedSecret: GENERATOR.modPow(this.subgroups[this.myIndex].value, MODULUS).toString(16),
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


}

module.exports = CCEGK;