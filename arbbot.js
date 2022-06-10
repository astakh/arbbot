const ccxt  = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot');
const wd    = require('./wavesmatcher');
const func  = require('./functions');
require('dotenv').config();
const WebSocket = require('ws');
let bws = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');
//let gws = new WebSocket('wss://api.gateio.ws/ws/v4/');
const bin_waves_dep_adr = process.env.BINANCE_WAVES_DEPOSIT_ADDRESS;
const wav_usdt_dep_adr  = process.env.WAVESDEX_USDT_DEPOSIT_ADDRESS;

let wavesUsdtPrice      = {};
wavesUsdtPrice.binance  = {};
//wavesUsdtPrice.gateio   = {};
bws.onmessage = (event) => {
    let sockObj = JSON.parse(event.data);
    wavesUsdtPrice.binance.bidPrice = parseFloat(sockObj.b);
    wavesUsdtPrice.binance.askPrice = parseFloat(sockObj.a);
    wavesUsdtPrice.binance.avgPrice = (wavesUsdtPrice.binance.bidPrice + wavesUsdtPrice.binance.askPrice) / 2;
    //console.log(`WAVESUSDT bid: ${sockObj.b}, ask: ${sockObj.a}`);
}
var l = {bidPrice: 0, askPrice: 0, avgPrice: 0};
const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });
//const gateio    = new ccxt.gateio(          { apiKey: process.env.GATEIO_API_KEY, secret: process.env.GATEIO_API_SECRET });


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
        let b = await binance.fetchBalance();
        if (b[balance.nameLeftA].free) { balance.LeftA = b[balance.nameLeftA].free; } else {balance.LeftA = 0; } 
        if (b[balance.nameLeftC].free) { balance.LeftC = b[balance.nameLeftC].free; } else {balance.LeftC = 0; }

        b = await wavesdex.fetchBalance();
        if (b[balance.nameRighA].free) { balance.RighA = b[balance.nameRighA].free; } else {balance.RighA = 0; } 
        if (b[balance.nameRighC].free) { balance.RighC = b[balance.nameRighC].free; } else {balance.RighC = 0; }
        res = true;
        console.log(`Balances: left: A${balance.LeftA.toFixed(0)} C${balance.LeftC.toFixed(0)} || right: A${balance.RighA.toFixed(0)} C${balance.RighC.toFixed(0)}`)
    }
    catch(err) { console.log('getBalances: error', err); res = false; }
    return res;
}
async function placeOrder(exch, pair, orderType, orderDirection, amount, price) {
    let res = {};
    if (exch == wavesdex) {
        console.log('try to place waves order');
        let order;
        if (pair == 'WAVES/USDN')   { order = await wd.placeWAVESUSDNOrder(amount, price, orderDirection); }
        if (pair == 'USDT/USDN')    { order = await wd.placeUSDTUSDNOrder(amount, price, orderDirection); }

        if (order.success) {
        
            order       = await getOrder(exch, order.id, pair);
            res.success = true;
            res.order   = order;
            res.price   = order.price;
            res.id      = order.id;
        } else { res.success = false; }
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
let balance     = {nameLeftA: 'WAVES', nameLeftC: 'USDT', nameRighA: 'WAVES', nameRighC: 'USDN', LeftA: 0, LeftC: 0, RighA: 0, RighC: 0};
let scope       = {};
let exchanges   = [];
let usdtusdnRate= 1; 
let order;

exchanges['wavesdex']   = wavesdex;
exchanges['binance']    = binance;
//exchanges['gateio']     = gateio;

async function doRebalanceBot(bot) { 
    if (bot.nextTime < Date.now()) {
        bot.balLeftA = balance.LeftA; bot.balRighA = balance.RighA;
        bot.balLeftC = balance.LeftC; bot.balRighC = balance.RighC;
        if (bot.stage == 0) { // looking for scope
            bot.rateRigh = usdtusdnRate; 
            scope = await getScopes(bot);
            bot.nextTime += setDelay(bot, scope, 'sell'); 
            console.log(`${bot.strategy} || ${func.nowTime()} || Scope: sell: ${scope.sell.toFixed(2)} || Scope: buy: ${scope.buy.toFixed(2)} || Time: ${scope.time}`);
            if (scope.sell > bot.disbalLeft) { // ready to sell from left and buy to right
                bot.orderLeftSellPrice  = scope.bidLeft;
                bot.orderRighBuyPrice   = scope.askRigh;
                bot.amount  = parseInt(bot.amountC / bot.orderLeftSellPrice) / 1;
                if (bot.balLeftA >= bot.amount && bot.balRighC > bot.amount * bot.orderRighBuyPrice) {
                    console.log(`${bot.strategy}:${bot.stage}: Balance OK`); 
                    bot.stage   = await db.setStage(bot.procId, 1);
                    if (bot.dealId == '') bot.dealId  = await db.addDeal(bot);
                }
                else { console.log(`${bot.strategy}:${bot.stage}: Too low balance`); }
                //await db.addLog(`Deal started amount=${bot.amount}`)
            }
        }
        if (bot.stage == 1) { // try to place order to left sell
            order = await placeOrder(bot.exchLeft, bot.pairLeft, 'limit', 'sell', bot.amount, bot.orderLeftSellPrice / 1.005);
            if (order.success) {
                //await       db.addLog(`${bot.strategy}:${bot.stage}: Sell order ${order.id} placed`);
                bot         = await db.newOrder(bot, 'orderLeftSell', order);
                bot.stage   = await db.setStage(bot.procId, 2);
            } else          {console.log(order.error)}
        }
        if (bot.stage == 2) { // try to place order to right buy
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'buy', bot.amount, bot.orderRighBuyPrice * 1.01);
            if (order.success) {
                //await       db.addLog(`${bot.strategy}:${bot.stage}: Buy order ${order.id} placed`);
                bot         = await db.newOrder(bot, 'orderRighBuy', order);
                bot.stage   = await db.setStage(bot.procId, 3);
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
                bot.stage   = await db.setStage(bot.procId, 4); 
            } else { console.log(`leftSell: ${bot.orderLeftSellClosed} || right Buy ${bot.orderRighBuyClosed}`)}
        }
        if (bot.stage == 4) { // looking for scope to sell from right and buy to left 
            bot.rateRigh = usdtusdnRate; 
            scope = await getScopes(bot);
            bot.nextTime += setDelay(bot, scope, 'buy');
            console.log(`${bot.strategy} || ${func.nowTime()} || Scope: buy: ${scope.buy.toFixed(2)} || Scope: sell: ${scope.sell.toFixed(2)} || Time: ${scope.time}`);
            if (scope.buy > bot.disbalRigh) { // ready to sell  from right and buy to left
                bot.orderLeftBuyPrice   = scope.askLeft;
                bot.orderRighSellPrice  = scope.bidRigh;
                if (bot.balRighA >= bot.amount && bot.balLeftC > bot.amount * bot.orderLeftBuyPrice) {
                    console.log(`${bot.strategy}:${bot.stage}: Balance OK`);
                    bot.stage               = await db.setStage(bot.procId, 11);
                }
                else { console.log(`${bot.strategy}:${bot.stage}: Too low balance`); }
            }
            else if (scope.sell > bot.disbalRebal) {
                bot.stage   = await db.setStage(bot.procId, 5);
            }
        }
        if (bot.stage == 5) {
            const balance = await bot.exchLeft.fetchBalance();
            if (balance.USDT.free > bot.amountC) { 
                const withdraw = await binance.withdraw ('USDT', bot.amountC+1, wav_usdt_dep_adr, { network: 'BSC' });
                await db.addLog(`${bot.strategy} USDT withdraw started`);
                bot.stage = await db.setStage(bot.procId, 6);
            } else { bot.stage = await db.setStage(bot.procId, 4); }
        }
        if (bot.stage == 6) {
            const balance = await bot.exchRigh.fetchBalance();
            if (balance.WAVES.free > bot.amount) { 
                const withdraw = await wavesdex.withdraw ('WAVES', bot.amount, bin_waves_dep_adr);
                await db.addLog(`${bot.strategy} WAVES withdraw started`);
                bot.stage = await db.setStage(bot.procId, 7);
            } else { bot.stage = await db.setStage(bot.procId, 4); }
        }
        if (bot.stage == 7) {
            try {
                const balance = await bot.exchRigh.fetchBalance();
                console.log(balance.USDT); 
                if (balance.USDT.free) 
                    if (balance.USDT.free > bot.amountC) {bot.stage = await db.setStage(bot.procId, 8);}
                    else { bot.nextTime += 10 * 1000; }
                else { bot.nextTime += 10 * 1000; }
            }
            catch(err) {
                console.log(err);
                bot.nextTime += 10 * 1000;
            }
        }
        if (bot.stage == 8) {
            order = await placeOrder(bot.exchRigh, 'USDT/USDN', 'limit', 'sell', bot.amountC, bot.rateRigh / 1.005);
            if (order.success) {
                await       db.addLog(`${bot.strategy}:${bot.stage}: USDT sell order ${order.id} placed`);
                bot         = await db.newOrder(bot, 'orderUsdtUsdn', order);
                bot.stage   = await db.setStage(bot.procId, 9);
            } else          {console.log(order.error)}
        }
        if (bot.stage == 9) {
            order = await getOrder(bot.exchRigh, bot.orderUsdtUsdn, 'USDT/USDN'); 
            if (order.success && order.status == 'closed') {
                bot         = await db.saveOrder(bot, 'orderUsdtUsdn', order);
                console.log(`USDT Sell: ${bot.orderUsdtUsdnClosed} `);
                bot.stage   = await db.setStage(bot.procId, 10);
            } else { bot.nextTime += 5 * 1000; }
        }
        if (bot.stage == 10) {
            let balance = await bot.exchRigh.fetchBalance();
            if (balance.USDN.free > bot.amountC * bot.rateRigh) { 
                balance = await bot.exchLeft.fetchBalance();
                scope   = await getScopes(bot);
                if (balance.WAVES.free >= bot.amount) {
                    bot.stage = await db.setStage(bot.procId, 0);
                    await db.addLog(`${bot.strategy}:rebalance completed`)
                }
                else { bot.nextTime += 10 * 1000; }
            }
            else { bot.nextTime += 10 * 1000; }
        }
        if (bot.stage == 11) { // try to place order to left buy
            order = await placeOrder(bot.exchLeft, bot.pairLeft, 'limit', 'buy', bot.amount, bot.orderLeftBuyPrice * 1.005);
            //console.log(order);
            if (order.success) {
                //await       db.addLog(`${bot.strategy}:${bot.stage}: Buy order ${order.id} placed`);
                bot         = await db.newOrder(bot, 'orderLeftBuy', order);
                bot.stage   = await db.setStage(bot.procId, 12);
            } else                  {console.log(order.error)}
        }
        if (bot.stage == 12) { // try to place order to right sell
            order = await placeOrder(bot.exchRigh, bot.pairRigh, 'limit', 'sell', bot.amount, bot.orderRighSellPrice / 1.01);
            if (order.success) {
                //await       db.addLog(`${bot.strategy}:${bot.stage}: Sell order ${order.id} placed`);
                bot         = await db.newOrder(bot, 'orderRighSell', order);
                bot.stage   = await db.setStage(bot.procId, 13);
            } else                  {console.log(order.error)}
        }
        if (bot.stage == 13) { // ?are orders closed 
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
                    bot.stage   = await db.setStage(bot.procId, 14); 
            } else { console.log(`leftBuy: ${bot.orderLeftBuyClosed} || right sell ${bot.orderRighSellClosed}`)}
        }
        if (bot.stage == 14) { // save results and restart
            console.log('trying to save deal: ', bot.dealId);
            bot.stage   = await db.saveDeal(bot); 
            bot.dealId  = '';
        }
    }
    return bot;
}


async function botLoop() { 
    let bot         = {};
    let bots        = [];

    bot = await db.getProcData('62a1c48760f4df7c59575908'); // get proc data ================= 
    bot.exchLeft    = exchanges[bot.exchangeLeft];
    bot.exchRigh    = exchanges[bot.exchangeRigh];
    bot.nextTime    = Date.now();
    bots[0]         = bot;
    bot = await db.getProcData('62a1c4b33f3b0a4095eeecb3'); // get proc data ================= 
    bot.exchLeft    = exchanges[bot.exchangeLeft];
    bot.exchRigh    = exchanges[bot.exchangeRigh];
    bot.nextTime    = Date.now();
    bots[1]         = bot;

    console.log(`Having ${bots.length} bots..`);
    

    let rateTime     = 0;
    while(true) {
        if (rateTime < Date.now()) { 
            usdtusdnRate = await setRate(); 
            rateTime = Date.now() + 30*1000;
            getBalances(); 
        }

        for (var i = 0; i < bots.length; i++ ) {
            if (bots[i].procType == 'rebalance1')        { bots[i] = await doRebalanceBot(bots[i]); }

        }
        

        //round++;
        //await func.sleep(delay);
    
    }
}

botLoop();

