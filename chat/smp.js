function SMP(context, settings) {

    let SM_MSG1_LEN = 7;
    let SM_MSG2_LEN = 11;
    let SM_MSG3_LEN = 8;
    let SM_MSG4_LEN = 3;

    let SM_MODULUS = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF", 16);
    let SM_ORDER = new BigInteger("7FFFFFFFFFFFFFFFE487ED5110B4611A62633145C06E0E68948127044533E63A0105DF531D89CD9128A5043CC71A026EF7CA8CD9E69D218D98158536F92F8A1BA7F09AB6B6A8E122F242DABB312F3F637A262174D31BF6B585FFAE5B7A035BF6F71C35FDAD44CFD2D74F9208BE258FF324943328F6722D9EE1003E5C50B1DF82CC6D241B0E2AE9CD348B1FD47E9267AFC1B2AE91EE51D6CB0E3179AB1042A95DCF6A9483B84B4B36B3861AA7255E4C0278BA36046511B993FFFFFFFFFFFFFFFF", 16);
    let SM_GENERATOR = "2";

    let two = new BigInteger("2",16);
    let SM_MODULUS_MINUS_2 =  SM_MODULUS.subtract(two);

    this.reset = function(){
        this.context = context;
        this.chat = context.chat;

        this.myID = undefined;
        this.secret = undefined;
        this.friend_pubKey = undefined;

        this.x2 = undefined;
        this.x3 = undefined;
        this.g1 = new BigInteger(SM_GENERATOR, 16);
        this.g2 = undefined;
        this.g3 = undefined;
        this.g3o = undefined;
        this.p = undefined;
        this.q = undefined;
        this.pab = undefined;
        this.qab = undefined;

        this.nextExpected = "SMP_EXPECT1";
        this.received_question = 'No question';
        this.sm_prog_state = "SMP_PROG_OK";
    };

    this.smpInit = function(pass_phrase, friendID, initiating, question, input){
        this.reset();
        this.friendID = friendID;
        this.myID = context.chord.id;
        this.received_question = question;
        this.friend_pubKey = context.longtermPubKeys[friendID].toSring(16);

        let combined_secret = "";

        let myLongPubKey = context.myLongPubKey.toString(16);
        let resp_LongPubKey = context.longtermPubKeys[friendID].toString(16);
        let init_fingerprint = cryptico.publicKeyID(myLongPubKey);
        let respond_fingerprint = cryptico.publicKeyID(resp_LongPubKey);

        combined_secret += "0x01";
        if (initiating) {
            combined_secret += init_fingerprint;
            combined_secret += respond_fingerprint;
        } else {
            combined_secret += respond_fingerprint;
            combined_secret += init_fingerprint;
        }
        combined_secret += context.sid;
        combined_secret += pass_phrase;

        this.secret = new BigInteger(sha256.hex(combined_secret),16);

        if (initiating) {
            this.sendMes(sm_step1(this, question), $_.MSG.SMP_STEP1);
            this.nextExpected = "SMP_EXPECT3";
        } else {
            let err = sm_step2a(this, input, question);
            if (err !== "OK") {alert(err); this.reset(); return err;}

            this.sendMes(sm_step2b(this), $_.MSG.SMP_STEP2);
            this.nextExpected = "SMP_EXPECT4";
        }
    };
/////////////////////////////////////////////////////
    // this.button_good = function (peer) {
    //     var $sm_status = $("[id='sm_status_" + peer + "']");
    //     //$sm_status.prop("disabled", true);
    //     $sm_status.prop("className", "btn-success btn-block");
    //     $sm_status.text('Secure');
    // };

    // this.button_bad = function (peer) {
    //     var $sm_status = $("[id='sm_status_" + peer + "']");
    //     $sm_status.prop("className", "btn-danger btn-block");
    //     alert(this.friendID + " is suspicious!");
    //     $sm_status.text('Not secure');
    // };
///////////////////////////////////////////////////
    /**
     * For each step send next message, set the next expected one
     * Informs the user about the assumption of smp
     * @param input received message
     * @param {int} step number of proceding step
     **/
    this.smp_auth = function(input, step){
        switch (step) {
            case 3:
                let msg3 = sm_step3(this, input);
                if (typeof(msg3) === 'object') {
                    this.sendMes(sm_step3(this, input), $_.MSG.SMP_STEP3);
                    this.nextExpected = "SMP_EXPECT5";
                } else {
                    alert("case 3 - " + msg3);
                    this.reset();
                }
                break;
            case 4:
                let output = []; //to send to function with reference
                this.sm_prog_state = sm_step4(this, input, output);
        
                this.sendMes(output[0], $_.MSG.SMP_STEP4);

                this.nextExpected = "SMP_EXPECT_NO";
///////////////////////////////////////////////////////////////////
                if (this.sm_prog_state === "OK") {
                    let $sm_status = $("[id='sm_status_" + this.friendID + "']");
                      
                    $sm_status.prop("className", "btn-success btn-block");
                    $sm_status.text('Secure');
///////////////////////////////////////////////////////////////////
                    if (this.chat.whitelist_keys.indexOf(this.friend_pubKey) === -1) {
                        this.chat.whitelist_keys.push(this.friend_pubKey);

                        //encrypt whitelist_keys to send to localstorage
                        let encr_whitelist = this.context.encrypt_array(this.chat.whitelist_keys);
                        localStorage["smp_whitelist_" + this.myID] = JSON.stringify(encr_whitelist);

                    }
                    this.context.csmp.result[this.friendID] = $_.CSMP_RESULTS.GOOD;
                    this.context.csmp.groups[this.friendID] = this.myID;
                    }
                    else {
//////////////////////////////////////////////////                        
                        let $sm_status = $("[id='sm_status_" + this.friendID + "']");
                        $sm_status.prop("className", "btn-danger btn-block");
                        alert(this.friendID + " is suspicious!");
                        $sm_status.text('Not secure');
//////////////////////////////////////////////////
                        // delete pubkey from whitelist
                        if (this.chat.whitelist_keys.indexOf(this.friend_pubKey) !== -1) {
                            this.chat.whitelist_keys.splice(this.chat.whitelist_keys.indexOf(this.friend_pubKey), 1);
                            
                            //encrypt whitelist_keys to send to localstorage
                            var encr_whitelist = this.context.encrypt_array(this.chat.whitelist_keys);
                            localStorage["smp_whitelist_" + this.myID] = JSON.stringify(encr_whitelist);

                        }
                        this.context.csmp.result[this.friendID] = $_.CSMP_RESULTS.BAD;
                        this.context.csmp.groups[this.friendID] = this.friendID;
                    }

                    this.context.csmp.checked_by_me.push(this.friendID);

                    this.context.csmp.amount_unknown -= 1;
 
                    this.reset();
                    if (this.context.csmp.ready_to_send_res() === 1){
                        this.context.csmp.sendResults();
                    }
                    if (this.context.csmp.mail[this.friendID] !== undefined){
                        this.context.handleMessage(this.friendID, this.context.csmp.mail[this.friendID]);
                    }

                break;
            case 5:
                this.sm_prog_state = sm_step5(this, input);
                this.nextExpected = "SMP_EXPECT_NO";

                if (this.sm_prog_state === "OK") {
//////////////////////////////////////////////////////////////                    
                    let $sm_status = $("[id='sm_status_" + this.friendID + "']");
                    $sm_status.prop("className", "btn-success btn-block");
                    $sm_status.text('Secure');
//////////////////////////////////////////////////////////////                    
                    if (this.chat.whitelist_keys.indexOf(this.friend_pubKey) === -1) {
                        this.chat.whitelist_keys.push(this.friend_pubKey);

                        //encrypt whitelist_keys to send to localstorage
                        let encr_whitelist = this.context.encrypt_array(this.chat.whitelist_keys);
                        localStorage["smp_whitelist_" + this.myID] = JSON.stringify(encr_whitelist);

                    }
                    // Save results  and add a member in group
                    this.context.csmp.result[this.friendID] = $_.CSMP_RESULTS.GOOD;
                    this.context.csmp.status = $_.CSMP_STATUS.DONE;
                    this.context.csmp.groups[this.friendID] = this.myID;
                    this.context.csmp.amount_unknown -= 1;
                    this.context.csmp.checked_by_me.push(this.friendID);

                    if (this.context.csmp.ready_to_send_res() === 1){
                        this.context.csmp.sendResults();
                    }
                    if (this.context.csmp.mail[this.friendID] !== undefined){
                        this.context.handleMessage(this.friendID, this.context.csmp.mail[this.friendID]);
                    }


                } else {
/////////////////////////////////////////////////////////////////                    
                    alert(this.friendID + " is suspicious!");
                    let $sm_status = $("[id='sm_status_" + this.friendID + "']");
                    $sm_status.text('Not secure');
                    $sm_status.prop("className", "btn-danger btn-block");
////////////////////////////////////////////////////////////////

                    // delete pubkey from whitelist
                    if (this.chat.whitelist_keys.indexOf(this.friend_pubKey) !== -1) {
                        this.chat.whitelist_keys.splice(this.chat.whitelist_keys.indexOf(this.friend_pubKey), 1);
                        
                        //encrypt whitelist_keys to send to localstorage
                        let encr_whitelist = this.context.encrypt_array(this.chat.whitelist_keys);
                        localStorage["smp_whitelist_" + this.myID] = JSON.stringify(encr_whitelist)
                    }
                    // Save results
                    this.context.csmp.result[this.friendID] = $_.CSMP_RESULTS.BAD;
                    this.context.csmp.status = $_.CSMP_STATUS.FREE;
                    this.context.csmp.groups[this.friendID] = this.friendID;
                    this.context.csmp.amount_unknown -= 1;
                    this.context.csmp.checked_by_me.push(this.friendID);

                    if (this.context.csmp.ready_to_send_res() === 1){
                        this.context.csmp.sendResults();
                    }
                    if (this.context.csmp.mail[this.friend] !== undefined){
                        this.context.handleMessage(this.friendID, this.context.csmp.mail[this.friendID]);
                    }

                    if (this.context.csmp.status === $_.CSMP_STATUS.FREE){
                        if (this.context.csmp.choose_aim()){
////////////////////////////////////////////////////////////////////////////////////                            
                            // this.context.client.smp_start(this.context.csmp.aim, 1, 0);
                        }
                    }
                }
                this.reset();
                break;                
        }
    };

    this.sendMes = function(msg, type){
        let data = {
            "type": type,
            "data": {to: this.friendID, from: this.myID, data: msg}
        };
        this.context.signMessage(data);
        this.context.chord.send(this.friendID, type, data);
    };


    /** Create first message in SMP exchange.  Input is Alice's secret value
     * which this protocol aims to compare to Bob's.  Output is a serialized
     * mpi array whose elements correspond to the following:
     * [0] = g2a, Alice's half of DH exchange to determine g2
     * [1] = c2, [2] = d2, Alice's ZK proof of knowledge of g2a exponent
     * [3] = g3a, Alice's half of DH exchange to determine g3
     * [4] = c3, [5] = d3, Alice's ZK proof of knowledge of g3a exponent
     * @param {SMP} astate
     * @param {String} question (question = 'No question', if no question)
     * */
    function sm_step1(astate, question) {
        let msg1 = [];
        astate.received_question = question;

        astate.x2 = randomExponent();
        astate.x3 = randomExponent();

        msg1[0] = astate.g1.modPow(astate.x2, SM_MODULUS);
        sm_proof_know_log(msg1, 1, 2, astate.g1, astate.x2);

        msg1[3] = astate.g1.modPow(astate.x3, SM_MODULUS);
        sm_proof_know_log(msg1, 4, 5, astate.g1, astate.x3);

        msg1[6] = question;

        let output = serialize_array(msg1);

        astate.sm_prog_state = "OK";
        return output;
    }


    /* Receive the first message in SMP exchange, which was generated by
    * sm_step1.  Input is saved until the user inputs their secret
    * information.  No output.
    * Check the ZK proofs and stores Alice's msg
    * */
    function sm_step2a(bstate, input){
        let msg1 = [];
        let err;

        bstate.sm_prog_state = "SMP_PROG_CHEATED";

        // Calculate message in string to BigInteger
        err = unserialize_array(msg1, SM_MSG1_LEN, input);
        if (err) return "SMP_ERR_MSS_LEN";


        if (check_group_elem(msg1[0]) || check_expon(msg1[2]) ||
            check_group_elem(msg1[3]) || check_expon(msg1[5])) {
            return "SMP_ERR_INV_VALUE1";
        }

        /* Store Alice's g3a value for later in the protocol */
        bstate.g3o = msg1[3];

        /* Verify Alice's proofs */
        if (sm_check_know_log(msg1[1], msg1[2], bstate.g1, msg1[0], 1) ||
            sm_check_know_log(msg1[4], msg1[5], bstate.g1, msg1[3], 2)) {
            return "SMP_ERR_INV_VALUE2";
        }

        /* Create Bob's half of the generators g2 and g3 */
        bstate.x2 = randomExponent();
        bstate.x3 = randomExponent();

        /* Combine the two halves from Bob and Alice and determine g2 and g3 */
        bstate.g2 = msg1[0].modPow(bstate.x2, SM_MODULUS);
        bstate.g3 = msg1[3].modPow(bstate.x3, SM_MODULUS);

        bstate.sm_prog_state = "OK";
        return "OK";

    }



    /** Create second message in SMP exchange.  Input is Bob's secret value.
     * Information from earlier steps in the exchange is taken from Bob's
     * state.  Output is a serialized mpi array whose elements correspond
     * to the following:
     * [0] = g2b, Bob's half of DH exchange to determine g2
     * [1] = c2, [2] = d2, Bob's ZK proof of knowledge of g2b exponent
     * [3] = g3b, Bob's half of DH exchange to determine g3
     * [4] = c3, [5] = d3, Bob's ZK proof of knowledge of g3b exponent
     * [6] = pb, [7] = qb, Bob's halves of the (Pa/Pb) and (Qa/Qb) values
     * [8] = cp, [9] = d5, [10] = d6, Bob's ZK proof that pb, qb formed correctly
     * @param {SMP} bstate
     * */
    function sm_step2b(bstate) {
        let r, qb1, qb2;
        let msg2 = [];

        msg2[0] = bstate.g1.modPow(bstate.x2, SM_MODULUS);
        sm_proof_know_log(msg2, 1, 2, bstate.g1, bstate.x2);

        msg2[3] = bstate.g1.modPow(bstate.x3,SM_MODULUS);
        sm_proof_know_log(msg2, 4, 5, bstate.g1, bstate.x3);

        /* Calculate P and Q values for Bob */
        r = randomExponent();
        bstate.p = bstate.g3.modPow(r,SM_MODULUS);
        msg2[6] = bstate.p;
        qb1 = bstate.g1.modPow(r,SM_MODULUS);
        qb2 = bstate.g2.modPow(bstate.secret, SM_MODULUS);
        bstate.q = qb1.multiply(qb2).mod(SM_MODULUS);
        msg2[7] = bstate.q;

        sm_proof_equal_coords(msg2, 8, 9, 10, bstate, r, 5);

        /* Convert to serialized form */
        let output = serialize_array(msg2);

        bstate.sm_prog_state = "OK";

        return output;
    }

    /* Create third message in SMP exchange.  Input is a message generated
    * by otrl_sm_step2b. Output is a serialized mpi array whose elements
    * correspond to the following:
    * [0] = pa, [1] = qa, Alice's halves of the (Pa/Pb) and (Qa/Qb) values
    * [2] = cp, [3] = d5, [4] = d6, Alice's ZK proof that pa, qa formed correctly
    * [5] = ra, calculated as (Qa/Qb)^x3 where x3 is the exponent used in g3a
    * [6] = cr, [7] = d7, Alice's ZK proof that ra is formed correctly */
    function sm_step3(astate,input){
        let r, qa1, qa2, inv;
        let msg2 = [];
        let msg3 = [];
        let err;

        astate.sm_prog_state = "SMP_PROG_CHEATED";

        err = unserialize_array(msg2, SM_MSG2_LEN, input);
        if (err) return "SMP_ERR_MSS_LEN";

        if (check_group_elem(msg2[0]) || check_group_elem(msg2[3]) ||
            check_group_elem(msg2[6]) || check_group_elem(msg2[7]) ||
            check_expon(msg2[2]) || check_expon(msg2[5]) ||
            check_expon(msg2[9]) || check_expon(msg2[10])) {
            return "SMP_ERR_INV_VALUE";
        }

        /* Store Bob's g3a value for later in the protocol */
        astate.g3o = msg2[3];

        /* Verify Bob's knowledge of discrete log proofs */
        if (sm_check_know_log(msg2[1], msg2[2], astate.g1, msg2[0], 3) ||
            sm_check_know_log(msg2[4], msg2[5], astate.g1, msg2[3], 4)) {
            return "SMP_ERR_INV_VALUE";
        }

        /* Combine the two halves from Bob and Alice and determine g2 and g3 */
        astate.g2 = msg2[0].modPow(astate.x2, SM_MODULUS);
        astate.g3 = msg2[3].modPow(astate.x3, SM_MODULUS);

        /* Verify Bob's coordinate equality proof */
        if (sm_check_equal_coords(msg2[8], msg2[9], msg2[10], msg2[6], msg2[7],
                astate, 5)) {
            return "SMP_ERR_INV_VALUE";
        }

        /* Calculate P and Q values for Alice */
        r = randomExponent();
        astate.p = astate.g3.modPow(r, SM_MODULUS);
        msg3[0] = astate.p;
        qa1 = astate.g1.modPow(r,SM_MODULUS);
        qa2 = astate.g2.modPow(astate.secret, SM_MODULUS);
        astate.q = qa1.multiply(qa2).mod(SM_MODULUS);
        msg3[1] = astate.q;

        sm_proof_equal_coords(msg3, 2,3,4, astate,r, 6);

        /* Calculate Ra and proof */
        inv = msg2[6].modInverse(SM_MODULUS);
        astate.pab = astate.p.multiply(inv).mod(SM_MODULUS);
        inv = msg2[7].modInverse(SM_MODULUS);
        astate.qab = astate.q.multiply(inv).mod(SM_MODULUS);
        msg3[5] = astate.qab.modPow(astate.x3, SM_MODULUS);
        sm_proof_equal_logs(msg3, 6, 7, astate, 7);

        let output = serialize_array(msg3);

        astate.sm_prog_state = "SMP_PROG_OK";
        return output;
    }


    /* Create final message in SMP exchange.  Input is a message generated
    * by sm_step3. Output is a serialized mpi array whose elements
    * correspond to the following:
    * [0] = rb, calculated as (Qa/Qb)^x3 where x3 is the exponent used in g3b
    * [1] = cr, [2] = d7, Bob's ZK proof that rb is formed correctly
    * This method also checks if Alice and Bob's secrets were the same.  If
    * so, it returns NO_ERROR.  If the secrets differ, an INV_VALUE error is
    * returned instead. */
    function sm_step4(bstate,input, output){
        let comp;
        let inv, rab;
        let msg3 = [];
        let msg4 = [];
        let err;
        err = unserialize_array(msg3, SM_MSG3_LEN, input);
        if (err) return err;

        bstate.sm_prog_state = "SMP_PROG_CHEATED";

        if (check_group_elem(msg3[0]) || check_group_elem(msg3[1]) ||
            check_group_elem(msg3[5]) || check_expon(msg3[3]) ||
            check_expon(msg3[4]) || check_expon(msg3[7]))  {
            return "SMP_ERR_INV_VALUE";
        }

        /* Verify Alice's coordinate equality proof */
        if (sm_check_equal_coords(msg3[2], msg3[3], msg3[4], msg3[0], msg3[1],
                bstate, 6)) {
            return "SMP_ERR_INV_VALUE";
        }

        /* Find Pa/Pb and Qa/Qb */
        inv = bstate.p.modInverse(SM_MODULUS);
        bstate.pab = msg3[0].multiply(inv).mod(SM_MODULUS);
        inv = bstate.q.modInverse(SM_MODULUS);
        bstate.qab = msg3[1].multiply(inv).mod(SM_MODULUS);

        /* Verify Alice's log equality proof */
        if (sm_check_equal_logs(msg3[6], msg3[7], msg3[5], bstate, 7)) {
            return "SMP_ERR_INV_VALUE";
        }

        /* Calculate Rb and proof */
        msg4[0] = bstate.qab.modPow(bstate.x3, SM_MODULUS);
        sm_proof_equal_logs(msg4,1,2, bstate, 8);

        output[0] = serialize_array( msg4);


        /* Calculate Rab and verify that secrets match */
        rab = msg3[5].modPow(bstate.x3, SM_MODULUS);
        comp = rab.compareTo(bstate.pab) !== 0;

        bstate.sm_prog_state = comp ? "SMP_PROG_FAILED":
            "SMP_PROG_SUCCEEDED";

        if (comp)
            return "SMP_ERR_INV_VALUE";
        else
            return "OK";
    }

    /* Receives the final SMP message, which was generated in sm_step.
    * This method checks if Alice and Bob's secrets were the same.  If
    * so, it returns NO_ERROR.  If the secrets differ, an INV_VALUE error is
    * returned instead. */
    function sm_step5(astate, input){
        let comp;
        let rab;
        let msg4 = [];
        let err;
        err = unserialize_array(msg4, SM_MSG4_LEN, input);
        if (err) return err;

        astate.sm_prog_state = "SMP_PROG_CHEATED";

        if (check_group_elem(msg4[0]) || check_expon(msg4[2])) {
            return "SMP_ERR_INV_VALUE1";
        }

        /* Verify Bob's log equality proof */
        if (sm_check_equal_logs(msg4[1], msg4[2], msg4[0], astate, 8)) {
            return "SMP_ERR_INV_VALUE2";
        }

        /* Calculate Rab and verify that secrets match */
        rab = msg4[0].modPow(astate.x3,SM_MODULUS);

        comp = rab.compareTo(astate.pab) !== 0;

        astate.sm_prog_state = comp ? "SMP_PROG_FAILED" :
            "SMP_PROG_SUCCEEDED";

        if (comp)
            return "BAD";
        else
            return "OK";
    }

    /**
     * Generates big random number
     * Generate a random exponent
     * @returns {BigInteger}
     */
    function randomExponent(){
        return settings.generateNumber().mod(SM_MODULUS);
    }

    /* Takes a buffer containing serialized and concatenated msg
    * and converts it to an array of BigInteger.
    * Rerurns true, if error */
    function unserialize_array(msg, msg_len, input){
        if (msg_len !== input.length)
        {return true;}
        for (let i=0; i<msg_len; i++)
        {
            msg[i] = new BigInteger(input[i], 16);
        }
        return false;
    }

    /*
    Convert BigInteger to string in msg
    */
    function serialize_array(msg){
        let out = [];
        for (let i=0; i<msg.length; i++)
        {
            out[i] = msg[i].toString(16);
        }
        return out;
    }

    /* Check that x is in the right range to be a (non-unit) group element */
    function check_group_elem(g)
    {
        return ( g.compareTo(2) < 0 )||(g.compareTo(SM_MODULUS_MINUS_2) > 0);
    }

    /* Check that x is in the right range to be a (non-zero) exponent */
    function check_expon(x)
    {
        return (x.compareTo(1) < 0 )|| (x.compareTo(SM_ORDER) >= 0);
    }


    /*
    * Proof of knowledge of a discrete logarithm
    */
    function sm_proof_know_log(mes, i,j, g, x){
        let r = randomExponent();
        let temp = g.modPow(r, SM_MODULUS);

        mes[i] = new BigInteger(sha256.hex(temp.toString(16)),16);
        temp = x.multiply(mes[i]).mod(SM_ORDER);
        mes[j] = r.subtract(temp).mod(SM_ORDER);
    }


    /*
    * Verify a proof of knowledge of a discrete logarithm.
    * Checks that c = h(g^d x^c)
    */
    function sm_check_know_log(c,d,g,x)
    {
        let comp, gd, xc, gdxc, hgdxc;

        gd = g.modPow(d, SM_MODULUS);
        xc = x.modPow(c, SM_MODULUS);
        gdxc = gd.multiply(xc).mod(SM_MODULUS);
        hgdxc = new BigInteger(sha256.hex(gdxc.toString(16)),16);

        comp = hgdxc.compareTo(c) !== 0 ;

        return comp;
    }


    /*
    * Proof of knowledge of coordinates with first components being equal
    */
    function sm_proof_equal_coords(a, c, d1, d2, state,r)
    {
        let r1 = randomExponent();
        let r2 = randomExponent();
        let temp1;
        let temp2;

        /* Compute the value of c, as c = h(g3^r1, g1^r1 g2^r2) */
        temp1 = state.g1.pow(r1).mod(SM_MODULUS);
        temp2 = state.g2.pow(r2).mod(SM_MODULUS);
        temp2 = temp1.multiply(temp2).mod(SM_MODULUS);
        temp1 = state.g3.pow(r1).mod(SM_MODULUS);
        a[c] = new BigInteger(sha256.hex(temp1.toString(16) + temp2.toString(16)),16);

        /* Compute the d values, as d1 = r1 - r c, d2 = r2 - secret c */
        temp1 =  r.multiply(a[c]).mod(SM_ORDER);
        a[d1] = r1.subtract(temp1).mod(SM_ORDER);

        temp1 = state.secret.multiply(a[c]).mod(SM_ORDER);
        a[d2] = r2.subtract(temp1).mod(SM_ORDER);

    }

    /*
    * Verify a proof of knowledge of coordinates with first components being equal
    */
    function sm_check_equal_coords(c,d1,d2,p,q,state){
        let comp;
        let temp1, temp2, temp3, cprime;

        /* To verify, we test that hash(g3^d1 * p^c, g1^d1 * g2^d2 * q^c) = c
            * If indeed c = hash(g3^r1, g1^r1 g2^r2), d1 = r1 - r*c,
            * d2 = r2 - secret*c.  And if indeed p = g3^r, q = g1^r * g2^secret
            * Then we should have that:
            *   hash(g3^d1 * p^c, g1^d1 * g2^d2 * q^c)
            * = hash(g3^(r1 - r*c + r*c), g1^(r1 - r*c + q*c) *
            *      g2^(r2 - secret*c + secret*c))
            * = hash(g3^r1, g1^r1 g2^r2)
            * = c
            */
        temp2 =  state.g3.pow(d1).mod(SM_MODULUS);
        temp3 = p.pow(c).mod(SM_MODULUS);
        temp1 = temp2.multiply(temp3).mod(SM_MODULUS);

        temp2 = state.g1.pow(d1).mod(SM_MODULUS);
        temp3 = state.g2.pow(d2).mod(SM_MODULUS);
        temp2 = temp2.multiply(temp3).mod(SM_MODULUS);
        temp3 = q.pow(c).mod(SM_MODULUS);
        temp2 = temp3.multiply(temp2).mod(SM_MODULUS);

        cprime = new BigInteger(sha256.hex(temp1.toString(16) + temp2.toString(16)),16);

        comp = c.compareTo(cprime) !== 0;

        return comp;
    }



    /*
    * Proof of knowledge of logs with exponents being equal
    */
    function sm_proof_equal_logs(msg, c,d,state) {
        let r = randomExponent();
        let temp1,  temp2;

        /* Compute the value of c, as c = h(g1^r, (Qa/Qb)^r) */
        temp1 = state.g1.pow(r).mod(SM_MODULUS);
        temp2 = state.qab.pow(r).mod(SM_MODULUS);
        msg[c] = new BigInteger(sha256.hex(temp1.toString(16) + temp2.toString(16)),16);

        /* Compute the d values, as d = r - x3 c */
        temp1 = state.x3.multiply(msg[c]).mod(SM_ORDER); // *c //????
        msg[d] = r.subtract(temp1).mod(SM_ORDER);

    }

    /*
    * Verify a proof of knowledge of logs with exponents being equal
    */
    function sm_check_equal_logs(c,d,r, state) {
        let comp;

        let temp1, temp2, temp3;
        let cprime;

        /* Here, we recall the exponents used to create g3.
            * If we have previously seen g3o = g1^x where x is unknown
            * during the DH exchange to produce g3, then we may proceed with:
            *
            * To verify, we test that hash(g1^d * g3o^c, qab^d * r^c) = c
            * If indeed c = hash(g1^r1, qab^r1), d = r1- x * c
            * And if indeed r = qab^x
            * Then we should have that:
            *   hash(g1^d * g3o^c, qab^d r^c)
            * = hash(g1^(r1 - x*c + x*c), qab^(r1 - x*c + x*c))
            * = hash(g1^r1, qab^r1)
            * = c
            */
        temp2 = state.g1.pow(d).mod(SM_MODULUS);
        temp3 = state.g3o.pow(c).mod(SM_MODULUS);
        temp1 = temp2.multiply(temp3).mod(SM_MODULUS);

        temp3 = state.qab.pow(d).mod(SM_MODULUS);
        temp2 = r.pow(c).mod(SM_MODULUS);
        temp2 = temp3.multiply(temp2).mod(SM_MODULUS);

        cprime = new BigInteger(sha256.hex(temp1.toString(16) + temp2.toString(16)),16);

        comp = c.compareTo(cprime) !== 0;

        return comp;
    }
}

module.exports = SMP;