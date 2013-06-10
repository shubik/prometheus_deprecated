module.exports = {
    guest: {
        check: function (session_user) {
            return true;
        }
    },

    user: {
        fk_param: 'user_id',
        check: function (session_user) {
            return !!session_user;
        }
    },

    admin: {
        check: function (session_user) {
            return session_user && session_user.roles && session_user.roles.indexOf('admin') !== -1;
        }
    },

    owner: {
        check: function(session_user) {
            return false;
        }
    }
}