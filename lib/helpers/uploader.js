var _        = require('underscore'),
    fs       = require('fs'),
    deferred = require('deferred'),
    MD5      = require('MD5'),
    resizer  = require('./image_resizer');

module.exports = function(file) {

    var self = this,
        _def = deferred();

    if (!self._uploads) {
        console.warn('%s: model missing ._uploads object; returning...', __dirname);
        return;
    }

    fs.readFile(file.path, function (err, data) {
        var ext        = '.' + file.name.split('.').pop(),
            basename   = MD5(file.name + new Date().getTime()),
            path       = self._uploads.path,
            path_pub   = self._uploads.path_public,
            filename   = basename + ext;

        if (err) {
            _def.resolve(err);
        } else {
            fs.writeFile(path + filename, data, function (err) {
                if (err) {
                    _def.resolve(err);
                } else {
                    self._attributes[file.attr] = path_pub + filename;

                    /* --- Handle image resizes --- */

                    self._schema[file.attr].resize && resizer(path, basename, ext, self._schema[file.attr].resize);

                    /* --- Resolve promise with public URL of original file --- */

                    _def.resolve(path_pub + filename);
                }
            });
        }
    });

    return _def.promise;
}