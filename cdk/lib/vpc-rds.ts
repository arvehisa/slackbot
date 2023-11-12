import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from 'constructs';

export class VpcRdsStack extends cdk.Stack {
  readonly myVpc: ec2.Vpc;
  readonly appRunnerVpcConnectorSG: ec2.SecurityGroup;

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
            vpc,
            securityGroups: [PostgresSG],
            //vpcSubnets 正しくは PRIVATE_EGRESS だが、ローカルテストと前準備の都合上 Public にする
            vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }), 
            publiclyAccessible: true,
        }
    });
    this.myVpc = vpc
    this.appRunnerVpcConnectorSG = AppRunnerVpcConnectorSG

  }
}
