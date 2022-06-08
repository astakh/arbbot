const ccxt  = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot');
const wd    = require('./wavesmatcher');
const func  = require('./functions');
require('dotenv').config();
const WebSocket = require('ws');
let bws = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');
//let gws = new WebSocket('wss://api.gateio.ws/ws/v4/');

let wavesUsdtPrice      = {};
wavesUsdtPrice.binance  = {};
wavesUsdtPrice.gateio   = {};
bws.onmessage = (event) => {
    let sockObj = JSON.parse(event.data);
    wavesUsdtPrice.binance.bidPrice = parseFloat(sockObj.b);
    wavesUsdtPrice.binance.askPrice = parseFloat(sockObj.a);
    wavesUsdtPrice.binance.avgPrice = (wavesUsdtPrice.binance.bidPrice + wavesUsdtPrice.binance.askPrice) / 2;
    //console.log(`WAVESUSDT bid: ${sockObj.b}, ask: ${sockObj.a}`);
}
var socketGateio = new WebSocket('wss://ws.gate.io/v3');
socketGateio.onopen = function () {
    console.log("Connected to gate.io websocket");
    const params = ["WAVES_USDT", 20, "0.0001"];
    var msg = {
        id:     11111,
        method: 'depth.subscribe',
        params: params
    };
    socketGateio.send(JSON.stringify(msg));
};

socketGateio.onmessage = function (e) { 
    let asks    = wavesUsdtPrice.gateio.asks;
    let bids    = wavesUsdtPrice.gateio.bids;
    let r       = JSON.parse(e.data);
    let params  = [];
    let newAsks = [];
    let d       = [];

    if (r.params) {
        params = r.params;
        if (params[0]) {
            asks = func.toFloat(params[1].asks);
            bids = func.toFloat(params[1].bids);
            //console.log(asks, bids);
        }
        else {
            if (params[1].asks){
                newAsks = func.toFloat(params[1].asks)
                newAsks.forEach(newElement => {
                    for (var i = 0; i < asks.length; i++) {
                        if (newElement[1] == 0 ) {
                            d = asks.splice(i, 1);
                            break;
                        }
                        else {
                            if (newElement[0] <= asks[i][0]) {
                                d = asks.splice(i, 0, newElement);
                                break;
                            }
                        }
                    }
                });
            }
            if (params[1].bids){
                newBids = func.toFloat(params[1].bids)
                newBids.forEach(newElement => {
                    for (var i = 0; i < bids.length; i++) {
                        if (newElement[1] == 0 ) {
                            d = bids.splice(i, 1);
                            break;
                        }
                        else {
                            if (newElement[0] >= bids[i][0]) {
                                d = bids.splice(i, 0, newElement);
                                break;
                            }
                        }
                    }
                });
            }
        }
        wavesUsdtPrice.gateio.asks = asks;
        wavesUsdtPrice.gateio.bids = bids;
        let vol     = 0;
        for (var i  = 0; i < bids.length; i++ ) {
            vol += bids[i][1];
            if (vol > 100) { wavesUsdtPrice.gateio.bidPrice = bids[i][0]; break; }
        }
        vol = 0;
        for (var i = 0; i < asks.length; i++ ) {
            vol += asks[i][1];
            if (vol > 100) { wavesUsdtPrice.gateio.askPrice = asks[i][0]; break; }
        }
        wavesUsdtPrice.gateio.avgPrice    = (wavesUsdtPrice.gateio.bidPrice+wavesUsdtPrice.gateio.askPrice)/2;

    }
    
}

var l = {bidPrice: 0, askPrice: 0, avgPrice: 0};
const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });
const gateio    = new ccxt.gateio(          { apiKey: process.env.GATEIO_API_KEY, secret: process.env.GATEIO_API_SECRET });


