Heraclitus
==========

Heraclitus is a simple ORM for Node.js with adapter for MongoDB.

Because of async nature of database calls, Heraclitus' model constructor always returns a promise (we prefer __[Deferred](https://github.com/medikoo/deferred)__ library), not a model. This promise resolves with model once it is created (e.g. for a blank model, `var user = new UserModel()`), or once it is loaded from database (e.g. if you provide model id, `var user = new UserModel(123)`) or `null` if model was not found.

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
var heraclitus    = require('heraclitus'),
    ModelFactory  = heraclitus.factory,
    MongodbStore  = heraclitus.stores.mongodb,
    Validators    = heraclitus.validators,
    MD5           = heraclitus.MD5,
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
var user = UserModel();

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
var user = UserModel(123);

user(function(model) {
    var new_name = model.get('name') + ' updated';
    model.set('name', new_name);
    model.save();
}, function(err) {
    // handle error
});
```

Note that if model with such id is not found, promise will resolve with `null`.