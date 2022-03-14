const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const router = express.Router()
const nodemailer = require('nodemailer')
const smtpTransport = require('nodemailer-smtp-transport')

router.use(cors())
router.use(express.json())

const storage = multer.diskStorage({
    destination: '../client/public/Uploads/',
    filename:(req, file, cb) => {
        return cb(null, Date.now()+'_'+file.originalname);
    }
})

const upload = multer({storage:storage})

const pool = require('../Db/db')

router.post('/', async (req,res) => {
    const {name,email,password,roll} = req.body
    console.log(req.body)

    try{
        if(!email || !roll){
            return res.status(422).json({error: "Fill the fields"})
        }
        else{
            let pss = await bcrypt.hash(password,10)
            pool.query(
                `SELECT email FROM users WHERE email = '${email}'`,
                (err, result) => {
                    if(result.rows != ''){
                        return res.status(422).json({error: "Mail already exists"})
                    }
                    else if(err){
                        console.log(err)
                    }
                    else{
                        pool.query(
                            `INSERT INTO users (name,email,password,roll) VALUES($1,$2,$3,$4)`,[name,email,pss,roll],
                            (err, r) => {
                                if(r){
                                    return res.status(201).json({message: "User Registered Successfully"})
                                }
                                else{
                                    console.log(err)
                                }
                            }
                        );
                    }
                }
            );
        }
    }catch(err){
        console.log(err+'22')
    }
})

router.post('/login', async(req,res) => {
    try{
        const {email,password} = req.body
        if(!email || !password){
            return res.status(400).send({error: "Fill the data"})
        }
        
        pool.query(
            `SELECT * FROM users WHERE email = '${email}'`,
            async (err, result) => {
                if(result.rows != ''){

                    let token = jwt.sign(result.rows[0].user_id,process.env.SECRET_KEY)
                    console.log(token)

                    let passmatch = await bcrypt.compare(password,result.rows[0].password)
                    console.log(passmatch)

                    if(passmatch){        
                        res.cookie("email",email,{
                            expires: new Date(Date.now() + 25892000000),
                            httpOnly: true
                        })

                        res.cookie("user_id",result.rows[0].user_id,{
                            expires: new Date(Date.now() + 25892000000),
                            httpOnly: true
                        })
        
                        res.cookie("jwtoken",token,{
                            expires: new Date(Date.now() + 25892000000),
                            httpOnly: true
                        })
                        return res.send({user : result.rows})
                    }
                    else{
                        res.clearCookie('email',{ path: '/'})
                        res.clearCookie('user_id',{ path: '/'})
                        res.clearCookie('jwtoken',{path: '/'})
                        res.status(400).send({error: "Login credentials Error"})
                    }
                }
                else{
                    console.log(err)
                    res.clearCookie('email',{ path: '/'})
                    res.clearCookie('user_id',{ path: '/'})
                    res.clearCookie('jwtoken',{path: '/'})
                    res.status(400).send({error: "No user found"})
                }
            }
        );
    }
    catch(err){
        console.log(err)
    }
})

