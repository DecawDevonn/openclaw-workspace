#!/bin/bash
# domain_activation.sh - Activate devonn.ai with ACM certificate and ALB ingress

set -e

DOMAIN="devonn.ai"
ZONE_ID="REPLACE_ROUTE53_ZONE_ID"
ACCOUNT_ID="REPLACE_ACCOUNT_ID"
CLUSTER_NAME="REPLACE_CLUSTER_NAME"
REGION="${AWS_REGION:-us-west-2}"

echo "====================================="
echo "  Devonn.ai Domain Activation"
echo "====================================="
echo ""
echo "Domain: $DOMAIN"
echo "Zone ID: $ZONE_ID"
echo "Account: $ACCOUNT_ID"
echo "Cluster: $CLUSTER_NAME"
echo "Region: $REGION"
echo ""

# Step 1: Request ACM Certificate
echo "📜 Step 1: Requesting ACM certificate..."
CERT_ARN=$(aws acm request-certificate \
    --domain-name "$DOMAIN" \
    --subject-alternative-names "www.$DOMAIN" \
    --validation-method DNS \
    --region "$REGION" \
    --query 'CertificateArn' \
    --output text)

echo "   Certificate ARN: $CERT_ARN"
echo ""

# Step 2: Get validation records and add to Route 53
echo "📝 Step 2: Creating Route 53 validation records..."

echo "   Waiting for certificate to be ready for validation..."
sleep 10

VALIDATION_OPTIONS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.DomainValidationOptions[]' \
    --output json)

# Build Route 53 change batch
CHANGE_BATCH='{"Changes":['
FIRST=true

for domain in "$DOMAIN" "www.$DOMAIN"; do
    VALIDATION=$(echo "$VALIDATION_OPTIONS" | jq -r ".[] | select(.DomainName==\"$domain\")")
    RECORD=$(echo "$VALIDATION" | jq -r '.ResourceRecord.Name')
    VALUE=$(echo "$VALIDATION" | jq -r '.ResourceRecord.Value')
    
    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        CHANGE_BATCH+=","
    fi
    
    CHANGE_BATCH+="{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$RECORD\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$VALUE\"}]}}"
done

CHANGE_BATCH+=']}'

echo "   Adding DNS validation records to Route 53..."
aws route53 change-resource-record-sets \
    --hosted-zone-id "$ZONE_ID" \
    --change-batch "$CHANGE_BATCH"

echo ""

# Step 3: Wait for certificate validation
echo "⏳ Step 3: Waiting for certificate validation..."
echo "   (This may take a few minutes)"

MAX_WAIT=600
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query 'Certificate.Status' \
        --output text)
    
    if [ "$STATUS" = "ISSUED" ]; then
        echo "   ✅ Certificate validated successfully!"
        break
    elif [ "$STATUS" = "FAILED" ]; then
        echo "   ❌ Certificate validation failed!"
        exit 1
    fi
    
    echo "   ⏳ Current status: $STATUS (waiting 30s)..."
    sleep 30
    ELAPSED=$((ELAPSED + 30))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "   ⚠️  Timed out waiting for validation. Check manually in AWS Console."
    exit 1
fi

echo ""

# Step 4: Deploy Kubernetes resources
echo "☸️  Step 4: Deploying to EKS cluster..."
echo "   Updating kubeconfig for cluster: $CLUSTER_NAME"
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"

echo "   Applying deployment..."
kubectl apply -f k8s/devonn-api.yaml

echo "   Rendering and applying ingress..."
sed "s|REPLACE_CERT_ARN|$CERT_ARN|g" k8s/ingress.template.yaml | kubectl apply -f -

echo ""

# Step 5: Wait for ALB provisioning
echo "🔍 Step 5: Waiting for ALB provisioning..."
echo ""
echo "   Checking ingress status..."

for i in {1..30}; do
    ALB_HOSTNAME=$(kubectl get ingress devonn-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ -n "$ALB_HOSTNAME" ]; then
        ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
            --names "$(echo $ALB_HOSTNAME | cut -d'-' -f1)" \
            --query 'LoadBalancers[0].CanonicalHostedZoneId' \
            --output text 2>/dev/null || echo "")
        
        echo ""
        echo "✅ ALB Provisioned Successfully!"
        echo ""
        echo "📊 ALB Details:"
        echo "   DNS Name: $ALB_HOSTNAME"
        echo "   Hosted Zone ID: $ALB_ZONE_ID"
        echo ""
        echo "📋 Next Steps:"
        echo "   1. Create Route 53 alias record for devonn.ai"
        echo "   2. Create Route 53 alias record for www.devonn.ai"
        echo ""
        echo "   Alias record should point:"
        echo "   devonn.ai A → $ALB_HOSTNAME"
        echo ""
        echo "   Here's the JSON for the alias record:"
        echo ""
        cat << EOF
{
  "Action": "UPSERT",
  "ResourceRecordSet": {
    "Name": "devonn.ai",
    "Type": "A",
    "AliasTarget": {
      "HostedZoneId": "$ALB_ZONE_ID",
      "DNSName": "$ALB_HOSTNAME",
      "EvaluateTargetHealth": true
    }
  }
}
EOF
        echo ""
        exit 0
    fi
    
    echo "   ⏳ ALB not ready yet (attempt $i/30)..."
    sleep 10
done

echo ""
echo "⚠️  Timed out waiting for ALB. Check ingress status with:"
echo "   kubectl get ingress devonn-ingress"
exit 1
