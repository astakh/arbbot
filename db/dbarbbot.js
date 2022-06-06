const mongodb   = require('mongodb');
const mongoose  = require('mongoose'); 
const func      = require('../functions');
require('dotenv').config();


const db        = process.env.DBPATH; 
mongoose
    .connect(db)
    .then((res) => console.log('Connected to DB'))
    .catch((err) => console.log(err));

    const Schema = mongoose.Schema; 

    const maskSchema = new Schema ({
        enabled:            { type: Boolean,},
        stage:              { type: Number, },
        exchangeLeft:       { type: String, },
        exchangeRigh:       { type: String, },
        strategy:           { type: String, },
        procType:           { type: String, },
        pairLeft:           { type: String, },
        pairRigh:           { type: String, },
        pairLeftA:          { type: String, },
        pairLeftC:          { type: String, },
        pairRighA:          { type: String, },
        pairRighC:          { type: String, },
        balLeftA:           { type: Number, },
        balLeftC:           { type: Number, },
        balRighA:           { type: Number, },
        balRighC:           { type: Number, },
        rateLeft:           { type: Number, },
        rateRigh:           { type: Number, },
        disbalLeft:         { type: Number, },
        disbalRigh:         { type: Number, },
        amount:             { type: Number, },
        amountC:            { type: Number, },
        stage:              { type: Number, },
        orderLeftBuy:       { type: String, },
        orderRighBuy:       { type: String, },
        orderLeftSell:      { type: String, },
        orderRighSell:      { type: String, },
        orderLeftBuyPrice:  { type: Number, },
        orderRighBuyPrice:  { type: Number, },
        orderLeftSellPrice: { type: Number, },
        orderRighSellPrice: { type: Number, },
        orderLeftBuyClosed: { type: Boolean,},
        orderRighBuyClosed: { type: Boolean,},
        orderLeftSellClosed:{ type: Boolean,},
        orderRighSellClosed:{ type: Boolean,},
        botId:              { type: String, },
        procId:             { type: String, },
        dealId:             { type: String, },
        lastAction:         { type: String, },
        }, {timestamps: true});
        const Mask = mongoose.model('Mask', maskSchema); 
        const Proc = mongoose.model('Proc', maskSchema); 
    
    const dealSchema = new Schema ({
        procId:             { type: String, },
        profit:             { type: Number, },
        amount:             { type: Number, },
        orderLeftBuy:       { type: String, },
        orderRighBuy:       { type: String, },
        orderLeftSell:      { type: String, },
        orderRighSell:      { type: String, },
        startTime:          { type: String, },
        endedTime:          { type: String, },
        orderLeftBuyPrice:  { type: Number, },
        orderRighBuyPrice:  { type: Number, },
        orderLeftSellPrice: { type: Number, },
        orderRighSellPrice: { type: Number, },
        }, {timestamps: true});
        const Deal = mongoose.model('Deal', dealSchema); 
    
    const logSchema = new Schema ({
    text:   { type: String, } }, {timestamps: true});
    const Log = mongoose.model('Log', logSchema); 
    const botprocSchema = new Schema ({
        botId:      { type: String, }, 
        procId:     { type: String, },
        active:     { type: Boolean,}, 
    
    }, {timestamps: true});
        const Botproc = mongoose.model('Botproc', botprocSchema); 
    
    const scopeSchema = new Schema ({
        buy:    { type: Number, }, 
        sell:   { type: Number, } 
    }, {timestamps: true});
    const Scope = mongoose.model('Scope', scopeSchema); 
    
