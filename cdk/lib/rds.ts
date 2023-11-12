import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from 'constructs';

type Props = cdk.StackProps & {
    vpc: ec2.Vpc;
    postgresSecurityGroup: ec2.SecurityGroup;
  };


export class RdsStack extends cdk.Stack {

  constructor(scope: Construct, id: string, Props: Props) {
    super(scope, id, Props);

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
            vpc: Props.vpc,
            securityGroups: [Props.postgresSecurityGroup],
            //vpcSubnets 正しくは PRIVATE_EGRESS だが、ローカルテストと前準備の都合上 Public にする
            vpcSubnets: Props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }), 
            publiclyAccessible: true,
        }
    });

  }
}
