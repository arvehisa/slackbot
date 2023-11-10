import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import { Construct } from 'constructs';

type Props = cdk.StackProps & {
  ecr: ecr.Repository,
};

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: "slackbot-vpc",
      maxAzs: 2
    });
    
    const vpcConnector = new apprunner.VpcConnector(this, 'VpcConnector', {
      vpc,
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      vpcConnectorName: 'apprunner-vpc-connector',
    });
        
    new apprunner.Service(this, 'Service', {
      serviceName: 'slackbot-rag-pgvector',
      source: apprunner.Source.fromEcrPublic({
        imageConfiguration: { port: 8080 },
        imageIdentifier: `${props.ecr.repositoryUri}:latest`,
      }),
      vpcConnector,
    });


    
    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
