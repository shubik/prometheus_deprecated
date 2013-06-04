var _        = require('underscore'),
    fs       = require('fs'),
    exec     = require('child_process').exec,
    deferred = require('deferred');

module.exports = function(req) {
    var self = this,
        params  = _.extend(req.params || {}, req.query || {}, req.body || {}),
        def = deferred(),
        files = _.filter(req.files, function(file, attr) {
            file.attr = attr;
            return file.size > 0 && file.name.length > 0;
        });

    this._ischanged = true;

    /* --- Handle normal params --- */

    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            if (this._schema[key].permitted) {
                index = parseInt(params[key], 10);
                this._attributes[key] = this._schema[key].permitted[index];
            } else if (params[key].length !== 0) {
                this._attributes[key] = params[key];
            } else {
                this._attributes[key] = this._schema[key].default;
            }
        }
    }

    /* --- Handle file uploads --- */

    deferred.map(files, function (file) {
        var _def = deferred();

        fs.readFile(file.path, function (err, data) {
            var ext        = file.name.split('.').pop(),
                basename   = MD5(file.name + utils.now()),
                fname_orig = basename + '_orig.' + ext,
                path       = __appdir + '/public/uploads/',
                path_pub   = '/uploads/';

            if (err) {
                _def.resolve(err);
            } else {
                fs.writeFile(path + fname_orig, data, function (err) {
                    if (err) {
                        _def.resolve(err);
                    } else {
                        self._attributes[file.attr] = path_pub + fname_orig;
                        _def.resolve(path_pub + fname_orig);
                    }

                    /* --- Handle image resizes --- */

                    if (self._schema[file.attr].content_size) {
                        var sizes = self._schema[file.attr].content_size.split(',');

                        _.each(sizes, function(size) {
                            var size_clean = size.replace(/^\s\s*/, '').replace(/\s\s*$/, '').toLowerCase(),
                                dims       = size_clean.substr(1),
                                fname      = path + basename + '_' + size_clean + '.' + ext,
                                command;

                            if (size_clean[0] === 'c') {
                                command = 'convert ' + path + fname_orig + ' -resize ' + dims + 'x' + dims + '^ -crop ' + dims + 'x' + dims + '+0+0 -background white -flatten -gravity center -quality 95 -strip -colorspace RGB -unsharp 0x0.5+0.5+0.05 ' + fname;
                            } else if (size_clean[0] === 's') {
                                command = 'convert ' + path + fname_orig + ' -resize ' + dims + '\> -background white -flatten -gravity center -quality 95 -strip -colorspace RGB -unsharp 0x0.5+0.5+0.05 ' + fname;
                            }

                            console.log('about to exec()', command);

                            exec(command, function(err, stdout, stderr) {
                                if (err === null) {
                                    console.log('image successfully resized');
                                } else {
                                    console.log('image could not be resized', err.stack);
                                }
                            });
                        });
                    }
                });
            }
        });

        return _def.promise;
    })(function (result) {
        def.resolve(self);
    }, function(err) {
        def.resolve(err);
    });

    return def.promise;
}