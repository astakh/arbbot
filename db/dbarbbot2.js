const mongodb   = require('mongodb');
const mongoose  = require('mongoose'); 
const func      = require('../functions');
require('dotenv').config();

const db        = process.env.DB_ARB2_PATH; 
mongoose
.connect(db)
.then((res) => console.log('Connected to DB'))
.catch((err) => console.log(err));

const Schema = mongoose.Schema; 

const maskSchema = new Schema ({
    enabled:            { type: Boolean,},
    stage:              { type: Number, },
    profit:             { type: Object, },
    exch1:              { type: Object, },
    exch2:              { type: Object, },
    name:               { type: String, },
    procType:           { type: String, },
    cion:               { type: Object, },
    base:               { type: Object, },
    disbal:             { type: Object, },
    amountC:            { type: Number, },
    amountB:            { type: Number, },
    orderSel:           { type: Object, }, // tow orders: sell from left and buy to right
    orderBuy:           { type: Object, },
    
    maskId:             { type: String, },
    procId:             { type: String, },
    dealId:             { type: String, }, 
}, {timestamps: true});
const Mask = mongoose.model('Mask', maskSchema); 
const Proc = mongoose.model('Proc', maskSchema); 

const dealSchema = new Schema ({
    procId:             { type: String, },
    maskId:             { type: String, },
    profit:             { type: Object, },
    orderSel:           { type: Object, }, 
    orderBuy:           { type: Object, },
}, {timestamps: true});
const Deal = mongoose.model('Deal', dealSchema); 

const logSchema = new Schema ({
text:   { type: String, } }, {timestamps: true});
const Log = mongoose.model('Log', logSchema); 

const scopeSchema = new Schema ({
    buy:    { type: Number, }, 
    sell:   { type: Number, } 
}, {timestamps: true});
const Scope = mongoose.model('Scope', scopeSchema); 

async function addLog(t) {
    let log = new Log({text: t});
    await func.sendAlert(t);
    console.log(t)
    await log.save();
}
async function addScope(s, b) {
    let log = new Scope({buy: b, sell: s}); 
    await log.save();
}
async function getProcData(procId){
    let p = await Proc.findById(procId);
    return p;
}


async function addMask() {
    const coin = {
        name: 'WAVES',
        ticker: {left: 'WAVES', right: 'WAVES', rate: 1, ccxt: 'WAVES'}, // rate = 
        balance:{left: 0, right: 0},
    }
    const base1 = {
        name: 'USDT',
        ticker: {left: 'USDT', right: 'USDT', rate: 1, ccxt: 'USDT'}, //  
        balance:0,
    }
    const base2 = {
        name: 'USDN',
        ticker: {left: 'USDN', right: '=-=-=-=-=-=', rate: 1, ccxt: 'USDN'}, //  
        balance:0,
    }
    const exch1 = {
        name:   'binance',
        fee:    0.00075
    }
    const exch2 = {
        name:   'wavesdex',
        fee:    0.0005
    }
    const moves = []
    const profit = {result: 0, moves: moves}
    const disbal = {
        deal: {s: 0.4, b:  0.4},
        rebal:{to1: 0.7, to1: 0.7}  
    }
    const orderSel = {
        left: {
            id:         '',
            amountC:    0,
            price:      0,
            average:    0,
            placed:     false,
            closed:     false,
            filled:     0,
        },
        right: {
            id:         '',
            amountC:    0,
            price:      0,
            average:    0,
            placed:     false,
            closed:     false,
            filled:     0,
        }
    }
    const orderBuy = {
        left: {
            id:         '',
            amountC:    0,
            price:      0,
            average:    0,
            placed:     false,
            closed:     false,
            filled:     0,
        },
        right: {
            id:         '',
            amountC:    0,
            price:      0,
            average:    0,
            placed:     false,
            closed:     false,
            filled:     0,
        }
    }
    const params = {
    enabled:            true,
    stage:              0,
    profit:             profit,
    exch1:              exch1,
    exch2:              exch2,
    name:               'vertion2',
    procType:           'vertion2',
    coin:               coin,
    base1:              base1,
    base2:              base2,
    disbal:             disbal,
    amountC:            0,
    amountB:            200,
    orderSel:           orderSel, 
    orderBuy:           orderBuy,
    
    maskId:             '',
    procId:             '',
    dealId:             '', 
    }
    let mask    = new Mask(params);
    let proc    = new Proc(mask);
    proc.maskId = mask._id; 
    mask.maskId = mask._id; 
    proc.procId = proc._id; 
    mask.procId = proc._id; 

    await proc.save(); 
    await mask.save();
    console.log(proc._id, 'process created');
    console.log(mask._id, 'mask created');

}


module.exports.addLog           = addLog;
module.exports.addScope         = addScope;
module.exports.getProcData      = getProcData;
module.exports.addMask          = addMask;