router.get('/dashboard', async(req,res)=>{
    try{
        let vtoken,verifyToken
        if(req.cookies.jwtoken && req.cookies.user_id ){
            vtoken = req.cookies.jwtoken
            verifyToken = jwt.verify(vtoken,process.env.SECRET_KEY)
            console.log(`${verifyToken}`)
        }            
        else{
            console.log('No')
            return res.status(422).send({error: "No Token"})
        }     
    
        if(verifyToken){      
            pool.query(
                `SELECT * FROM users WHERE user_id = ${req.cookies.user_id}`,async(err,r)=>{
                    if(r.rows != ''){
                        if(r.rows[0].roll === 'User'){
                            pool.query(
                                `SELECT *,*  FROM users LEFT JOIN files ON users.user_id = files.user_id WHERE users.user_id = ${req.cookies.user_id}`,
                                async(err,result) =>{
                                    try{
                                        if(result.rows != '' && result.rows[0].user_id != null){
                                            return res.send(
                                                {
                                                    user : result.rows
                                                }
                                            )                        
                                        }
                                        else{
                                            return res.send(
                                                {
                                                    user : r.rows
                                                }
                                            )
                                        }
                                    }
                                    catch(err){
                                        console.log(err)
                                    }
                                }
                            ) 
                        }
                        else if(r.rows[0].roll === 'Admin'){
                            pool.query(
                                `SELECT * FROM review WHERE email = '${req.cookies.email}'`,
                                async(err,result) =>{
                                    try{
                                        if(result.rows != ''){
                                            pool.query(`SELECT * FROM files`,(err,re)=>{
                                                if(re.rows != ''){
                                                    console.log(result.rows)
                                                    return res.send(
                                                        {
                                                            user : r.rows,
                                                            review : result.rows,
                                                            files : re.rows
                                                        }
                                                    )   
                                                }
                                            })                     
                                        }
                                        else{
                                            return res.send(
                                                {
                                                    user : r.rows
                                                }
                                            ) 
                                        }
                                    }
                                    catch(er){
                                        console.log(er)
                                    }
                                }
                            )                          
                        }
                        else if(r.rows[0].roll === 'SuperAdmin'){
                            pool.query(
                                `SELECT name,user_id,roll,email from users WHERE user_id != ${req.cookies.user_id} AND roll = 'Admin'`,async(err,result) =>{
                                    try{
                                        if(result.rows != ''){
                                            console.log(result.rows)
                                            pool.query(
                                                `SELECT * FROM files`,(err,re)=>{
                                                    console.log(result.rows)
                                                    if(re.rows != ''){
                                                        pool.query(
                                                            `SELECT * from review`,(err,rr)=>{
                                                                if(rr.rows != ''){
                                                                    return res.send(
                                                                        {
                                                                            user : r.rows,
                                                                            admin : result.rows,
                                                                            files : re.rows,
                                                                            review: rr.rows
                                                                        }
                                                                    ) 
                                                                }
                                                                else{
                                                                    return res.send(
                                                                        {
                                                                            user : r.rows,
                                                                            admin : result.rows,
                                                                            files : re.rows
                                                                        }
                                                                    )
                                                                }
                                                            }
                                                        )
                                                    }
                                                    else{
                                                        return res.send(
                                                            {
                                                                user : r.rows,
                                                                admin : result.rows
                                                            }
                                                        )                                                        
                                                    }
                                                }
                                            )                   
                                        }
                                        else{
                                            pool.query(
                                                `SELECT * FROM files`,(err,re)=>{
                                                    if(re.rows != ''){
                                                        return res.send(
                                                            {
                                                                user : r.rows,
                                                                files : re.rows
                                                            }
                                                        ) 
                                                    }
                                                    else{
                                                        return res.send(
                                                            {
                                                                user : r.rows
                                                            }
                                                        )                                                        
                                                    }
                                                }
                                            )    
                                        }
                                    }
                                    catch(er){
                                        console.log(er)
                                    }
                                }
                            )                          
                        }
                    }
                }
            )    
        }
    }
    catch(err){
        console.log(err)
    }
})

router.post('/user',upload.single('file'), async(req,res)=>{
    try{
        if(req.file){
            console.log(req.body.user_id,req.file.filename)
            pool.query(`INSERT INTO files (user_id,name,title,file) VALUES($1,$2,$3,$4)`,[req.body.user_id,req.body.name,req.body.title,req.file.filename],
            (err,result) => {
                if(result){
                    return res.status(201).json({message: "File Uploaded"})
                }
                else{
                    console.log(err+'165')
                }
            })
        }
        else{

        }
    }
    catch(err){
        console.log(err)
    }
})

router.post('/assign', async(req,res)=>{
    try{
        const {name,email,file,status,title} = req.body
        console.log(req.body)
        pool.query(`SELECT * FROM review WHERE file = '${file}'`,async(err,result)=>{
            try{
                console.log(result.rowCount)
                if(result.rowCount < 2){
                    console.log(file + '-' + result.rowCount)
                    pool.query(`INSERT INTO review (name,email,title,file,status) VALUES($1,$2,$3,$4,$5)`,[name,email,title,file,status],
                        async(err,resul) => {
                            try{
                                if(resul){
                                    return res.status(201).json({message: "File Uploaded"})
                                }
                                else{
                                    console.log(err+'320')
                                }
                            }
                            catch(err){
                                console.log(err)
                            }
                        }
                    )
                }
                else{
                    return res.status(422).json({error: "Only two limits"})
                }
            }
            catch(err){
                console.log(err)
            }
        })
    }
    catch(err){
        console.log(err)
    }
})

router.put('/delete/:table',async(req,res)=>{
    try{
        pool.query(
            `DELETE FROM ${req.params.table} WHERE id = ${req.body.id} `,(err,result)=>{
                console.log(result)
            }
        )
    }
    catch(err){
        console.log(err)
    }
})

router.put('/edit_profile/:id', async(req,res)=>{
    const {name,email,password,ppassword,hashpassword} = req.body
    console.log(req.body)
    try{
        if(name && email){            
            if(req.cookies.email === email){
                console.log(email)
                pool.query(
                    `UPDATE users SET name = $1 WHERE user_id = $2`,[name,req.params.id],
                    (err, result) => {
                        res.send(result.rows)
                    }
                );
            }
            else{
                pool.query(
                    `UPDATE users SET name = $1,email = $2 WHERE user_id = $3`,[name,email,req.params.id],
                    (err, result) => {
                        res.send(result.rows)
                    }
                );  

                res.cookie("email",email,{
                    httpOnly: true
                })
            }
        }
        else{
            const ps = await bcrypt.hash(password,10)

            let pscmp = await bcrypt.compare(ppassword,hashpassword)
            console.log(pscmp)
            if(pscmp){
                pool.query(
                    `UPDATE users SET password = $1 WHERE user_id = $2`,[ps,req.params.id],
                    (err, result) => {
                        res.send(result.rows)
                    }
                );
            }
            else{
                res.status(400).send({error : "Password was wrong"})
            }
        }
    }
    catch(err){
        console.log(err)
    }
})

