import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class CoreStack extends cdk.Stack {
  readonly myVpc: ec2.Vpc;
  readonly AppSG: ec2.SecurityGroup;
  readonly rdssg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: "slackbot-vpc",
      maxAzs: 2,
    });

    const AppSG = new ec2.SecurityGroup(
      this,
        'AppSG', {
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
      AppSG,
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
    
    const secrets = secretsmanager.Secret.fromSecretNameV2(
      this,
      'rag-pgvector-db-secrets', //CDK用の名前
      'rag-pgvector-db-secrets' //実際のSecretsの名前
    )

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
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
      code: lambda.DockerImageCode.fromImageAsset('../lambda'),
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroups: [AppSG],
      environment: {
        PGVECTOR_HOST: secrets.secretValueFromJson('host').unsafeUnwrap(),
        PGVECTOR_PASSWORD: secrets.secretValueFromJson('password').unsafeUnwrap(),
      },
      timeout: cdk.Duration.seconds(300),
      memorySize: 2048,
      role: lambdaRole,
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(embeddinglambda)
    );

    this.myVpc = vpc
    this.AppSG = AppSG
    this.rdssg = PostgresSG;
  }
}