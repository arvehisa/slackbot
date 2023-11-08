import {
  Stack, StackProps, RemovalPolicy,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

type Props = StackProps & {
  resourceName: string
}

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {});

    const cluster = new ecs.Cluster(this, "EcsCluster", {
      clusterName: `${props.resourceName}-cluster`,
      vpc: vpc,
    });

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/aws/ecs/${props.resourceName}`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

  }
}
