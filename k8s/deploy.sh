#!/bin/bash
# ============================================================
# LGTM Stack Kubernetes Deployment Script
# ============================================================

set -e

# Get script directory and cd to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 LGTM Stack Kubernetes Deployment"
echo "===================================="
echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check cluster connectivity
echo "📡 Checking cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Check your kubeconfig."
    exit 1
fi
echo "✅ Connected to cluster"
echo ""

# Ask about LoadBalancer
read -p "🔧 Use LoadBalancer + Ingress? (y/n): " USE_LB
echo ""

# Apply namespace first
echo "📦 Creating namespace..."
kubectl apply -f namespace.yaml

# Apply infrastructure in order
echo "📦 Deploying Prometheus..."
kubectl apply -f infrastructure/prometheus/

echo "📦 Deploying Loki..."
kubectl apply -f infrastructure/loki/

echo "📦 Deploying Tempo..."
kubectl apply -f infrastructure/tempo/

echo "📦 Deploying Alloy..."
kubectl apply -f infrastructure/alloy/

echo "📦 Deploying Node Exporter..."
kubectl apply -f infrastructure/node-exporter/

echo "📦 Deploying Grafana..."
kubectl apply -f infrastructure/grafana/

# Apply applications
echo "📦 Deploying Sample App..."
kubectl apply -f apps/sample-app/

echo "📦 Deploying Order Service..."
kubectl apply -f apps/order-service/

echo "📦 Deploying Payment Service..."
kubectl apply -f apps/payment-service/

# Ingress (if requested)
if [[ "$USE_LB" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🌐 Installing NGINX Ingress Controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml
    
    echo "⏳ Waiting for Ingress Controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=120s
    
    echo "📦 Applying Ingress rules..."
    kubectl apply -f ingress.yaml
    
    echo ""
    echo "🌐 LoadBalancer IP (may take a minute):"
    kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
    echo ""
fi

echo ""
echo "⏳ Waiting for pods to be ready..."
sleep 10

echo ""
echo "📊 Pod Status:"
kubectl get pods -n lgtm

echo ""
echo "🌐 Services:"
kubectl get svc -n lgtm

echo ""
echo "✅ Deployment complete!"
echo ""

if [[ "$USE_LB" =~ ^[Yy]$ ]]; then
    echo "🔗 Access via LoadBalancer IP"
else
    echo "🔗 Access via NodePort:"
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
    echo "   Grafana:    http://${NODE_IP}:30300"
    echo "   Sample App: http://${NODE_IP}:30800"
fi
