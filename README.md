Heraclitus
==========

Heraclitus is a simple ORM for Node.js with adapter for MongoDB.

## Defining models:

You define model by passing model-specific options to ModelFactory, which returns a model constructor.

### Required params:

*   __name__ Name of your model, e.g. `UserModel`
*   __schema__ Description of model attributes

### Optional params:

*   __mixins__ An array with mixins that will be applied to constructor's prototype
*   __prototype_methods__ Model-specific methods that will be added to constructor's prototype
*   __static_methods__ Model-specific static methods that will be added to constructor
*   __hooks__ Model-specific hooks (callbacks) that will be called during model lifecycle, e.g. `afterInitialize`, `beforeSave` etc.