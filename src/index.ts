'use strict';

import * as assert from 'assert';
import { Before, Given, HookScenarioResult, Then, When } from 'cucumber';
import * as _ from 'lodash';

import { RequisitionAdopter } from 'enqueuer/js/components/requisition-adopter';
import { Configuration } from 'enqueuer/js/configurations/configuration';
import { PublisherModel } from 'enqueuer/js/models/inputs/publisher-model';
import { RequisitionModel } from 'enqueuer/js/models/inputs/requisition-model';
import { SubscriptionModel } from 'enqueuer/js/models/inputs/subscription-model';
import { reportModelIsPassing } from 'enqueuer/js/models/outputs/report-model';
import { RequisitionFilePatternParser } from 'enqueuer/js/requisition-runners/requisition-file-pattern-parser';
import { RequisitionRunner } from 'enqueuer/js/requisition-runners/requisition-runner';

export class EnqueuerStepDefinitions {
    private requisitionsCache: Map<string, RequisitionModel>;
    private publishersCache: Map<string, PublisherModel>;
    private subscriptionsCache: Map<string, SubscriptionModel>;
    private requisitionFileParser: RequisitionFilePatternParser;

    constructor() {
        this.requisitionsCache = new Map<string, RequisitionModel>();
        this.publishersCache = new Map<string, PublisherModel>();
        this.subscriptionsCache = new Map<string, SubscriptionModel>();
    }

    public build() {
        this.initEnqueuer();
        const self: EnqueuerStepDefinitions = this;
        Before(async function (testcase: HookScenarioResult) {
            const requisition = self.buildEnqueuerRequisition(testcase);
            if (requisition) {
                this.testReport = await self.executeEnqueuer(requisition);
            }
        });
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

    private buildSteps() {
        this.buildRequisitionSteps();
        this.buildSubscriptionsSteps();
        this.buildPublishersSteps();
    }

    private buildRequisitionSteps() {
        this.requisitionsCache.forEach(requisition => {
            const self = this;
            Given(requisition.name, function () {
                const requisitionReport = self.findRequisitionReport(this.testReport, requisition.name);
                if (requisitionReport.tests) {
                    requisitionReport.tests.forEach((test: RequisitionModel) => {
                        assert(test.valid, test.description);
                    });
                }
            });
        });
    }

    private buildPublishersSteps() {
        this.publishersCache.forEach(publisher => {
            const self = this;
            When(publisher.name, function () {
                const publisherReport = self.findPublisherReport(this.testReport, publisher.name);
                if (publisherReport.tests) {
                    publisherReport.tests.forEach((test: RequisitionModel) => {
                        assert(test.valid, test.description);
                    });
                }
            });
        });
    }

    private buildSubscriptionsSteps() {
        this.subscriptionsCache.forEach(subscription => {
            const self = this;
            Then(subscription.name, function () {
                const subscriptionReport = self.findSubscriptionReport(this.testReport, subscription.name);
                if (subscriptionReport.tests) {
                    subscriptionReport.tests.forEach((test: RequisitionModel) => {
                        assert(test.valid, test.description);
                    });
                }
            });
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

    private async executeEnqueuer(requisition: RequisitionModel) {
        const configuration = Configuration.getInstance();
        const enqueuerRequisition = new RequisitionAdopter(
            {
                name: 'enqueuer',
                parallel: configuration.isParallel(),
                requisitions: [requisition],
                timeout: -1
            }).getRequisition();
        const parsingErrors = this.requisitionFileParser.getFilesErrors();
        const finalReports = await new RequisitionRunner(enqueuerRequisition, 0).run();

        finalReports.forEach(report => {
            report.tests = parsingErrors;
            report.valid = report.valid && reportModelIsPassing(report);
        });

        return finalReports;
    }

    private buildEnqueuerRequisition(testcase: HookScenarioResult) {
        const enqueuerRequisition = this.requisitionsCache.get(testcase.pickle.name);
        let requisition: any;
        if (enqueuerRequisition) {
            requisition = _.chain(enqueuerRequisition).omit('publishers', 'subscriptions').clone().value();
        } else {
            requisition = {
                name: testcase.pickle.name
            };
        }
        requisition.publishers = [];
        requisition.subscriptions = [];
        requisition.requisitions = [];

        testcase.pickle.steps.forEach(step => {
            if (this.requisitionsCache.has(step.text)) {
                const innerRequisition = this.requisitionsCache.get(step.text);
                requisition.requisitions.push(_.chain(innerRequisition).omit('publishers', 'subscriptions').clone().value());
            }
            if (this.publishersCache.has(step.text)) {
                requisition.publishers.push(_.clone(this.publishersCache.get(step.text)));
            }
            if (this.subscriptionsCache.has(step.text)) {
                requisition.subscriptions.push(_.clone(this.subscriptionsCache.get(step.text)));
            }
        });

        return requisition;
    }

    private initEnqueuer() {
        const configuration = Configuration.getInstance();
        this.requisitionFileParser = new RequisitionFilePatternParser(configuration.getFiles());
        const enqueuerRequisitions = this.requisitionFileParser.parse();
        this.buildRequisitionsCache(enqueuerRequisitions);
    }

    private buildRequisitionsCache(requisitions: Array<RequisitionModel>) {
        requisitions.forEach(requisition => {
            this.requisitionsCache.set(requisition.name, requisition);
            if (requisition.publishers) {
                requisition.publishers.forEach(publisher => {
                    this.publishersCache.set(publisher.name, publisher);
                });
            }
            if (requisition.subscriptions) {
                requisition.subscriptions.forEach(subscription => {
                    this.subscriptionsCache.set(subscription.name, subscription);
                });
            }
            if (requisition.requisitions) {
                this.buildRequisitionsCache(requisition.requisitions);
            }
        });
    }
}