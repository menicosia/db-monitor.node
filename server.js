// Mysql Monitor - an app to monitor availability of a MySQL database

var finalhandler = require('finalhandler') ;
var http = require('http') ;
var serveStatic = require('serve-static') ;
var strftime = require('strftime') ;
var url = require('url') ;
var mysql = require('mysql2') ;
var pg = require('pg') ;
var redis = require('redis') ;
var util = require('util') ;
var fs = require('fs') ;
var serviceCreds = require('./serviceCreds.class.js') ;

// CONFIGURE THESE
var numSecondsStore = 600 // Default 10 minutes

// Variables
var data = "" ;
// var activateState = Boolean(false) ;
var localMode = Boolean(false) ;
var vcap_services = undefined ;
var db_creds = new serviceCreds.dbCreds() ;
var dbClient = undefined ;
var dbConnectState = Boolean(false) ;

var dbConnectTimer = undefined ;
var redisConnectTimer = undefined ;
var pingInterval = undefined ;

// REDIS DOCUMENTATION

// Each instance is responsible for recording its own activity in
// Redis. Because this is cloud foundry, there's only ever expected to
// be one of each index running ie there should be no conflicts of
// multiple instances updating the same data.  There are two pieces of
// data per instance: lastTime and a 600-bit list (used to be Bit array)
// which represents 10 min of data.
// Instance_0_Hash lastKeyUpdated 0-599 lastUpdate SECS
// Instance_0_List ...

var redis_creds = new serviceCreds.redisCreds() ;
var redisClient = undefined ;
var redisConnectionState = Boolean(false) ;

var lastUpdate ;

// If deployed by Cloud Foundry
if (process.env.VCAP_APP_PORT) { var port = process.env.VCAP_APP_PORT ;}
else { var port = 8080 ; }
if (process.env.CF_INSTANCE_INDEX) { var myIndex = JSON.parse(process.env.CF_INSTANCE_INDEX) ; }
else { var myIndex = 0 ; }
if (process.env.VCAP_SERVICES) {
    db_creds.setCreds("cf") ;
    redis_creds.setCreds("cf") ;
    if (db_creds) {
        activateState = 'my' ;
    } else {
        console.error("[ERROR] No VCAP_SERVICES mysql bindings.")
    }
}

// Setup based on Environment Variables
if (process.env.DB_TYPE) {
    console.log("Using environment for Redis and DB configuration...") ;
    db_creds.setCreds("env") ;
    redis_creds.setCreds("env") ;
}

// Here lie the names of the Redis data structures that we'll read/write from
var myInstance = "Instance_" + myIndex + "_Hash" ;
var myInstanceBits = "Instance_" + myIndex + "_Bits" ;
var myInstanceList = "Instance_" + myIndex + "_List" ;

// Callback functions

function handleDBerror(err) {
    if (err) {
        console.warn("[DB] ERROR: Issue with database: " + err.code) ;
    } else {
        console.warn("[DB] ERROR: Unspecified issue with database.") ;
    }
    dbConnectState = Boolean(false) ;
    if (db_creds.activateState && ! dbConnectTimer) {
        console.info("[DB] Will attempt to reconnect every 1 seconds.") ;
        dbConnectTimer = setInterval(dbConnect, 1000) ;
    } else {
        console.info("Connect timer is set, expecting it to re-try.") ;
    }
}
        
function handleDBend() {
    console.warn("[DB] server closed connection. Will attempt to reconnect") ;
    if (db_creds.activateState) {
        dbConnect() ;
    }
}

function handleDBConnect(err) {
    if (err) {
        handleDBerror(err) ;
        recordDBStatus(0) ;
    } else {
        dbConnectState = Boolean(true) ;
        // clear any pre-existing ping activity
        if (pingInterval) {
            clearInterval(pingInterval) ;
            pingInterval = undefined ;
        }
        // stop trying to reconnect
        if (dbConnectTimer) {
            clearInterval(dbConnectTimer) ;
            dbConnectTimer = undefined ;
        }
        dbClient.on('error', (err) => handleDBerror(err)) ;
        dbClient.on('end', handleDBend) ;
        console.log("[DB] Connected to database. Commencing ping every 1s.") ;
        pingInterval = setInterval(doPing, 1000) ;
    }
}

