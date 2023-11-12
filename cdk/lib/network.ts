import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.Stack {
  readonly myVpc: ec2.Vpc;
  readonly appRunnerVpcConnectorSG: ec2.SecurityGroup;
  readonly rdssg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: "slackbot-vpc",
      maxAzs: 2
    });

    const AppRunnerVpcConnectorSG = new ec2.SecurityGroup(
        this,
         'AppRunnerVpcConnectorSG', {
            securityGroupName: 'apprunner-vpc-connector-sg',
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
        AppRunnerVpcConnectorSG,
        ec2.Port.tcp(5432),
        'Allow AppRunner VPC Connector to access Postgres'
    )
    
    this.myVpc = vpc
    this.appRunnerVpcConnectorSG = AppRunnerVpcConnectorSG
    this.rdssg = PostgresSG;


  }
}
