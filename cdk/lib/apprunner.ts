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
  AppRunnerLambdaSG: ec2.SecurityGroup;
  secrets: secretsmanager.Secret;
};

export class AppRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    
    const vpcConnector = new apprunner.VpcConnector(this, 'VpcConnector', {
      vpc: props.vpc,
      securityGroups: [props.AppRunnerLambdaSG],
      vpcSubnets: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
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

    //手動で Slackbot の Secret を Secrets Manager にいれたものをここで取得する
    const slackSecret = secretsmanager.Secret.fromSecretNameV2( 
      this,
      'SlackSecret', //CloudFormation Logical ID
      'SlackSecret' //実際のSecretsの名前
    );

    new apprunner.Service(this, 'AppRunnerService', {
      serviceName: 'slackbot-rag-pgvector',
      source: apprunner.Source.fromEcr({
        imageConfiguration: { 
          port: 8080,
          environment: {
            // unsafeUnwrap() は、SecretValue から値を取り出すメソッド。Secret は Cloudformation に出力されるらしいのでセキュリティリスクあり
            PGVECTOR_HOST: props.secrets.secretValueFromJson('host').unsafeUnwrap(),
            PGVECTOR_PASSWORD: props.secrets.secretValueFromJson('password').unsafeUnwrap(),
            SLACK_BOT_TOKEN: slackSecret.secretValueFromJson('SLACK_BOT_TOKEN').unsafeUnwrap(),
            SLACK_SIGNING_SECRET: slackSecret.secretValueFromJson('SLACK_SIGNING_SECRET').unsafeUnwrap(),
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
