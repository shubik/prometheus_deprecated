var types = ['create', 'read', 'update', 'destroy', 'transfer'];

module.exports = function(ctx, allowed) {
    _.each(types, function(action) {
        action = String(action);

        var evt = 'crud:' + action,
            str = 'You are not allowed to ' + action.toUpperCase() + ' this object';

        ctx.on(evt, function() {
            if (!allowed[evt]) {
                ctx.emit('forbidden', new Error(str));
            }
        });
    });
}