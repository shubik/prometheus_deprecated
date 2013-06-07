var _            = require('underscore'),
    fs           = require('fs'),
    exec         = require('child_process').exec,
    deferred     = require('deferred'),
    format       = require('util').format,
    default_opts = {
        resize: null,
        gravity: null,
        crop: null,
        background: null,
        flatten: '',
        quality: 95,
        strip: '',
        colorspace: 'RGB',
        unsharp: '0x0.5+0.5+0.05'
    },
    convert = function(src, dest, options, def) {

        var opts = _.extend({}, default_opts, options || {}),
            args = _.reduce(opts, function(memo, val, opt) {
                val && memo.push('-' + opt + ' ' + val);
                return memo;
            }, []),
            command;

        args.splice(0, 0, 'convert ' + src);
        args.push(dest);

        command = args.join(' ');

        exec(command, function(err, stdout, stderr) {
            if (err) {
                def.resolve(err);
            } else {
                def.resolve(stdout);
            }
        });
    };

module.exports = function(path, basename, ext, sizes) {
    deferred.map(sizes, function(size) {
        var def     = deferred(),
            dim     = size.substr(1),
            dims    = (size[0] === 's') ? dim : dim + 'x' + dim,
            src     = path + basename + ext,
            dest    = path + basename + '_' + size + ext,
            args    = {},
            command = '';

        size = size.toLowerCase();

        if (size[0] === 'c') {
            args.resize = format('%s^', dims);
            args.crop = format('%s+0+0', dims);
            args.background = 'white';
            args.gravity = 'center';
            convert(src, dest, args, def);
        } else if (size[0] === 's') {
            args.resize = format('%s\\>', dims);
            convert(src, dest, args, def);
        }

        return def.promise;
    }, 1);
}