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
import { RequisitionFilePatternParser } from 'enqueuer/js/requisition-runners/requisition-file-pattern-parser';
import { RequisitionRunner } from 'enqueuer/js/requisition-runners/requisition-runner';
import { CucumberStepsBuilder } from './cucumber-steps';

debug.formatters.J = (v) => {
    return JSON.stringify(v, null, 2);
};

export class EnqueuerStepDefinitions {
    private requisitionsCache: Map<string, RequisitionModel>;
    private publishersCache: Map<string, PublisherModel>;
    private subscriptionsCache: Map<string, SubscriptionModel>;
    private requisitionFileParser: RequisitionFilePatternParser;
    private cucumberStepsBuilder: CucumberStepsBuilder;
    private debugger = {
        build: debug('EnqueuerCucumber:Build'),
        runtime: debug('EnqueuerCucumber:Runtime')
    };

    constructor() {
        this.requisitionsCache = new Map<string, RequisitionModel>();
        this.publishersCache = new Map<string, PublisherModel>();
        this.subscriptionsCache = new Map<string, SubscriptionModel>();
        this.cucumberStepsBuilder = new CucumberStepsBuilder();
    }

    public build() {
        this.debugger.build('Starting EnqueuerStepDefinitions plugin');
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
        this.requisitionsCache.forEach(requisition => {
            this.cucumberStepsBuilder.createGivenStep(requisition);
        });
        this.publishersCache.forEach(publisher => {
            this.cucumberStepsBuilder.createWhenStep(publisher);
        });
        this.subscriptionsCache.forEach(subscription => {
            this.cucumberStepsBuilder.createThenStep(subscription);
        });
    }

    private async executeEnqueuer(requisition: RequisitionModel) {
        this.debugger.runtime('Executing requisition <<%s>> in Enqueuer', requisition.name);
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

        this.debugger.runtime('Report execution for requisition <<%s>>: %J', requisition.name, finalReports);
        return finalReports;
    }

    private buildEnqueuerRequisition(testcase: HookScenarioResult) {
        this.debugger.runtime('Building enqueuer requisition for test execution: <<%s>>', testcase.pickle.name);
        this.debugger.runtime('Cucumber metadata for test: %J', testcase);
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

        this.debugger.runtime('Enqueuer requisition created: %J', requisition);
        return requisition;
    }

    private initEnqueuer() {
        this.debugger.build('Initializing enqueuer');
        const configuration = Configuration.getInstance();
        this.requisitionFileParser = new RequisitionFilePatternParser(configuration.getFiles());
        const enqueuerRequisitions = this.requisitionFileParser.parse();
        this.debugger.build('Enqueuer Requisitions loaded: %J', enqueuerRequisitions);
        this.buildRequisitionsCache(enqueuerRequisitions);
    }

    private buildRequisitionsCache(requisitions: Array<RequisitionModel>) {
        this.debugger.build('Building cache for enqueuer requisitions');
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
        if (this.debugger.build.enabled) {
            this.debugger.build('Requisitions cache ready: %J', Array.from(this.requisitionsCache.keys()));
            this.debugger.build('Publishers cache ready: %J', Array.from(this.publishersCache.keys()));
            this.debugger.build('Subscriptions cache ready: %J', Array.from(this.subscriptionsCache.keys()));
        }
    }
}