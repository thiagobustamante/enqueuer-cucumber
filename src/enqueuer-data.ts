'use strict';

import debug from 'debug';
import * as _ from 'lodash';

import { Configuration } from 'enqueuer/js/configurations/configuration';
import { PublisherModel } from 'enqueuer/js/models/inputs/publisher-model';
import { RequisitionModel } from 'enqueuer/js/models/inputs/requisition-model';
import { SubscriptionModel } from 'enqueuer/js/models/inputs/subscription-model';
import { RequisitionFilePatternParser } from 'enqueuer/js/requisition-runners/requisition-file-pattern-parser';
import { CucumberMatcher } from './cucumber-expressions';

export interface EnqueuerStep {
    step?: RequisitionModel | SubscriptionModel | PublisherModel;
    variables?: { [key: string]: any };
}

export class EnqueuerData {
    private requisitionsCache: Map<string, RequisitionModel>;
    private publishersCache: Map<string, PublisherModel>;
    private subscriptionsCache: Map<string, SubscriptionModel>;
    private requisitionFileParser: RequisitionFilePatternParser;
    private cucumberMatcher: CucumberMatcher;
    private debugger = {
        build: debug('EnqueuerCucumber:EnqueuerData:Build'),
        runtime: debug('EnqueuerCucumber:EnqueuerData')
    };

    constructor() {
        this.requisitionsCache = new Map<string, RequisitionModel>();
        this.publishersCache = new Map<string, PublisherModel>();
        this.subscriptionsCache = new Map<string, SubscriptionModel>();
        this.cucumberMatcher = new CucumberMatcher();
    }

    public initEnqueuer() {
        this.debugger.build('Initializing enqueuer');
        const configuration = Configuration.getInstance();
        this.requisitionFileParser = new RequisitionFilePatternParser(configuration.getFiles());
        const enqueuerRequisitions = this.requisitionFileParser.parse();
        this.debugger.build('Enqueuer Requisitions loaded: %J', enqueuerRequisitions);
        this.debugger.build('Building cache for enqueuer requisitions');
        this.buildRequisitionsCache(enqueuerRequisitions);
        if (this.debugger.build.enabled) {
            this.debugger.build('Requisitions cache ready: %J', Array.from(this.requisitionsCache.keys()));
            this.debugger.build('Publishers cache ready: %J', Array.from(this.publishersCache.keys()));
            this.debugger.build('Subscriptions cache ready: %J', Array.from(this.subscriptionsCache.keys()));
        }
    }

    public getParsingErrors() {
        return this.requisitionFileParser.getFilesErrors();
    }

    public getRequisitions() {
        return Array.from(this.requisitionsCache.values());
    }

    public getRequisitionNames() {
        return Array.from(this.requisitionsCache.keys());
    }

    public getPublishers() {
        return Array.from(this.publishersCache.values());
    }

    public getPublisherNames() {
        return Array.from(this.publishersCache.keys());
    }

    public getSubscriptions() {
        return Array.from(this.subscriptionsCache.values());
    }

    public getSubscriptionNames() {
        return Array.from(this.subscriptionsCache.keys());
    }

    public getRequisitionStep(name: string, createIfNotExist?: boolean) {
        this.debugger.runtime('Searching for a matching requisition step for <<%s>>', name);
        const result: EnqueuerStep = {};
        result.step = this.cloneStep(this.requisitionsCache.get(name));
        if (!result.step) {
            for (const reqName of this.getRequisitionNames()) {
                const values: Array<string> = this.cucumberMatcher.match(reqName, name);
                if (values && values.length) {
                    const requisition = this.requisitionsCache.get(reqName);
                    if (requisition.variables && requisition.variables.length >= values.length) {
                        result.step = _.chain(requisition)
                            .omit('publishers', 'subscriptions', 'requisitions')
                            .clone()
                            .value() as RequisitionModel;
                        this.mergeStepVariables(result, values);
                    }
                }
            }
        }
        if (result.step) {
            result.step.publishers = [];
            result.step.subscriptions = [];
            result.step.requisitions = [];
        } else if (createIfNotExist) {
            result.step = this.getDefaultRequisition(name);
        }
        if (result.step) {
            this.debugger.runtime('Requisition Step for <<%s>>: %J', name, result);
        }
        return result;
    }

    public getPublisherStep(name: string) {
        this.debugger.runtime('Searching for a matching publisher step for <<%s>>', name);
        const result: EnqueuerStep = {};
        result.step = this.cloneStep(this.publishersCache.get(name));
        if (!result.step) {
            for (const pubName of this.getPublisherNames()) {
                const values: Array<string> = this.cucumberMatcher.match(pubName, name);
                if (values && values.length) {
                    const publisher = this.publishersCache.get(pubName);
                    if (publisher.variables && publisher.variables.length >= values.length) {
                        result.step = _.clone(publisher);
                        this.mergeStepVariables(result, values);
                    }
                }
            }
        }
        if (result.step) {
            this.debugger.runtime('Publisher Step for <<%s>>: %J', name, result);
        }
        return result;
    }

    public getSubscriptionStep(name: string) {
        this.debugger.runtime('Searching for a matching subscription step for <<%s>>', name);
        const result: EnqueuerStep = {};
        result.step = this.cloneStep(this.subscriptionsCache.get(name));
        if (!result.step) {
            for (const subName of this.getSubscriptionNames()) {
                const values: Array<string> = this.cucumberMatcher.match(subName, name);
                if (values && values.length) {
                    const subscription = this.subscriptionsCache.get(subName);
                    if (subscription.variables && subscription.variables.length >= values.length) {
                        result.step = _.clone(subscription);
                        this.mergeStepVariables(result, values);
                    }
                }
            }
        }
        if (result.step) {
            this.debugger.runtime('Subscription Step for <<%s>>: %J', name, result);
        }
        return result;
    }

    private getDefaultRequisition(name: string): any {
        return {
            name: name,
            publishers: [],
            requisitions: [],
            subscriptions: []
        };
    }

    private mergeStepVariables(result: EnqueuerStep, values: Array<string>) {
        result.variables = {};
        values.forEach((value, index) => {
            result.variables[result.step.variables[index]] = value;
        });
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

    private cloneStep(step: RequisitionModel | SubscriptionModel | PublisherModel) {
        if (step) {
            return _.clone(step);
        }
        return null;
    }
}