async function lastAction() {
    let s           = await Proc.findById(procID);
    s.lastAction    = func.nowTime();
    await s.save();
}
async function nextStage(procId) {
    let s           = await Proc.findById(procId);
    s.lastAction    = func.nowTime();
    if (s.stage > 8) {
        s.stage     = 0; // add save deal
        await addLog('Start new process');
    }
    else {
        s.stage     = s.stage + 1; 
        await addLog(`Next stage: ${s.stage}`);
    }
    await s.save();
    return s.stage;
}
async function saveOrder(bot, orderType, order) {
    let proc    = await Proc.findById(bot.procId);
    if (bot[orderType] == '') { 
        proc[orderType] = order.id;
        bot[orderType]  = order.id;
        await addLog(`${orderType} ${order.id} with price ${order.order.price.toFixed(4)} added`);
        await proc.save();
    }
    if (order.order.status == 'closed') {
        proc[orderType + 'Price']   = order.order.average;
        proc[orderType + 'Closed']  = true;
        bot[orderType + 'Price']    = order.order.average;
        bot[orderType + 'Closed']   = true;
        await addLog(`${orderType} ${order.id} with price ${order.order.average.toFixed(4)} closed`);
        await proc.save();
    }
    return bot;
}
async function newOrder(procId, order, id) {
    let proc    = await Proc.findById(procId);
    if (order == 'orderLeftBuy')    { proc.orderLeftBuy     = id; }
    if (order == 'orderLeftSell')   { proc.orderLeftSell    = id; }
    if (order == 'orderRighBuy')    { proc.orderRighBuy     = id; }
    if (order == 'orderRighSell')   { proc.orderRighSell    = id; }
    await proc.save();
    return id;
}
async function newClosedOrder(procId, order) {
    let proc    = await Proc.findById(procId);
    if (order == 'orderLeftBuy')    { proc.orderLeftBuyClosed  = true; }
    if (order == 'orderLeftSell')   { proc.orderLeftSellClosed = true; }
    if (order == 'orderRighBuy')    { proc.orderRighBuyClosed  = true; }
    if (order == 'orderRighSell')   { proc.orderRighSellClosed = true; }
    await proc.save();
    return true;
}
async function newClosedOrderPrice(procId, order, avg) {
    let proc    = await Proc.findById(procId);
    if (order == 'orderLeftBuy')    { proc.orderLeftBuyPrice     = avg; }
    if (order == 'orderLeftSell')   { proc.orderLeftSellPrice    = avg; }
    if (order == 'orderRighBuy')    { proc.orderRighBuyPrice     = avg; }
    if (order == 'orderRighSell')   { proc.orderRighSellPrice    = avg; }
    await proc.save();
    return avg;
}
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
async function addDeal(bot) {
    let d       = new Deal({procId: bot.procId, amount: bot.amount, startTime: func.nowTime()});
    await       d.save();
    let p       = await Proc.findById(bot.procId);
    p.dealId    = d._id;
    await       p.save();
    return      d._id;
}
async function saveDeal(proc){ 
    try {
        let d = await Deal.findById(proc.dealId);
        d.amount                = proc.amount;
        d.amountC               = proc.amountC;
        d.profit                = (proc.orderLeftSellPrice - proc.orderLeftBuyPrice + proc.orderRighSellPrice - proc.orderRighBuyPrice) * proc.amount - (proc.orderLeftBuyPrice * 4 * 0.001);
        d.orderLeftBuy          = proc.orderLeftBuy;
        d.orderLeftSell         = proc.orderLeftSell;
        d.orderRighSell         = proc.orderRighSell;
        d.orderRighBuy          = proc.orderRighBuy;
        d.orderLeftBuyPrice     = proc.orderLeftBuyPrice;
        d.orderLeftSellPrice    = proc.orderLeftSellPrice;
        d.orderRighSellPrice    = proc.orderRighSellPrice;
        d.orderRighBuyPrice     = proc.orderRighBuyPrice;
        d.endedTime             = func.nowTime();
        await d.save();
        await addLog(`Deal closed with ${d.profit.toFixed(2)} profit`);

        try {
            d = await Proc.findById(proc.procId);
            d.stage                 = 0;
            d.orderLeftBuy          = '';
            d.orderLeftSell         = '';
            d.orderRighSell         = '';
            d.orderRighBuy          = '';
            d.orderLeftBuyClosed    = false;
            d.orderLeftSellClosed   = false;
            d.orderRighSellClosed   = false;
            d.orderRighBuyClosed    = false;
            d.orderLeftBuyPrice     = 0;
            d.orderLeftSellPrice    = 0;
            d.orderRighSellPrice    = 0;
            d.orderRighBuyPrice     = 0;
            d.dealId                = '';

            await d.save();
            return 0;
        } catch(err) { await addLog(err); return 8; }
    } catch(err) { await addLog(err); return 8; }
} 
async function addMask1() {
    let m = new Mask({
        strategy:   'B/W-arbitrTEST',
        procType:   'xxx/waves',
        exchangeLeft:   'binance',
        exchangeRigh:   'wavesdex',
        pairLeft:   'WAVES/USDT',
        pairRigh:   'WAVES/USDN',
        pairLeftA:  'WAVES',
        pairLeftC:  'USDT',
        pairRighA:  'WAVES',
        pairRighC:  'USDN',
        balLeftA:   0,
        balLeftC:   0,
        balRighA:   0,
        balRighC:   0,
        rateLeft:   1.0,
        rateRigh:   1.015,
        disbalLeft: 0.9,
        disbalRigh: 0.9,
        amount:     2,
        amountC:            100,     
        stage:              0,
        orderLeftBuy:       '',
        orderRighBuy:       '',
        orderLeftSell:      '',
        orderRighSell:      '',
        orderLeftBuyPrice:  0,
        orderRighBuyPrice:  0,
        orderLeftSellPrice: 0,
        orderRighSellPrice: 0,
        orderLeftBuyClosed: false,
        orderRighBuyClosed: false,
        orderLeftSellClosed:false,
        orderRighSellClosed:false,
        botId:              '',
        procId:             '',
        dealId:             '',
        enabled:            true,
    
    });
    let p   = new Proc(m);
    p.botId = m._id; 
    m.botId = m._id; 
    m.procId= p._id;
    p.procId= p._id;
    await p.save(); 
    await m.save();
    console.log(p._id, 'process created');
    console.log(m._id, 'mask created');

}

module.exports.lastAction       = lastAction;
module.exports.nextStage        = nextStage;
module.exports.addLog           = addLog;
module.exports.addScope         = addScope;
module.exports.newOrder         = newOrder;
module.exports.saveOrder        = saveOrder;
module.exports.getProcData      = getProcData;
module.exports.saveDeal         = saveDeal;
module.exports.addDeal          = addDeal;
module.exports.addMask1         = addMask1;
module.exports.newClosedOrder   = newClosedOrder;
module.exports.newClosedOrderPrice   = newClosedOrderPrice;