function handleDBping(err) {
    if (err) {
        console.error('[DB] ping error: ' + err) ;
        recordDBStatus(0) ;
        if ('pg' == db_creds.activateState) {
            dbConnectState = Boolean(false) ;
            dbClient.end() ;
        } else if ('my' == db_creds.activateState) {
            dbConnectState = Boolean(false) ;
            dbClient.destroy() ;
        }
    } else {
        console.log("[" + myIndex + "] Server responded to ping.") ;
        recordDBStatus(1) ;
    }
}

function handleLastTime(err, res) {
    if (err) {
        console.error("Error from redis: " + err) ;
    } else {
        console.log("Setting lastUpdate to: " + res) ;
        lastTime = res ;
    }
}

function handleRedisConnect(message, err) {
    clearInterval(redisConnectTimer) ;
    redisConnectTimer = undefined ;
    switch (message) {
    case "error":
        redisConnectionState = false ;
        console.error("[redis] ERROR: Redis connection failed: " + err + "\n[redis] Will try again in 3s." ) ;
        redisConnectTimer = setTimeout(RedisConnect, 3000) ;
        break ;
    case "ready":
        redisConnectionState = true ;
        redisClient.hget(myInstance, "lastUpdate", handleLastTime) ;
        console.log("[redis] READY.") ;
        break ;
    default:
        console.warn("Redis connection result neither error nor ready?!") ;
        break ;
    }
}


// Helper functions
function recordDBStatusHelper(err, res, bool) {
    if (err) {
        console.log("Error from redis: " + err) ;
        // Assume that handleRedisConnect's on("error") will kick in?
    } else {
        // write a 1 to the current second in redis
        lastTime = res ;
        now = Date.now() ;
        if (now < lastTime) {
            console.error("Last updated time is in the future?! Waiting to catch up...")
        } else {
            if (bool) {
                redisClient.lpush(myInstanceList, 1) ;
            } else {
                redisClient.lpush(myInstanceList, 0) ;
                console.log("DB down: " + bool + " lastUpdate: " + now) ;
            }
            redisClient.ltrim(myInstanceList, 0, numSecondsStore-1) ;
            redisClient.hmset(myInstance, "lastUpdate", now) ;
        }
    }
}

function recordDBStatus(bool) {
    if (redisConnectionState) {
        redisClient.hget(myInstance, "lastUpdate", function(err, res) { recordDBStatusHelper(err, res, bool) ; }) ;
    }
}

function doPing() {
    if ('pg' == db_creds.activateState) {
        dbClient.query("select null", handleDBping) ;
    }
    if ('my' == db_creds.activateState) {
        dbClient.ping(handleDBping) ;
    }
}

function pgConnect() {
    console.log("[DB] Attempting to connect to Postgres...") ;
    dbClient = new pg.Client(db_creds.db_creds)
    dbClient.connect(handleDBConnect) ;
}

function MySQLConnect() {
    console.log("[DB] Attempting to connect to MySQL...") ;
    dbClient = mysql.createConnection(db_creds.db_creds) ;
    dbClient.connect(handleDBConnect) ;
    // dbClient.on('error', handleDBConnect) ;
}

function dbConnect(request) {
    if ('pg' == db_creds.activateState) {
        pgConnect() ;
    } else if ('my' == db_creds.activateState) {
        MySQLConnect() ;
    } else {
        handleDBConnect( { "code" : "Not configured to talk with database. Will wait for config." } ) ;
    }
}
function RedisConnect() {
    if (redisClient) { redisClient.end(true) }
    if (db_creds.activateState && redis_creds) {
        console.log("[redis] Attempting to connect to redis...") ;
        redisClient = redis.createClient(redis_creds.redis_creds["port"], redis_creds.redis_creds["host"]) ;
        redisClient.auth(redis_creds.redis_creds["password"]) ;
        redisClient.on("error", function(err) { handleRedisConnect("error", err) }) ;
        redisClient.on("ready", function() { handleRedisConnect("ready", undefined) }) ;
    } else {
        redisClient = undefined ;
        redisConnectionState = Boolean(false) ;
    }
}

