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
  secrets: secretsmanager.ISecret;
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
      'slackbot-credentials' //実際のSecretsの名前を指定しているのでそのクレデンシャルがあることが前提
    );

    const langchainApiKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'LangchainApiKey',
      'langchain'
    );


    //pgadmin を別の AppRunner でデプロイする
    new apprunner.Service(this, 'pgadmin-app-runner', {
      serviceName: 'pgadmin-service',
      source: apprunner.Source.fromEcr ({
        imageConfiguration: { 
          port: 80,
          environmentVariables: {
            'PGADMIN_DEFAULT_EMAIL': 'postgres@example.com',
            'PGADMIN_DEFAULT_PASSWORD': 'postgres'
          }
        },
        repository: ecr.Repository.fromRepositoryName(this, 'PgAdminRepo', 'pgadmin4'),
        tagOrDigest: 'latest',
      }),
      vpcConnector,
      instanceRole: instanceRole,
      accessRole: accessRole,
    });

    new apprunner.Service(this, 'slackbot-app-runner', {
      serviceName: 'slackbot-rag-pgvector',
      source: apprunner.Source.fromEcr({
        imageConfiguration: { 
          port: 8080,
          environmentVariables: {
            // unsafeUnwrap() は、SecretValue から値を取り出すメソッド。Secret は Cloudformation に出力されるらしいのでセキュリティリスクあり
            PGVECTOR_HOST: props.secrets.secretValueFromJson('host').unsafeUnwrap(),
            PGVECTOR_PASSWORD: props.secrets.secretValueFromJson('password').unsafeUnwrap(),
            SLACK_BOT_TOKEN: slackSecret.secretValueFromJson('SLACK_BOT_TOKEN').unsafeUnwrap(),
            SLACK_SIGNING_SECRET: slackSecret.secretValueFromJson('SLACK_SIGNING_SECRET').unsafeUnwrap(),
            SOCKET_MODE_TOKEN: slackSecret.secretValueFromJson('SOCKET_MODE_TOKEN').unsafeUnwrap(),
            LANGCHAIN_TRACING_V2: "true",
            LANGCHAIN_ENDPOINT: "https://api.smith.langchain.com",
            LANGCHAIN_API_KEY: langchainApiKey.secretValueFromJson('LANGCHAIN_API_KEY').unsafeUnwrap(),
            LANGCHAIN_PROJECT: "slackbot-rag-pgvector"
          }
        },
        repository: props.ecr,
        tagOrDigest: 'latest',
      }),
      vpcConnector,
      instanceRole: instanceRole,
      accessRole: accessRole,

    });




  }
}
