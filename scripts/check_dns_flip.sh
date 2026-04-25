#!/bin/bash
# check_dns_flip.sh - Verify DNS delegation propagation for devonn.ai

set -e

DOMAIN="devonn.ai"
EXPECTED_NS=$(aws route53 get-hosted-zone --id REPLACE_ROUTE53_ZONE_ID --query 'DelegationSet.NameServers' --output text 2>/dev/null || echo "")

echo "====================================="
echo "  Devonn.ai DNS Propagation Check"
echo "====================================="
echo ""

if [ -z "$EXPECTED_NS" ]; then
    echo "❌ Failed to fetch Route 53 NS records. Check your AWS credentials and zone ID."
    exit 1
fi

echo "Expected Route 53 Nameservers:"
echo "$EXPECTED_NS" | tr '\t' '\n' | sed 's/^/  - /'
echo ""

echo "Current delegation (from WHOIS/DNS):"
CURRENT_NS=$(dig +short NS $DOMAIN 2>/dev/null || true)
if [ -n "$CURRENT_NS" ]; then
    echo "$CURRENT_NS" | sed 's/^/  - /'
else
    echo "  (No NS records found yet — delegation may still be propagating)"
fi
echo ""

echo "Checking propagation across public resolvers..."
RESOLVERS=("8.8.8.8" "1.1.1.1" "9.9.9.9")
PROPAGATED=0

for resolver in "${RESOLVERS[@]}"; do
    RESULT=$(dig +short @$resolver NS $DOMAIN 2>/dev/null | head -1 || true)
    if [ -n "$RESULT" ]; then
        echo "  ✓ $resolver: $RESULT"
        PROPAGATED=$((PROPAGATED + 1))
    else
        echo "  ⏳ $resolver: Not yet"
    fi
done

echo ""
if [ $PROPAGATED -eq ${#RESOLVERS[@]} ]; then
    echo "✅ DNS delegation fully propagated. Ready for domain activation."
    exit 0
else
    echo "⏳ DNS still propagating. Check again in a few minutes."
    exit 1
fi
