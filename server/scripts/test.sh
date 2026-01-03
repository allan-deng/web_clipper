#!/bin/bash
#
# API Test Script for Web Clipper Backend
#
# Tests all API endpoints with various scenarios
#
# Usage: ./test.sh [server_url] [auth_token]
# Example: ./test.sh http://localhost:18080 your-secret-token
#

# Configuration
SERVER_URL="${1:-http://localhost:18080}"
AUTH_TOKEN="${2:-your-secret-token-here}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_test() {
    echo ""
    echo -e "${BLUE}▶ TEST: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
    echo -e "${YELLOW}  ℹ $1${NC}"
}

print_request() {
    echo -e "  ${CYAN}Request:${NC} $1"
}

print_response() {
    echo -e "  ${CYAN}Response:${NC}"
    echo "$1" | sed 's/^/    /'
}

# Check if jq is available
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is required but not installed.${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq is not installed. JSON output will not be formatted.${NC}"
        JQ_AVAILABLE=false
    else
        JQ_AVAILABLE=true
    fi
}

# Format JSON if jq is available
format_json() {
    if [ "$JQ_AVAILABLE" = true ]; then
        echo "$1" | jq . 2>/dev/null || echo "$1"
    else
        echo "$1"
    fi
}

# Check HTTP status code
check_status() {
    local expected=$1
    local actual=$2
    local test_name=$3
    
    if [ "$actual" -eq "$expected" ]; then
        print_success "$test_name (HTTP $actual)"
        return 0
    else
        print_fail "$test_name (Expected HTTP $expected, got $actual)"
        return 1
    fi
}

# Check JSON field value
check_json_field() {
    local json=$1
    local field=$2
    local expected=$3
    local test_name=$4
    
    if [ "$JQ_AVAILABLE" = true ]; then
        local actual=$(echo "$json" | jq -r "$field" 2>/dev/null)
        if [ "$actual" = "$expected" ]; then
            print_success "$test_name"
            return 0
        else
            print_fail "$test_name (Expected '$expected', got '$actual')"
            return 1
        fi
    else
        if echo "$json" | grep -q "\"$expected\""; then
            print_success "$test_name (partial match)"
            return 0
        else
            print_fail "$test_name (could not verify without jq)"
            return 1
        fi
    fi
}

#=============================================================================
# Test Cases
#=============================================================================

# Test 1: Health Check
test_health_check() {
    print_test "Health Check Endpoint"
    print_request "GET $SERVER_URL/health"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" "$SERVER_URL/health")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Health endpoint returns 200"
    check_json_field "$response" ".status" "ok" "Status is 'ok'"
}

# Test 2: Save without Auth Token (should fail)
test_save_no_auth() {
    print_test "Save Without Auth Token (should fail)"
    print_request "POST $SERVER_URL/api/v1/save (no Authorization header)"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"metadata":{"title":"Test"},"content":{"markdown":"# Test"}}' \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 401 "$http_code" "Returns 401 Unauthorized"
}

# Test 3: Save with Invalid Auth Token (should fail)
test_save_invalid_auth() {
    print_test "Save With Invalid Auth Token (should fail)"
    print_request "POST $SERVER_URL/api/v1/save (wrong token)"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer invalid-token-12345" \
        -d '{"metadata":{"title":"Test"},"content":{"markdown":"# Test"}}' \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 401 "$http_code" "Returns 401 Unauthorized"
}

# Test 4: Save with Invalid JSON (should fail)
test_save_invalid_json() {
    print_test "Save With Invalid JSON (should fail)"
    print_request "POST $SERVER_URL/api/v1/save (malformed JSON)"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{invalid json}' \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 400 "$http_code" "Returns 400 Bad Request"
}

# Test 5: Save with Missing Required Fields (should fail)
test_save_missing_fields() {
    print_test "Save With Missing Required Fields (should fail)"
    print_request "POST $SERVER_URL/api/v1/save (missing metadata.url)"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "metadata": {
                "title": "Test Article"
            },
            "content": {
                "markdown": "# Test"
            }
        }' \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 400 "$http_code" "Returns 400 Bad Request"
}

