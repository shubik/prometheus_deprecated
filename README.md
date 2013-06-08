Prometheus
==========

Prometheus is a simple ORM for Node.js with adapter for MongoDB and built-in form builder, form parser, and table builder. Form parser has uploads handler with image resizer.

Because of async nature of database calls, Prometheus' model constructor always returns a promise (we prefer [Deferred](https://github.com/medikoo/deferred) library), not a model. This promise resolves with model once it is created (e.g. for a blank model, `var user = new UserModel()`), or once it is loaded from database (e.g. if you provide model id, `var user = new UserModel(123)`) or `null` if model was not found.

## Installation

### NPM

In your project path:

```javascript
$ npm install prometheus
```

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

## Form builder

Each model has built-in method `model.toForm()` which returns an object that you can use to render forms. Below is an example route that uses `toForm()` method to display form for adding a new company:

```javascript
add: function(req, res) {
    var company = new CompanyModel();

    company(function(model) {

        model.set('auth_token', MD5(_.random(99999999, 999999999) + config.auth.salt));

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
        company = new CompanyModel();

    company(function(model) {
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

## Changelog

### v.0.0.2

*   Refactored image uploader
*   Added image resizer. Note that image resizer needs __imagemagick__ to be installed.