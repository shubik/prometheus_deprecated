Prometheus
==========

Prometheus is a simple ODM for Node.js with adapter for MongoDB (so far) and built-in __form builder__, __form parser__, and __table builder__. Form parser has __uploads handler__ with __image resizer.__

Because of async nature of database calls, Prometheus' model constructor has an internal promise (we use [Deferred](https://github.com/medikoo/deferred) library), which is exposed via attribute `ready`. This promise resolves with model once model is initialized (e.g. a blank model, `var user = new UserModel({})`), or loaded from database (e.g. if you provide a query, `var user = new UserModel({ id: 123 })`). If you're trying to load with a query a model that does not exist, you can know if by checking `model.get() === null` or `model.toJSON() === null`.

## Installation

### NPM

In your project path:

```javascript
$ npm install prometheus
```

## Defining models:

You define model by passing model-specific options to ModelFactory, which returns a model constructor.

### Required params

*   `name` — Friendly name of your model, e.g. `UserModel`
*   `schema` — Description of model attributes

### Optional params

*   `mixins` — An array with mixins that will be applied to constructor's prototype
*   `prototype_methods` — Model-specific methods that will be added to constructor's prototype
*   `static_methods` — Model-specific static methods that will be added to constructor
*   `hooks` — Model-specific hooks (callbacks) that will be called during model lifecycle, e.g. `afterInitialize`, `beforeSave` etc.
*   `permissions` — Object with a list of CRUDT permissions
*   `roles` — Object with functions which check permissions per each role listed in `permissions`

## Defining a model example

```javascript
var prometheus    = require('prometheus'),
    ModelFactory  = prometheus.factory,
    MongodbStore  = prometheus.stores.mongodb,
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
            index: ModelFactory.indexes.UNIQUE
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

Blank model is instantiated by calling a model constructor with a blank query as first argument:

```javascript
var user = new UserModel({}, { req: req });

