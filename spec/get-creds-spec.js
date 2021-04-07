
var serviceCreds = require('../serviceCreds.class.js') ;

describe("Getting the DB credentials", function() {
    describe("using environment variables", function () {
        env_db_creds = new serviceCreds.dbCreds() ;
        process.env.DB_TYPE="pg"
        process.env.DB_HOST="localhost"
        process.env.DB_USER="postgres"
        process.env.DB_PASSWORD="passw0rd"
        env_db_creds.setCreds("env") ;
        it("sets host to localhost", function() {
            expect(env_db_creds.db_creds["host"]).toBe("localhost") ;
        }) ;
    }) ;
    describe("using web configuration", function() {
        web_db_creds = new serviceCreds.dbCreds() ;
        connect_info = { 'db_type' : 'pg',
                         'db_host' : "127.0.0.1",
                         'db_user' : 'postgres',
                         'db_pw' : 'passw0rd'
                       } ;
        web_db_creds.setCreds("web", connect_info) ;
        it("sets activateState to PG", function() {
            expect(web_db_creds.activateState).toBe("pg") ;
        }) ;
        it("sets host to 127.0.0.1", function() {
            expect(web_db_creds.db_creds["host"]).toBe("127.0.0.1") ;
        }) ;
    }) ;
}) ;

describe("Getting the Redis credentials", function() {
    describe("using environment variables", function() {
        env_redis_creds = new serviceCreds.redisCreds() ;
        process.env.REDIS_CREDS="localhost:6379:passw0rd"
        env_redis_creds.setCreds("env") ;
        it("sets host to localhost", function() {
            expect(env_redis_creds.redis_creds["host"]).toBe("localhost") ;
        }) ;
    }) ;
    describe("using web configuration", function() {
        web_redis_creds = new serviceCreds.redisCreds() ;
        connect_info = { 'redis_host' : "localhost",
                         'redis_port' : "6363",
                         'redis_pw' : "passw0rd"
                       } ;
        web_redis_creds.setCreds("web", connect_info) ;
        it("sets port to 6363", function() {
            expect(web_redis_creds.redis_creds['port']).toBe('6363') ;
        }) ;
    }) ;
}) ;
