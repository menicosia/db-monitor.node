# db-monitor.node

A node app to monitor the availabiliy of an (HA) mysql or postgres service.

Design:
- a Node server which maintains a DB connection
- a JavaScript app which connects back to the Node server and represents the status of the connections

## K8s deployments

1. Clone this repo
1. `docker build --tag db-monitor`
1. `docker tag db-monitor:latest ${REGISTRY}/db-monitor:latest`
1. `docker push ${REGISTRY}/db-monitor:latest
1. Create a file to describe the deployment:
    ```yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      labels:
        app: db-monitor
      name: db-monitor
      namespace: tsql-demo
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: db-monitor
      strategy:
        type: RollingUpdate
      template:
        metadata:
          labels:
            app: db-monitor
        spec:
          containers:
          - image: harbor.run.haas-502.pez.vmware.com/library/pg-monitor
            imagePullPolicy: Always
            name: db-monitor
            env:
            - name: MYSQL_HOST
              value: "10.100.200.106"
            - name: MYSQL_PW
              value: "*****"
            - name: MYSQL_USER
              value: "bn_wordpress"
            - name: REDIS_CREDS
              value: "10.100.200.207:6379:*****"
    ```
1. `kubectl create -f ./db-monitor-deployment.yaml`



## CF Requirements
- This app could be run on Cloud Foundry. (Possibly broken)
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

### Pushing to a remote registry

> docker image tag pg-monitor:latest gcr.io/data-pcf-db/pg-monitor:latest
> docker image push gcr.io/data-pcf-db/pg-monitor:latest

If you have another tag, or a different version of the container with the same tag, you may need to:
> docker rmi --force 1197e8489df7

