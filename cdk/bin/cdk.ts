#!/usr/bin/env node
import 'source-map-support/register';
import {
  App, Tags
}
  from 'aws-cdk-lib';
import { MainStack } from '../lib/main-stack';
import { ECRStack } from "../lib/ecr-stack";

const app = new App();
new MainStack(app, 'MainStack', {});
new ECRStack(app, 'ECRStack', {});

Tags.of(app).add('created', 'cdk');
Tags.of(app).add('repository', 'cdk');
