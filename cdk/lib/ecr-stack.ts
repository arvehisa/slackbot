import {
  Stack, StackProps, RemovalPolicy,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecr_assets as ecr_assets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "path";
import * as imagedeploy from "cdk-docker-image-deployment";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ECRStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    const resourceName = "slackbot";
    const ecrRepository = new ecr.Repository(this, "EcrRepo", {
      repositoryName: `${resourceName}-ecr-repo`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteImages: true,
    });

    new imagedeploy.DockerImageDeployment(
      this,
      "ImageDeploymentWithTag",
      {
        source: imagedeploy.Source.directory(
          path.join(__dirname, "../..", "app")
        ),
        destination: imagedeploy.Destination.ecr(ecrRepository, {
          tag: "myspecialtag",
        }),
      }
    );
  }
}