user.ready(function(model) {
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

Existing model is instantiated with a query as first argument:

```javascript
var user = new UserModel({ email: 'farennikov@gmail.com' }, { req: req });

user.ready(function(model) {
    if (model.toJSON() === null) {
        // model with this email not found - save new
        model.set({ email: 'farennikov@gmail.com' });
    } else {
        var new_name = model.get('name') + ' updated';
        model.set('name', new_name);
    }
    model.save();
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

## Form builder

Each model has built-in method `model.toForm()` which returns an object that you can use to render forms. Below is an example route that uses `toForm()` method to display form for adding a new company:

```javascript
add: function(req, res) {
    var company = new CompanyModel({}, { req: req });

    company.ready(function(model) {

        model.set('auth_token', MD5(_.random(1000000, 9999999) + config.auth.salt));

        var model_form = model.toForm({
            url         : '/rest/company',
            method      : 'POST',
            show_hidden : true
        });

        res.render('admin/company_add', {
            title      : 'Add company',
            model_form : model_form
        });

    }, function(err) {
        res.send(400, err.toString());
    });
}
```

Actual form is rendered using a Jade mixin and Twitter Bootstrap, as follows:

```jade
mixin form_builder(formdata)
  form.form-horizontal.themed(id="#{formdata.tag.id}", name="#{formdata.tag.name}", method="#{formdata.tag.method}", action="#{formdata.tag.action}", enctype="#{formdata.tag.enctype}")
    fieldset
      for field in formdata.fields
        .control-group
          label.control-label #{field.label}
          .controls
            for inp in field.inputs

              if field.type == 'text'
                !{inp}

              if field.type == 'textarea'
                !{inp}

              if field.type == 'select'
                !{inp}

              if field.type == 'checkbox'
                label.checkbox
                  !{inp}

              if field.type == 'radio'
                label.radio
                  !{inp}

              if field.type == 'other'
                !{inp}

      .form-actions
        button.btn.medium.btn-primary(type="submit") Save
```

And this mixin is called from respective view as follows:

```jade
+form_builder(model_form)
```

## Form parser

Each model has built-in method `model.parseForm()` which returns an object that you can use to render forms. Below is an example route that uses `parseForm()` method to add a new company:

```javascript
create: function(req, res) {
    var params  = _.extend(req.params || {}, req.query || {}, req.body || {}),
        company = new CompanyModel({}, { req: req });

    company.ready(function(model) {
        model.parseForm(req)(function(model) {
            model.save()(function(model) {
                res.json(200, model.toJSON());
            }, function(err) {
                res.send(400, err.toString());
            });
        }, function(err) {
            res.send(400, err.toString());
        });
    });
}
```

### Using image resizer

You can optionally resize your image uploads by adding `resize` property to schema attribute, such as in this example:

```javascript
schema: {
    logo: {
        name: 'Company Logo',
        default: null,
        type: ModelFactory.types.STRING,
        content_type: 'image/jpeg, image/png, image/gif',
        resize: ['c100', 's600x600', 's1200x1200']
    }
}
```

Please note, that uploads are saved in store as their public URLs, not as a binary. Therefore in order to save uploads, your model definition needs to have `uploads` attribute, which is an object with two params: `path` and `path_public`, where `path` is path to upload folder on the server, and `path_public` is a path to the upload relative to your domain, e.g.:

```javascript
uploads: {
    path: '/home/ubuntu/myproject/node/public/uploads/',
    path_public: '/uploads/'
}
```

You can generate `path` in your app.js as follows:

```javascript
var uploads = {
    path_public: '/uploads/'
};
uploads.path = __dirname + '/public' + config.uploads.path_public;
```

Uploaded images will be saved in the provided path and will be persisted in the store as public path, e.g. `/uploads/3e192ca4fa8ec546cdb6ef6e2ab55b00.jpg`.

### Image sizes

Image sizes are listed in the `resize` param of the attribute schema and you can add as many size definitions as you want. There are two notations for the image sizes:

*   __Crop:__ `cXXX`, e.g. `c100` which will generate thumbs 100x100px centered in the middle of the original image
*   __Resize:__ `sXXXxYYY`, e.g. `s600x600` which will generate image with either size up to 600px wide or high

All additional sizes are saved using image basename followed with `_{size}.ext`, e.g. `3e192ca4fa8ec546cdb6ef6e2ab55b00_c100.jpg` or `3e192ca4fa8ec546cdb6ef6e2ab55b00_s600x600.jpg`.

Image resizer required [Imagemagick](http://www.imagemagick.org/script/index.php) to be installed on your host.

## Validators

Prometheus does validation by data type as long as you use `type` property in schema item description. But if attribute's value requires more specific validation, you can add a `validate` property to schema item. For example, if you want to know if value is a number Pi (to a certain proximity), you can add a validator:

```javascript
schema: {
    pi: {
        name: 'Pi',
        default: null,
        type: ModelFactory.types.NUMBER,
        validate: function(val) {
            return val / Math.PI > 0.999;
        }
    }
}
```

## Object Pool

In order to helm minimize memory usage by reusing model instances, Prometheus (somewhat) implements [Object Pool Pattern](http://en.wikipedia.org/wiki/Object_pool_pattern), [reusable Obj class](https://gist.github.com/wthit56/5890898). `model_factory.js` has a hash with arrays of model instances by model name. In order to take advantage of OPP, all you have to do is use your model constructor without `new` keyword (e.g. `model = DeviceModel({ id: id }, { req: req });`), and releasing model back to the pool by calling `model.release()` when you don't plan to use this model any more (e.g. after ending request with `res.send()`). Calling `model.release()` marks it as available and resets all initial attributes and event listeners for this model. Next time you attempt to create a model without `new`, `ModelConstructor` will try to find an available model instance of this type, initialize it again and return, or create new one and add to the pool if there are no free instances.

### Cleanup of unused model instances

By default pool of model instances is never clean up. You can initiate cleaning up unused models by calling `reusable.cleanup()` as in the following code:

```javascript
var prometheus   = require('prometheus'),
    reusable     = prometheus.reusable,
    ModelFactory = prometheus.factory;

reusable.cleanup(ModelFactory, 30000); // where last param is interval delay in ms
```

At any time you can stop cleanup of models by running `reusable.stop()`.

## Schema properties

### Required

*   `name` — {String} Friendly name for this attribute, e.g. "UserModel"
*   `default` — {Mixed} Default attribute value, e.g. `null`, `"changeme"`, etc.
*   `type` — {String} Data type from list of constants in ModelFactory.types

### Optional

*   `validate` — {Function} that validates attribute value (see above)
*   `permitted` — {Array} Permitted values
*   `content_type` — {String} Comma separated mime types, default `text/plain`
*   `resize` — {Array} Desired image sizes (see above)
*   `maxlength` — {Number} Number if string has a maximum length
*   `maketag` — {Function} that returns a custom HTML tag for this field
*   `readonly` — {Boolean} True if user is not allowed to change value
*   `sync` — {Boolean} False if should not be synced with store
*   `index` — {String} Type of index, e.g. UNIQUE, FULLTEXT etc.
*   `required` — {Boolean} true if value can not be empty, null or default

## Permissions

Prometheus has model level permissions management. Defining permissions is optional. If permission rules are not defined, all permissions are set to `true`.

### Defining permissions

You can define permissions for models by adding `permissions` and `roles` properties to `model_options` of a model, as in the example below. `permissions` is a hash with key-value pairs, where keys are CRUD operations and values are arrays with user roles, able to perform corresponding operations:

```javascript
permissions: {
    'create'   : ['admin'],
    'read'     : ['admin', 'user', 'guest'],
    'update'   : ['admin', 'user'],
    'destroy'  : ['admin'],
    'transfer' : ['admin']
}
```

Two built-in roles are `app` and `guest`: if you do no pass `req` to the model constructor in the options, we assume that this model is not created within a function handling a route, so it's created elsewhere by the application. At the other hand, if `req` was passed with options, we assume that model is created as a result of HTTP(S) request by a user, who by default is a guest.

`roles` is a hash of functions which return promises resolved with boolean result of permission checks:

```javascript
roles: {
    user: function (model, req) {
        var def = deferred(),
            pass = !!(req && req.session.user);

        def.resolve({ user: pass });
        return def.promise;
    },

    admin: function (model, req) {
        var def = deferred(),
            pass = !!(req && req.session.user && req.session.user.roles.indexOf('admin') !== -1);

        def.resolve({ admin: pass });
        return def.promise;
    }
}
```

Above example adds custom user role checks for `user` and `admin`, where user is anyone with user hash inside `req.session` and `admin` is a user whose roles hash contains "admin".

Please note that all of these functions return a promise — this is important because in Prometheus' internals we use `deferred.map()` to check all permissions. We did this on purpose because some permission checkers may be asyncronous.

### Handling 403 Forbidden situations

If you are using any method on the model that involves CRUD operations, and user's permissions are insufficient to do a certain operation on the model, an error event will fire on the model, which you can handle by subscribing to it where you instantiate the model:

```javascript
var model = new UserModel({ email: 'farennikov@gmail.com' }, { req: req });

model.on('error', function(err) {
    res.send(403, err.toString());
});

model.ready(function(model) {
    model.set('foo', 'bar');
    model.save();
});
```

Above example will send client "403 Forbidden" headers if session user does not have update rights.

## Changelog

### v.0.1.7

*   Changed checking permissions during CRUD ops from event-based to synchronous
*   (this is bad but) Formbuilder has been altered to add Bootstrap 3 classes to form elements

### v.0.1.6

*   Implemented clean up of unused model instances at a set interval
*   Added `PASSWORD` data type. For this type, `toForm()` generates `<input type="password">` tag. This type validates as `STRING`.
*   Fixed MongoDB store `find()` bug that prevented from using queries. Now JSON string queries are parsed to objects.

### v.0.1.5

*   Fixed an issue with EventEmitter being a part of model prototype instead of model instance which caused firing events on all models of the same type
*   Implemented Object Pool Pattern

### v.0.1.4

*   Added typecasting to values parsed by `parseForm`
*   Added optional `required` attribute to schema
*   Added check for `required` attribute, `PRIMARY` and `UNIQUE` indexes in model validator
*   Misc. bug fixes

### v.0.1.3

*   Added ability to create and remove indexes on the store's collections
*   Removed `unique` param from schema; use `index: ModelFactory.indexes.UNIQUE` instead

### v.0.1.2

*   Refactored evt_handlers.js
*   Fixed examples

### v.0.1.1

*   Moved some event handlers in model_factory.js initializer to separate dependencies
*   Changed `model.find()` attributes to accept only `query` and `options`
*   Removed `multiline` param from schema descriptions; use `datatypes.TEXT` instead

### v.0.1.0

*   Instantiating model arguments changed to `query` and `[options]`
*   Model constructor does not return promise any more; it returns self (model)
*   If model is not found with a query, `model.ready` is resolved with `this`, not `null` as in previous versions. This allows you not to have to instantiate a new blank model, but instead reuse existing model instance
*   Added model-level permissions

### v.0.0.3

*   Added setters and getters for model attributes
*   Removed built-in validators
*   Added implicit check for changes in model attributes before update
*   Refactored `destroy()` method

### v.0.0.2

*   Refactored image uploader
*   Added image resizer. Note that image resizer needs __imagemagick__ to be installed.