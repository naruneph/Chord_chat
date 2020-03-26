class Settings {

    constructor(){

        /////////////mpOTR/////////////
        this.len_sid_random = 13;
        this.key_length = "1024";
        this.exp = "03";
        this.g = new BigInteger("31", 10);
        this.qmod = new BigInteger("1205156213460516294276038011098783037428475274251229971327058470979054415841306114445046929130670807336613570738952006098251824478525291315971365353402504611531367372670536703348123007294680829887020513584624726600189364717085162921889329599071881596888429934762044470097788673059921772650773521873603874984881875042154463169647779984441228936206496905064565147296499973963182632029642323604865192473605840717232357219244260470063729922144429668263448160459816959", 10);
        this.pmod = new BigInteger("2410312426921032588552076022197566074856950548502459942654116941958108831682612228890093858261341614673227141477904012196503648957050582631942730706805009223062734745341073406696246014589361659774041027169249453200378729434170325843778659198143763193776859869524088940195577346119843545301547043747207749969763750084308926339295559968882457872412993810129130294592999947926365264059284647209730384947211681434464714438488520940127459844288859336526896320919633919", 10);
        this.random = new SecureRandom();


        //////////////SMP & DGS//////////////
        this.MODULUS = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF", 16);
        this.ORDER =   new BigInteger("7FFFFFFFFFFFFFFFE487ED5110B4611A62633145C06E0E68948127044533E63A0105DF531D89CD9128A5043CC71A026EF7CA8CD9E69D218D98158536F92F8A1BA7F09AB6B6A8E122F242DABB312F3F637A262174D31BF6B585FFAE5B7A035BF6F71C35FDAD44CFD2D74F9208BE258FF324943328F6722D9EE1003E5C50B1DF82CC6D241B0E2AE9CD348B1FD47E9267AFC1B2AE91EE51D6CB0E3179AB1042A95DCF6A9483B84B4B36B3861AA7255E4C0278BA36046511B993FFFFFFFFFFFFFFFF", 16);
        this.GENERATOR = new BigInteger("2", 16);
        
    }

    generatePair() {
        let rsaPrivateKey = new RSAKey();
        rsaPrivateKey.generate(this.key_length, this.exp);
        let rsaPubKey = cryptico.publicKeyString(rsaPrivateKey);
        return [rsaPrivateKey, rsaPubKey];
    }

    generateNumber(len = this.len_sid_random) {
        let randBytes = new Array(len);
        this.random.nextBytes(randBytes);
        return new BigInteger(randBytes);
    }

    generateExpPair() {
        let randBigNumber = this.generateNumber();
        randBigNumber = randBigNumber.mod(this.qmod);
        let b = this.g.modPow(randBigNumber, this.pmod);
        return [randBigNumber, b];
    }

    randomExponent() {
        return this.generateNumber().mod(this.ORDER);
    } 


    //for DGS

    deserialize_group_sig (sig){
        let C = [];
        for (let i = 0; i < sig["C"].length; i++){
            C.push(new BigInteger(sig["C"][i],16));
        }

        let Su = [];
        for (let i = 0; i < sig["Su"].length; i++){
            Su.push(new BigInteger(sig["Su"][i],16));
        }

        let Sv = [];
        for (let i = 0; i < sig["Sv"].length; i++){
            Sv.push(new BigInteger(sig["Sv"][i],16));
        }

        let output = {
            "g_wave": new BigInteger(sig["g_wave"],16),
            "y_wave": new BigInteger(sig["y_wave"],16),
            "C": C,
            "Su": Su,
            "Sv": Sv
        }

        return output;

    }

    verify(groupPubKey, msg, g_wave, y_wave, C, Su, Sv) {

        let peersNumber = C.length;
        let c = C[0];
        for (let i = 1; i < peersNumber; i++){
            c = c.xor(C[i]);
        }

        let result = "";

        result += groupPubKey[0].toString(16);
        result += g_wave.toString(16);
        result += y_wave.toString(16);

        let t1, t2, t3, val; 
        for (let i = 0; i < peersNumber; i++){
            t1 = y_wave.modPow(C[i], this.MODULUS); 
            t2 = groupPubKey[0].modPow(Su[i], this.MODULUS); 
            t3 = this.GENERATOR.modPow(Sv[i], this.MODULUS); 

            val = t1.multiply(t2.multiply(t3).mod(this.MODULUS)).mod(this.MODULUS);
            result += val.toString(16); 
        } 

        let z = Array.from(groupPubKey[1].values());
        for (let i = 0; i < peersNumber; i++){
            t1 = z[i].modPow(C[i], this.MODULUS);
            t2 = this.GENERATOR.modPow(Sv[i], this.MODULUS);

            val = t1.multiply(t2).mod(this.MODULUS);
            result += val.toString(16);
        } 

        for (let i = 0; i < peersNumber; i++){
            t1 = g_wave.modPow(C[i], this.MODULUS);
            t2 = this.GENERATOR.modPow(Su[i], this.MODULUS);

            val = t1.multiply(t2).mod(this.MODULUS);
            result += val.toString(16);
        } 

        result += msg; 

        let value = new BigInteger(sha256.hex(result),16);

        let comp = value.compareTo(c) === 0;

        return comp;
    }

};
module.exports = Settings;

