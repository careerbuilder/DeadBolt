__author__ = 'ayost'

import mysql.connector
import requests
import boto3
import json
import gzip
import sys
import os
import re

existing_users = {}
api_info = {
    'host': "",
    'username': "",
    'password': ""
}

db_info = {
    'host': "",
    'port': "",
    'username': "",
    'password': "",
    'database': ""
}


class DictDiffer(object):
    """
    Calculate the difference between two dictionaries as:
    (1) items added
    (2) items removed
    (3) keys same in both but changed values
    (4) keys same in both and unchanged values
    """
    def __init__(self, current_dict, past_dict):
        self.current_dict, self.past_dict = current_dict, past_dict
        self.set_current, self.set_past = set(current_dict.keys()), set(past_dict.keys())
        self.intersect = self.set_current.intersection(self.set_past)
    def added(self):
        return self.set_current - self.intersect
    def removed(self):
        return self.set_past - self.intersect
    def changed(self):
        c = []
        for o in self.intersect:
            np = self.past_dict[o].copy()
            nc = self.current_dict[o]
            if 'Active' in np:
                del np['Active']
            if 'ID' in np:
                del np['ID']
            if 'Active' in nc:
                del nc['Active']
            if 'ID' in nc:
                del nc['ID']
            if np != nc :
                c.append(o)
        return set(c)
    def unchanged(self):
        return set(o for o in self.intersect if self.past_dict[o] == self.current_dict[o])


def email_users(msg_type, msg_object):
    ses = boto3.client('ses', region_name='us-east-1')
    subject = 'Deadbolt User Import'
    if msg_type == 'DELETE_WARNING':
        subject = 'More than 5 active users staged for delete!'
    elif msg_type == 'SUCCESS':
        subject = 'User import completed successfully'
    elif msg_type == 'ERROR':
        subject = 'User import encountered an error'
    msg = {
        'Subject':{
            'Data': subject
        },
        'Body': {
            'Text':{
                'Data': json.dumps(msg_object, indent=2)
            }
        }
    }
    ses.send_email(Source=secrets['Email']['From'], Destination={'ToAddresses':secrets['Email']['To']}, ReplyToAddresses=secrets['Email']['ReplyTo'], Message=msg)


def get_new_userlist():
    s3 = boto3.resource('s3', region_name='us-east-1')
    bucket = s3.Bucket(secrets['S3']['Bucket'])
    newest = None
    for csv in bucket.objects.filter(Prefix=secrets['S3']['Prefix']):
        if csv.storage_class.upper().strip() == 'GLACIER':
            continue
        obj = csv.get()
        if newest is None:
            newest = obj
        else:
            if obj['LastModified'] > newest['LastModified']:
                newest = obj
    body = gzip.decompress(newest['Body'].read()).decode('utf8')
    rows = re.split(r'\n', body)
    users = []
    for row in rows:
        row = re.sub(r'"', '', row.strip())
        info = re.split(r'\s*,\s*', row)
        if len(info) != 4:
            continue
        if 'hhrepid' in info[0].lower():
            continue
        user = {'Username': info[0],
                'LastName': info[1],
                'FirstName': info[2],
                'Email': info[3]
                }
        users.append(user)
    return users


def filter_info(info):
    username_list = {}
    for user in info:
        if 'Username' not in user or len(user['Username']) < 1:
            continue
        username_list[user['Username'].lower()] = user
    return username_list


def get_existing_users():
    query = 'Select `Username`, `LastName`, `FirstName`, `Email`, `ID`, `Active` from `users`;'
    cursor = cnx.cursor()
    cursor.execute(query)
    old_users = {}
    for res in cursor:
        info = res
        username = info[0]
        user = {
            'Username': username,
            'LastName': info[1],
            'FirstName': info[2],
            'Email': info[3],
            'ID': info[4]
        }
        if len(info) > 5:
            if info[5] == 1:
                existing_users[username] = info[4]
        old_users[username.lower()] = user
    return old_users