# Test 6: Save with Path Traversal Attack (should fail)
test_save_path_traversal() {
    print_test "Save With Path Traversal Attack (should fail)"
    print_request "POST $SERVER_URL/api/v1/save (malicious asset filename)"
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d '{
            "metadata": {
                "title": "Test Article",
                "url": "https://example.com/article",
                "domain": "example.com",
                "savedAt": "2024-01-01T00:00:00Z"
            },
            "content": {
                "markdown": "# Test Content"
            },
            "assets": [
                {
                    "filename": "../../../etc/passwd",
                    "base64": "dGVzdA==",
                    "mimeType": "image/png"
                }
            ]
        }' \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 400 "$http_code" "Returns 400 Bad Request"
    check_json_field "$response" ".code" "3001" "Error code is 3001 (Security Violation)"
}

# Test 7: Save Minimal Valid Request
test_save_minimal() {
    print_test "Save Minimal Valid Request"
    print_request "POST $SERVER_URL/api/v1/save (minimal valid data)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"Test Article $(date +%s)\",
                \"url\": \"https://example.com/test-article\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\"
            },
            \"content\": {
                \"markdown\": \"# Test Article\\n\\nThis is a test article content.\"
            }
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
}

# Test 8: Save Full Request with Highlights
test_save_with_highlights() {
    print_test "Save Full Request With Highlights"
    print_request "POST $SERVER_URL/api/v1/save (with highlights)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"Article With Highlights $(date +%s)\",
                \"url\": \"https://example.com/highlighted-article\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\",
                \"tags\": [\"test\", \"highlights\"]
            },
            \"content\": {
                \"markdown\": \"# Article With Highlights\\n\\nThis is an important paragraph that was highlighted.\\n\\n## Section 2\\n\\nMore content here.\",
                \"highlights\": [
                    {
                        \"text\": \"important paragraph\",
                        \"note\": \"This is my note about this highlight\",
                        \"color\": \"#ffeb3b\",
                        \"position\": 0
                    },
                    {
                        \"text\": \"More content\",
                        \"note\": \"\",
                        \"color\": \"#4caf50\",
                        \"position\": 1
                    }
                ]
            }
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
}

# Test 9: Save Full Request with AI Summary
test_save_with_ai_summary() {
    print_test "Save Full Request With AI Summary"
    print_request "POST $SERVER_URL/api/v1/save (with AI summary)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"AI Summary Test $(date +%s)\",
                \"url\": \"https://example.com/ai-summary-test\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\",
                \"tags\": [\"ai\", \"test\"]
            },
            \"content\": {
                \"markdown\": \"# AI Summary Test\\n\\nThis article discusses the importance of AI in modern software development.\",
                \"aiSummary\": {
                    \"keyPoints\": [
                        \"AI is transforming software development\",
                        \"Automation improves productivity\",
                        \"Human oversight remains important\"
                    ],
                    \"evidence\": [
                        {
                            \"point\": \"AI is transforming software development\",
                            \"quote\": \"The importance of AI in modern software development\"
                        }
                    ],
                    \"mermaidDiagram\": \"graph TD\\n    A[AI] --> B[Development]\\n    B --> C[Productivity]\",
                    \"status\": \"SUCCESS\"
                }
            }
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
}

# Test 10: Save with Base64 Image Asset
test_save_with_image() {
    print_test "Save With Base64 Image Asset"
    print_request "POST $SERVER_URL/api/v1/save (with image)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # Small 1x1 red PNG image in base64
    local small_png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"Article With Image $(date +%s)\",
                \"url\": \"https://example.com/image-article\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\"
            },
            \"content\": {
                \"markdown\": \"# Article With Image\\n\\n![Test Image](./assets/test-image.png)\\n\\nSome content here.\"
            },
            \"assets\": [
                {
                    \"filename\": \"test-image.png\",
                    \"base64\": \"$small_png\",
                    \"mimeType\": \"image/png\"
                }
            ]
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
    check_json_field "$response" ".data.assetsCount" "1" "Assets count is 1"
}

