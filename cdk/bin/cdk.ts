#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppRunnerStack } from '../lib/apprunner'; 
import { CoreStack } from '../lib/core';
import { EcrStack } from '../lib/ecr';

const app = new cdk.App();

const ecrStack = new EcrStack(app, 'EcrStack'); 

const coreStack = new CoreStack(app, 'CoreStack'); 

new AppRunnerStack(app, 'AppRunnerStack', {
  ecr: ecrStack.ecr,
  vpc: coreStack.myVpc, 
  AppRunnerLambdaSG: coreStack.AppRunnerLambdaSG,
  secrets: coreStack.secrets,
});