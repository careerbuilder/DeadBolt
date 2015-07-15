__author__ = 'ayost'

import mysql.connector
import requests
import boto3
import json
import gzip
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
        return set(o for o in self.intersect if self.past_dict[o] != self.current_dict[o])
    def unchanged(self):
        return set(o for o in self.intersect if self.past_dict[o] == self.current_dict[o])


def get_new_userlist():
    s3 = boto3.resource('s3')
    bucket = s3.Bucket('sitedb-auth-useasttest')
    newest = None
    for csv in bucket.objects.filter(Prefix='add/CBEmployee'):
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
        user = {'Username': info[0],
                'LastName': info[1],
                'FirstName': info[2],
                'Email': info[3]
                }
        users.append(user)
    return users


def filter_info(info):
    #alphanum = re.compile(r'^[a-zA-Z]+$')
    # cbemail = re.compile(r'^[a-zA-Z]+\.[a-zA-Z]+@careerbuilder\.co(m|\.uk)$', re.IGNORECASE)
    #clean = []
    #for obj in info:
    #    isclean = True
    #    for key in obj:
    #        if key == "Email":
    #            continue
    #        if not alphanum.match(obj[key]):
    #            isclean = False
    #            break
    #    if isclean:
    #        clean.append(obj)
    email_list = {}
    for user in info:
        if 'Email' not in user or len(user['Email'])<1:
            continue
        if user['Email'].lower() not in email_list:
            email_list[user['Email'].lower()] = [user]
        else:
            email_list[user['Email'].lower()].append(user)
    for key in email_list:
        if len(email_list[key]) > 1:
            email_list[key] = [email_list[key][0]]
    return email_list


def get_existing_users():
    query = 'Select `Username`, `LastName`, `FirstName`, `Email`, `User_ID` from `possible_users`;'
    cursor = cnx.cursor()
    cursor.execute(query)
    old_users = {}
    for res in cursor:
        info = res
        email = info[3]
        if email.lower() not in old_users:
            old_users[email.lower()] = []
        user = {
            'Username': info[0],
            'LastName': info[1],
            'FirstName': info[2],
            'Email': email
        }
        if len(info) > 4:
            if info[4] is not None:
                existing_users[email] = info[4]
        old_users[email.lower()].append(user)
    return old_users


def compare_users(new_dict, old_dict):
    diff = DictDiffer(new_dict, old_dict)
    new_keys = diff.added()
    removed_keys = diff.removed()
    #updated = diff.changed()
    changes['Added'] = list(new_keys)
    changes['Removed'] = list(removed_keys)
    for old_user in removed_keys:
        user = old_dict[old_user][0]
        if old_user in existing_users:
            user['ID'] = existing_users[old_user]
        remove_user(user)
    new_users = []
    for new_user in new_keys:
        new_users.append(new_dict[new_user][0])
    add_users(new_users)
    #for ud in updated:
    #    user = new_dict[ud][0]
    #    if ud in existing_users:
    #        user['ID'] = existing_users[ud]
    #    update_user(user)


def add_users(user_list):
    if len(user_list) < 1:
        return
    sql = "Insert into `possible_users` (Username, FirstName, LastName, Email) Values "
    for user in user_list:
        sql += '("' + user['Username'] + '", "' + user['FirstName'] + '", "' + user['LastName'] + '", "' + user['Email'] + '"), '
    sql = sql[0:len(sql) - 2]
    sql += " ON DUPLICATE KEY UPDATE Username=Values(Username), FirstName=Values(FirstName), LastName=Values(LastName)"
    cursor = cnx.cursor()
    cursor.execute(sql)
    cnx.commit()


def remove_user(user):
    if 'ID' in user and user['ID'] is not None:
        r = requests.delete(api_info['host'] + "/users/" + str(user['ID']), headers={'authorization': api_info['Session']}, verify=False)
        res = r.json()
        print(res)
    sql = "Delete from `possible_users` where `Username` = '" + user['Username'] + "';"
    cursor = cnx.cursor()
    cursor.execute(sql)
    cnx.commit()


if __name__ == '__main__':
    newusers = get_new_userlist()
    try:
        secret_file = open('./script_creds.secret', 'r')
        secrets = json.load(secret_file)
        db_info = secrets['db']
        api_info = secrets['api']
        login = requests.post(api_info['host'] + '/login/', data={'email': api_info['username'], 'password': api_info['password']}, verify=False)
        response = login.json()
        if 'Success' in response and response['Success']:
            api_info['Session'] = response['Session']
        secret_file.close()
        existing_users = {}
        changes = {}
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'], database=db_info['database'], port=db_info['port'])
        compare_users(filter_info(newusers), get_existing_users())
        cnx.close()
    except FileNotFoundError:
        changes = {'Error': "No secrets file!"}
    log = open('./output_log.log', 'a')
    json.dump(changes, log, indent=2, sort_keys=True)
    log.close()