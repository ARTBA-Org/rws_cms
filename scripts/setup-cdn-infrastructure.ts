#!/usr/bin/env tsx

/**
 * AWS CDN Infrastructure Setup Script
 * 
 * This script creates the necessary AWS resources for CDN functionality:
 * - S3 bucket for image storage
 * - CloudFront distribution for global content delivery
 * - IAM policies for secure access
 * 
 * Prerequisites:
 * - AWS CLI configured with appropriate permissions
 * - Node.js and npm/yarn installed
 * 
 * Usage:
 * npm run setup:cdn
 * or
 * tsx scripts/setup-cdn-infrastructure.ts
 */

import { 
  S3Client, 
  CreateBucketCommand, 
  PutBucketCorsCommand, 
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutBucketNotificationConfigurationCommand,
  BucketLocationConstraint
} from '@aws-sdk/client-s3'
import { 
  CloudFrontClient, 
  CreateDistributionCommand, 
  CreateOriginAccessControlCommand 
} from '@aws-sdk/client-cloudfront'
import { 
  IAMClient, 
  CreateUserCommand, 
  CreateAccessKeyCommand, 
  AttachUserPolicyCommand,
  CreatePolicyCommand 
} from '@aws-sdk/client-iam'
import { CDN_CONFIG } from '../src/utils/cdnConfig'

// Configuration
const STACK_NAME = 'rws-cms-cdn'
const PROJECT_NAME = process.env.PROJECT_NAME || 'rws-cms'
const ENVIRONMENT = process.env.NODE_ENV || 'production'

interface CDNInfrastructure {
  bucket: {
    name: string
    region: string
    url: string
  }
  cloudfront: {
    distributionId: string
    domainName: string
    url: string
  }
  iam: {
    user: string
    accessKeyId: string
    secretAccessKey: string
  }
}

class CDNInfrastructureSetup {
  private s3Client: S3Client
  private cloudfrontClient: CloudFrontClient
  private iamClient: IAMClient
  private bucketName: string
  private region: string

  constructor() {
    this.region = CDN_CONFIG.aws.region
    this.bucketName = CDN_CONFIG.s3.bucketName || `${PROJECT_NAME}-images-${ENVIRONMENT}`
    
    // Initialize AWS clients
    this.s3Client = new S3Client({ region: this.region })
    this.cloudfrontClient = new CloudFrontClient({ region: 'us-east-1' }) // CloudFront is global but client needs us-east-1
    this.iamClient = new IAMClient({ region: this.region })
    
    console.log(`🚀 Setting up CDN infrastructure for ${PROJECT_NAME} (${ENVIRONMENT})`)
    console.log(`📦 Bucket: ${this.bucketName}`)
    console.log(`🌍 Region: ${this.region}`)
  }

  async setup(): Promise<CDNInfrastructure> {
    console.log('\n=== Starting CDN Infrastructure Setup ===\n')

    try {
      // Step 1: Create S3 bucket
      console.log('1️⃣ Creating S3 bucket...')
      await this.createS3Bucket()
      
      // Step 2: Configure S3 bucket
      console.log('2️⃣ Configuring S3 bucket...')
      await this.configureS3Bucket()
      
      // Step 3: Create CloudFront Origin Access Control
      console.log('3️⃣ Creating CloudFront Origin Access Control...')
      const oac = await this.createOriginAccessControl()
      
      // Step 4: Create CloudFront distribution
      console.log('4️⃣ Creating CloudFront distribution...')
      const distribution = await this.createCloudFrontDistribution(oac.id)
      
      // Step 5: Create IAM user and access keys
      console.log('5️⃣ Creating IAM user and access keys...')
      const iamCredentials = await this.createIAMUser()
      
      // Step 6: Update S3 bucket policy with CloudFront access
      console.log('6️⃣ Updating S3 bucket policy...')
      await this.updateS3BucketPolicy(distribution.id, oac.id)

      const infrastructure: CDNInfrastructure = {
        bucket: {
          name: this.bucketName,
          region: this.region,
          url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com`,
        },
        cloudfront: {
          distributionId: distribution.id,
          domainName: distribution.domainName,
          url: `https://${distribution.domainName}`,
        },
        iam: iamCredentials,
      }

      console.log('\n✅ CDN Infrastructure Setup Complete!')
      console.log('\n=== Infrastructure Details ===')
      console.log(JSON.stringify(infrastructure, null, 2))
      
      console.log('\n=== Environment Variables ===')
      this.printEnvironmentVariables(infrastructure)
      
      console.log('\n=== Next Steps ===')
      console.log('1. Add the environment variables to your .env file')
      console.log('2. Wait 5-15 minutes for CloudFront distribution to deploy')
      console.log('3. Test image upload via API: POST /api/cdn/images')
      console.log('4. Monitor CloudFront distribution status in AWS Console')

      return infrastructure

    } catch (error) {
      console.error('❌ Setup failed:', error)
      throw error
    }
  }

