import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';
import * as api from 'aws-cdk-lib/aws-apigateway';

export class CoreStack extends cdk.Stack {
  readonly myVpc: ec2.Vpc;
  readonly AppRunnerLambdaSG: ec2.SecurityGroup;
  readonly rdssg: ec2.SecurityGroup;
  readonly rdsSecrets: secretsmanager.ISecret;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: "slackbot-vpc",
      maxAzs: 2,
      natGateways: 1,
    });

    const AppRunnerLambdaSG = new ec2.SecurityGroup(
      this,
        'AppRunnerLambdaSG', {
          securityGroupName: 'apprunner-lambda-sg',
          vpc,
         }
    )

    const PostgresSG = new ec2.SecurityGroup(
      this,
      'PostgresSG',
      {
          allowAllOutbound: true,
          securityGroupName: 'slackbot-rag-pgvector-db-sg',
          vpc,
      }
    )

    PostgresSG.addIngressRule(
      AppRunnerLambdaSG,
      ec2.Port.tcp(5432),
      'Allow AppRunner VPC Connector to access Postgres'
    )

    const rdsCredentials = rds.Credentials.fromGeneratedSecret(
      'postgres', //db username
      { secretName: 'rag-pgvector-db-secrets' }
    )
    
    new rds.DatabaseCluster(this, 'postgres', {
      credentials: rdsCredentials,
      defaultDatabaseName: 'postgres', //database name
      clusterIdentifier: 'rag-pgvector-db',
      engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_3,
        }),
      instances: 1,
      instanceProps: {
          instanceType: ec2.InstanceType.of(
              ec2.InstanceClass.T4G, 
              ec2.InstanceSize.MEDIUM
          ),
          vpc: vpc,
          securityGroups: [PostgresSG],
          vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }), 
      }
    })
    
    // secrets for lambda environment variables
    const secrets = secretsmanager.Secret.fromSecretNameV2(
      this,
      'rag-pgvector-db-secrets', //CDK用の名前
      'rag-pgvector-db-secrets' //実際のSecretsの名前
    )

    const slackSecret = secretsmanager.Secret.fromSecretNameV2( 
      this,
      'SlackSecret', //CloudFormation Logical ID
      'slackbot-credentials' //実際のSecretsの名前を指定しているのでそのクレデンシャルがあることが前提
    );

    const langchainApiKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'LangchainApiKey',
      'langchain'
    );

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: 'embedding-lambda-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Embedding Lambda Execution Role',
    })

    // とりあえず全部 Allow して後で絞る
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['*'],
      resources: ['*'],
    }));

    const bucket = new s3.Bucket(this, 'EmbeddingDocumentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // CDK 削除したら中身も消えるので要注意
      autoDeleteObjects: true,
    });

    const embeddinglambda = new lambda.DockerImageFunction(this, 'embeddinglambda', {
      
      functionName: 'embedding-lambda',
      code: lambda.DockerImageCode.fromImageAsset('../embedding-lambda',{ platform: Platform.LINUX_AMD64 }),
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [AppRunnerLambdaSG],
      environment: {
        PGVECTOR_HOST: secrets.secretValueFromJson('host').unsafeUnwrap(),
        PGVECTOR_PASSWORD: secrets.secretValueFromJson('password').unsafeUnwrap(),
      },
      timeout: cdk.Duration.seconds(300),
      memorySize: 2048,
      architecture: lambda.Architecture.X86_64,
      role: lambdaRole,
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(embeddinglambda)
    );

    // Slackbot Lambda 
    
    const slackbotLambda = new lambda.DockerImageFunction(this, 'slackbotLambda', {
      functionName: 'slackbot-lambda',
      code: lambda.DockerImageCode.fromImageAsset('../app',{ platform: Platform.LINUX_AMD64 }),
      vpc: vpc, 
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [AppRunnerLambdaSG],
      environment: {
        PGVECTOR_HOST: secrets.secretValueFromJson('host').unsafeUnwrap(),
        PGVECTOR_PASSWORD: secrets.secretValueFromJson('password').unsafeUnwrap(),
        SLACK_BOT_TOKEN: slackSecret.secretValueFromJson('SLACK_BOT_TOKEN').unsafeUnwrap(),
        SLACK_SIGNING_SECRET: slackSecret.secretValueFromJson('SLACK_SIGNING_SECRET').unsafeUnwrap(),
        SOCKET_MODE_TOKEN: slackSecret.secretValueFromJson('SOCKET_MODE_TOKEN').unsafeUnwrap(),
        LANGCHAIN_TRACING_V2: "true",
        LANGCHAIN_ENDPOINT: "https://api.smith.langchain.com",
        LANGCHAIN_API_KEY: langchainApiKey.secretValueFromJson('LANGCHAIN_API_KEY').unsafeUnwrap(),
        LANGCHAIN_PROJECT: "slackbot-rag-pgvector"
      },
      timeout: cdk.Duration.seconds(300),
      memorySize: 2048,
      architecture: lambda.Architecture.X86_64,
      role: lambdaRole,
      });


    // API Gateway
    new api.LambdaRestApi(this, 'slackbot-api', {
      handler: slackbotLambda,
    });

    // Client VPN Endpoint
    const clientCidr = '1.0.0.0/22'
    const serverCertificateArn = 'arn:aws:acm:us-east-1:618044871166:certificate/e6754345-c2c4-44f8-b4b1-43e28d6a7b03'
    const clientCertificateArn = 'arn:aws:acm:us-east-1:618044871166:certificate/987d5ae8-2686-4b7a-be67-4b85ae468c99'

    new ec2.ClientVpnEndpoint(this, 'ClientVpn', {
      vpc: vpc,
      cidr: clientCidr,
      serverCertificateArn: serverCertificateArn,
      clientCertificateArn: clientCertificateArn,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [AppRunnerLambdaSG],
      description: 'Client VPN Endpoint',
    })
    

    this.myVpc = vpc
    this.AppRunnerLambdaSG = AppRunnerLambdaSG
    this.rdsSecrets = secrets;
  }
}