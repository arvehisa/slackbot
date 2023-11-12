#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppRunnerStack } from '../lib/apprunner'; 
import { VpcRdsStack } from '../lib/vpc-rds';
import { EcrStack } from '../lib/ecr';

const app = new cdk.App();

const ecrStack = new EcrStack(app, 'EcrStack'); 

const vpcRdsStack = new VpcRdsStack(app, 'VpcRdsStack'); 

new AppRunnerStack(app, 'AppRunnerStack', {
  ecr: ecrStack.ecr,
  vpc: vpcRdsStack.myVpc, 
});
