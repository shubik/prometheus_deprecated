var _        = require('underscore'),
    fs       = require('fs'),
    deferred = require('deferred'),
    resizer  = require('./image_resizer');

module.exports = function(file) {
    var self = this,
        _def = deferred();

    fs.readFile(file.path, function (err, data) {
        var ext        = '.' + file.name.split('.').pop(),
            basename   = MD5(file.name + utils.now()),
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

                    if (self._schema[file.attr].content_size) {
                        _.each(self._schema[file.attr].content_size, _.bind(resizer, this, path, basename, ext, filename));
                    }

                    /* --- Resolve promise with public URL of original file --- */

                    _def.resolve(self._uploads.public + fname_orig);
                }
            });
        }
    });

    return _def.promise;
}