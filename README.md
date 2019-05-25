# Enqueuer Cucumber Integration

## Instalation: 

Install [cucumber-js](https://cucumber.io/docs/guides/10-minute-tutorial/) and [enqueuer](www.enqueuer.com).

Install EnqueuerCucumber integration plugin:

```sh
npm i -D enqueuer-cucumber
```

## Usage: 

Then create a Cucumber Step Definition that load its steps from Enqueuer, like:

```javascript
const { EnqueuerStepDefinitions } = require('enqueuer-cucumber');
const path = require('path');
const enqueuerFiles = path.join(__dirname, './enqueuer/*.yaml');

new EnqueuerStepDefinitions()
    .addFile(enqueuerFiles)
    .addPlugin('enqueuer-plugin-amqp')
    .build();
```
In the above example, we are saying to EnqueuerCucumber plugin to load its steps according to the expression ```./enqueuer/*.yaml```.

Then, lets create some test scenarios with cucumber:

```
Feature: Tickets issuing for my Tickets Service

  Scenario: Issue a ticket for a given order
    Given I have an order to buy a ticket for a desired event
    When I receive a payment notification for that order
    Then I should call the issuing API
    And I uptade the order with the tickets
```

Then, we can write our step definitions with enqueuer:

```yaml
requisitions:
- name: I have an order to buy a ticket for a desired event
  onInit:
      store:
          orderId: order123
- publishers:
  -   name: I receive a payment notification for that order
      type: amqp
      payload: 
          orderId: `<<orderId>>`
      routingKey: orderchange.payments

  subscriptions:
  -   type: http
      name: I should call the issuing API
      endpoint: /my-issuing-endpoint
      port: 9085
      method: POST
      response:
          status: 200
          payload: 
              tickets:
                  - `<<ticketNumner>>`
      onMessageReceived:
          assertions:
          -   expect: params.orderId
              toBeEqualTo: `<<orderId>>`
  -   type: http
      name: I uptade the order with the tickets
      endpoint: /orders/:orderId/tickets
      port: 9085
      method: POST
      response:
          status: 204
      onMessageReceived:
          assertions:
          -   expect: JSON.parse(body).tickets[0]
              toBeEqualTo: `<<ticketNumner>>`

```

We just need to ensure that the we use the same names for the steps and enqueuer definitions.

If we want to create parameterized steps, we can follow the same rules applicable to cucumber JS.

For example, if we want to modify the previous example to customize some values used in the tests, we could rewrite it as:

```
Feature: Tickets issuing for my Tickets Service

  Scenario Template: Issue a ticket for a given order
    Given I have the order "<orderId>" to buy a ticket for a desired event
    When I receive a payment notification for the order "<orderId>"
    Then I should generate the ticket "<ticketNumber>" for the order "<orderId>"
    And I uptade the order "<orderId>" with the ticket "<ticketNumber>" 

    Examples:
        | orderId | ticketNumber |
        |    order1 |   TKT001 | 
        |    order2 |   TKT002 | 
        |    order3 |   TKT003 | 
```

Then, we can write our step definitions with enqueuer:

```yaml
requisitions:
- name: I have the order {string} to buy a ticket for a desired event
  variables:
    - orderId
- publishers:
  -   name: I receive a payment notification for the order {string}
      variables:
        - orderId
      type: amqp
      payload: 
          orderId: `<<orderId>>`
      routingKey: orderchange.payments

  subscriptions:
  -   type: http
      name: I should generate the ticket {string} for the order {string}
      variables:
        - ticketNumber
        - orderId
      endpoint: /my-issuing-endpoint
      port: 9085
      method: POST
      response:
          status: 200
          payload: 
              tickets:
                  - `<<ticketNumner>>`
      onMessageReceived:
          assertions:
          -   expect: params.orderId
              toBeEqualTo: `<<orderId>>`
  -   type: http
      name: And I uptade the order {string} with the ticket {string}
      variables:
        - orderId
        - ticketNumber
      endpoint: /orders/:orderId/tickets
      port: 9085
      method: POST
      response:
          status: 204
      onMessageReceived:
          assertions:
          -   expect: JSON.parse(body).tickets[0]
              toBeEqualTo: `<<ticketNumner>>`

```