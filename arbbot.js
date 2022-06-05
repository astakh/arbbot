const ccxt = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot');
const func  = require('./functions');
require('dotenv').config();
const WebSocket = require('ws');
let bws = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');

bws.onmessage = (event) => {
    let sockObj = JSON.parse(event.data);
    l.bidPrice = parseFloat(sockObj.b);
    l.askPrice = parseFloat(sockObj.a);
    l.avgPrice = (l.bidPrice + l.askPrice) / 2;
    //console.log(`WAVESUSDT bid: ${sockObj.b}, ask: ${sockObj.a}`);
}
var l = {bidPrice: 0, askPrice: 0, avgPrice: 0};
const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });

async function getScopes() {
    let t       = new Date();
    //const l     = await func.getOrdersDirect('binance', 'WAVES', 'USDT', bot.amount);
    const r     = await func.getOrdersDirect('wavesdex', 'WAVES', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', bot.amount);
    //console.log('getScopes: ', bot.pairRigh, bot.amount);
    let res     = {}; 
    if (l.askPrice>0 && r.askPrice>0) {
        res.buy     = (r.bidPrice/bot.rateRigh - l.askPrice/bot.rateLeft) / l.askPrice/bot.rateLeft * 100;
        res.sell    = (l.bidPrice/bot.rateLeft - r.askPrice/bot.rateRigh) / r.askPrice/bot.rateRigh * 100;
        res.bidLeft = l.bidPrice;
        res.askLeft = l.askPrice;
        res.bidRigh = r.bidPrice;
        res.askRigh = r.askPrice; 
        res.time    = new Date() - t;
        res.timeR   = r.time;
        res.timeL   = 0//l.time;
        await db.addScope(res.sell, res.buy);
        return res;
    }
    else {
        res.buy     = 0;
        res.sell    = 0;
        res.bidLeft = 0;
        res.askLeft = 0;
        res.bidRigh = 0;
        res.askRigh = 0; 
        res.time    = new Date() - t;
        return res;
    }
}
async function getBalances() {
    let res = {};
    try {
        let b = await bot.exchLeft.fetchBalance();
        if (bot.pairLeftA == 'WAVES')   bot.balLeftA = b.WAVES.free * 1;
        if (bot.pairLeftC == 'USDT')    bot.balLeftC = b.USDT.free * 1;
        if (bot.pairLeftC == 'USDN')    bot.balLeftC = b.USDN.free * 1;
        b = await bot.exchRigh.fetchBalance();
        if (bot.pairRighA == 'WAVES')   bot.balRighA = b.WAVES.free * 1;
        if (bot.pairRighC == 'USDT')    bot.balRighC = b.USDT.free * 1;
        if (bot.pairRighC == 'USDN')    bot.balRighC = b.USDN.free * 1;
        res = true;
    }
    catch(err) { res = false; }
    return res;
}
async function placeOrder(exch, pair, orderType, orderDirection, amount, price) {
    let res = {};
    try {
        const order = await exch.createOrder(pair, orderType, orderDirection, amount, price);
        res.success = true;
        res.order   = order;
        res.id      = order.id;
    }
    catch(err) { res.success=false;  res.error=err; }
    return res;
}
async function getOrder(exch, id, pair) {
    let res = {};
    try {
        const order = await exch.fetchOrder(id, pair);
        res.success = true;
        res.order   = order;
        res.id      = order.id;
        res.status  = order.status;
    }
    catch(err) { res.success=false;  res.error=err; }
    return res;
}
async function setRate() {
    let market = await func.getOrdersDirect('wavesdex', '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
    console.log(`USDT/USDN: ${parseFloat((market.avgPrice)/100).toFixed(4)} `);
    return parseFloat(market.avgPrice)/100;
}
function setDelay(t) {
    if (t == 'sell') if (scope.sell < 0) { delay = 2000 - scope.time; } else if (scope.sell < bot.disbalLeft/2) {delay = 1000 - scope.time} else { delay = 0; }
    if (t == 'buy')  if (scope.buy < 0)  { delay = 2000 - scope.time; } else if (scope.buy < bot.disbalRigh/2)  {delay = 1000 - scope.time} else { delay = 0; }
}
let bot = {};
let scope;
let delay = 0;

async function botLoop() {
    // set vars
    let order;
    let round = 0;

    bot = await db.getProcData('62989717feb20f6dcebecc25'); // get proc data ================= 
    bot.exchLeft = binance;
    bot.exchRigh = wavesdex; 
    bot.procId   = bot._id; 
    
    while(bot.stage < 9) {
    //while(false) {

        if (bot.stage == 0) { // looking for scope
            if ((round % 25) == 0) { bot.rateRigh = await setRate(); }
            scope = await getScopes();
            setDelay('sell');
            console.log(`Round: ${round} || ${func.nowTime()} || Scope: sell: ${scope.sell.toFixed(4)} || Scope: buy: ${scope.buy.toFixed(4)} || Time: ${scope.time} || timeR:${scope.timeR} || timeL:${scope.timeL}`);
            if (scope.sell > bot.disbalLeft) { // ready to sell from left and buy to right
                bot.dealId  = await db.addDeal(bot);
                bot.orderLeftSellPrice  = scope.bidLeft;
                bot.orderRighBuyPrice   = scope.askRigh;
                bot.stage   = await db.nextStage(bot.procId);
                await db.addLog(`Deal started`)
            }
        }
        if (bot.stage == 1) { // try to place order to left sell
            order = await placeOrder(bot.exchLeft, bot.pairLeft, 'limit', 'sell', bot.amount, bot.orderLeftSellPrice);
            if (order.success) {
                await       db.addLog(`Sell order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderLeftSell', order);
                bot.stage   = await db.nextStage(bot.procId);
            } else          {console.log(order.error)}
        }
        if (bot.stage == 2) { // try to place order to right buy
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'buy', bot.amount, bot.orderRighBuyPrice * 1.01);
            if (order.success) {
                await       db.addLog(`Buy order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderRighBuy', order);
                bot.stage   = await db.nextStage(bot.procId);
            } else          {console.log(order.error)}
        }
        if (bot.stage == 3) { // ?are orders closed  
            if (!bot.orderLeftSellClosed) {
                order = await getOrder(bot.exchLeft, bot.orderLeftSell, bot.pairLeft);
                //console.log(`left sell order.status: ${order.status}`);
                if (order.success && order.status == 'closed') {
                    bot         = await db.saveOrder(bot, 'orderLeftSell', order);
                    console.log(`left Sell: ${bot.orderLeftSellClosed} `)
                }
            }
            if (!bot.orderRighBuyClosed) {
                order = await getOrder(bot.exchRigh, bot.orderRighBuy, bot.pairRigh);
                //console.log(`right buy order.status: ${order.status}`);
                if (order.success && order.status == 'closed') {
                    bot         = await db.saveOrder(bot, 'orderRighBuy', order);
                    console.log(`right buy: ${bot.orderRighBuyClosed} `)
                }
            }
            if (bot.orderRighBuyClosed && bot.orderLeftSellClosed) {
                bot.stage   = await db.nextStage(bot.procId); 
            } else { console.log(`leftSell: ${bot.orderLeftSellClosed} || right Buy ${bot.orderRighBuyClosed}`)}
        }
        if (bot.stage == 4) { // looking for scope to sell from right and buy to left 
            if ((round % 25) == 0) { bot.rateRigh = await setRate(); }
            scope = await getScopes();
            setDelay('buy');
            console.log(`Round: ${round} || ${func.nowTime()} || Scope: buy: ${scope.buy.toFixed(4)} || Scope: sell: ${scope.sell.toFixed(4)} || Time: ${scope.time} || timeR:${scope.timeR} || timeL:${scope.timeL}`);
            if (scope.buy > bot.disbalRigh) { // ready to sell  from right and buy to left
                bot.stage               = await db.nextStage(bot.procId);
                bot.orderLeftBuyPrice   = scope.askLeft;
                bot.orderRighSellPrice  = scope.bidRigh;
            }
        }
        if (bot.stage == 5) { // try to place order to left buy
            order = await placeOrder(bot.exchLeft, bot.pairLeft, 'limit', 'buy', bot.amount, bot.orderLeftBuyPrice);
            if (order.success) {
                await               db.addLog(`Buy order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderLeftBuy', order);
                bot.stage           = await db.nextStage(bot.procId);
            } else                  {console.log(order.error)}
        }
        if (bot.stage == 6) { // try to place order to right sell
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'sell', bot.amount, bot.orderRighSellPrice / 1.01);
            if (order.success) {
                await               db.addLog(`Sell order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderRighSell', order);
                bot.stage           = await db.nextStage(bot.procId);
            } else                  {console.log(order.error)}
        }
        if (bot.stage == 7) { // ?are orders closed 
            if (!bot.orderRighSellClosed) {
                order = await getOrder(bot.exchRigh, bot.orderRighSell, bot.pairRigh);
                if (order.success && order.status == 'closed') {
                    bot = await db.saveOrder(bot, 'orderRighSell', order);
                }
            }
            if (!bot.orderLeftBuyClosed) {
                order = await getOrder(bot.exchLeft, bot.orderLeftBuy, bot.pairLeft);
                if (order.success && order.status == 'closed') {
                    bot = await db.saveOrder(bot, 'orderLeftBuy', order);
                }
            }
            if (bot.orderLeftBuyClosed && bot.orderRighSellClosed) {
                    bot.stage   = await db.nextStage(bot.procId); 
            } else { console.log(`leftBuy: ${bot.orderLeftBuyClosed} || right sell ${bot.orderRighSellClosed}`)}
        }
        if (bot.stage == 8) { // save results and restart
            console.log('trying to save deal: ', bot.dealId);
            bot.stage = await db.saveDeal(bot); 
        }


        round++;
        await func.sleep(delay);
    
    }
}

botLoop();

