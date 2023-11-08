import {
  Stack, StackProps, RemovalPolicy,
  aws_ecr as ecr,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "path";
import * as imagedeploy from "cdk-docker-image-deployment";

type Props = StackProps & {
  resourceName: string
}
export class ECRStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);


    const ecrRepository = new ecr.Repository(this, "EcrRepo", {
      repositoryName: `${props.resourceName}-ecr-repo`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteImages: true,
    });

    new imagedeploy.DockerImageDeployment(
      this,
      "DockerImageDeployment",
      {
        source: imagedeploy.Source.directory(
          path.join(__dirname, "../..", "app")
        ),
        destination: imagedeploy.Destination.ecr(ecrRepository, {
          tag: "myspecialtag",
        }),
      }
    );
    // TODO: ECS Taskへのデプロイどうすっか
  }
}
