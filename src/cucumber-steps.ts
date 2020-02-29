'use strict';

import assert = require("assert");
import { Given, StepDefinitionCode, Then, When } from 'cucumber';
import {
    InputPublisherModel, InputRequisitionModel, InputSubscriptionModel,
    OutputPublisherModel, OutputRequisitionModel, OutputSubscriptionModel, OutputTestModel
} from 'enqueuer';
import * as _ from 'lodash';

import debug from 'debug';
import { ReportModel } from "enqueuer/js/models/outputs/report-model";

export class CucumberStepsBuilder {
    private debugger = {
        build: debug('EnqueuerCucumber:Steps:Build'),
        runtime: debug('EnqueuerCucumber:Steps')
    };

    public createGivenStep(requisition: InputRequisitionModel) {
        const self = this;
        this.debugger.build('Creating Given Step for requisition <<%s>>', requisition.name);
        Given(requisition.name, this.createCucumberHook(requisition, function () {
            self.checkRequisitionExecution(this.testReport, requisition);
        }));
    }

    public createWhenStep(publisher: InputPublisherModel) {
        const self = this;
        this.debugger.build('Creating When Step for publisher <<%s>>', publisher.name);
        When(publisher.name, this.createCucumberHook(publisher, function () {
            self.checkPublisherExecution(this.testReport, publisher);
        }));
    }

    public createThenStep(subscription: InputSubscriptionModel) {
        const self = this;
        this.debugger.build('Creating Then Step for subscription <<%s>>', subscription.name);
        Then(subscription.name, this.createCucumberHook(subscription, function () {
            self.checkSubscriptionExecution(this.testReport, subscription);
        }));
    }

    public createGroupStep(group: InputRequisitionModel) {
        const step = this.getCucumberStepFunction(group.step);
        const self = this;
        this.debugger.build('Creating <<%s>> Step for group <<%s>>', group.step, group.name);
        step(group.name, this.createCucumberHook(group, function () {
            if (group.subscriptions) {
                group.subscriptions.forEach(subscription => self.checkSubscriptionExecution(this.testReport, subscription));
            }
            if (group.publishers) {
                group.publishers.forEach(publisher => self.checkPublisherExecution(this.testReport, publisher));
            }
            if (group.requisitions) {
                group.requisitions.forEach(requisition => self.checkRequisitionExecution(this.testReport, requisition));
            }
        }));
    }

    private checkRequisitionExecution(testReport: Array<OutputRequisitionModel>, requisition: InputRequisitionModel) {
        const requisitionReport = this.findRequisitionReport(testReport, requisition.name);
        this.checkTests(requisition, requisitionReport);
    }


    private checkSubscriptionExecution(testReport: Array<OutputRequisitionModel>, subscription: InputSubscriptionModel) {
        const subscriptionReport = this.findSubscriptionReport(testReport, subscription.name);
        this.checkTests(subscription, subscriptionReport);
    }

    private checkPublisherExecution(testReport: Array<OutputRequisitionModel>, publisher: InputPublisherModel) {
        const publisherReport = this.findPublisherReport(testReport, publisher.name);
        this.checkTests(publisher, publisherReport);
    }

    private checkTests(step: InputSubscriptionModel | InputPublisherModel | InputRequisitionModel, testReport: ReportModel) {
        this.debugger.runtime('Enqueuer report for <<%s>>: %J', step.name, testReport);
        if (testReport && testReport.hooks) {
            _.values(testReport.hooks).forEach(hook => {
                hook.tests.forEach((test: OutputTestModel) => {
                    assert(test.valid, test.description);
                });
            });
        }
    }

    private getCucumberStepFunction(name: string) {
        if (name) {
            if (name.toLowerCase() === 'then') {
                return Then;
            }
            if (name.toLowerCase() === 'when') {
                return When;
            }
            if (name.toLowerCase() === 'given') {
                return Given;
            }
        }
        return Then;
    }

    private findSubscriptionReport(requisitions: Array<OutputRequisitionModel>, name: string): OutputSubscriptionModel {
        if (!requisitions) {
            return null;
        }
        let subscriptionReport = null;
        for (const requisition of requisitions) {
            const subscriptions = requisition.subscriptions || [];
            subscriptionReport = subscriptions.find((sub) => name === sub.name);
            if (subscriptionReport) {
                return subscriptionReport;
            }
            subscriptionReport = this.findSubscriptionReport(requisition.requisitions, name);
            if (subscriptionReport) {
                return subscriptionReport;
            }
        }
        return subscriptionReport;
    }

    private findPublisherReport(requisitions: Array<OutputRequisitionModel>, name: string): OutputPublisherModel {
        if (!requisitions) {
            return null;
        }
        let publisherReport = null;
        for (const requisition of requisitions) {
            const publishers = requisition.publishers || [];
            publisherReport = publishers.find((pub) => name === pub.name);
            if (publisherReport) {
                return publisherReport;
            }
            publisherReport = this.findPublisherReport(requisition.requisitions, name);
            if (publisherReport) {
                return publisherReport;
            }
        }
        return publisherReport;
    }

    private findRequisitionReport(requisitions: Array<OutputRequisitionModel>, name: string): OutputRequisitionModel {
        if (!requisitions) {
            return null;
        }
        let requisitionReport = requisitions.find((req) => name === req.name);
        if (!requisitionReport) {
            for (const requisition of requisitions) {
                requisitionReport = this.findRequisitionReport(requisition.requisitions, name);
                if (requisitionReport) {
                    return requisitionReport;
                }
            }
        }
        return requisitionReport;
    }

    private createCucumberHook(step: any, stepDefinition: StepDefinitionCode) {
        const params = (step.variables || []).join(',');
        // tslint:disable-next-line:no-eval
        return eval(`(function(){ return function(${params}) {return stepDefinition.apply(this);}})();`);
    }
}