def compare_users(new_dict, old_dict):
    diff = DictDiffer(new_dict, old_dict)
    new_keys = diff.added().copy()
    new_keys.update(diff.changed())
    # new_keys = diff.added()
    removed_keys = diff.removed()
    activedels = []
    del_users = []
    for old_user in removed_keys:
        user = old_dict[old_user]
        if old_user in existing_users:
            if existing_users[old_user] <1:
                continue
            user['Active'] = True
            activedels.append(user)
        del_users.append(user)
    if len(activedels) >= 5 and forced is False:
        print('\nAborting!\nMore than 5 Active records staged for delete.\nTo proceed anyway, re-run with the -f or --force flag set')
        email_users('DELETE_WARNING', activedels)
        exit(1)
    changes['Removed'] = list(u['Username'] for u in del_users)
    remove_users(del_users)
    new_users = []
    for new_user in new_keys:
        new_users.append(new_dict[new_user])
    changes['Added'] = list(u['Username'] for u in new_users)
    add_users(new_users)


def add_users(user_list):
    if len(user_list) < 1:
        return
    sql = "Insert into `users` (Username, FirstName, LastName, Email) Values "
    args = {}
    i = 1
    for user in user_list:
        sql += '(%(username' + str(i) + ')s, %(firstname' + str(i) + ')s, %(lastname' + str(i) + ')s, %(email' + str(i) + ')s), '
        args['username' + str(i)] = user['Username']
        args['firstname' + str(i)] = user['FirstName']
        args['lastname' + str(i)] = user['LastName']
        args['email' + str(i)] = user['Email']
        i += 1
    sql = sql[0:len(sql) - 2]
    sql += " ON DUPLICATE KEY UPDATE Email=Values(Email), FirstName=Values(FirstName), LastName=Values(LastName);"
    cursor = cnx.cursor()
    cursor.execute(sql, args)
    cnx.commit()


def remove_users(user_list):
    for user in user_list:
        if 'Active' in user and user['Active']:
            r = requests.delete(api_info['host'] + "/users/" + str(user['ID']), headers={'authorization': api_info['Session']}, verify=False)
            res = r.json()
            print(res)
        sql = "Delete from `users` where `Username` = %(username)s;"
        args = {'username': user['Username']}
        cursor = cnx.cursor()
        cursor.execute(sql, args)
        cnx.commit()


def backup_users():
    cursor = cnx.cursor()
    cursor.execute('Drop Table if exists `users_importbkp`;')
    cnx.commit()
    cursor.execute('Create Table `users_importbkp` select * from `users`;')
    cnx.commit()


if __name__ == '__main__':
    forced = False
    script_loc = os.path.abspath(os.path.dirname(sys.argv[0]))
    if len(sys.argv)> 1:
        if sys.argv[1] == '-f' or sys.argv[1] == '--force':
            forced = True
    try:
        secret_file = open(os.path.join(script_loc, './script_creds.secret'), 'r')
        secrets = json.load(secret_file)
        secret_file.close()
    except FileNotFoundError:
        print("No secrets file!")
        email_users('ERROR', "No secrets file!")
        exit(1)
    db_info = secrets['db']
    api_info = secrets['api']
    newusers = get_new_userlist()
    login = requests.post(api_info['host'] + '/login/', data={'Email': api_info['email'], 'Password': api_info['password']}, verify=False)
    response = login.json()
    if 'Success' in response and response['Success']:
        api_info['Session'] = response['Session']
        existing_users = {}
        changes = {}
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'], database=db_info['database'], port=db_info['port'])
        backup_users()
        compare_users(filter_info(newusers), get_existing_users())
        cnx.close()
        email_users('SUCCESS', changes)
        log = open(os.path.join(script_loc,'./output_log.log'), 'a')
        json.dump(changes, log, indent=2, sort_keys=True)
        log.close()
    else:
        print('login error!', response['Error'])
        email_users('ERROR', response['Error'])
        exit(1)
