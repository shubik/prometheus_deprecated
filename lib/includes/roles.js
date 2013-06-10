/*
Functions for checking roles.

Default roles:

guest (always true)
user (with session, not inactive)
owner (where subject.user_id = session.user.id) - fk = user_id
admin (where session.user.roles.indexOf('admin') ! == -1)

Custom roles:

company (where subject.company_id = userModel.get('company_id')) - fk = company_id

You can add more custom roles.
*/