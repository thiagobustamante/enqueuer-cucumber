'use strict';

const { CucumberExpression, ParameterTypeRegistry } = require('cucumber-expressions');

export class CucumberMatcher {
    public match(expression: string, text: string) {
        const cucumberExpression = new CucumberExpression(
            expression,
            new ParameterTypeRegistry()
        );
        const args = cucumberExpression.match(text);
        if (!args) {
            return null;
        }
        return args.map((arg: any) => arg.getValue(null));
    }

    public matches(expression: string, text: string) {
        const values = this.match(expression, text);
        return (values && values.length);
    }
}