# Test 11: CORS Preflight Request
test_cors_preflight() {
    print_test "CORS Preflight Request"
    print_request "OPTIONS $SERVER_URL/api/v1/save"
    
    local http_code
    local cors_header
    
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X OPTIONS \
        -H "Origin: http://localhost" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type, Authorization" \
        "$SERVER_URL/api/v1/save")
    
    cors_header=$(curl -s -I \
        -X OPTIONS \
        -H "Origin: http://localhost" \
        -H "Access-Control-Request-Method: POST" \
        "$SERVER_URL/api/v1/save" | grep -i "access-control-allow-origin" || echo "")
    
    print_info "HTTP Code: $http_code"
    print_info "CORS Header: $cors_header"
    
    if [ "$http_code" -eq 204 ] || [ "$http_code" -eq 200 ]; then
        print_success "CORS preflight returns success"
    else
        print_fail "CORS preflight failed (HTTP $http_code)"
    fi
}

# Test 12: Special Characters in Title
test_save_special_chars() {
    print_test "Save With Special Characters in Title"
    print_request "POST $SERVER_URL/api/v1/save (special chars in title)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"Test: Special/Chars \\\"Quotes\\\" & Symbols <> $(date +%s)\",
                \"url\": \"https://example.com/special-chars?param=value&other=123\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\"
            },
            \"content\": {
                \"markdown\": \"# Special Characters Test\\n\\nContent with special chars: <>&\\\"'\"
            }
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
}

# Test 13: Unicode/Chinese Characters
test_save_unicode() {
    print_test "Save With Unicode/Chinese Characters"
    print_request "POST $SERVER_URL/api/v1/save (Chinese content)"
    
    local response
    local http_code
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"metadata\": {
                \"title\": \"中文测试文章 $(date +%s)\",
                \"url\": \"https://example.com/chinese-article\",
                \"domain\": \"example.com\",
                \"savedAt\": \"$timestamp\",
                \"tags\": [\"中文\", \"测试\"]
            },
            \"content\": {
                \"markdown\": \"# 中文测试\\n\\n这是一篇中文测试文章。\\n\\n## 第二部分\\n\\n更多中文内容。\",
                \"highlights\": [
                    {
                        \"text\": \"中文测试文章\",
                        \"note\": \"这是一条中文笔记\",
                        \"color\": \"#ffeb3b\",
                        \"position\": 0
                    }
                ]
            }
        }" \
        "$SERVER_URL/api/v1/save")
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    print_response "$(format_json "$response")"
    
    check_status 200 "$http_code" "Returns 200 OK"
    check_json_field "$response" ".code" "0" "Response code is 0 (success)"
}

#=============================================================================
# Main
#=============================================================================

main() {
    print_header "Web Clipper API Tests"
    echo ""
    echo "  Server URL: $SERVER_URL"
    echo "  Auth Token: ${AUTH_TOKEN:0:10}..."
    echo ""
    
    check_dependencies
    
    # Check if server is running
    print_info "Checking if server is running..."
    if ! curl -s --connect-timeout 5 "$SERVER_URL/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Cannot connect to server at $SERVER_URL${NC}"
        echo -e "${YELLOW}Make sure the server is running with: cd server && go run .${NC}"
        exit 1
    fi
    print_success "Server is running"
    
    # Run all tests
    print_header "Running Tests"
    
    test_health_check
    test_save_no_auth
    test_save_invalid_auth
    test_save_invalid_json
    test_save_missing_fields
    test_save_path_traversal
    test_save_minimal
    test_save_with_highlights
    test_save_with_ai_summary
    test_save_with_image
    test_cors_preflight
    test_save_special_chars
    test_save_unicode
    
    # Print summary
    print_header "Test Summary"
    echo ""
    echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
    echo -e "  Total:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

# Run main
main "$@"
