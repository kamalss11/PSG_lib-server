const express = require('express')
const app = express()
const dotenv = require('dotenv')
const path = require('path')
const cookieParser = require('cookie-parser')
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "./public/")));

dotenv.config({path:'./config.env'})

// Middleware
// const middleware = (req,res,next) => {
//     console.log("Hello my middleware")
// }
const PORT = process.env.PORT

require('./DB/db')

app.use(require('./Router/router'))

// middleware()

app.get('/',(req,res) => {
    res.send("Hello World,Regiater Ur name")
})  

app.get('/signin',(req,res) => {
    res.send("Hello World,Login")
}) 

app.get('/about',(req,res) => {
    res.send("Hello about")
}) 

app.listen(PORT,()=>{
    console.log(`Server is listening at port ${PORT}`)
})