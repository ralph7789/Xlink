#!/bin/bash

# E2E Test Script for xLink Architecture

echo "Starting E2E Tests for xLink..."
echo "-----------------------------------"

# 1. Test Frontend Availability
echo "1. Testing Frontend Applications"
HTTP_FRONTEND_MAIN=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_FRONTEND_MAIN" == "200" ]; then
    echo "[PASS] Frontend Main Page (/) is available"
else
    echo "[FAIL] Frontend Main Page (/) returned $HTTP_FRONTEND_MAIN"
fi

HTTP_FRONTEND_DEV=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/developer)
if [ "$HTTP_FRONTEND_DEV" == "200" ]; then
    echo "[PASS] Frontend Developer Portal (/developer) is available"
else
    echo "[FAIL] Frontend Developer Portal (/developer) returned $HTTP_FRONTEND_DEV"
fi

HTTP_FRONTEND_ADMIN=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin)
if [ "$HTTP_FRONTEND_ADMIN" == "200" ]; then
    echo "[PASS] Frontend Admin Portal (/admin) is available"
else
    echo "[FAIL] Frontend Admin Portal (/admin) returned $HTTP_FRONTEND_ADMIN"
fi

echo "-----------------------------------"
# 2. Test Gateway API (Management)
echo "2. Testing Go API Gateway (Management API)"
TEST_ENDPOINT="/test-$(date +%s)"
# Generate a test JWT token (secret: 'supersecret')
TOKEN=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 | tr -d '=' | tr '/+' '_-').$(echo -n '{"role":"admin"}' | base64 | tr -d '=' | tr '/+' '_-')
SIG=$(echo -n "$TOKEN" | openssl dgst -sha256 -hmac "supersecret" -binary | base64 | tr -d '=' | tr '/+' '_-')
JWT="$TOKEN.$SIG"

CREATE_RESP=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" -d "{\"path\": \"$TEST_ENDPOINT\", \"method\": \"GET\", \"code\": \"return {\\\"status\\\": \\\"success\\\", \\\"timestamp\\\": Date.now()};\"}" http://localhost:8080/api/endpoints)

if echo "$CREATE_RESP" | jq -e '.message == "Endpoint created"' >/dev/null 2>&1; then
    echo "[PASS] Gateway successfully created a new endpoint configuration"
else
    echo "[FAIL] Gateway failed to create endpoint: $CREATE_RESP"
fi

LIST_RESP=$(curl -s -H "Authorization: Bearer $JWT" http://localhost:8080/api/endpoints)
if echo "$LIST_RESP" | jq -e ".[] | select(.path == \"$TEST_ENDPOINT\")" >/dev/null 2>&1; then
    echo "[PASS] Gateway successfully listed the newly created endpoint"
else
    echo "[FAIL] Gateway failed to list the new endpoint"
fi

echo "-----------------------------------"
# 3. Test Sandbox Execution via Gateway
echo "3. Testing Sandbox Execution Engine (Native V8)"
EXEC_RESP=$(curl -s http://localhost:8080/run$TEST_ENDPOINT)
if echo "$EXEC_RESP" | jq -e '.status == "success"' >/dev/null 2>&1; then
    echo "[PASS] Code executed successfully in native V8 Sandbox via Gateway"
else
    echo "[FAIL] Sandbox execution failed. Response: $EXEC_RESP"
fi

echo "-----------------------------------"
# 4. Test Rate Limiting (Redis)
echo "4. Testing Redis Rate Limiting"
# Run 105 requests concurrently
PIDS=()
for i in {1..105}; do 
    (
        RESP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/run$TEST_ENDPOINT)
        echo "$RESP_CODE"
    ) &
    PIDS+=($!)
done

# Wait and count 429s
RATE_429=0
for pid in "${PIDS[@]}"; do
    CODE=$(wait $pid)
    if [ "$CODE" == "429" ]; then
        RATE_429=$((RATE_429 + 1))
    fi
done

if [ "$RATE_429" -ge 5 ]; then
    echo "[PASS] Rate limiting (100 req/min) enforced correctly via Redis (got $RATE_429 throttles)"
else
    echo "[FAIL] Rate limiting failed. Only got $RATE_429 HTTP 429 responses."
fi

echo "-----------------------------------"
echo "E2E Tests Completed."
