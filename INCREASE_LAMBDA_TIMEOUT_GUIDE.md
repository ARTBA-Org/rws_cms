# How to Increase AWS Lambda Timeout - Step by Step Guide

## Method 1: AWS Console (Easiest)

### Step 1: Find Your Lambda Function
1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Make sure you're in the correct region (check top-right corner)
3. Look for your function. It's usually named something like:
   - `amplify-rwscms-main-XXXXXX-function`
   - Or check CloudWatch logs for the function name from your error

### Step 2: Update Timeout
1. Click on your Lambda function name
2. Go to **Configuration** tab
3. Click on **General configuration** (left sidebar)
4. Click **Edit** button
5. Find **Timeout** setting
6. Change from `0 min 30 sec` to `1 min 0 sec` (or higher)
   - Recommended: `1 min 0 sec` for 5-page PDFs
   - Maximum: `15 min 0 sec`
7. Click **Save**

### Step 3: (Optional) Increase Memory
While you're there, also increase memory for better performance:
1. In the same Edit screen
2. Find **Memory (MB)**
3. Change to `1024 MB` or `1536 MB`
4. Click **Save**

## Method 2: AWS Amplify Console

If your app is deployed with Amplify:

### Step 1: Access Amplify Console
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click on your app
3. Click on **Backend environments** tab
4. Click on your environment (e.g., "main" or "production")

### Step 2: Edit Backend
1. Click **Edit backend** button
2. Go to **Functions** section
3. Find your API function
4. Click on it to open Lambda console
5. Follow Method 1 steps above

## Method 3: Amplify CLI (For Local Development)

If you have Amplify CLI set up:

```bash
# 1. Pull the latest backend configuration
amplify pull

# 2. Update function configuration
amplify function update

# 3. Select your function from the list
# Choose the function that handles your API

# 4. When prompted for "Do you want to update the Lambda function permissions?"
# Choose: Yes

# 5. When prompted for "Do you want to edit advanced settings?"
# Choose: Yes

# 6. Set the following:
# - Timeout: 60 (or higher)
# - Memory: 1024 (or higher)

# 7. Push changes to cloud
amplify push
```

## Method 4: Update CloudFormation Template

If you have access to the CloudFormation/SAM template:

### Find your template file
Look for files like:
- `amplify/backend/function/[functionName]/[functionName]-cloudformation-template.json`
- `template.yaml`
- `serverless.yml`

### Add/Update timeout configuration:

#### JSON Format:
```json
{
  "Resources": {
    "LambdaFunction": {
      "Properties": {
        "Timeout": 60,
        "MemorySize": 1024
      }
    }
  }
}
```

#### YAML Format:
```yaml
Resources:
  YourLambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      Timeout: 60
      MemorySize: 1024
```

#### Serverless Framework:
```yaml
functions:
  api:
    handler: index.handler
    timeout: 60
    memorySize: 1024
```

### Deploy changes:
```bash
# For Amplify
amplify push

# For SAM
sam deploy

# For Serverless Framework
serverless deploy
```

## Method 5: Using Environment Variables (Next.js on Vercel/Amplify)

If your Next.js app is on Amplify Hosting:

### In Amplify Console:
1. Go to your app in Amplify Console
2. Click **Environment variables** (left sidebar)
3. Add these variables:
```
AMPLIFY_FUNCTION_TIMEOUT=60
AWS_LAMBDA_FUNCTION_TIMEOUT=60
```
4. Redeploy your app

### In your next.config.js:
```javascript
module.exports = {
  serverRuntimeConfig: {
    functionTimeout: 60, // seconds
  },
}
```

## Verify the Change

### Check in AWS Console:
1. Go back to Lambda console
2. Click on your function
3. Check **Configuration** → **General configuration**
4. Verify Timeout shows your new value

### Test with a PDF:
```bash
# Upload a PDF and check CloudWatch logs
# You should see processing complete without timeout errors
```

### Monitor in CloudWatch:
1. Go to CloudWatch Logs
2. Find your Lambda function log group
3. Look for latest log stream
4. Check for "Duration" in the REPORT line:
   ```
   REPORT RequestId: xxx Duration: 28002.51 ms
   ```
   If Duration is less than your new timeout, it's working!

## Quick Checklist

- [ ] Located Lambda function in AWS Console
- [ ] Changed Timeout from 30s to 60s+
- [ ] Increased Memory to 1024MB+
- [ ] Saved changes
- [ ] Tested with a PDF upload
- [ ] Verified in CloudWatch logs

## Troubleshooting

### Can't find the Lambda function?
- Check CloudWatch logs for the function name
- Look in different AWS regions
- Search for "amplify" in Lambda console

### Changes not taking effect?
- Clear browser cache
- Redeploy your application
- Check if there are multiple Lambda functions

### Still timing out?
- Increase timeout further (up to 15 minutes)
- Use the optimized processor with fewer pages
- Consider processing without images

## Cost Implications

Lambda pricing = Requests + Duration
- Increasing timeout doesn't cost more if execution completes faster
- Increasing memory can actually reduce costs by completing faster
- Monitor your AWS bill for actual usage

## Next Steps

After increasing timeout:
1. Test with your largest PDF
2. Monitor performance in CloudWatch
3. Adjust processor config in your code:
```javascript
{
  maxPages: 10,      // Can process more pages now
  timeoutMs: 55000,  // 55 seconds (for 60s Lambda)
  enableImages: true,
  batchSize: 1
}
```