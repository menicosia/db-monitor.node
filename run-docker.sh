#!/bin/sh

docker run -d -p 8080:8080 --name pg-monitor --network apps pg-monitor
