#!/usr/bin/env bash
set -euo pipefail
# GitHub-hosted Linux runner only. The supervisor keeps outbound access;
# repository containers cannot reach private networks, metadata, or runner services.
# Match container-originated traffic only: registry replies are also addressed to
# Docker's private subnet and must reach Docker's normal forwarding rules.
for cidr in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 100.64.0.0/10; do
  sudo iptables -I DOCKER-USER -i docker0 -d "$cidr" -j REJECT
done
sudo iptables -I INPUT -i docker0 -j REJECT
