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
	    "user_id" SERIAL,
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
        "name" VARCHAR(100) NOT NULL,
	    "title" VARCHAR(100) NOT NULL,
	    "file" VARCHAR(100) NOT NULL,
        "date" DATE,
        PRIMARY KEY ("id"),
        FOREIGN KEY ("user_id") REFERENCES users("user_id")
    );`

const review = `
    CREATE TABLE IF NOT EXISTS "review"(
        "id" SERIAL,
        "file_id" int,
        "user_id" int,
        "author" VARCHAR(100) NOT NULL,
        "r1" VARCHAR(100) NOT NULL,
        "r2" VARCHAR(100) NOT NULL,
        "r1_email" VARCHAR(100) NOT NULL,
        "r2_email" VARCHAR(100) NOT NULL,
	    "title" VARCHAR(100) NOT NULL,
        "file" VARCHAR(100) NOT NULL,
        "r1_status" VARCHAR(100) NOT NULL,
        "r2_status" VARCHAR(100) NOT NULL,
        "r1_comment" VARCHAR(100),
        "r2_comment" VARCHAR(100),
        PRIMARY KEY ("id"),
        FOREIGN KEY ("user_id") REFERENCES users("user_id")
    );` 

const volumes = `
    CREATE TABLE IF NOT EXISTS "volumes"(
        "id" SERIAL,
        "file_id" int,
        "file" VARCHAR(100) NOT NULL,
        "volume_no" int NOT NULL,
        "no" int,
        PRIMARY KEY ("id")
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

execute(review).then(result => {
    if (result) {
        console.log('Table created review');
    }
})

execute(volumes).then(result => {
    if (result) {
        console.log('Table created Volumes');
    }
})

module.exports = pool