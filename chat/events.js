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

            //AUTH_FINISH: 'EVENTS.AUTH_FINISH',

            CCEGK_FINISH: 'EVENTS.CCEGK_FINISH'
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


            DGS_INIT: 'MSG.DGS_INIT',
            CCEGK: 'MSG.CCEGK',
            DGS_PUBKEY_CHECK: 'MSG.DGS_PUBKEY_CHECK'
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

        ee: new EventEmitter()
    };
}