function handleBits(request, response, reply) {
    console.log("Returning array from Redis of length: " + reply.length) ;
    response.end(JSON.stringify(reply)) ;
    return(true) ;
}

function dispatchApi(request, response, method, query) {
    switch(method) {
    case "0bits":
        if (redisConnectionState) {
            redisClient.lrange('Instance_0_List', 0, -1, function (err, reply) {
                var req = request ;
                var res = response ;
                if (err) {
                    console.error('[ERROR] querying redis: ' + err) ;
                    process.exit(5) ;
                } else {
                    handleBits(req, res, reply) ;
                }
            } ) ;
            break ;
        } else {
            response.end(false) ;
        }
    }
}

function requestHandler(request, response) {
    data = "" ;
    requestParts = url.parse(request.url, true);
    rootCall = requestParts['pathname'].split('/')[1] ;
    console.log("Recieved request for: " + rootCall) ;
    switch (rootCall) {
    case "env":
	if (process.env) {
	    data += "<p>" ;
	    for (v in process.env) {
		data += v + "=" + process.env[v] + "<br>\n" ;
	    }
	    data += "<br>\n" ;
	} else {
	    data += "<p> No process env? <br>\n" ;
	}
        response.write(data) ;
	break ;
    case "dbstatus":
        data += JSON.stringify({"dbStatus":dbConnectState}) ;
        response.write(data) ;
        break ;
    case "ping":
        if (dbConnectState) {
            doPing() ;
            data += "OK, will ping the DB. Watch the log for a response." ;
        } else {
            data += "I'm sorry, Dave, I can't do that. No connection to the database." ;
        }
        response.write(data) ;
        break ;
    case "api":
        var method = requestParts['pathname'].split('/')[2] ;
        dispatchApi(request, response, method, requestParts['query']) ;
        return true ; // short-circuit response.end below.
        break ;
    case "debug":
        // This is the old code that was the original index page.
        data += "<h1>MySQL Monitor</h1>\n" ;
        data += "<p>" + strftime("%Y-%m-%d %H:%M") + "<br>\n" ;
        data += "<p>Request was: " + request.url + "<br>\n" ;
        if (db_creds.activateState) {
	          data += "Database connection info: " + mysql_creds["uri"] + "<br>\n" ;
        } else {
            data += "Database info is NOT SET</br>\n" ;
        }
        data += "</p\n<hr>\n" ;
        data += "<A HREF=\"" + url.resolve(request.url, "env") + "\">/env</A>  " ;
        data += "<A HREF=\"" + url.resolve(request.url, "ping") + "\">/ping</A>  " ;
        response.write(data) ;
        break ;
    case "config":
        if ("query" in requestParts) {
            db_creds.setCreds("web", requestParts["query"]) ;
            redis_creds.setCreds("web", requestParts["query"]) ;
            
            if (db_creds.activateState) {
                console.log("Received setup details, attempting to connect to DB and Redis...") ;
                RedisConnect() ;
                dbConnect() ;
                response.writeHead(302, {'Location': '/'}) ;
            }
        } else {
            response.write("ERROR: Usage: /config?db_host=127.0.0.1&db_DB=mydb&db_user=postgres&db_pw=READCTED&redis_host=127.0.0.1&redis_port=6379&redis_pw=REDACTED "
                         + "(request: " + request.url  + ")\n") ;
        }
        break ;
    default:
        console.log("Unknown request: " + request.url) ;
        response.statusCode = 404 ;
        response.statusMessage = http.STATUS_CODES[404] ;
        response.writeHead(404) ;
        response.write("<H1>404 - Not Found</H1>") ;
    }

    response.end() ;
    return(true) ;
}

// MAIN
var staticServer = serveStatic("static") ;
monitorServer = http.createServer(function(req, res) {
    var done = finalhandler(req, res) ;
    staticServer(req, res, function() { requestHandler(req, res, done) ; } ) ;
}) ;

monitorServer.listen(port) ;

if (db_creds.activateState) {
    console.log("Connecting to database...") ;
    dbConnect() ;
    console.log("Connecting to Redis...") ;
    RedisConnect() ;
}

console.log("Server up and listening on port: " + port) ;
