/**
 * Circle SMP object
 * @param {Object} context mpOTRContext
 * @property {CSMP_STATUS} status {FREE, CHECKING, DONE}
 * @property {Array} circle nicknames of peer in order
 * @property {String} aim name of a person to do SMP
 * @property {map} mail list of last letters from each person
 * @property {CSMP_RESULT} result 'GOOD' - if was checked, 'IN_PROCESS' - if is checking, 'BAD' - if check fails, else 'UNKNOWN'
 * @property {map} groups peers of one group have the same name, peers without group has name of himeself, unknown - ''
 **/

function CSMP($_, context) {
    this.ntime = 0;
    this.sum = 0;

    this.init = function () {
        this.context = context;
        this.status = $_.CSMP_STATUS.FREE;
        this.circle = [];
        this.amount_unknown = context.room.users.length;
        this.aim = '';
        this.result = {};
        this.mail = {};
        this.groups = new Map();
        this.checked_by_me = [];
        this.list_to_check = new Map();

        this.stime = 0;
        this.ftime = 0;

        // Create a oriented circle
        this.circle.push(this.context.chord.id); 

        for (var i = 0; i < this.context.room.users.length; ++i) {
            var peer = this.context.room.users[i];
            this.circle.push(peer);
            this.mail[peer] = undefined;
            this.groups[peer] = '';

            this.result[peer] = $_.CSMP_RESULTS.UNKNOWN;

        }
        this.circle.sort();
        var me = this.circle.indexOf(this.context.chord.id);
        this.circle = this.circle.splice(me + 1).concat(this.circle);
        this.circle.pop();
    };

    /**
     * Return 1, if ready to send results; 0, if need to wait for SMP finish.
     * **/
    this.ready_to_send_res = function(){
        for (var i=0; i < this.circle.length; i++){
            if (this.result[this.circle[i]] === $_.CSMP_RESULTS.IN_PROCESS){
                return 0;
            }
        }
        return 1;
    };

    /** 
     * Choose aim to init smp.
     * Return 1, if smp needed; 0, if not.
     **/
    this.choose_aim = function () {
        if (this.amount_unknown <= 0) { 
            this.status = $_.CSMP_STATUS.DONE;
            this.ftime = +new Date();
            console.log("info", (this.ftime - this.stime).toString());
            this.sum += this.ftime - this.stime;
            this.stime = 0;

            E.ee.emitEvent(E.EVENTS.AUTH_FINISH, [this.context.room]);
            return 0;
        }

        if (this.status === $_.CSMP_STATUS.CHECKING) {
            return 0;
        }

        if (this.status === $_.CSMP_STATUS.FREE) {
            for (var i = 0; i < this.circle.length; i++) {
                if (this.result[this.circle[i]] === $_.CSMP_RESULTS.UNKNOWN) {
                    this.aim = this.circle[i];
                    return 1;
                }

                if (this.result[this.circle[i]] === $_.CSMP_RESULTS.IN_PROCESS) {
                    return 0;
                }

                if (this.result[this.circle[i]] === $_.CSMP_RESULTS.GOOD) {
                    this.status = $_.CSMP_STATUS.DONE;
                    E.ee.emitEvent(E.EVENTS.AUTH_FINISH, [this.context.room]);

                    return 0;
                }

            }
        }
        return 0;
    };

    /**
     *  Send results if you have friends
     **/
    this.sendResults = function () {

        if (Object.values(this.groups).indexOf(this.context.chord.id) === -1) {
            return;
        }

        var good = [];
        var bad = [];

        for (var i = 0; i < this.circle.length; i++) {

            if (this.result[this.circle[i]] === $_.CSMP_RESULTS.GOOD) {
                good.push(this.circle[i]);
            }
            if (this.result[this.circle[i]] === $_.CSMP_RESULTS.BAD) {
                bad.push(this.circle[i]);
            }
        }

        var msg = {
            "good": good,
            "bad": bad
        };

        var message = {
            "type": $_.MSG.CSMP_RESULT,
            "data": {
                from: this.context.chord.id,
                results: msg
            },
            "room": this.context.room.id
        };
        this.context.signMessage(message);

        this.context.chord.publish(this.context.room.id, $_.MSG.BROADCAST, message);

    };

    /** Handle received messages
     * @param {String} from name of receiver
     * @param {Object} results received message, which contains array of good and bad peers
     **/
    this.handleMessage = function (from, results) {
        var bad = results['bad'];
        var good = results['good'];
        var peer;

        switch (this.result[from]) {
            case $_.CSMP_RESULTS.GOOD:
                this.groups[from] = this.context.chord.id;

                for (var i = 0; i < results['good'].length; i++) {
                    peer = good[i];

                    if (peer !== this.context.chord.id) {

                        if (this.result[peer] === $_.CSMP_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CSMP_RESULTS.GOOD;
                            this.groups[peer] = this.context.chord.id;
                            
                            this.amount_unknown -= 1;

                            if (this.mail[peer] !== undefined) {
                                this.handleMessage(peer, this.mail[peer]);
                            }
                        }
                        else if (this.result[peer] === $_.CSMP_RESULTS.BAD) {
                            console.log('Get conflict: My friend says that bad? guy is good');
                        }
                    }

                }
                for (var i = 0; i < results['bad'].length; i++) {

                    peer = bad[i];

                    if (peer === this.context.chord.id) {
                        console.log('Conflict: My friend tells everyone that I am bad');
                    } else {
                        if (this.result[peer] === $_.CSMP_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CSMP_RESULTS.BAD;
                            this.groups[peer] = results['bad'];
                            
                            this.amount_unknown -= 1;

                            if (this.mail[peer] !== undefined) {
                                this.handleMessage(peer, this.mail[peer]);
                            }
                        }
                        else if (this.result[peer] === $_.CSMP_RESULTS.GOOD) {
                            console.log('Conflict: My friend says that good? guy is bad');
                        }
                    }
                }

                break;

            case $_.CSMP_RESULTS.BAD_NOT_SURE:
            case $_.CSMP_RESULTS.BAD:

                for (var i = 0; i < results['good'].length; i++) {
                    peer = good[i];

                    if (peer !== this.context.chord.id) {
                        // Accept what people says about me
                        if (this.list_to_check[from] && this.list_to_check[from].has(peer)) {
                            this.list_to_check[from].delete(peer);
                            this.result[from] = $_.CSMP_RESULTS.BAD;
                            this.groups[from] = this.groups[peer];

                            this.amount_unknown -= 1;
                        }

                        // Save results of 'from'
                        if (this.result[peer] === $_.CSMP_RESULTS.UNKNOWN) {
                            this.result[peer] = $_.CSMP_RESULTS.BAD_NOT_SURE;
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

            case $_.CSMP_RESULTS.UNKNOWN:
            case $_.CSMP_RESULTS.IN_PROCESS:
                this.mail[from] = results;
                break;

            default:
                alert("Strange csmp_results")
        }
        this.mail[from] = undefined;

    };
}

module.exports = CSMP;