async function getScopes(bot) {
    let t       = new Date();
    const l     = wavesUsdtPrice[bot.exchangeLeft];
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
    if (exch == wavesdex) {
        console.log('try to place waves order')
        let order = await wd.placeWavesOrder('WAVES', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', amount, price, orderDirection);
        order       = await getOrder(exch, order.id, pair);
        res.success = true;
        res.order   = order;
        res.price   = order.price;
        res.id      = order.id;

    }
    else {
        try {
            let order   = await exch.createOrder(pair, orderType, orderDirection, amount, price);
            order       = await getOrder(exch, order.id, pair);
            res.success = true;
            res.order   = order;
            res.price   = order.price;
            res.id      = order.id;
        }
        catch(err) { res.success=false;  res.error=err; }
    }
    return res;
}
async function getOrder(exch, id, pair) {
    let res = {};
    try {
        const order = await exch.fetchOrder(id, pair);
        res.success = true;
        res.order   = order;
        res.id      = order.id;
        res.price   = order.price;
        res.average = order.average;
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
function setDelay(bot, scope, direction) {
    let delay = 0;
    if (direction == 'sell') if (scope.sell < 0) { delay = 2000; } else if (scope.sell < bot.disbalLeft/2) {delay = 1000; } 
    if (direction == 'buy')  if (scope.buy < 0)  { delay = 2000; } else if (scope.buy < bot.disbalRigh/2)  {delay = 1000; }
    return delay;
}
let scope       = {};
let exchanges   = [];
let usdtusdnRate= 1; 
let order;

exchanges['wavesdex']   = wavesdex;
exchanges['binance']    = binance;
exchanges['gateio']     = gateio;

async function doWBot(bot) { 
    if (bot.nextTime < Date.now()) {
        if (bot.stage == 0) { // looking for scope
            bot.rateRigh = usdtusdnRate; 
            scope = await getScopes(bot);
            bot.nextTime += setDelay(bot, scope, 'sell'); 
            console.log(`${bot.strategy} || ${func.nowTime()} || Scope: sell: ${scope.sell.toFixed(2)} || Scope: buy: ${scope.buy.toFixed(2)} || Time: ${scope.time}`);
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
                await       db.addLog(`${bot.strategy}:${bot.stage}: Sell order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderLeftSell', order);
                bot.stage   = await db.nextStage(bot.procId);
            } else          {console.log(order.error)}
        }
        if (bot.stage == 2) { // try to place order to right buy
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'buy', bot.amount, bot.orderRighBuyPrice * 1.01);
            if (order.success) {
                await       db.addLog(`${bot.strategy}:${bot.stage}: Buy order ${order.id} placed`);
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
            bot.rateRigh = usdtusdnRate; 
            scope = await getScopes(bot);
            bot.nextTime += setDelay(bot, scope, 'buy');
            console.log(`${bot.strategy} || ${func.nowTime()} || Scope: buy: ${scope.buy.toFixed(2)} || Scope: sell: ${scope.sell.toFixed(2)} || Time: ${scope.time}`);
            if (scope.buy > bot.disbalRigh) { // ready to sell  from right and buy to left
                bot.stage               = await db.nextStage(bot.procId);
                bot.orderLeftBuyPrice   = scope.askLeft;
                bot.orderRighSellPrice  = scope.bidRigh;
            }
        }
        if (bot.stage == 5) { // try to place order to left buy
            order = await placeOrder(bot.exchLeft, bot.pairLeft, 'limit', 'buy', bot.amount, bot.orderLeftBuyPrice);
            //console.log(order);
            if (order.success) {
                await       db.addLog(`${bot.strategy}:${bot.stage}: Buy order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderLeftBuy', order);
                bot.stage   = await db.nextStage(bot.procId);
            } else                  {console.log(order.error)}
        }
        if (bot.stage == 6) { // try to place order to right sell
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'sell', bot.amount, bot.orderRighSellPrice / 1.01);
            if (order.success) {
                await       db.addLog(`${bot.strategy}:${bot.stage}: Sell order ${order.id} placed`);
                bot         = await db.saveOrder(bot, 'orderRighSell', order);
                bot.stage   = await db.nextStage(bot.procId);
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
    }
    return bot;
}

async function botLoop() { 
    let bot         = {};
    let bots        = [];
    
    bot = await db.getProcData('62a03ea9527695861f98d6f7'); // get proc data ================= 
    bot.exchLeft    = exchanges[bot.exchangeLeft];
    bot.exchRigh    = exchanges[bot.exchangeRigh];
    bot.nextTime    = Date.now();
    bots[0]         = bot; 
    bot = await db.getProcData('62a03eef9dbb07ddbd54bb85'); // get proc data ================= 
    bot.exchLeft    = exchanges[bot.exchangeLeft];
    bot.exchRigh    = exchanges[bot.exchangeRigh];
    bot.nextTime    = Date.now();
    bots[1]         = bot; 
    console.log(`Having ${bots.length} bots..`);
    

    let rateTime     = 0;
    while(true) {
        if (rateTime < Date.now()) { usdtusdnRate = await setRate(); rateTime = Date.now() + 30*1000; }

        for (var i = 0; i < bots.length; i++ ) {
            bots[i] = await doWBot(bots[i]);
        }
        

        //round++;
        //await func.sleep(delay);
    
    }
}

botLoop();