router.post('/forget_password',async (req,res)=>{
    const {email} = req.body
    try{
        console.log(email)
        var tkn,e
            
        pool.query(
            `SELECT email FROM users WHERE email = '${email}'`, 
            async(err, result) => {
                try{
                    console.log(result.rows)
                    if(result.rows.length == 0){
                        return res.status(422).send({msg : 'No Account found with this mail'})
                    }
                    // return res.status(422).json({ data: "Mail" })
                    else{
                        crypto.randomBytes(32, (err, buffer) => {
                            if (err) {
                                console.log(err)
                            }        
                            tkn = buffer.toString("hex")
                
                            res.cookie("reset_password",tkn,{
                                expires : new Date(Date.now() + 600000),
                                httpOnly : true
                            })
                
                            res.cookie("r_email",email,{
                                expires : new Date(Date.now() + 600000),
                                httpOnly : true
                            })
                            console.log('Reset Token - ' + tkn)
    
                            // create reusable transporter object using the default SMTP transport
                            var transporter = nodemailer.createTransport(smtpTransport({
                                service: 'gmail',
                                auth: {
                                    user: 'kamalesh1132002@gmail.com',
                                    pass: 'kamalesh5050'
                                }
                            }))
                            var mailOptions = {
                                from: 'ikamaloffc@gmail.com',
                                to: req.body.email,
                                subject: 'ResetPassword',
                                html: `<p>Click this <a href=http://localhost:3000/reset_password/${tkn}>Link</a> to reset your password</p>
                                <p>Link will valid only for 10 minutes.</p>
                                <p style='text-align:left'>Thanks & Regards</p>`
                            }
                            transporter.sendMail(mailOptions, function (error, info) {
                                if (error) {
                                    console.log(error + '296')
                                } else {
                                    console.log('Email sent: ' + info.response)
                                    return res.status(422).send({s: 'Check your mail'})
                                }
                            })
                        })
                    }

                }
                catch(err){
                    console.log(err)
                }
            }
        );


    }catch(err){
        console.log(err,"169")
    }
})

router.put('/reset_password',async (req,res)=>{
    const {password} = req.body
    try{
        if(req.cookies.reset_password){
            let pss = await bcrypt.hash(password,10)
            console.log(pss)
            pool.query(
                `UPDATE users set password = $1 WHERE email = $2`,[pss,req.cookies.r_email],(err,result)=>{
                    res.clearCookie('reset_password',{path: '/'})
                    res.clearCookie('r_email',{path: '/'})
                    res.status(201).json({dd : 'Password Changed'})
                }
            )
        }
        else{
            res.status(400).json({error : 'Link Expires'})
        }


    }catch(err){
        console.log(err,"169")
    }
})

router.put('/accept_reject',async (req,res)=>{
    try{
        const{id,status} = req.body
        console.log(req.body)
        pool.query(
            `UPDATE review SET status = $1 WHERE id = $2`,[status,id],
            async(err, result) => {
                try{
                    if(result.rows){
                    console.log(result.rows)}
                    console.log(err)
                }
                catch(er){
                    console.log(er)
                }
            }
        )
    }
    catch(err){
        console.log(err)
    }
})

router.post('/check_status',async (req,res)=>{
    try{
        let count = 0
        const {file} = req.body
        pool.query(`SELECT status from review WHERE file = '${file}'`,(er,result)=>{
            if(result.rows != '' && result.rowCount == 2){
                result.rows.map((e,i)=>{
                    if(e.status === 'Accepted'){
                        ++count
                    }    
                })
                if(count == 2){
                    return res.status(201).send({message: "Accepted"})
                }
                else if(count == 1){
                    return res.status(201).send({message: "Not Reviewed"})
                }
                else{
                    return res.status(201).send({message: "Rejected"})                    
                }
            }
            else{
                return res.status(201).send({message: "Not Reviewed"})                
            }
        })
    }
    catch(er){
        console.log(er)
    }
})

router.get('/logout',(req,res) => {
    res.clearCookie('email',{path: '/'})
    res.clearCookie('user_id',{ path: '/'})
    res.clearCookie('jwtoken',{path: '/'})
    res.clearCookie('reset_password',{path: '/'})
    res.clearCookie('r_email',{path: '/'})
    res.status(200).send('User Logout')
})

module.exports = router