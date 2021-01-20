# mysql-monitor.node

A node app to monitor the availabiliy of an (HA) mysql service.

Design:
- a Node server which maintains a MySQL connection
- a JavaScript app which connects back to the Node server and represents the status of the connections

## CF Requirements
- This app is designed to run on Cloud Foundry.
- It will require database credentials. Currently supported service bindings are p-mysql (Pivotal) or ClearDB.
- Included `manifest.yml` assumes the app has been bound to service instances `mysql-monitor-db` and `mysql-monitor-redis`.

## Local Usage
Provide environment variables "MYSQL_URL" and "REDIS_CREDS"

Examples:
- export REDIS_CREDS="127.0.0.1:6379:" (indicates blank password)
- export MYSQL_URI="mysql://root:password@127.0.0.1/foobar?reconnect=true"

run `npm start` to begin monitoring

###

In a browser, visit the top-level page for a graphical representation of database availability, and enjoy!


### Local mode

> docker run -d -p 6379:6379 --network=apps -e REDIS_PASSWORD=passw0rd -e ALLOW_EMPTY_PASSSWORD=no --name redis bitnami/redis:latest
> docker run -d -p 5432:5432 --network=apps -e POSTGRESQL_DATABASE=pmAccept -e POSTGRESQL_PASSWORD=passw0rd --name postgresql bitnami/postgresql:latest
> docker inspect redis | jq -r ".[0].NetworkSettings.Networks.apps.IPAddress"
> docker inspect postgresql | jq -r ".[0].NetworkSettings.Networks.apps.IPAddress"
> docker run -d -p 8080:8080 --network=apps -e PG_URI=postgres://postgres:passw0rd@POSTGRES_IP:5432/pmAccept -e REDIS_CREDS=REDIS_IP:6379:passw0rd pg-monitor