  private async createS3Bucket(): Promise<void> {
    try {
      const createBucketParams: any = {
        Bucket: this.bucketName,
      }

      // Add LocationConstraint for regions other than us-east-1
      if (this.region !== 'us-east-1') {
        createBucketParams.CreateBucketConfiguration = {
          LocationConstraint: this.region as BucketLocationConstraint,
        }
      }

      const command = new CreateBucketCommand(createBucketParams)
      await this.s3Client.send(command)
      
      console.log(`   ✅ S3 bucket ${this.bucketName} created`)
    } catch (error: any) {
      if (error.name === 'BucketAlreadyOwnedByYou') {
        console.log(`   ⚠️  S3 bucket ${this.bucketName} already exists`)
      } else {
        throw error
      }
    }
  }

  private async configureS3Bucket(): Promise<void> {
    // Enable versioning
    if (CDN_CONFIG.s3.versioning) {
      const versioningCommand = new PutBucketVersioningCommand({
        Bucket: this.bucketName,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      })
      await this.s3Client.send(versioningCommand)
      console.log('   ✅ S3 bucket versioning enabled')
    }

    // Configure CORS
    if (CDN_CONFIG.s3.corsEnabled) {
      const corsCommand = new PutBucketCorsCommand({
        Bucket: this.bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'x-amz-request-id'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      })
      await this.s3Client.send(corsCommand)
      console.log('   ✅ S3 bucket CORS configured')
    }
  }

