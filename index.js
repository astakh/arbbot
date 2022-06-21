//const { urlencoded } = require('express');
const express   = require('express')
//const session   = require('express-session')
const exphbs    = require('express-handlebars')
const mongoose  = require('mongoose')
const path      = require('path')
//const bcrypt     = require('bcrypt')
require('dotenv').config();
//const passport  = require('passport')
//const localStrategy = require('passport-local').Strategy
//const { auth } = require('express-openid-connect')
const PORT      = process.env.PORT || 3000
const DBPATH    = process.env.DBPATH
const app       = express()
//const User      = require('./models/Users')
const hbs       = exphbs.create({
    defaultLayout:  'main',
    extname:        'hbs'
})

app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')
app.set('views', 'views')
app.use(express.urlencoded({extended: false}))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public'))) 
app.use(session({
    secret: 'tohidesecret',
    resave: false,
    saveUninitialized: true
}))  

app.get('/', (req, res) => {    
    res.render('index', params) 
})



async function start() {
    try {
        await mongoose.connect(DBPATH, {
            useNewUrlParser: true 
        })
        app.listen(PORT, () => {
            console.log(`Server started.. port: ${PORT}`)
        })
    } catch(e) { console.log('start: error', e)} 
}

start()