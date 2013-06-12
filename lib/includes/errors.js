var custom_error = function(code, name) {
        var err = function(msg) {
            this.name = code + ' ' + name;
            this.message = msg || '';
        }
        err.prototype = Error.prototype;
        return err;
    },

    error_names = {
        400: 'BadRequest',
        401: 'Unauthorized',
        402: 'PaymentRequired',
        403: 'Forbidden',
        404: 'NotFound',
        405: 'MethodNotAllowed',
        406: 'NotAcceptable',
        407: 'ProxyAuthenticationRequired',
        408: 'RequestTimeout',
        409: 'Conflict',
        410: 'Gone',
        411: 'LengthRequired',
        412: 'PreconditionFailed',
        413: 'RequestEntityTooLarge',
        414: 'RequestURITooLong',
        415: 'UnsupportedMediaType',
        416: 'RequestedRangeNotSatisfiable',
        417: 'ExpectationFailed'
    };

module.exports = _.reduce(error_names, function(memo, errname, errcode) {
    memo[errname] = custom_error(errcode, errname);
    return memo;
}, {});