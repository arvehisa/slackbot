import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

type Props = cdk.StackProps & {
  ecr: ecr.Repository;
  vpc: ec2.Vpc;
};

export class AppRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    
    const vpcConnector = new apprunner.VpcConnector(this, 'VpcConnector', {
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      vpcConnectorName: 'apprunner-vpc-connector',
    });
        
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    })

    const accessRole = new iam.Role(this, 'AppRunnerECRAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
    })

    // IAMロールの権限が不確かなので一回 Admin にしておく
    accessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
    )

    instanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
    )

    const secrets = secretsmanager.Secret.fromSecretNameV2(
      scope,
      'rag-pgvector-db-secrets', //CDK用の名前
      'rag-pgvector-db-secrets' //実際のSecretsの名前
    )

    //手動で Slackbot の Secret を Secrets Manager にいれたものをここで取得する
    const slackSecret = secretsmanager.Secret.fromSecretAttributes( 
      this,
      'SlackSecret',
      {
        secretCompleteArn: 'arn:aws:secretsmanager:us-east-1:618044871166:secret:slackbot-credentials-DdeZ1X',
      }
    );

    new apprunner.Service(this, 'AppRunnerService', {
      serviceName: 'slackbot-rag-pgvector',
      source: apprunner.Source.fromEcr({
        imageConfiguration: { 
          port: 8080,
          environment: {
            PGVECTOR_HOST: 'rag-pgvector-db.cluster-cqk2c3y2xg3l.ap-northeast-1.rds.amazonaws.com',
            PGVECTOR_PASSWORD: secrets.secretValueFromJson('password').toString(),
            SLACK_BOT_TOKEN: slackSecret.secretValueFromJson('SLACK_BOT_TOKEN').toString(),
            SLACK_SIGNING_SECRET: slackSecret.secretValueFromJson('SLACK_SIGNING_SECRET').toString(),
          }
        },
        repository: props.ecr,
        tag: 'latest',
      }),
      vpcConnector,
      instanceRole: instanceRole,
      accessRole: accessRole,
    });

  }
}
