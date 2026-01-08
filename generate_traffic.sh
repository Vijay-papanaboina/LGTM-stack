#!/bin/bash
# ============================================================
# Traffic Generator for LGTM Stack
# ============================================================
# Usage: ./generate_traffic.sh [OPTIONS]
#   -u URL      Base URL (default: $BASE_URL or http://localhost:30800)
#   -n COUNT    Number of iterations (default: infinite)
#   -b          Burst mode (parallel requests)
#   -f          Fast mode (100ms delay)
#   -e          Error only mode (generate 500 errors)
#   -h          Show help
# ============================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:30800}"
COUNT=0  # 0 = infinite
BURST=false
FAST=false
ERROR_ONLY=false
DELAY=1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -u URL      Base URL (default: \$BASE_URL or http://localhost:30800)"
  echo "  -n COUNT    Number of iterations (0 = infinite, default: infinite)"
  echo "  -b          Burst mode (10 parallel requests)"
  echo "  -f          Fast mode (100ms delay)"
  echo "  -e          Error only mode (generate 500 errors)"
  echo "  -h          Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 -b              # Burst mode, infinite"
  echo "  $0 -e -n 100       # 100 error requests"
  echo "  $0 -u http://app.example.com -f"
  exit 0
}

# Parse arguments
while getopts "u:n:bfeh" opt; do
  case $opt in
    u) BASE_URL="$OPTARG" ;;
    n) COUNT="$OPTARG" ;;
    b) BURST=true ;;
    f) FAST=true; DELAY=0.1 ;;
    e) ERROR_ONLY=true ;;
    h) show_help ;;
    *) echo "Use -h for help"; exit 1 ;;
  esac
done

echo -e "${CYAN}🚀 Traffic Generator${NC}"
echo "   Target: $BASE_URL"
echo "   Mode:   $([ "$BURST" = true ] && echo "BURST" || echo "SEQUENTIAL") $([ "$ERROR_ONLY" = true ] && echo "(ERRORS ONLY)")"
echo "   Count:  $([ "$COUNT" -eq 0 ] && echo "∞ (Ctrl+C to stop)" || echo "$COUNT")"
echo ""

SUCCESS=0
FAILURE=0
ITERATION=0

send_request() {
  local endpoint=$1
  local method=${2:-GET}
  local data=${3:-}
  
  if [ "$method" = "POST" ]; then
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" -d "$data" 2>&1) || true
  else
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>&1) || true
  fi
  
  if [[ "$http_code" =~ ^2 ]]; then
    ((SUCCESS++))
    return 0
  else
    ((FAILURE++))
    return 1
  fi
}

cleanup() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "📊 ${YELLOW}Results:${NC}"
  echo -e "   ${GREEN}✅ Success: $SUCCESS${NC}"
  echo -e "   ${RED}❌ Failure: $FAILURE${NC}"
  echo -e "   📈 Total:   $((SUCCESS + FAILURE))"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

while true; do
  ((ITERATION++))
  
  if [ "$COUNT" -gt 0 ] && [ "$ITERATION" -gt "$COUNT" ]; then
    break
  fi
  
  if [ "$ERROR_ONLY" = true ]; then
    # Error only mode
    if [ "$BURST" = true ]; then
      echo -e "${YELLOW}[$ITERATION] Sending 10 error requests...${NC}"
      for _ in {1..10}; do
        send_request "/api/error" "GET" &
      done
      wait
    else
      send_request "/api/error" "GET"
    fi
  else
    # Normal mode - hit all endpoints
    echo -ne "${YELLOW}[$ITERATION] ${NC}"
    
    if [ "$BURST" = true ]; then
      send_request "/" "GET" &
      send_request "/api/fast" "GET" &
      send_request "/api/fast" "GET" &
      send_request "/api/slow" "GET" &
      send_request "/api/order" "POST" '{"item":"test","quantity":1}' &
      wait
      echo -e "${GREEN}✓ burst complete${NC}"
    else
      send_request "/" "GET"
      send_request "/api/fast" "GET"
      send_request "/api/order" "POST" '{"item":"test","quantity":1}'
      
      # Slow every 5th
      if [ $((ITERATION % 5)) -eq 0 ]; then
        send_request "/api/slow" "GET"
      fi
      
      # Error every 7th
      if [ $((ITERATION % 7)) -eq 0 ]; then
        send_request "/api/error" "GET"
      fi
      
      echo -e "${GREEN}✓${NC}"
    fi
  fi
  
  sleep "$DELAY"
done

cleanup

