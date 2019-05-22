'use strict';

import * as assert from 'assert';
import { Before, Given, HookScenarioResult } from 'cucumber';
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

    private buildSteps() {
        this.requisitionsCache.forEach(requisition => {
            Given(requisition.name, function () {
                const requisitionReport = this.testReport.requisitions.find(
                    (req: RequisitionModel) => req.name === requisition.name
                );
                if (requisitionReport.tests) {
                    requisitionReport.tests.forEach((test: RequisitionModel) => {
                        assert(test.valid, test.description);
                    });
                }
            });
        });
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

        testcase.pickle.steps.forEach(step => {
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