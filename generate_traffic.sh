#!/bin/bash
# ============================================================
# Traffic Generator for LGTM Stack
# ============================================================
# Usage: ./generate_traffic.sh [OPTIONS]
#   -u URL      Base URL (default: http://34.93.182.86)
#   -n COUNT    Number of requests (default: 10)
#   -b          Burst mode (parallel requests)
#   -f          Fast mode (no delay)
# ============================================================

BASE_URL="${BASE_URL:-http://34.93.182.86}"
COUNT=10
BURST=false
FAST=false

# Parse arguments
while getopts "u:n:bf" opt; do
  case $opt in
    u) BASE_URL="$OPTARG" ;;
    n) COUNT="$OPTARG" ;;
    b) BURST=true ;;
    f) FAST=true ;;
    *) echo "Usage: $0 [-u URL] [-n COUNT] [-b] [-f]"; exit 1 ;;
  esac
done

echo "🚀 Traffic Generator"
echo "   Target: $BASE_URL"
echo "   Count:  $COUNT"
echo "   Mode:   $([ "$BURST" = true ] && echo "BURST" || echo "SEQUENTIAL")"
echo ""

SUCCESS=0
FAILURE=0

send_request() {
  local endpoint=$1
  local method=${2:-GET}
  local data=${3:-}
  
  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>&1)
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [[ "$http_code" =~ ^2 ]]; then
    echo "  ✅ $method $endpoint -> $http_code"
    ((SUCCESS++))
  else
    echo "  ❌ $method $endpoint -> $http_code"
    ((FAILURE++))
  fi
}

# Endpoints to hit
endpoints=(
  "GET /"
  "GET /api/fast"
  "GET /api/slow"
  "GET /api/error"
  "POST /api/order {\"item\":\"test-item\",\"quantity\":1}"
)

for i in $(seq 1 $COUNT); do
  echo "[$i/$COUNT] Sending requests..."
  
  for ep in "${endpoints[@]}"; do
    method=$(echo "$ep" | awk '{print $1}')
    path=$(echo "$ep" | awk '{print $2}')
    data=$(echo "$ep" | cut -d' ' -f3-)
    
    if [ "$BURST" = true ]; then
      send_request "$path" "$method" "$data" &
    else
      send_request "$path" "$method" "$data"
    fi
  done
  
  if [ "$BURST" = true ]; then
    wait
  fi
  
  if [ "$FAST" != true ] && [ $i -lt $COUNT ]; then
    sleep 1
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Results:"
echo "   ✅ Success: $SUCCESS"
echo "   ❌ Failure: $FAILURE"
echo "   📈 Total:   $((SUCCESS + FAILURE))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
