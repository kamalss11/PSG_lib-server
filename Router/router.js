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
                                `SELECT *,* FROM users 
                                LEFT JOIN files ON users.user_id = files.user_id WHERE users.user_id = ${req.cookies.user_id}`,
                                async(err,result) =>{
                                    try{
                                        if(result.rows != '' && result.rows[0].user_id != null){
                                            pool.query(`SELECT * FROM review`,(e,re)=>{
                                                if(re.rows != ''){
                                                    return res.send(
                                                        {
                                                            user : result.rows,
                                                            review : re.rows
                                                        }
                                                    ) 
                                                }
                                                else{
                                                    return res.send(
                                                        {
                                                            user : result.rows
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
                                    catch(err){
                                        console.log(err)
                                    }
                                }
                            ) 
                        }
                        else if(r.rows[0].roll === 'Admin'){
                            pool.query(
                                `SELECT * FROM review WHERE r1_email  = '${req.cookies.email}' OR r2_email = '${req.cookies.email}' ORDER BY id ASC`,
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
                                                        return res.send(
                                                            {
                                                                user : r.rows,
                                                                admin : result.rows,
                                                                files : re.rows
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
            pool.query(`INSERT INTO files (user_id,name,title,file,date,status) VALUES($1,$2,$3,$4,$5,$6)`,[req.body.user_id,req.body.name,req.body.title,req.file.filename,new Date(),'OnProcessing'],
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

router.post('/check_status',async (req,res)=>{
    try{
        const {id} = req.body
        pool.query(`SELECT r1_status,r2_status from review WHERE file_id = ${id}`,(er,result)=>{
            if(result.rows != ''){
                if(result.rows[0].r1_status === 'Accepted' && result.rows[0].r2_status === 'Accepted'){
                    return res.status(201).send({message: "Accepted"}) 
                }

                if(result.rows[0].r1_status === 'Rejected' && result.rows[0].r2_status === 'Rejected' || result.rows[0].r2_status === 'Rejected' || result.rows[0].r1_status === 'Rejected'){
                    return res.status(201).send({message: "Rejected"}) 
                }

                if(result.rows[0].r1_status === 'OnProcessing' && result.rows[0].r2_status === 'OnProcessing' || result.rows[0].r1_status === 'OnProcessing' && result.rows[0].r2_status === 'Accepted' || result.rows[0].r1_status === 'Accepted' && result.rows[0].r2_status === 'OnProcessing'){
                    return res.status(201).send({message: "OnProcessing"}) 
                }
            }
            else{
                return res.status(201).send({message: "OnProcessing"})                
            }
        })
    }
    catch(er){
        console.log(er)
    }
})

router.get('/file/:id',async(req,res)=>{
    try{
        console.log(req.params.id)
        pool.query(`SELECT * FROM files WHERE id = ${req.params.id}`,(err,result)=>{
            if(result.rows != ''){
                pool.query(`SELECT * FROM review WHERE file_id = ${req.params.id}`,(err,r)=>{
                    if(r.rows != ''){
                        return res.status(201).send({file: result.rows,reviews:r.rows}) 
                    }
                    else{
                        return res.status(201).send({file: result.rows}) 
                    }
                })
            }
            else{    
                console.log(err)           
            }
        }) 
    }
    catch(err){
        console.log(err)
    }
})

router.post('/reviewers',async(req,res)=>{
    try{
        console.log(req.body)
        const {file_id,user_id,author,reviewer1,reviewer2,r1_email,r2_email,title,file,status} = req.body
        pool.query(`INSERT INTO review (file_id,user_id,author,r1,r2,r1_email,r2_email,title,file,r1_status,r2_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[file_id,user_id,author,reviewer1,reviewer2,r1_email,r2_email,title,file,status,status],
        (err,result) => {
            if(result){
                return res.status(201).json({message: "File Uploaded"})
            }
            else{
                console.log(err+'510')
            }
        })
    }
    catch(err){
        console.log(err)
    }
})

router.put('/reviewers',async(req,res)=>{
    try{
        let acp = [],volumes = [],filtered_accp = []
        const {comment,file,file_id,status,rev1_email,rev2_email} = req.body
        console.log(req.body)
        if(rev1_email){
            pool.query(
                `UPDATE review SET r1_status = $1,r1_comment = $2 WHERE id = $3`,[status,comment,file_id],
                (err, result) => {
                    if(result){
                        pool.query(`SELECT * FROM review WHERE file = '${file}' AND r1_status = 'Rejected' OR r2_status = 'Rejected'`,(er,ress)=>{
                            if(ress.rows != ''){
                                pool.query(`UPDATE files SET status = $1 WHERE file = $2`,['Rejected',file])
                            }
                        })
                        pool.query(`SELECT * FROM review WHERE file = '${file}' AND r1_status = 'Accepted' AND r2_status = 'Accepted'`,(er,ress)=>{
                        if(ress.rows != ''){
                            pool.query(`UPDATE file SET status = $1 WHERE file = $2`,['Accepted',file])
                            acp = ress.rows
                            pool.query(`SELECT * FROM volumes`,(err,re)=>{
                                if(re.rows != ''){
                                    if(re.rows[re.rowCount - 1].file_no === 5 && re.rows[re.rowCount - 1].no === 5){
                                        pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no + 1,1,1,new Date().getFullYear()],(err,result)=>{
                                            console.log(result)
                                            console.log(err)
                                        })                                             
                                    }
                                    else if(re.rowCount % 5 != 0){
                                        pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no,re.rows[re.rowCount - 1].no,re.rows[re.rowCount - 1].file_no + 1,new Date().getFullYear()],(err,result)=>{
                                        console.log(result)
                                        console.log(err)
                                        }) 
                                    }  
                                    else if(re.rowCount % 5 === 0){
                                        pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no,re.rows[re.rowCount - 1].no + 1,1,new Date().getFullYear()],(err,result)=>{
                                        console.log(result)
                                        console.log(err)
                                        }) 
                                    }  
                                }
                                else{
                                    pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,1,1,1,new Date().getFullYear()],(err,result)=>{
                                        console.log(result)
                                        console.log(err)
                                    })
                                }
                            })
                        }
                        }) 
                    }
                }
            )
        }
        else if(rev2_email){
            pool.query(
                `UPDATE review SET r2_status = $1,r2_comment = $2 WHERE id = $3`,[status,comment,file_id],
                (err, result) => {
                    if(result){
                        if(result){
                            pool.query(`SELECT * FROM review WHERE file = '${file}' AND r1_status = 'Rejected' OR r2_status = 'Rejected'`,(er,ress)=>{
                                if(ress.rows != ''){
                                    pool.query(`UPDATE files SET status = $1 WHERE file = $2`,['Rejected',file])
                                }
                            })
                            pool.query(`SELECT * FROM review WHERE file = '${file}' AND r1_status = 'Accepted' AND r2_status = 'Accepted'`,(er,ress)=>{
                            if(ress.rows != ''){
                                pool.query(`UPDATE files SET status = $1 WHERE file = $2`,['Accepted',file])
                                acp = ress.rows
                                pool.query(`SELECT * FROM volumes`,(err,re)=>{
                                    if(re.rows != ''){
                                        if(re.rows[re.rowCount - 1].file_no === 5 && re.rows[re.rowCount - 1].no === 5){
                                            pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no + 1,1,1,new Date().getFullYear()],(err,result)=>{
                                                console.log(result)
                                                console.log(err)
                                            })                                             
                                        }
                                        else if(re.rowCount % 5 != 0){
                                            pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no,re.rows[re.rowCount - 1].no,re.rows[re.rowCount - 1].file_no + 1,new Date().getFullYear()],(err,result)=>{
                                            console.log(result)
                                            console.log(err)
                                            }) 
                                        }  
                                        else if(re.rowCount % 5 === 0){
                                            pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,re.rows[re.rowCount - 1].volume_no,re.rows[re.rowCount - 1].no + 1,1,new Date().getFullYear()],(err,result)=>{
                                            console.log(result)
                                            console.log(err)
                                            }) 
                                        }  
                                    }
                                    else{
                                        pool.query(`INSERT INTO volumes (file_id,file,volume_no,no,file_no,year)  VALUES($1,$2,$3,$4,$5,$6)`,[file_id,file,1,1,1,new Date().getFullYear()],(err,result)=>{
                                            console.log(result)
                                            console.log(err)
                                        })
                                    }
                                })
                            }
                            }) 
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

// router.put('/reviewers', async(req,res)=>{
//     try{
//         let volume_size = 5, accepted = [],filtered_accp = [],volumes = [],volume_count,volume
//         const {comment,file_id,status,rev1_email,rev2_email} = req.body
//         console.log(req.body)
//         if(rev1_email){
//             pool.query(
//                 `UPDATE review SET r1_status = $1,r1_comment = $2 WHERE id = $3`,[status,comment,file_id],
//                 (err, result) => {
//                     if(result){
//                         pool.query(`SELECT * FROM review WHERE r1_status = 'Accepted' AND r2_status = 'Accepted'`,(er,ress)=>{
//                             if(ress.rows != ''){
//                                 accepted = ress.rows
//                                 console.log(accepted)        
//                                 pool.query(`SELECT * FROM volumes `,(er,ressw)=>{
//                                     if(ress.rows != ''){
//                                         volumes = ressw.rows
//                                         volume_count = ressw.rowCount
//                                         console.log(volumes)
//                                         filtered_accp = accepted.filter((e,i)=>{
//                                             return !volumes.find((ee,ii)=>{
//                                                 return ee.file === e.file
//                                             })
//                                         })
//                                         console.log('Filtereds',filtered_accp)
                
//                                         if(filtered_accp){
//                                             filtered_accp = filtered_accp.slice(0,volume_size)
//                                         }
                
//                                         if(filtered_accp.length === volume_size){
//                                             volume = (volume_count / volume_size) + 1
//                                             filtered_accp.map((e,i)=>{
//                                                 pool.query(`INSERT INTO volumes (file_id,file,volume_no,no)  VALUES($1,$2,$3,$4)`,[e.file_id,e.file,volume,i+1],(err,result)=>{
//                                                     console.log(result)
//                                                     console.log(err)
//                                                 })
//                                             })
//                                         }
//                                     }
//                                     else{
//                                         console.log('No Volumes')
//                                         accepted.map((e,i)=>{
//                                             pool.query(`INSERT INTO volumes (file,file_id,volume_no)  VALUES($1,$2,$3)`,[e.file,e.file_id,1],(err,result)=>{
//                                                 console.log(result)
//                                                 console.log(err)
//                                             })
//                                         })
//                                     }
//                                 })  
//                             }
//                         })
//                         res.send(result.rows)
//                     }
//                 }
//             )
//         }
//         else if(rev2_email){
//             pool.query(
//                 `UPDATE review SET r2_status = $1,r2_comment = $2 WHERE id = $3`,[status,comment,file_id],
//                 (err, result) => {
//                     if(result){
//                         pool.query(`SELECT * FROM review WHERE r1_status = 'Accepted' AND r2_status = 'Accepted'`,(er,ress)=>{
//                             if(ress.rows != ''){
//                                 accepted = ress.rows
//                                 console.log(accepted)        
//                                 pool.query(`SELECT * FROM volumes `,(er,ressw)=>{
//                                     if(ress.rows != ''){
//                                         volumes = ressw.rows
//                                         volume_count = ressw.rowCount
//                                         console.log(volumes)
//                                         filtered_accp = accepted.filter((e,i)=>{
//                                             return !volumes.find((ee,ii)=>{
//                                                 return ee.file === e.file
//                                             })
//                                         })
//                                         console.log('Filtereds',filtered_accp)
                
//                                         if(filtered_accp){
//                                             filtered_accp = filtered_accp.slice(0,volume_size)
//                                         }
                
//                                         if(filtered_accp.length === volume_size){
//                                             volume = (volume_count / volume_size) + 1
//                                             filtered_accp.map((e,i)=>{
//                                                 pool.query(`INSERT INTO volumes (file_id,file,volume_no,no)  VALUES($1,$2,$3,$4)`,[e.file_id,e.file,volume,i+1],(err,result)=>{
//                                                     console.log(result)
//                                                     console.log(err)
//                                                 })
//                                             })
//                                         }
//                                     }
//                                     else{
//                                         console.log('No Volumes')
//                                         accepted.map((e,i)=>{
//                                             pool.query(`INSERT INTO volumes (file,file_id,volume_no)  VALUES($1,$2,$3)`,[e.file,e.file_id,1],(err,result)=>{
//                                                 console.log(result)
//                                                 console.log(err)
//                                             })
//                                         })
//                                     }
//                                 })  
//                             }
//                         })
//                         res.send(result.rows)
//                     }
//                 }
//             )            
//         }
//     }
//     catch(err){
//         console.log(err)
//     }
// })

router.get('/archives',async(req,res)=>{
    try{
        pool.query(`SELECT DISTINCT volume_no FROM volumes ORDER BY volume_no ASC`,(er,ress)=>{
            if(ress.rows != ''){
                res.send({volumes: ress.rows})
            }
            else{
                res.send({message: 'No Volumes'})
            }
        })
    }
    catch(err){
        console.log(err)
    }
})

router.get('/volume/:no',async(req,res)=>{
    try{
        pool.query(`SELECT * FROM volumes WHERE volume_no = ${req.params.no} ORDER BY no ASC `,(er,ress)=>{
            console.log(ress.rows)
            if(ress.rows != ''){
                res.send({volumes: ress.rows})
            }
            else{
                res.send({message: 'No Volumes'})
            }
        })
    }
    catch(err){
        console.log(err)
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