  private async createOriginAccessControl(): Promise<{ id: string; etag: string }> {
    const command = new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: `${this.bucketName}-oac`,
        Description: `Origin Access Control for ${this.bucketName}`,
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      },
    })

    const response = await this.cloudfrontClient.send(command)
    console.log(`   ✅ Origin Access Control created: ${response.OriginAccessControl?.Id}`)
    
    return {
      id: response.OriginAccessControl!.Id!,
      etag: response.ETag!,
    }
  }

  private async createCloudFrontDistribution(oacId: string): Promise<{ id: string; domainName: string }> {
    const command = new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: `${this.bucketName}-${Date.now()}`,
        Comment: `CDN for ${PROJECT_NAME} images`,
        Enabled: true,
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: `${this.bucketName}-origin`,
              DomainName: `${this.bucketName}.s3.${this.region}.amazonaws.com`,
              S3OriginConfig: {
                OriginAccessIdentity: '', // Empty for OAC
              },
              OriginAccessControlId: oacId,
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: `${this.bucketName}-origin`,
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // Managed-CachingOptimized
          OriginRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // Managed-CORS-S3Origin
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: '/images/*',
              TargetOriginId: `${this.bucketName}-origin`,
              ViewerProtocolPolicy: 'redirect-to-https',
              Compress: true,
              CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingOptimizedForUncompressedObjects
              OriginRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf', // Managed-CORS-S3Origin
            },
          ],
        },
        PriceClass: 'PriceClass_100', // Use only North America and Europe edge locations
      },
    })

    const response = await this.cloudfrontClient.send(command)
    console.log(`   ✅ CloudFront distribution created: ${response.Distribution?.Id}`)
    console.log(`   🌐 Domain: ${response.Distribution?.DomainName}`)
    
    return {
      id: response.Distribution!.Id!,
      domainName: response.Distribution!.DomainName!,
    }
  }

  private async createIAMUser(): Promise<{ user: string; accessKeyId: string; secretAccessKey: string }> {
    const userName = `${PROJECT_NAME}-cdn-user`
    const policyName = `${PROJECT_NAME}-cdn-policy`

    try {
      // Create IAM policy
      const policyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
              's3:PutObjectAcl',
              's3:GetObjectVersion',
              's3:DeleteObjectVersion',
            ],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
          {
            Effect: 'Allow',
            Action: [
              's3:ListBucket',
              's3:GetBucketLocation',
              's3:GetBucketVersioning',
            ],
            Resource: [`arn:aws:s3:::${this.bucketName}`],
          },
          {
            Effect: 'Allow',
            Action: [
              'cloudfront:CreateInvalidation',
              'cloudfront:GetInvalidation',
              'cloudfront:ListInvalidations',
            ],
            Resource: ['*'],
          },
        ],
      }

      const createPolicyCommand = new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: JSON.stringify(policyDocument),
        Description: `CDN access policy for ${PROJECT_NAME}`,
      })

      const policyResponse = await this.iamClient.send(createPolicyCommand)
      console.log(`   ✅ IAM policy created: ${policyName}`)

      // Create IAM user
      const createUserCommand = new CreateUserCommand({
        UserName: userName,
        Path: '/',
      })

      await this.iamClient.send(createUserCommand)
      console.log(`   ✅ IAM user created: ${userName}`)

      // Attach policy to user
      const attachPolicyCommand = new AttachUserPolicyCommand({
        UserName: userName,
        PolicyArn: policyResponse.Policy!.Arn!,
      })

      await this.iamClient.send(attachPolicyCommand)
      console.log(`   ✅ IAM policy attached to user`)

      // Create access key
      const createAccessKeyCommand = new CreateAccessKeyCommand({
        UserName: userName,
      })

      const keyResponse = await this.iamClient.send(createAccessKeyCommand)
      console.log(`   ✅ IAM access key created`)

      return {
        user: userName,
        accessKeyId: keyResponse.AccessKey!.AccessKeyId!,
        secretAccessKey: keyResponse.AccessKey!.SecretAccessKey!,
      }

    } catch (error: any) {
      if (error.name === 'EntityAlreadyExists') {
        console.log(`   ⚠️  IAM user ${userName} already exists`)
        // For existing users, you might want to create new access keys
        throw new Error('User already exists. Please use existing credentials or delete the user first.')
      }
      throw error
    }
  }

  private async updateS3BucketPolicy(distributionId: string, oacId: string): Promise<void> {
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowCloudFrontServicePrincipal',
          Effect: 'Allow',
          Principal: {
            Service: 'cloudfront.amazonaws.com',
          },
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${this.bucketName}/*`,
          Condition: {
            StringEquals: {
              'AWS:SourceArn': `arn:aws:cloudfront::${await this.getAccountId()}:distribution/${distributionId}`,
            },
          },
        },
      ],
    }

    const command = new PutBucketPolicyCommand({
      Bucket: this.bucketName,
      Policy: JSON.stringify(bucketPolicy),
    })

    await this.s3Client.send(command)
    console.log('   ✅ S3 bucket policy updated for CloudFront access')
  }

  private async getAccountId(): Promise<string> {
    // Simple way to get account ID from IAM
    try {
      const { IAMClient, GetUserCommand } = await import('@aws-sdk/client-iam')
      const iamClient = new IAMClient({ region: this.region })
      const response = await iamClient.send(new GetUserCommand({}))
      return response.User!.Arn!.split(':')[4]
    } catch {
      // Fallback - extract from STS
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts')
      const stsClient = new STSClient({ region: this.region })
      const response = await stsClient.send(new GetCallerIdentityCommand({}))
      return response.Account!
    }
  }

  private printEnvironmentVariables(infrastructure: CDNInfrastructure): void {
    console.log(`
# AWS Configuration
AWS_REGION=${this.region}
AWS_ACCESS_KEY_ID=${infrastructure.iam.accessKeyId}
AWS_SECRET_ACCESS_KEY=${infrastructure.iam.secretAccessKey}

# S3 Configuration  
S3_BUCKET_NAME=${infrastructure.bucket.name}
S3_REGION=${infrastructure.bucket.region}
S3_PUBLIC_READ=false
S3_CORS_ENABLED=true
S3_VERSIONING=true

# CloudFront Configuration
CLOUDFRONT_DISTRIBUTION_ID=${infrastructure.cloudfront.distributionId}
CLOUDFRONT_DOMAIN_NAME=${infrastructure.cloudfront.domainName}
CLOUDFRONT_IMAGE_TTL=86400

# CDN Features
CDN_IMAGE_FORMATS=webp,png,jpeg
CDN_IMAGE_QUALITIES=85,70,50
CDN_IMAGE_SIZES=400,800,1200,1600
CDN_RESPONSIVE_IMAGES=true
CDN_LAZY_LOADING=true
CDN_GENERATE_THUMBNAILS=true
CDN_MAX_FILE_SIZE=10485760

# Optional: Custom domain (requires manual setup)
# CLOUDFRONT_CUSTOM_DOMAIN=cdn.yourdomain.com
    `)
  }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new CDNInfrastructureSetup()
  
  setup.setup()
    .then(() => {
      console.log('\n🎉 CDN infrastructure setup completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error)
      process.exit(1)
    })
}

export { CDNInfrastructureSetup }