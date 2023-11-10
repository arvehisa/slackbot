#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';
import { EcrStack } from '../lib/ecr-stack';

const app = new cdk.App();

const ecrStack = new EcrStack(app, 'EcrStack', {});

new CdkStack(app, 'CdkStack', {ecr: ecrStack.ecr});