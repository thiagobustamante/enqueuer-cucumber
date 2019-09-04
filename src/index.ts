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

const MAIN_REQUISITION = 'Cucumber_Main_requisition';
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
        this.enquererData.getGroups().forEach(group => {
            this.cucumberStepsBuilder.createGroupStep(group);
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
        let requisition = this.fromEnqueuerStep(requisitionStep.step as InputRequisitionModel, requisitionStep) as InputRequisitionModel;
        requisition = _.defaultsDeep(requisition, { onInit: { store: {} } });

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
                    const mainRequisition = this.getMainRequisition(requisition);
                    mainRequisition.publishers.push(this.fromEnqueuerStep(requisition, publisher) as InputPublisherModel);
                    stepMatched = true;
                }
            }
            if (!stepMatched) {
                const subscription = this.enquererData.getSubscriptionStep(step.text);
                if (subscription.step) {
                    const mainRequisition = this.getMainRequisition(requisition);
                    mainRequisition.subscriptions.push(this.fromEnqueuerStep(requisition, subscription) as InputSubscriptionModel);
                    stepMatched = true;
                }
            }
            if (!stepMatched) {
                this.buildEnqueuerGroup(requisition, step.text);
            }
        });

        this.debugger('Enqueuer requisition created: %J', requisition);
        return requisition;
    }

    private buildEnqueuerGroup(requisition: InputRequisitionModel, name: string) {
        const group = this.enquererData.getGroupStep(name);
        if (group.step) {
            this.processEnqueuerGroup(requisition, group);
        }
    }

    private processEnqueuerGroup(requisition: InputRequisitionModel, group: EnqueuerStep) {
        const req = this.fromEnqueuerStep(requisition, group) as InputRequisitionModel;
        const mainRequisition = this.getMainRequisition(requisition);
        if (req.requisitions) {
            req.requisitions.forEach(r => requisition.requisitions.push(r));
        }
        if (req.publishers) {
            req.publishers.forEach(p => mainRequisition.publishers.push(p));
        }
        if (req.subscriptions) {
            req.subscriptions.forEach(s => mainRequisition.subscriptions.push(s));
        }
        if (req.useGroup) {
            _.castArray(req.useGroup).forEach(usegroup => {
                this.buildEnqueuerGroup(requisition, usegroup);
            });
        }
        this.applyGroupTimeout(req);
    }

    private applyGroupTimeout(group: InputRequisitionModel) {
        if (group.timeout) {
            if (group.requisitions) {
                group.requisitions.forEach(r => r.timeout = group.timeout);
            }
            if (group.publishers) {
                group.publishers.forEach(p => p.timeout = group.timeout);
            }
            if (group.subscriptions) {
                group.subscriptions.forEach(s => s.timeout = group.timeout);
            }
        }
    }

    private fromEnqueuerStep(requisition: InputRequisitionModel, requisitionStep: EnqueuerStep) {
        if (requisitionStep.variables) {
            requisition.onInit.store = _.merge(requisition.onInit.store, requisitionStep.variables);
        }
        return requisitionStep.step;
    }

    private getMainRequisition(requisition: InputRequisitionModel) {
        let mainRequisition = requisition.requisitions.find(req => req.name === MAIN_REQUISITION);
        if (!mainRequisition) {
            mainRequisition = this.enquererData.getDefaultRequisition(MAIN_REQUISITION);
            if (requisition.timeout) {
                mainRequisition.timeout = requisition.timeout;
            }
            requisition.requisitions.push(mainRequisition);
        }

        return mainRequisition;
    }
}