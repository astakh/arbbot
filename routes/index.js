const { Router } = require('express')
const router    = Router();
const Deal      = require('../models/')
const User      = require('../models/Users')
const Exchange  = require('../models/Exchanges')
const Strategy  = require('../models/Strategys')
const ccxt      = require('ccxt')
const {check}   = require('express-validator')
const bcr       = require('bcryptjs')     
const jwt       = require('jsonwebtoken')
require('dotenv').config();

router.get('/portfolio', async (req, res) => {
    const params = {}
    params.title = 'Deals:'

    
    res.render( 'portfolio', params) 
})
module.exports = router