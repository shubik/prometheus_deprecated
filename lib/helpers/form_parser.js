var _         = require('underscore'),
    deferred  = require('deferred'),
    uploader  = require('./uploader'),
    datatypes = require('../includes/datatypes');

module.exports = function() {
    var self   = this,
        req    = this.options.req,
        params = _.extend(req.params || {}, req.query || {}, req.body || {}),
        def    = deferred(),
        files  = _.filter(req.files, function(file, attr) {
            file.attr = attr;
            return file.size > 0 && file.name.length > 0;
        });

    /* --- Handle normal params --- */

    for (var key in params) {
        if (params.hasOwnProperty(key) && this._schema[key]) {
            if (this._schema[key].permitted) {

                index = parseInt(params[key], 10);

                switch(this._schema[key].type) {
                    case datatypes.JSON:
                    case datatypes.ARRAY:
                        this._attributes[key] = [this._schema[key].permitted[index]];
                        break;

                    default:
                        this._attributes[key] = this._schema[key].permitted[index];

                }

            } else if (params[key].length !== 0) {

                switch(this._schema[key].type) {
                    case datatypes.JSON:
                    case datatypes.ARRAY:
                        this._attributes[key] = JSON.parse(params[key]);
                        break;

                    case datatypes.NUMBER:
                        this._attributes[key] = parseInt(params[key], 10);
                        break;

                    case datatypes.DECIMAL:
                        this._attributes[key] = parseFloat(params[key], 10);
                        break;

                    case datatypes.BOOLEAN:
                        this._attributes[key] = (params[key].toLowerCase() === 'true') ? true : false;
                        break;

                    default:
                        this._attributes[key] = params[key];
                }

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