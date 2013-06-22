var _        = require('underscore'),
    deferred = require('deferred'),
    uploader = require('./uploader');

module.exports = function() {
    var self   = this,
        req    = this.opions.req,
        params = _.extend(req.params || {}, req.query || {}, req.body || {}),
        def    = deferred(),
        files  = _.filter(req.files, function(file, attr) {
            file.attr = attr;
            return file.size > 0 && file.name.length > 0;
        });

    /* --- Handle normal params --- */

    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            if (this._schema[key].permitted) {
                index = parseInt(params[key], 10);
                this._attributes[key] = this._schema[key].permitted[index];
            } else if (params[key].length !== 0) {
                // cast type of params[key] depending on schema.type
                // vliadate by data type
                this._attributes[key] = params[key];
            } else {
                this._attributes[key] = this._schema[key].default;
            }
        }
    }

    /* --- Handle file uploads --- */

    deferred.map(files, _.bind(uploader, this))
    (function (result) {
        def.resolve(self);
    }, function(err) {
        def.resolve(err);
    });

    return def.promise;
}