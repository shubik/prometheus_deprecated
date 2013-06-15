var UserModel = require('./_user_model'),
    user = new UserModel({});

user.ready(function(model) {

    console.log('user created');

    model.set({
        name: 'Shubik',
        email: 'farennikov@gmail.com'
    });

    model.save()(function(model) {
        console.log('New user model saved', model.toJSON());
    }, function(err) {
        console.log('Error saving new user', err.toString());
    });
}, function(err) {
    console.log('Error creating new user', err.toString());
});