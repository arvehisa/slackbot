#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppRunnerStack } from '../lib/apprunner'; 
import { NetworkStack } from '../lib/network';
import { EcrStack } from '../lib/ecr';
import { RdsStack } from '../lib/rds';

const app = new cdk.App();

const ecrStack = new EcrStack(app, 'EcrStack'); 

const networkStack = new NetworkStack(app, 'NetworkStack'); 

const rds = new RdsStack(app, 'RdsStack', {
  vpc: networkStack.myVpc,
  postgresSecurityGroup: networkStack.rdssg,
});

new AppRunnerStack(app, 'AppRunnerStack', {
  ecr: ecrStack.ecr,
  vpc: networkStack.myVpc, 
  appRunnerVpcConnectorSG: networkStack.appRunnerVpcConnectorSG,
});
