const axios = require('axios');
require('dotenv').config();

async function sendAlert(text) {
    const TGBOT_KEY = process.env.TGBOT_KEY;
    const TGCHAT_ID = process.env.TGCHAT_ID;
    const URI       = `https://api.telegram.org/bot${TGBOT_KEY}/sendMessage`;

    const d = axios.post(URI, {
        chat_id:    TGCHAT_ID,
        parse_mode: 'html',
        text:       text
    })
}

sendAlert('another hello');

