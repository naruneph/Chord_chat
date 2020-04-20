var EventEmitter = require("../lib/EventEmitter");

module.exports = function() {
    return {
        /**
         * Possible events in application.
         */
        EVENTS: {
            PEER_OPENED: 'EVENTS.PEER_OPENED',
            PEER_DISCONNECTED: 'EVENTS.PEER_DISCONNECTED',
            PEER_CLOSED: 'EVENTS.PEER_CLOSED',
            PEER_ERROR: 'EVENTS.PEER_ERROR',
            NEW_CONN: 'EVENTS.NEW_CONN',
            MPOTR_INIT: 'EVENTS.MPOTR_INIT',
            MPOTR_START: 'EVENTS.MPOTR_START',
            MPOTR_SHUTDOWN_START: 'EVENTS.MPOTR_SHUTDOWN_START',
            MPOTR_SHUTDOWN_FINISH: 'EVENTS.MPOTR_SHUTDOWN_FINISH',
            BLOCK_CHAT: 'EVENTS.BLOCK_CHAT',
            CONN_LIST_ADD: "EVENTS.CONN_LIST_ADD",
            CONN_LIST_REMOVE: "EVENTS.CONN_LIST_REMOVE",
            INCOMING_MSG: "EVENTS.INCOMING_MSG",
            OLDBLUE_MSG_DELIVERED: "EVENTS.OLDBLUE_MSG_DELIVERED",

            SMP_INIT: 'EVENTS.SMP_INIT',
            SMP_STEP1: 'EVENTS.SMP_STEP1',
            SMP_STEP2: 'EVENTS.SMP_STEP2',
            SMP_STEP3: 'EVENTS.SMP_STEP3',
            SMP_STEP4: 'EVENTS.SMP_STEP4',
            CSMP: 'EVENTS.CSMP',

            AUTH_FINISH: 'EVENTS.AUTH_FINISH',
            QUIT_ROOM: 'EVENTS.QUIT_ROOM',

            CCEGK_FINISH: 'EVENTS.CCEGK_FINISH',
            DGS_INIT: 'EVENTS.DGS_INIT',
            DGS_PUBKEY_CHECK: 'EVENTS.DGS_PUBKEY_CHECK',

            CHAINS_BLACK_LIST: 'EVENTS.CHAINS_BLACK_LIST',
            CHAINS_SEARCH: 'EVENTS.CHAINS_SEARCH',
            CHAINS_SUCCESS: 'EVENTS.CHAINS_SUCCESS',

            CHAINS_PROOF_INIT: 'EVENTS.CHAINS_PROOF_INIT',
            CHAINS_SEND_MSG: 'EVENTS.CHAINS_SEND_MSG',
            CHAINS_PROOF: 'EVENTS.CHAINS_PROOF',
            CHAINS_PROOF_START: 'EVENTS.CHAINS_PROOF_START',
            CHAINS_PROOF_FINISH: 'EVENTS.CHAINS_PROOF_FINISH',
            CHAINS_PROOF_RECEIVED: 'EVENTS.CHAINS_PROOF_RECEIVED',
            CHAINS_CHECK_PROOFS: 'EVENTS.CHAINS_CHECK_PROOFS'


        },

        /**
         * Possible message types. Also used as event types for corresponding handlers.
         */
        MSG: {
            UNENCRYPTED: "MSG.UNENCRYPTED",
            CONN_LIST_SYNC: "MSG.CONN_LIST_SYNC",
            CONN_LIST_REMOVE: "MSG.CONN_LIST_REMOVE",
            CLOSE_DUBBED_CONN: "MSG.CLOSE_DUBBED_CONN",
            MPOTR_INIT: "MSG.MPOTR_INIT",
            MPOTR_AUTH: "MSG.MPOTR_AUTH",
            MPOTR_CHAT: "MSG.MPOTR_CHAT",
            MPOTR_LOST_MSG: "MSG.MPOTR_LOST_MSG",
            MPOTR_SHUTDOWN: "MSG.MPOTR_SHUTDOWN",
            BD_KEY_RATCHET: "MSG.BD_KEY_RATCHET",
            BROADCAST: "BROADCAST",

            CSMP_INIT: 'MSG.CSMP_INIT',
            CSMP_RESULT: 'MSG.CSMP_RESULT',
            SMP_STEP1: "MSG.SMP_STEP1",
            SMP_STEP2: "MSG.SMP_STEP2",
            SMP_STEP3: 'MSG.SMP_STEP3',
            SMP_STEP4: 'MSG.SMP_STEP4',

            CCEGK: 'MSG.CCEGK',
            CCEGK_REMOVING: 'MSG.CCEGK_REMOVING',
            DGS_PUBKEY_CHECK: 'MSG.DGS_PUBKEY_CHECK',
            READY_FOR_DGS: 'MSG.READY_FOR_DGS',

            CHAINS_INIT: 'MSG.CHAINS_INIT',
            CHAINS_BLACK_LIST: 'MSG.CHAINS_BLACK_LIST',
            CHAINS_SEARCH: 'MSG.CHAINS_SEARCH',
            CHAINS_PROOF: 'MSG.CHAINS_PROOF',

            CC_RESULT: 'MSG.CC_RESULT'
        },

        /**
         * Client's status
         * IMPORTANT: If you want to modify STATUS (add, remove)
         * consider rewriting all checkStatus() wrappers.
         */
        STATUS: {
            UNENCRYPTED:    "STATUS.UNENCRYPTED",
            AUTH:           "STATUS.AUTH",
            MPOTR:          "STATUS.MPOTR",
            SHUTDOWN:       "STATUS.SHUTDOWN"
        },

        CSMP_STATUS: {
            FREE: 'CSMP_STATUS.FREE',
            CHECKING: 'CSMP_STATUS.CHECKING',
            DONE: 'CSMP_STATUS.DONE'
        },

        CSMP_RESULTS: {
            GOOD: 'CSMP_RESULTS.GOOD',
            BAD: 'CSMP_RESULTS.BAD',
            IN_PROCESS: 'CSMP_RESULTS.IN_PROCESS',
            UNKNOWN: 'CSMP_RESULTS.UNKNOWN',
            BAD_NOT_SURE: 'CSMP_RESULTS.BAD_NOT_SURE'
        },

        CC_STATUS: {
            FREE: 'CC_STATUS.FREE',
            CHECKING: 'CC_STATUS.CHECKING',
            DONE: 'CC_STATUS.DONE'
        },

        CC_RESULTS: {
            GOOD: 'CC_RESULTS.GOOD',
            BAD: 'CC_RESULTS.BAD',
            IN_PROCESS: 'CC_RESULTS.IN_PROCESS',
            UNKNOWN: 'CC_RESULTS.UNKNOWN',
            BAD_NOT_SURE: 'CC_RESULTS.BAD_NOT_SURE'
        },

        ee: new EventEmitter()
    };
}