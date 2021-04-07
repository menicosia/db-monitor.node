# db-monitor.node

A node app to monitor the availabiliy of an (HA) mysql or postgres service.

Design:
- a Node server which maintains a DB connection
- a JavaScript app which connects back to the Node server and represents the status of the connections

## K8s deployments

Deploy a Redis
1. `helm repo add bitnami https://charts.bitnami.com/bitnami`
1. `helm install dbmon-redis bitnami/redis`
1. `kubectl get secret --namespace tsql-demo dbmon-redis -o jsonpath="{.data.redis-password}" | base64 --decode`

Deploy this app
1. Clone this repo
1. `docker build --tag db-monitor`
1. `docker tag db-monitor:latest ${REGISTRY}/db-monitor:latest`
1. `docker push ${REGISTRY}/db-monitor:latest`
1. Modify the sample deployment template, [db-monitor-deployment.yaml](db-monitor-deployment.yaml), to describe the deployment.
1. `kubectl create -f ./db-monitor-deployment-local.yaml`
1. Get the IP address of the db-monitor app, `kubectl get service/db-monitor-entrypoint`
  - Fancy: `kubectl get service/db-monitor-entrypoint --output='jsonpath={.status.loadBalancer.ingress[].ip}'`

Visit http://IP-ADDRESS:8080/ to see the app.

## CF Requirements
- This app could be run on Cloud Foundry. (Possibly broken)
- It will require database credentials. Currently supported service bindings are p-mysql (Pivotal) or ClearDB.
- Included `manifest.yml` assumes the app has been bound to service instances `mysql-monitor-db` and `mysql-monitor-redis`.

## Local Usage

To run locally, spin up a database and a redis container:

```sh
$ docker network create apps --driver bridge
$ docker run -d -p 5432:5432 --name postgresql --network=apps -e POSTGRESQL_PASSWORD=passw0rd bitnami/postgresql:latest
$ docker run -d -p 3306:3306 --name mysql --network=apps -e MYSQL_ROOT_PASSWORD=passw0rd bitnami/mysql:latest
$ docker run -d -p 6379:6379 --name redis --network=apps -e REDIS_PASSWORD=passw0rd -e ALLOW_EMPTY_PASSSWORD=no bitnami/redis:latest
```

Get the IP addresses of your containers and run the app:

```sh
$ docker inspect redis | jq -r ".[0].NetworkSettings.Networks.apps.IPAddress"
$ docker inspect DATABASE | jq -r ".[0].NetworkSettings.Networks.apps.IPAddress"
$ docker run -d -p 8080:8080 --network=apps -e DB=DATABASE_CHOICE -e DB_HOST=IP_ADDRESS -e DB_USER={postgres,root} -e DB_PASSWORD=passw0rd DB_DATABASE -e REDIS_CREDS=REDIS_IP:6379:passw0rd db-monitor
```
