# LGTM Stack Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the LGTM observability stack.

## Prerequisites

1. **GKE Cluster:** Already set up
2. **Artifact Registry:** Create repository and push images
3. **kubectl:** Configured to connect to your cluster

## Quick Start

### 1. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create lgtm-stack \
  --repository-format=docker \
  --location=asia-south1 \
  --description="LGTM Stack images"
```

### 2. Configure Docker for GAR

```bash
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### 3. Build and Push Images

```bash
# From project root
cd ..

# Build and tag images
docker build -t asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/sample-app:v1 ./sample-app
docker build -t asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/order-service:v1 ./order-service
docker build -t asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/payment-service:v1 ./payment-service

# Push images
docker push asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/sample-app:v1
docker push asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/order-service:v1
docker push asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/payment-service:v1
```

### 4. Deploy to Kubernetes

```bash
# Create namespace first
kubectl apply -f namespace.yaml

# Deploy infrastructure
kubectl apply -f infrastructure/

# Deploy applications
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

| Service         | Image                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| sample-app      | `asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/sample-app:v1`      |
| order-service   | `asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/order-service:v1`   |
| payment-service | `asia-south1-docker.pkg.dev/learning-gcp-22/lgtm-stack/payment-service:v1` |
