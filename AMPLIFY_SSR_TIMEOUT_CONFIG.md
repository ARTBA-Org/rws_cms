# Configuring Lambda Timeout for Amplify SSR (Next.js) Apps

## Understanding Amplify SSR Deployment

Your `rws_cms` app is deployed using Amplify's `WEB_COMPUTE` platform, which means:
- Amplify manages the Lambda function internally
- The Lambda function may not be directly visible in AWS Lambda console
- Configuration is done through Amplify, not Lambda directly

## Method 1: Amplify Environment Variables

### Step 1: Go to Amplify Console
1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Select your `rws_cms` app (App ID: `d2edi1jahermo0`)

### Step 2: Configure Environment Variables
1. Click on **App settings** → **Environment variables**
2. Add these variables:

```bash
# Increase Lambda timeout
AWS_LAMBDA_FUNCTION_TIMEOUT=60

# Increase memory allocation
AWS_LAMBDA_FUNCTION_MEMORY_SIZE=1024

# For API routes specifically
AMPLIFY_FUNCTION_TIMEOUT=60
```

3. Click **Save**
4. **Redeploy your app** for changes to take effect

## Method 2: amplify.yml Configuration

Add to your `amplify.yml` file in the project root:

```yaml
version: 1
applications:
  - appRoot: .
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    serverlessFunction:
      timeout: 60  # Timeout in seconds
      memorySize: 1024  # Memory in MB
```

## Method 3: Next.js Configuration

### Update next.config.js:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase API route timeout
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Server runtime configuration
  serverRuntimeConfig: {
    functionTimeout: 60,
  },
  // Experimental features for Amplify
  experimental: {
    // Increase the default timeout for API routes
    proxyTimeout: 60000, // 60 seconds in milliseconds
  },
}

module.exports = nextConfig
```

## Method 4: Custom Build Settings in Amplify

### In Amplify Console:
1. Go to **App settings** → **Build settings**
2. Edit the build spec to include:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
        - echo "AWS_LAMBDA_FUNCTION_TIMEOUT=60" >> .env.production
        - echo "AWS_LAMBDA_FUNCTION_MEMORY_SIZE=1024" >> .env.production
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
  buildTimeout: 30  # Build timeout in minutes
  # Configure the Lambda function
  lambda:
    timeout: 60
    memorySize: 1024
```

## Method 5: Using AWS Systems Manager Parameter Store

1. Create parameters in Parameter Store:
```bash
aws ssm put-parameter \
  --name "/amplify/d2edi1jahermo0/main/LAMBDA_TIMEOUT" \
  --value "60" \
  --type "String" \
  --region us-east-1

aws ssm put-parameter \
  --name "/amplify/d2edi1jahermo0/main/LAMBDA_MEMORY" \
  --value "1024" \
  --type "String" \
  --region us-east-1
```

2. Reference in Amplify environment variables:
   - In Amplify Console, add environment variable
   - Set value to: `${ssm:/amplify/d2edi1jahermo0/main/LAMBDA_TIMEOUT}`

## Immediate Workaround

While you configure the Lambda timeout, use the optimized processor with these settings:

```javascript
// In your API route or wherever you call the processor
const config = {
  maxPages: 3,        // Process only 3 pages to stay within 30s
  timeoutMs: 25000,   // 25 seconds (safe for 30s timeout)
  enableImages: true,
  batchSize: 1
}
```

## Verify the Configuration

After deployment, check CloudWatch logs:
1. Go to CloudWatch → Log groups
2. Look for `/aws/amplify/d2edi1jahermo0`
3. Check the latest logs for timeout duration

## Alternative: Deploy Separate Lambda for PDF Processing

If Amplify's managed Lambda doesn't allow timeout configuration, consider:

1. **Create a separate Lambda function** for PDF processing
2. **Call it from your Next.js API route** using AWS SDK
3. **Configure the separate Lambda** with desired timeout

Example:
```javascript
// In your Next.js API route
import { Lambda } from 'aws-sdk'

const lambda = new Lambda({ region: 'us-east-1' })

export async function POST(request) {
  const result = await lambda.invoke({
    FunctionName: 'pdf-processor-function',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({ 
      pdfBuffer, 
      moduleId 
    })
  }).promise()
  
  return NextResponse.json(JSON.parse(result.Payload))
}
```

## Recommended Next Steps

1. Try Method 1 (Environment Variables) first - it's the easiest
2. Redeploy your app after making changes
3. Test with a 5-page PDF
4. If still timing out, consider the separate Lambda approach