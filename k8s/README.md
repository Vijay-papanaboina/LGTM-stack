# LGTM Stack Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the LGTM observability stack.

> **Note:** See the [main README](../README.md) for architecture overview and local development setup.

## Prerequisites

1. **Kubernetes Cluster:** GKE, EKS, AKS, or local (minikube/kind)
2. **Container Registry:** Create repository and push images
3. **kubectl:** Configured to connect to your cluster

## Quick Start

### 1. Create Container Registry (GCP Example)

```bash
# Replace with your project ID and region
export PROJECT_ID=your-gcp-project
export REGION=asia-south1

gcloud artifacts repositories create lgtm-stack \
  --repository-format=docker \
  --location=$REGION \
  --description="LGTM Stack images"
```

### 2. Configure Docker for Registry

```bash
gcloud auth configure-docker $REGION-docker.pkg.dev
```

### 3. Build and Push Images

```bash
# From project root
cd ..

# Build and tag images (replace with your registry path)
export REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/lgtm-stack

docker build -t $REGISTRY/sample-app:v1 ./sample-app
docker build -t $REGISTRY/order-service:v1 ./order-service
docker build -t $REGISTRY/payment-service:v1 ./payment-service

# Push images
docker push $REGISTRY/sample-app:v1
docker push $REGISTRY/order-service:v1
docker push $REGISTRY/payment-service:v1
```

### 4. Deploy to Kubernetes

```bash
# Create namespace first
kubectl apply -f namespace.yaml

# Deploy infrastructure (Helm charts)
./deploy.sh

# Or manually:
kubectl apply -f apps/
```

### 5. Access Grafana

```bash
# Port forward (temporary)
kubectl port-forward -n lgtm svc/grafana 3000:3000

# Or use Ingress (permanent)
kubectl apply -f ingress.yaml
```

## Image Paths

Update your deployments with your registry path:

| Service         | Image                          |
| --------------- | ------------------------------ |
| sample-app      | `$REGISTRY/sample-app:v1`      |
| order-service   | `$REGISTRY/order-service:v1`   |
| payment-service | `$REGISTRY/payment-service:v1` |

---

## Local Kubernetes Setup

### Option 1: Minikube

```bash
# Start minikube with enough resources
minikube start --cpus=4 --memory=8192 --driver=docker

# Enable ingress addon
minikube addons enable ingress

# Point shell to minikube's Docker daemon (for local images)
eval $(minikube docker-env)

# Build images directly in minikube
docker build -t sample-app:v1 ../sample-app
docker build -t order-service:v1 ../order-service
docker build -t payment-service:v1 ../payment-service

# Update deployments to use local images (imagePullPolicy: Never)
# Then deploy
./deploy.sh
```

### Option 2: Kind (Kubernetes in Docker)

```bash
# Create cluster
kind create cluster --name lgtm

# Load images into kind
docker build -t sample-app:v1 ../sample-app
docker build -t order-service:v1 ../order-service
docker build -t payment-service:v1 ../payment-service

kind load docker-image sample-app:v1 --name lgtm
kind load docker-image order-service:v1 --name lgtm
kind load docker-image payment-service:v1 --name lgtm

# Deploy
./deploy.sh
```

---

## Helm Charts

The deploy.sh script installs the following Helm charts:

| Chart                   | Repository           | Purpose                              |
| ----------------------- | -------------------- | ------------------------------------ |
| `kube-prometheus-stack` | prometheus-community | Prometheus + Grafana + Node Exporter |
| `loki`                  | grafana              | Log aggregation                      |
| `tempo`                 | grafana              | Distributed tracing                  |
| `alloy`                 | grafana              | OpenTelemetry collector              |

### Custom Values Files

Located in `helm/`:

| File                                | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `kube-prometheus-stack-values.yaml` | Grafana dashboards, data sources, service type |
| `loki-values.yaml`                  | Loki single-binary mode config                 |
| `tempo-values.yaml`                 | Tempo receivers config                         |
| `alloy-values.yaml`                 | Alloy OTLP receivers and exporters             |

### Manual Helm Installation

```bash
# Add repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install stack
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
    -n monitoring -f helm/kube-prometheus-stack-values.yaml

helm upgrade --install loki grafana/loki -n monitoring -f helm/loki-values.yaml
helm upgrade --install tempo grafana/tempo -n monitoring -f helm/tempo-values.yaml
helm upgrade --install alloy grafana/alloy -n monitoring -f helm/alloy-values.yaml
```

---

## Uninstall

```bash
./deploy.sh uninstall
```
