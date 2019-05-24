'use strict';

import { Before, HookScenarioResult } from 'cucumber';
import debug from 'debug';
import * as _ from 'lodash';

import { RequisitionAdopter } from 'enqueuer/js/components/requisition-adopter';
import { Configuration } from 'enqueuer/js/configurations/configuration';
import { PublisherModel } from 'enqueuer/js/models/inputs/publisher-model';
import { RequisitionModel } from 'enqueuer/js/models/inputs/requisition-model';
import { SubscriptionModel } from 'enqueuer/js/models/inputs/subscription-model';
import { reportModelIsPassing } from 'enqueuer/js/models/outputs/report-model';
import { RequisitionRunner } from 'enqueuer/js/requisition-runners/requisition-runner';
import { CucumberStepsBuilder } from './cucumber-steps';
import { EnqueuerData, EnqueuerStep } from './enqueuer-data';

debug.formatters.J = (v) => {
    return JSON.stringify(v, null, 2);
};

export class EnqueuerStepDefinitions {
    private enquererData: EnqueuerData;
    private cucumberStepsBuilder: CucumberStepsBuilder;
    private debugger = debug('EnqueuerCucumber');

    constructor() {
        this.enquererData = new EnqueuerData();
        this.cucumberStepsBuilder = new CucumberStepsBuilder();
    }

    public build() {
        this.debugger('Starting EnqueuerStepDefinitions plugin');
        this.enquererData.initEnqueuer();
        this.buildBeforeHook();
        this.buildSteps();
    }

    public addFile(file: string) {
        Configuration.getInstance().getFiles().push(file);
        return this;
    }

    public addPlugin(plugin: string) {
        Configuration.getInstance().addPlugin(plugin);
        return this;
    }

    private buildBeforeHook() {
        const self: EnqueuerStepDefinitions = this;
        Before(async function (testcase: HookScenarioResult) {
            const requisition = self.buildEnqueuerRequisition(testcase);
            if (requisition) {
                this.testReport = await self.executeEnqueuer(requisition);
            }
        });
    }

    private buildSteps() {
        this.enquererData.getRequisitions().forEach(requisition => {
            this.cucumberStepsBuilder.createGivenStep(requisition);
        });
        this.enquererData.getPublishers().forEach(publisher => {
            this.cucumberStepsBuilder.createWhenStep(publisher);
        });
        this.enquererData.getSubscriptions().forEach(subscription => {
            this.cucumberStepsBuilder.createThenStep(subscription);
        });
    }

    private async executeEnqueuer(requisition: RequisitionModel) {
        this.debugger('Executing requisition <<%s>> in Enqueuer', requisition.name);
        const configuration = Configuration.getInstance();
        const enqueuerRequisition = new RequisitionAdopter(
            {
                name: 'enqueuer',
                parallel: configuration.isParallel(),
                requisitions: [requisition],
                timeout: -1
            }).getRequisition();
        const parsingErrors = this.enquererData.getParsingErrors();
        const finalReports = await new RequisitionRunner(enqueuerRequisition, 0).run();

        finalReports.forEach(report => {
            report.tests = parsingErrors;
            report.valid = report.valid && reportModelIsPassing(report);
        });

        this.debugger('Report execution for requisition <<%s>>: %J', requisition.name, finalReports);
        return finalReports;
    }

    private buildEnqueuerRequisition(testcase: HookScenarioResult) {
        this.debugger('Building enqueuer requisition for test execution: <<%s>>', testcase.pickle.name);
        this.debugger('Cucumber metadata for test: %J', testcase);
        const requisitionStep = this.enquererData.getRequisitionStep(testcase.pickle.name, true);
        const requisition = this.fromEnqueuerStep(requisitionStep.step as RequisitionModel, requisitionStep) as RequisitionModel;

        testcase.pickle.steps.forEach(step => {
            const innerRequisition = this.enquererData.getRequisitionStep(step.text);
            let stepMatched = false;
            if (innerRequisition.step) {
                requisition.requisitions.push(this.fromEnqueuerStep(requisition, innerRequisition) as RequisitionModel);
                stepMatched = true;
            }
            if (!stepMatched) {
                const publisher = this.enquererData.getPublisherStep(step.text);
                if (publisher.step) {
                    requisition.publishers.push(this.fromEnqueuerStep(requisition, publisher) as PublisherModel);
                    stepMatched = true;
                }
            }
            if (!stepMatched) {
                const subscription = this.enquererData.getSubscriptionStep(step.text);
                if (subscription.step) {
                    requisition.subscriptions.push(this.fromEnqueuerStep(requisition, subscription) as SubscriptionModel);
                }
            }
        });

        this.debugger('Enqueuer requisition created: %J', requisition);
        return requisition;
    }

    private fromEnqueuerStep(requisition: RequisitionModel, requisitionStep: EnqueuerStep) {
        if (requisitionStep.variables) {
            requisition.store = _.merge(requisition.store, requisitionStep.variables);
        }
        return requisitionStep.step;
    }
}