'use strict';

import assert = require("assert");
import { Given, StepDefinitionCode, Then, When } from 'cucumber';
import {
    InputPublisherModel, InputRequisitionModel, InputSubscriptionModel,
    OutputPublisherModel, OutputRequisitionModel, OutputSubscriptionModel, OutputTestModel
} from 'enqueuer';

import debug from 'debug';

export class CucumberStepsBuilder {
    private debugger = {
        build: debug('EnqueuerCucumber:Steps:Build'),
        runtime: debug('EnqueuerCucumber:Steps')
    };

    public createGivenStep(requisition: InputRequisitionModel) {
        const self = this;
        this.debugger.build('Creating Given Step for requisition <<%s>>', requisition.name);
        Given(requisition.name, this.createCucumberHook(requisition, function () {
            const requisitionReport = self.findRequisitionReport(this.testReport, requisition.name);
            self.debugger.runtime('Enqueuer report for <<%s>>: %J', requisition.name, requisitionReport);
            if (requisitionReport.tests) {
                requisitionReport.tests.forEach((test: OutputTestModel) => {
                    assert(test.valid, test.description);
                });
            }
        }));
    }

    public createWhenStep(publisher: InputPublisherModel) {
        const self = this;
        this.debugger.build('Creating When Step for publisher <<%s>>', publisher.name);
        When(publisher.name, this.createCucumberHook(publisher, function () {
            const publisherReport = self.findPublisherReport(this.testReport, publisher.name);
            self.debugger.runtime('Enqueuer report for <<%s>>: %J', publisher.name, publisherReport);
            if (publisherReport.tests) {
                publisherReport.tests.forEach((test: OutputTestModel) => {
                    assert(test.valid, test.description);
                });
            }
        }));
    }

    public createThenStep(subscription: InputSubscriptionModel) {
        const self = this;
        this.debugger.build('Creating Then Step for subscription <<%s>>', subscription.name);
        Then(subscription.name, this.createCucumberHook(subscription, function () {
            const subscriptionReport = self.findSubscriptionReport(this.testReport, subscription.name);
            self.debugger.runtime('Enqueuer report for <<%s>>: %J', subscription.name, subscriptionReport);
            if (subscriptionReport.tests) {
                subscriptionReport.tests.forEach((test: OutputTestModel) => {
                    assert(test.valid, test.description);
                });
            }
        }));
    }

    private findSubscriptionReport(requisitions: Array<OutputRequisitionModel>, name: string): OutputSubscriptionModel {
        if (!requisitions) {
            return null;
        }
        let subscriptionReport = null;
        for (const requisition of requisitions) {
            subscriptionReport = requisition.subscriptions.find((sub) => name === sub.name);
            if (!subscriptionReport) {
                subscriptionReport = this.findSubscriptionReport(requisition.requisitions, name);
                if (subscriptionReport) {
                    return subscriptionReport;
                }
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
            publisherReport = requisition.publishers.find((pub) => name === pub.name);
            if (!publisherReport) {
                publisherReport = this.findPublisherReport(requisition.requisitions, name);
                if (publisherReport) {
                    return publisherReport;
                }
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