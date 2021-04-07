#!/bin/sh

set -x

if [ "X" == "${REGISTRY}X" ]; then
  echo "[ERROR] REGISTRY environment variable not set."
  exit 1
fi

kubectl delete deployment.apps/db-monitor --wait=true --now=true
kubectl delete service/db-monitor-entrypoint --wait=true
docker build --tag db-monitor .
docker tag db-monitor:latest ${REGISTRY}/db-monitor:latest
docker push ${REGISTRY}/db-monitor:latest
kubectl create -f db-monitor-deployment-local.yaml
sleep 2
echo "Go to URL: http://"$(kubectl get service/db-monitor-entrypoint --output='jsonpath={.status.loadBalancer.ingress[].ip}')":8080/"
