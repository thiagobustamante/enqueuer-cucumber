'use strict';

import { Before, HookScenarioResult } from 'cucumber';
import debug from 'debug';
import * as _ from 'lodash';

import {
    InputPublisherModel, InputRequisitionModel, InputSubscriptionModel,
    OutputRequisitionModel, RequisitionRunner
} from 'enqueuer';
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

    private async executeEnqueuer(requisition: InputRequisitionModel): Promise<Array<OutputRequisitionModel>> {
        this.debugger('Executing requisition <<%s>> in Enqueuer', requisition.name);
        const finalReports = await new RequisitionRunner(requisition).run();
        this.debugger('Report execution for requisition <<%s>>: %J', requisition.name, finalReports);
        return finalReports;
    }

    private buildEnqueuerRequisition(testcase: HookScenarioResult) {
        this.debugger('Building enqueuer requisition for test execution: <<%s>>', testcase.pickle.name);
        this.debugger('Cucumber metadata for test: %J', testcase);
        const requisitionStep = this.enquererData.getRequisitionStep(testcase.pickle.name, true);
        const requisition = this.fromEnqueuerStep(requisitionStep.step as InputRequisitionModel, requisitionStep) as InputRequisitionModel;

        testcase.pickle.steps.forEach(step => {
            const innerRequisition = this.enquererData.getRequisitionStep(step.text);
            let stepMatched = false;
            if (innerRequisition.step) {
                requisition.requisitions.push(this.fromEnqueuerStep(requisition, innerRequisition) as InputRequisitionModel);
                stepMatched = true;
            }
            if (!stepMatched) {
                const publisher = this.enquererData.getPublisherStep(step.text);
                if (publisher.step) {
                    requisition.publishers.push(this.fromEnqueuerStep(requisition, publisher) as InputPublisherModel);
                    stepMatched = true;
                }
            }
            if (!stepMatched) {
                const subscription = this.enquererData.getSubscriptionStep(step.text);
                if (subscription.step) {
                    requisition.subscriptions.push(this.fromEnqueuerStep(requisition, subscription) as InputSubscriptionModel);
                }
            }
        });

        this.debugger('Enqueuer requisition created: %J', requisition);
        return requisition;
    }

    private fromEnqueuerStep(requisition: InputRequisitionModel, requisitionStep: EnqueuerStep) {
        if (requisitionStep.variables) {
            requisition.store = _.merge(requisition.store, requisitionStep.variables);
        }
        return requisitionStep.step;
    }
}