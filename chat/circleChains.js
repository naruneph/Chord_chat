function CircleChains($_, context) {
    this.ntime = 0;
    this.sum = 0;

    this.init = function (circle, aim) {
        this.context = context;
        this.status = $_.CC_STATUS.FREE;
        this.circle = circle;
        this.amount_unknown = context.room.users.length;
        this.aim = aim;
        this.result = {};
        this.mail = {};
        this.groups = new Map();
        this.checked_by_me = [];
        this.list_to_check = new Map();

        this.auth_flag = true;

        this.stime = 0;
        this.ftime = 0;


        for (var i = 0; i < this.context.room.users.length; ++i){
            var peer = this.context.room.users[i];
            this.mail[peer] = undefined;
            this.groups[peer] = '';
            this.result[peer] = $_.CC_RESULTS.UNKNOWN;
        }

        this.result[aim]= $_.CC_RESULTS.IN_PROCESS;
        this.status = $_.CC_STATUS.CHECKING;
      
    };


    this.ready_to_send_res = function(){
        for (var i = 0; i < this.circle.length; i++){
            if (this.result[this.circle[i]] === $_.CC_RESULTS.IN_PROCESS){
                return 0;
            }
        }
        return 1;
    };


    this.choose_aim = function () {
        if (this.amount_unknown <= 0) { 
            this.status = $_.CC_STATUS.DONE;

            this.ftime = +new Date();
            console.log("info", (this.ftime - this.stime).toString());
            this.sum += this.ftime - this.stime;
            this.stime = 0;

            if(this.auth_flag){
                this.auth_flag = false;
                $_.ee.emitEvent($_.EVENTS.AUTH_FINISH);
            }
            

            return 0;
        }

        if (this.status === $_.CC_STATUS.CHECKING) {
            return 0;
        }

        if (this.status === $_.CC_STATUS.FREE) {
            for (var i = 0; i < this.circle.length; i++) {
                if (this.result[this.circle[i]] === $_.CC_RESULTS.UNKNOWN) {
                    this.aim = this.circle[i];
                    return 1;
                }

                if (this.result[this.circle[i]] === $_.CC_RESULTS.IN_PROCESS) {
                    return 0;
                }

                if (this.result[this.circle[i]] === $_.CC_RESULTS.GOOD) {
                    this.status = $_.CC_STATUS.DONE;

                    return 0;
                }

            }
        }
        return 0;
    };


    this.sendResults = function () {

        if (Object.values(this.groups).indexOf(this.context.chord.id) === -1) {
            return;
        }

        var good = [];
        var bad = [];

        for (var i = 0; i < this.circle.length; i++) {

            if (this.result[this.circle[i]] === $_.CC_RESULTS.GOOD) {
                good.push(this.circle[i]);
            }
            if (this.result[this.circle[i]] === $_.CC_RESULTS.BAD) {
                bad.push(this.circle[i]);
            }
        }

        var msg = {
            "good": good,
            "bad": bad
        };

        var message = {
            "type": $_.MSG.CC_RESULT,
            "data": {
                from: this.context.chord.id,
                results: msg
            },
            "room": this.context.room.id
        };
        this.context.signMessage(message);

        this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, message);

    };


    this.handleMessage = function (from, results) {
        var bad = results['bad'];
        var good = results['good'];
        var peer;

        switch (this.result[from]) {
            case $_.CC_RESULTS.GOOD:
                this.groups[from] = this.context.chord.id;

                for (var i = 0; i < results['good'].length; i++) {
                    peer = good[i];

                    if (peer !== this.context.chord.id) {

                        if (this.result[peer] === $_.CC_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CC_RESULTS.GOOD;
                            this.groups[peer] = this.context.chord.id;
                            
                            if(!chat.validUsers.has(peer)){
                                chat.validUsers.set(peer, this.context.longtermPubKeys[peer].toString(16));
                            }


                            this.amount_unknown -= 1;

                            if (this.mail[peer] !== undefined) {
                                this.handleMessage(peer, this.mail[peer]);
                            }
                        }
                        else if (this.result[peer] === $_.CC_RESULTS.BAD) {
                            console.log('Get conflict: My friend says that bad? guy is good');
                        }

                    }

                }
                for (var i = 0; i < results['bad'].length; i++) {

                    peer = bad[i];

                    if (peer === this.context.chord.id) {
                        console.log('Conflict: My friend tells everyone that I am bad');
                    } else {
                        if (this.result[peer] === $_.CC_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CC_RESULTS.BAD;
                            this.groups[peer] = results['bad'];
                            
                            if(chat.validUsers.has(peer) && (chat.validUsers.get(peer) === this.context.longtermPubKeys[peer].toString(16))){
                                chat.validUsers.delete(peer);
                            }

                            this.amount_unknown -= 1;

                            if (this.mail[peer] !== undefined) {
                                this.handleMessage(peer, this.mail[peer]);
                            }
                        }
                        else if (this.result[peer] === $_.CC_RESULTS.GOOD) {
                            console.log('Conflict: My friend says that good? guy is bad');
                        }
                    }
                }

                break;

            case $_.CC_RESULTS.BAD_NOT_SURE:
            case $_.CC_RESULTS.BAD:

                for (var i = 0; i < results['good'].length; i++) {
                    peer = good[i];

                    if (peer !== this.context.chord.id) {
                        // Accept what people says about me
                        if (this.list_to_check[from] && this.list_to_check[from].has(peer)) {
                            this.list_to_check[from].delete(peer);
                            this.result[from] = $_.CC_RESULTS.BAD;
                            this.groups[from] = this.groups[peer];

                            if(chat.validUsers.has(from) && (chat.validUsers.get(from) === this.context.longtermPubKeys[from].toString(16))){
                                chat.validUsers.delete(from);
                            }

                            this.amount_unknown -= 1; 
                    
                        }

                        // Save results of 'from'
                        if (this.result[peer] === $_.CC_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CC_RESULTS.BAD_NOT_SURE;
                            if (this.list_to_check[peer] === undefined) {
                                var _set = new Set();
                                _set.add(from);
                                this.list_to_check[peer] = _set;

                            } else {
                                this.list_to_check[peer].add(from);
                            }

                            if (this.mail[peer] !== undefined) {
                                this.handleMessage(peer, this.mail[peer]);
                            }
                        }

                    }
                }

                break;

            case $_.CC_RESULTS.UNKNOWN:
            case $_.CC_RESULTS.IN_PROCESS:
                this.mail[from] = results;
                break;

            default:
                console.log("Strange CC_results")
        }
        this.mail[from] = undefined;

        if(this.amount_unknown <= 0) {
            if(this.auth_flag){
                this.auth_flag = false;
                $_.ee.emitEvent($_.EVENTS.AUTH_FINISH);
            } 
        }
    };
}

module.exports = CircleChains;