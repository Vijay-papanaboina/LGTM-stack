#!/bin/bash
# ============================================================
# LGTM Stack Kubernetes Deployment Script (Helm Version)
# ============================================================

set -e

# Get script directory and cd to it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 LGTM Stack Kubernetes Deployment (Helm)"
echo "============================================"
echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl not found. Please install kubectl first."
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        echo "❌ helm not found. Please install helm first."
        echo "   Install: https://helm.sh/docs/intro/install/"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo "❌ Cannot connect to Kubernetes cluster. Check your kubeconfig."
        exit 1
    fi
    
    echo "✅ All prerequisites met"
    echo ""
}

# Add Helm repositories
add_helm_repos() {
    echo "📦 Adding Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
    helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
    helm repo update
    echo "✅ Helm repositories ready"
    echo ""
}

# Create namespace
create_namespace() {
    echo "📦 Creating namespace..."
    kubectl apply -f namespace.yaml
    echo ""
}

# Install kube-prometheus-stack (Prometheus + Grafana + Node Exporter)
install_prometheus_stack() {
    echo "📦 Installing kube-prometheus-stack..."
    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        -n monitoring \
        -f helm/kube-prometheus-stack-values.yaml \
        --wait --timeout 10m
    echo "✅ kube-prometheus-stack installed"
    echo ""
}

# Install Loki
install_loki() {
    echo "📦 Installing Loki..."
    helm upgrade --install loki grafana/loki \
        -n monitoring \
        -f helm/loki-values.yaml \
        --wait --timeout 5m
    echo "✅ Loki installed"
    echo ""
}

# Install Tempo
install_tempo() {
    echo "📦 Installing Tempo..."
    helm upgrade --install tempo grafana/tempo \
        -n monitoring \
        -f helm/tempo-values.yaml \
        --wait --timeout 5m
    echo "✅ Tempo installed"
    echo ""
}

# Install Alloy
install_alloy() {
    echo "📦 Installing Alloy..."
    helm upgrade --install alloy grafana/alloy \
        -n monitoring \
        -f helm/alloy-values.yaml \
        --wait --timeout 5m
    echo "✅ Alloy installed"
    echo ""
}

# Apply custom configurations
apply_custom_configs() {
    echo "📦 Applying custom configurations..."
    kubectl apply -f custom/ -n monitoring
    echo "✅ Custom configs applied"
    echo ""
}

# Deploy applications
deploy_apps() {
    echo "📦 Deploying applications..."
    kubectl apply -f apps/sample-app/
    kubectl apply -f apps/order-service/
    kubectl apply -f apps/payment-service/
    echo "✅ Applications deployed"
    echo ""
}

# Optional: Install Ingress
install_ingress() {
    read -p "🔧 Install NGINX Ingress Controller? (y/n): " INSTALL_INGRESS
    echo ""
    
    if [[ "$INSTALL_INGRESS" =~ ^[Yy]$ ]]; then
        echo "🌐 Installing NGINX Ingress Controller..."
        kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml
        
        echo "⏳ Waiting for Ingress Controller..."
        kubectl wait --namespace ingress-nginx \
            --for=condition=ready pod \
            --selector=app.kubernetes.io/component=controller \
            --timeout=120s || true
        
        echo "📦 Applying Ingress rules..."
        kubectl apply -f ingress.yaml
        echo ""
    fi
}

# Show status
show_status() {
    echo ""
    echo "⏳ Waiting for pods to be ready..."
    sleep 15
    
    echo ""
    echo "📊 Helm Releases (monitoring namespace):"
    helm list -n monitoring
    
    echo ""
    echo "📊 Monitoring Pods:"
    kubectl get pods -n monitoring
    
    echo ""
    echo "📊 App Pods:"
    kubectl get pods -n lgtm
    
    echo ""
    echo "🌐 Services:"
    kubectl get svc -n monitoring
    kubectl get svc -n lgtm
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || echo "localhost")
    echo "🔗 Access:"
    echo "   Grafana:    http://${NODE_IP}:30300 (admin/admin)"
    echo "   Sample App: http://${NODE_IP}:30800"
}

# Uninstall function
uninstall() {
    echo "🗑️ Uninstalling LGTM stack..."
    helm uninstall alloy -n monitoring 2>/dev/null || true
    helm uninstall tempo -n monitoring 2>/dev/null || true
    helm uninstall loki -n monitoring 2>/dev/null || true
    helm uninstall kube-prometheus-stack -n monitoring 2>/dev/null || true
    kubectl delete -f apps/ --recursive 2>/dev/null || true
    kubectl delete -f custom/ -n monitoring 2>/dev/null || true
    kubectl delete namespace monitoring 2>/dev/null || true
    kubectl delete namespace lgtm 2>/dev/null || true
    echo "✅ Uninstall complete"
}

# Main
main() {
    case "${1:-}" in
        uninstall)
            uninstall
            ;;
        *)
            check_prerequisites
            add_helm_repos
            create_namespace
            install_prometheus_stack
            install_loki
            install_tempo
            install_alloy
            apply_custom_configs
            deploy_apps
            install_ingress
            show_status
            ;;
    esac
}

main "$@"
