__author__ = 'ayost'


import mysql.connector
import requests
import codecs
import boto3
import json
import sys
import re

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


def encrypt_password(keyname, password):
    enc_obj = kms_connection.encrypt(KeyId=keyname, Plaintext=password)
    ciphertext = enc_obj['CiphertextBlob']
    return codecs.encode(ciphertext, 'hex')


def decrypt_password(enc_pass):
    dec_obj = kms_connection.decrypt(CiphertextBlob=codecs.decode(enc_pass, 'hex'))
    return dec_obj['Plaintext']


def save_passwords(username, passwords, keyname):
    query = "INSERT INTO Users (Username, "
    values = "VALUES (%(username)s, "
    update = "ON DUPLICATE KEY UPDATE MySQL_Password=VALUES(MySQL_Password), SQL_Server_Password=Values(SQL_Server_Password), Mongo_Password=Values(Mongo_Password), Cassandra_Password=Values(Cassandra_Password);"
    args = {'username': username}
    i = 1
    for key in passwords:
        query += key + ", "
        values += "%(arg" + str(i) + ")s, "
        args['arg' + str(i)] = re.sub(r'b\'(.*?)\'', r'\1', str(encrypt_password(keyname, passwords[key])))
        i += 1
    query = query[0:-2] + ") "
    values = values[0:-2] + ") "
    sql = query + values + update
    cursor = cnx.cursor()
    cursor.execute(sql, args)
    cnx.commit()


def change_password(username, password):
    passwords = get_passwords(password)
    cursor = cnx.cursor()
    query = "Select FirstName, LastName, Email, User_ID from possible_users where Username=%(username)s"
    cursor.execute(query, {'username': username})
    user = {
        'Username': username,
        'Groups': {}
    }
    for res in cursor:
        user['FirstName'] = res[0]
        user['LastName'] = res[1]
        user['Email'] = res[2]
        if (len(res) >= 4) and (res[3] is not None):
            user['User_ID'] = res[3]
    if 'User_ID' in user:
        q2 = "Select Group_ID, Permissions from users_groups where User_ID = %(id)s"
        cursor.execute(q2, {'id': user['User_ID']})
        for res in cursor:
            user['Groups'][res[0]] = res[1]
    for key in passwords:
        user[key] = passwords[key]
    save_passwords(username, passwords, 'alias/RDSAD')
    r = requests.post(api_info['host'] + '/users/', json=user, headers={'authorization': api_info['Session']}, verify=False)
    res = r.json()
    print(res)


def get_passwords(password):
    passwords = {}
    mysql_p = get_mysql_pass(password)
    mssql_p = get_mssql_pass(password)
    mongo_p = get_mongo_pass(password)
    cassandra_p = get_cassandra_pass(password)
    if mysql_p is not None:
        passwords['MySQL_Password'] = mysql_p
    if mssql_p is not None:
        passwords['SQL_Server_Password'] = mssql_p
    if mongo_p is not None:
        passwords['Mongo_Password'] = mongo_p
    if cassandra_p is not None:
        passwords['Cassandra_Password'] = cassandra_p
    return passwords


def get_mysql_pass(password):
    cursor = cnx.cursor()
    query = "Select PASSWORD('" + password + "');"
    cursor.execute(query)
    result = ""
    for res in cursor:
        result = res[0]
    cursor.close()
    # print(result)
    return result


def get_mssql_pass(password):
    return None


def get_mongo_pass(password):
    return None


def get_cassandra_pass(password):
    return None

if __name__ == "__main__":
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
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'], database=db_info['database'], port=db_info['port'])
        kms_connection = boto3.client('kms')
        change_password(sys.argv[1], sys.argv[2])
        cnx.close()
    except FileNotFoundError:
        print('Error!', "No secrets file!")
        exit(-1)




