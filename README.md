Prometheus
==========

Prometheus is a simple ORM for Node.js with adapter for MongoDB.

Because of async nature of database calls, Prometheus' model constructor always returns a promise (we prefer [Deferred](https://github.com/medikoo/deferred) library), not a model. This promise resolves with model once it is created (e.g. for a blank model, `var user = new UserModel()`), or once it is loaded from database (e.g. if you provide model id, `var user = new UserModel(123)`) or `null` if model was not found.

## Defining models:

You define model by passing model-specific options to ModelFactory, which returns a model constructor.

### Required params

*   `name` — Name of your model, e.g. `UserModel`
*   `schema` — Description of model attributes

### Optional params

*   `mixins` — An array with mixins that will be applied to constructor's prototype
*   `prototype_methods` — Model-specific methods that will be added to constructor's prototype
*   `static_methods` — Model-specific static methods that will be added to constructor
*   `hooks` — Model-specific hooks (callbacks) that will be called during model lifecycle, e.g. `afterInitialize`, `beforeSave` etc.

## Defining a model

```javascript
var prometheus    = require('prometheus'),
    ModelFactory  = prometheus.factory,
    MongodbStore  = prometheus.stores.mongodb,
    Validators    = prometheus.validators,
    MD5           = prometheus.MD5,
    UserModel,
    model_options;

model_options = {

    name: 'ExampleModel',

    store: new MongodbStore({
        collection: 'example'
    }),

    schema: {
        name: {
            name: 'Name',
            default: '',
            type: ModelFactory.types.STRING
        },
        email: {
            name: 'Email',
            default: '',
            type: ModelFactory.types.STRING,
            validate: Validators.isEmail,
            unique: true
        },
        password: {
            name: 'Password',
            default: '',
            type: ModelFactory.types.STRING,
            hidden: true
        }
    },

    mixins: [],

    prototype_methods: {},

    static_methods: {
        login: function(req, options) {
            // your login logic
        },

        logout: function(req) {
            // your logout logic
        }
    },

    hooks: {
        beforeSave: function() {
            var password = this.get('password');

            if (password.length !== 32) {
                this.set('password', MD5(password));
            }

            this.set('updated_at', utils.now());
        }
    }
}

UserModel = module.exports = ModelFactory(model_options);
```

## Instantiating models

Blank model is instantiated by calling a model constructor without arguments:

```javascript
var user = new UserModel();

user(function(model) {
    model.set({
        name: 'Shubik',
        email: 'farennikov@gmail.com',
        password: 'password'
    });

    model.save()(function(model) {
        // model successfully saved
    }, function(err) {
        // handle error
    });
}, function(err) {
    // handle error
});
```

Existing model is instantiated with model id as argument:

```javascript
var user = new UserModel(123);

user(function(model) {
    if (model === null) {
        // model with id 123 was not found
    } else {
        var new_name = model.get('name') + ' updated';
        model.set('name', new_name);
        model.save();
    }
}, function(err) {
    // handle error
});
```

Note that if model with such id is not found, promise will resolve with `null`.

## Model API

__Instance methods__

### model.get()

`get(attr)` retrieves an attribute of the model, or an entire model if attribute name is not provided.

### model.set()

`set(attr, [value])` sssigns new value to an attribute or a number of attributes of the model. If given only 1 param which is an Object, method will use keys of the object as attributes.

### model.save()

`save()` saves a new model or model that has been changed by `set()`. Returns a promise which is resolved with model if model was successfully saved or error if saving model failed. If model was initialized without an id, new model will be attempted to be created.

### model.destroy()

`destroy()` deletes model from a store. Returns a promise which is resolved with this model once model is deleted from database.

### model.keys()

`keys()` returns attribute names of this model.

### model.toJSON()

`toJSON()` returns all attributes of the model (key-value pairs).

### model.validate()

`validate()` validates model attributes according to the model's schema. Returns true or false.

### model.toForm()

`toForm()` returns an object that can be used to create HTML form for this model.

### model.parseForm()

`parseForm(req)` populates a model by values from a request.

### model.toTable()

`toTable()` returns an object that can be used to show this model in table form.

You can add model-specific instance methods by adding them to `prototype_methods` param of the options you pass to `ModelFactory`.

__Static methods__

Model constructors can have static methods which you can use without instantiating a model. By default there are two static methods: `find()` and `count()`:

### SomeModel.find()

`find(query, offset, limit, sort)` returns a promise which is resolved with an array of models found in database using provided arguments. Example:

```javascript
UserModel.find({ name: 'Shubik' })(function(results) {
    // do somethig with `results`
});
```

### SomeModel.count()

`count()` returns a promise which is resolved with number of all models in the database. Example:

```javascript
UserModel.count()(function(num) {
    // do somethig with `num`
});
```

You can add more model-specific static methods to `static_methods` param of the options you pass to `ModelFactory`.