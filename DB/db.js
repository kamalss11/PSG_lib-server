const Pool = require('pg').Pool

const pool = new Pool({
    host: 'localhost',
    port: '5432',
    user: 'postgres',
    password: 'kamal',
    database: 'Lib'
})

const execute = async (query) => {
    try {
        await pool.connect();     // gets connection
        await pool.query(query);  // sends queries
        return true;
    } catch (error) {
        console.error(error.stack+'28');
        return false;
    }
};

const users = `
    CREATE TABLE IF NOT EXISTS "users"(
	    "user_id" int,
	    "name" VARCHAR(100) NOT NULL,
	    "email" VARCHAR(100) NOT NULL,
        "password" VARCHAR(100) NOT NULL,
        "roll" VARCHAR(100) NOT NULL,
	    PRIMARY KEY ("user_id")
    );`  


const files = `
    CREATE TABLE IF NOT EXISTS "files"(
        "id" SERIAL,
        "user_id" int,
	    "file" VARCHAR(100) NOT NULL,
        "status" VARCHAR(50) NOT NULL,
        PRIMARY KEY ("id"),
        FOREIGN KEY ("user_id") REFERENCES users("user_id")
    );`

    execute(users).then(result => {
        if (result) {
            console.log('Table created user');
        }
    })

    execute(files).then(result => {
        if (result) {
            console.log('Table created files');
        }
    })

module.exports = pool