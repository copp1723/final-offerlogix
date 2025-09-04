#!/bin/bash

# Script to add leads to The Direct Hit-Ford campaign and start the cadence

API_BASE="http://localhost:5050/api"
FORD_CAMPAIGN_ID="ee876452-9ce3-42d4-94d2-252feafe9639"

echo "🎯 Adding leads to The Direct Hit-Ford campaign..."
echo ""

# Array of email addresses
emails=(
  "Caryn.ladd@gmail.com"
  "jon.gregory3861@gmail.com"
  "appleoptin@gmail.com"
  "abickart@gmail.com"
)

created_count=0
failed_count=0

# Create each lead
for email in "${emails[@]}"; do
  echo "Creating lead: $email"
  
  response=$(curl -s -w "%{http_code}" -X POST "$API_BASE/leads" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"firstName\": \"\",
      \"lastName\": \"\",
      \"phone\": \"\",
      \"vehicleInterest\": \"Ford\",
      \"leadSource\": \"manual_entry\",
      \"status\": \"new\",
      \"campaignId\": \"$FORD_CAMPAIGN_ID\"
    }")
  
  # Extract HTTP status code (last 3 characters)
  http_code="${response: -3}"
  # Extract response body (everything except last 3 characters)
  response_body="${response%???}"
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    echo "✅ Created lead: $email"
    ((created_count++))
  else
    echo "❌ Failed to create lead $email (HTTP $http_code): $response_body"
    ((failed_count++))
  fi
  
  # Small delay between requests
  sleep 0.5
done

echo ""
echo "📊 Summary:"
echo "✅ Successfully created: $created_count leads"
echo "❌ Failed: $failed_count leads"

if [ $created_count -gt 0 ]; then
  echo ""
  echo "🚀 Starting Ford campaign execution..."
  
  campaign_response=$(curl -s -w "%{http_code}" -X POST "$API_BASE/campaigns/$FORD_CAMPAIGN_ID/execute" \
    -H "Content-Type: application/json" \
    -d "{
      \"testMode\": false,
      \"maxLeadsPerBatch\": 50
    }")
  
  # Extract HTTP status code and response body
  campaign_http_code="${campaign_response: -3}"
  campaign_response_body="${campaign_response%???}"
  
  if [ "$campaign_http_code" -eq 200 ] || [ "$campaign_http_code" -eq 201 ]; then
    echo "✅ Campaign executed successfully!"
    echo "📧 Response: $campaign_response_body"
  else
    echo "❌ Failed to execute campaign (HTTP $campaign_http_code): $campaign_response_body"
  fi
else
  echo "❌ No leads were created, skipping campaign execution"
fi

echo ""
echo "🎉 Process completed!"
