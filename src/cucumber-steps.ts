'use strict';

import assert = require("assert");
import { Given, Then, When } from "cucumber";
import { PublisherModel } from 'enqueuer/js/models/inputs/publisher-model';
import { RequisitionModel } from 'enqueuer/js/models/inputs/requisition-model';
import { SubscriptionModel } from 'enqueuer/js/models/inputs/subscription-model';

export class CucumberStepsBuilder {
    public createGivenStep(requisition: RequisitionModel) {
        const self = this;
        Given(requisition.name, function () {
            const requisitionReport = self.findRequisitionReport(this.testReport, requisition.name);
            if (requisitionReport.tests) {
                requisitionReport.tests.forEach((test: RequisitionModel) => {
                    assert(test.valid, test.description);
                });
            }
        });
    }

    public createWhenStep(publisher: PublisherModel) {
        const self = this;
        When(publisher.name, function () {
            const publisherReport = self.findPublisherReport(this.testReport, publisher.name);
            if (publisherReport.tests) {
                publisherReport.tests.forEach((test: RequisitionModel) => {
                    assert(test.valid, test.description);
                });
            }
        });
    }

    public createThenStep(subscription: SubscriptionModel) {
        const self = this;
        Then(subscription.name, function () {
            const subscriptionReport = self.findSubscriptionReport(this.testReport, subscription.name);
            if (subscriptionReport.tests) {
                subscriptionReport.tests.forEach((test: RequisitionModel) => {
                    assert(test.valid, test.description);
                });
            }
        });
    }

    private findSubscriptionReport(requisitions: Array<RequisitionModel>, name: string): SubscriptionModel {
        if (!requisitions) {
            return null;
        }
        let subscriptionReport = null;
        for (const requisition of requisitions) {
            subscriptionReport = requisition.subscriptions.find((sub: SubscriptionModel) => sub.name === name);
            if (!subscriptionReport) {
                subscriptionReport = this.findSubscriptionReport(requisition.requisitions, name);
                if (subscriptionReport) {
                    return subscriptionReport;
                }
            }
        }
        return subscriptionReport;
    }

    private findPublisherReport(requisitions: Array<RequisitionModel>, name: string): PublisherModel {
        if (!requisitions) {
            return null;
        }
        let publisherReport = null;
        for (const requisition of requisitions) {
            publisherReport = requisition.publishers.find((sub: PublisherModel) => sub.name === name);
            if (!publisherReport) {
                publisherReport = this.findPublisherReport(requisition.requisitions, name);
                if (publisherReport) {
                    return publisherReport;
                }
            }
        }
        return publisherReport;
    }

    private findRequisitionReport(requisitions: Array<RequisitionModel>, name: string): RequisitionModel {
        if (!requisitions) {
            return null;
        }
        let requisitionReport = requisitions.find((req: RequisitionModel) => req.name === name);
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
}