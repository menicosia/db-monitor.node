"use strict" ;
var bindMySQL = require('./bind-mysql.js') ;

class dbCreds {
    constructor() {
        this.db_creds = {} ;
        this.activateState = Boolean(false) ;
    }
    
    setCreds(connect_type, connect_info) {
        this.db_creds = {} ;
        switch (connect_type) {
        case "cf": 
            if (! process.env.VCAP_SERVICES) {
                console.warn("[dbCreds] No VCAP_SERVICES found.")
                this.db_creds = undefined ;
                break ;
            }
            vcap_services = JSON.parse(process.env.VCAP_SERVICES) ;
            this.db_creds = bindMySQL.getMySQLCreds() ;
            break ;
        case "env": 
            if (! process.env.DB_TYPE || ! process.env.DB_HOST
                || ! process.env.DB_USER || ! process.env.DB_PASSWORD) {
                console.warn("[dbCreds] Missing environment variables: DB_TYPE, DB_HOST, DB_USER, DB_PASSWORD."
                             + " Will run in passive mode till configured."
                             + " See /setup.html or /config endpoint for more info.");
                return(undefined) ;
            }

            this.db_creds["host"] = process.env.DB_HOST ;
            this.db_creds["user"] = process.env.DB_USER ;
            this.db_creds["password"] = process.env.DB_PASSWORD ;
            // Database not needed for this app
            // this.db_creds["database"] = process.env.DB_DATABASE ;
            if ("pg" == process.env.DB_TYPE || "postgres" == process.env.DB_TYPE) {
                console.debug("[dbCreds] Configuring for Postgres...") ;
                this.db_creds["connectionTimeoutMillis"] = 1000 ;
                this.activateState = 'pg' ;
            } else if ("my" == process.env.DB_TYPE || "mysql" == process.env.DB_TYPE) {
                console.debug("[dbCreds] Configuring for MySQL...") ;
                this.db_creds["ssl"] = { "rejectUnauthorized" : false } ;
                this.activateState = "my" ;
            }

            break ;
        case "web":
            if (connect_info
                && "db_type" in connect_info && "db_host" in connect_info
                && "db_user" in connect_info && "db_pw" in connect_info) {
                console.log("Received DB connection info: " + connect_info["db_host"]) ;
                if ("pg" == connect_info["db_type"]) {
                    console.debug("[DB] Configuring for Postgres...") ;
                    this.db_creds["connectionTimeoutMillis"] = 1000 ;
                    this.activateState = 'pg' ;
                } else if ("my" == connect_info["db_type"]) {
                    console.debug("[DB] Configuring for MySQL...") ;
                    this.db_creds["ssl"] = { "rejectUnauthorized" : false } ;
                    this.activateState = "my" ;
                }
                
                this.db_creds["host"] = connect_info["db_host"] ;
                // Database not needed for this app
                // this.db_creds["database"] = connect_info["db_DB"] ;
                this.db_creds["user"] = connect_info["db_user"] ;
                this.db_creds["password"] = connect_info["db_pw"] ;
            }
            break ;
        }
    }
}

class redisCreds {
    constructor() {
        this.redis_creds = {} ;
    }

    setCreds(connect_type, connect_info) {
        switch (connect_type) {
        case "cf":
            if (! process.env.VCAP_SERVICES) {
                console.warn("[redisCreds] No VCAP_SERVICES found.")
                this.redis_creds = undefined ;
                break ;
            }
            vcap_services = JSON.parse(process.env.VCAP_SERVICES) ;
            // Consume Cloud Foundry Redis binding
            if (! vcap_services['redis']) {
                this.redis_creds["host"] = vcap_services["redis"][0]["credentials"]["host"] ;
                this.redis_creds["port"] = vcap_services["redis"][0]["credentials"]["port"] ;
                this.redis_creds["password"] = vcap_services["redis"][0]["credentials"]["password"] ;                
            } else if (vcap_services['rediscloud']) {
                this.redis_creds["host"] = vcap_services["rediscloud"][0]["credentials"]["hostname"] ;
                this.redis_creds["port"] = vcap_services["rediscloud"][0]["credentials"]["port"] ;
                this.redis_creds["password"] = vcap_services["rediscloud"][0]["credentials"]["password"] ;
            } else if (vcap_services['p-redis']) {
                this.redis_creds["host"] = vcap_services["p-redis"][0]["credentials"]["host"] ;
                this.redis_creds["port"] = vcap_services["p-redis"][0]["credentials"]["port"] ;
                this.redis_creds["password"] = vcap_services["p-redis"][0]["credentials"]["password"] ;
            } else {
                console.warn("[redisCreds] No VCAP_SERVICES redis bindings found.")
                this.redis_creds = undefined ;
                break ;
            }
            console.log("Got access credentials to redis: " + this.redis_creds["host"]
                        + ":" + this.redis_creds["port"]) ;
            break ;
        case "env":
            if (! process.env.REDIS_CREDS) {
                console.warn("[redisCreds] Missing environment variable REDIS_CREDS."
                             + " Will run in passive mode till configured."
                             + " See /setup.html or /config endpoint for more info.");
                this.redis_creds = undefined ;
            }
            var creds = process.env.REDIS_CREDS.split(":") ;
            if (3 != creds.length) {
                console.error("[redisCreds] ERROR: REDIS_CREDS must be colon separated host:port:password") ;
                this.redis_creds = undefined ;
            } else {
                this.redis_creds = { 'host' : creds[0], 'port' : creds[1], 'password' : creds[2] } ;
            }
            break ;
        case "web":
            if (! connect_info) { throw "connect_info is undefined." }
            this.redis_creds["host"] = connect_info["redis_host"] ;
            this.redis_creds["port"] = connect_info["redis_port"] ;
            this.redis_creds["password"] = connect_info["redis_pw"] ;
        }
    }
}
        
module.exports.dbCreds = dbCreds ;
module.exports.redisCreds = redisCreds ;
