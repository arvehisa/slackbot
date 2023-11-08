#!/usr/bin/env node
import 'source-map-support/register';
import {
  App, Tags
}
  from 'aws-cdk-lib';
import { MainStack } from '../lib/main-stack';
import { ECRStack } from "../lib/ecr-stack";

const app = new App();

const resourceName = "slackbot";

Tags.of(app).add('created', 'cdk');
Tags.of(app).add('repository', resourceName);

new MainStack(app, 'MainStack', { resourceName });
new ECRStack(app, 'ECRStack', { resourceName });
