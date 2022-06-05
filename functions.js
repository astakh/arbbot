const axios = require('axios');

async function getOrdersDirect(exch, amountAsset, priceAsset, volume) {
    let res = {bidPrice: 0, askPrice: 0, avgPrice: 0, time: new Date() };
    let apireq;
    if (exch == 'binance')  { 
        apireq = 'https://api.binance.com/api/v3/depth?limit=20&symbol=' + amountAsset + priceAsset; 
        try {
            const result = await axios.get(apireq);
            const bookW       = result.data;
            let vol     = 0;
            for (var i  = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.bids[i][1]);
                if (vol > volume) { res.bidPrice = parseFloat(bookW.bids[i][0]); break; }
            }
            vol = 0;
            for (var i = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.asks[i][1]);
                if (vol > volume) { res.askPrice = parseFloat(bookW.asks[i][0]); break; }
            }
            res.avgPrice    = (res.bidPrice+res.askPrice)/2;
            res.time        = new Date() - res.time;
            return res;
        } catch(err) {  console.log(err); } 
    }

    if (exch == 'wavesdex') { 
        apireq = 'https://matcher.waves.exchange/matcher/orderbook/' + amountAsset + "/" + priceAsset; 
        let amAssDig;
        let prAssDig; 
        try {
            const result = await axios.get(apireq);
            const bookW       = result.data;
            let vol     = 0;
            for (var i  = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.bids[i].amount) / 10**8;
                if (vol > volume) { res.bidPrice = parseFloat(bookW.bids[i].price) / 10**6; break; }
            }
            vol = 0;
            for (var i = 0; i < 20; i++ ) {
                vol += parseFloat(bookW.asks[i].amount) / 10**8;
                if (vol > volume) { res.askPrice = parseFloat(bookW.asks[i].price) / 10**6; break; }
            }
            res.avgPrice    = (res.bidPrice+res.askPrice)/2;
            res.time        = new Date() - res.time;
            return res;
        } catch(err) {  console.log(err); } 
    
    
    }

}
function nowTime() { let spl = new Date().toISOString().split('T'); return spl[0] + " - " + spl[1]; }
async function sleep(time) { return new Promise((resolve, reject) => setTimeout(resolve, time)) }

module.exports.nowTime          = nowTime;
module.exports.sleep            = sleep;
module.exports.getOrdersDirect  = getOrdersDirect;