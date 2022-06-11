const ccxt  = require ('ccxt');
const axios = require ('axios');
const db    = require('./db/dbarbbot2');
const wd    = require('./wavesmatcher');
const func  = require('./functions2');
require('dotenv').config();
const WebSocket = require('ws'); 
let bws = new WebSocket('wss://stream.binance.com:9443/ws/wavesusdt@bookTicker');
bws.onmessage = (event) => {
    let sockObj = JSON.parse(event.data);
    market.left.coin.sel = parseFloat(sockObj.b);
    market.left.coin.buy = parseFloat(sockObj.a);
    market.left.coin.avg = (market.left.coin.buy+market.left.coin.sel)/2;
}

const binance   = new ccxt.binance(         { apiKey: process.env.BINANCE_API_KEY,  secret: process.env.BINANCE_API_SECRET });
const wavesdex  = new ccxt.wavesexchange(   { apiKey: process.env.WAVESDEX_API_KEY, secret: process.env.WAVESDEX_API_SECRET });


async function getBalances() {
    if (balance.nextTime < Date.now() ){  
        try {
            let b = await binance.fetchBalance();
            if (b.WAVES.free)   { balance.left.coin = b.WAVES.free; } 
            if (b.USDT.free)    { balance.left.base1 = b.USDT.free; }  

            b = await wavesdex.fetchBalance();
            if (b.WAVES.free)   { balance.right.coin = b.WAVES.free; } 
            if (b.USDT.free)    { balance.right.base1 = b.USDT.free; }  
            if (b.USDN.free)    { balance.right.base2 = b.USDN.free; }  
            balance.nextTime = Date.now() + 20*1000;
            console.log(`Balances: left: ${balance.left.coin.toFixed(2)} ${balance.left.base1.toFixed(2)} || right: ${balance.right.coin.toFixed(2)} ${balance.right.base2.toFixed(2)} || nexttime: ${balance.nextTime}`)
            return true;
        }
        catch(err) { console.log('getBalances: error', err); return false; }
    }
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
async function getMarkets() {
    if (rateTime < Date.now() ) {
        let rates = await func.getMarketDirect('wavesdex', '34N9YcEETLWn93qYQ64EsP1x89tSruJU44RrEMSXXEPJ', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
        if (rates.success) {
            console.log(`USDT/USDN : ${(rates.result.avg/100).toFixed(4)} `); 
            market.right.base.sel = rates.result.sel/100;
            market.right.base.buy = rates.result.buy/100;
            market.right.base.avg = rates.result.avg/100;
            rateTime = Date.now() + 1000;
        }
    }
    rates = await func.getMarketDirect('wavesdex', 'WAVES', 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p', 200);
    if (rates.success) { 
        market.right.coin.sel = rates.result.sel;
        market.right.coin.buy = rates.result.buy;
        market.right.coin.avg = rates.result.avg; 
    }
}
async function getScopes() {
    //console.log(market.left.coin, market.left.base, market.right.coin, market.right.base)
    scope = {sel: 0, but: 0}
    if (market.left.coin.sel>0 && market.left.coin.buy>0 && market.right.coin.sel>0 && market.right.coin.buy>0 && market.right.base.sel>0 && market.right.base.buy>0) {
        scope.buy = (market.right.coin.sel/market.right.base.buy  - market.left.coin.buy) / market.left.coin.buy * 100;
        scope.sel = (market.left.coin.sel - market.right.coin.buy/market.right.base.sel) / market.left.coin.sel * 100;
        console.log(`Scope sell: ${scope.sel.toFixed(2)} || buy ${scope.buy.toFixed(2)}`);
    }
}
function setDelay(bot, scope, direction) {
    let delay = 0;
    if (direction == 'sell') if (scope.sell < 0) { delay = 2000; } else if (scope.sell < bot.disbalLeft/2) {delay = 1000; } 
    if (direction == 'buy')  if (scope.buy < 0)  { delay = 2000; } else if (scope.buy < bot.disbalRigh/2)  {delay = 1000; }
    return delay;
}
let balance     = {left: {coin: 0, base1: 0}, right: {coin: 0, base1: 0, base2: 0}, nextTime: 0};
let scope       = {};
let exchanges   = []; 
let order;
let goNext      = false;
let rateTime    = 0; 
let market      = { left: {coin: {sel: 0, buy: 0, avg: 0}, base: {sel: 1, buy: 1, avg: 1}}, right:{coin: {sel: 0, buy: 0, avg: 0}, base: {sel: 0, buy: 0, avg: 0}} }
exchanges['wavesdex']   = wavesdex;
exchanges['binance']    = binance;
async function makeMoveSell(bot) { 
    const l = await placeOrder(binance, 'WAVES/USDT', 'limit', 'sell', bot.move.sel.amount, market.left.coin.sel);
    const r = await placeOrder(wavesdex, 'WAVES/USDN', 'limit', 'buy', bot.move.sel.amount, market.right.coin.buy);
    console.log(l)
    console.log(r)
    if (l.success && r.success) {
        balance.left.coin   -= bot.move.sel.amount;
        balance.right.base2 -= r.order.cost;
        balance.right.coin  += bot.move.sel.amount;
        balance.left.base1  += l.order.cost;

        bot.move.sel.left.base      = l.order.cost;
        bot.move.sel.left.orderId   = l.id;
        bot.move.sel.left.status    = l.order.status;
        bot.move.sel.left.price     = l.order.average;
        
        bot.move.sel.right.base     = r.order.cost;
        bot.move.sel.right.orderId  = r.id;
        bot.move.sel.right.status   = r.order.status;
        bot.move.sel.right.price    = r.order.average;

        console.log(bot.move.left, bot.move.right)
        
        return true;
    }
    else {
        console.log('errrrror');
        return false;
    }
    

}

async function procVersion2(bot) {
    let log = `${bot.name}:${bot.stage}: `;
    if (bot.stage == 0) {   // looking possibilities to sell
        let next = false;
        if (scope.sel > bot.disbal.deal.sel) { 
            bot.move.sel.amount = parseInt(bot.amount.base / market.left.coin.sel) - 1;
            next = true;
        
        } else { log += 'no scope to sell '}
        if (next) {         // check-correct amounts
            log += 'scope to sell: '; 
            next = false;
            const decreasedAmount = Math.min(
                parseInt(bot.amount.base/market.left.coin.sel) - 1, 
                balance.left.coin, 
                parseInt(balance.right.base2 / market.right.coin.buy)-1
            );
            if (decreasedAmount > 1) {
                bot.move.sel.amount = decreasedAmount;
                next = true;
                log += 'balance OK';
            }
            else { log += 'balance too low'}
            console.log(log)
        }
        if (next) {         // start deal 
            bot     = await db.addDeal(bot);
            log     += 'deal started';
            console.log(log)
        } 
        console.log(log); 
    }
    if (bot.stage == 1) {   //place orders
        log = `${bot.name}:${bot.stage}: `;
        const move = makeMoveSell(bot);
        if (move) {
            bot.stage = await db.setStage(bot, 2);

        }
    }
    console.log(log);
    return bot;
}
async function botLoop() { 
    let bot         = {};
    let bots        = [];
    console.log('loading the bots')
    bot = await db.getProc('62a4a6a838178ae44cb068e8'); // get proc data ================= 
    if (bot) {
        bot.exchange1   = exchanges[bot.exch1.name];
        bot.exchange2   = exchanges[bot.exch2.name];
        bot.nextTime    = Date.now();
        bots[0]         = bot;
        goNext = true;
    } else { goNext = false; console.log('bots not found'); }
    console.log(`Having ${bots.length} bots..`); 

    let k = 0;
    while(goNext) {
        await getBalances();
        await getMarkets();
        await getScopes();
        //console.log(market); 

        scope.sel += 0.1*k;
        balance.left.coin += 100;

        for (var i = 0; i < bots.length; i++ ) {
            //console.log('bot', i, bots[0].procType)
            if (bots[i].procType == 'version2') bots[i] = await procVersion2(bots[i]);
            
        } 
        k++;
    }
}

botLoop();

