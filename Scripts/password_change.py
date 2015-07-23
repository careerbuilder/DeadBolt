__author__ = 'ayost'

import mysql.connector
import requests
import hashlib
import pymssql
import getpass
import codecs
import boto3
import json
import sys
import re
import os

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
    passwords = get_passwords({'username': username, 'password': password})
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
    if ('FirstName' not in user) and ('LastName' not in user) and ('Email' not in user):
        print("User is not in possible User list")
        exit(-1)
    if 'User_ID' in user:
        q2 = "Select Group_ID, Permissions from users_groups where User_ID = %(id)s"
        cursor.execute(q2, {'id': user['User_ID']})
        for res in cursor:
            user['Groups'][res[0]] = res[1]
    for key in passwords:
        user[key] = passwords[key]
    save_passwords(username, passwords, config['kms_keyname'])
    r = requests.post(api_info['host'] + '/users/', json=user, headers={'authorization': api_info['Session']}, verify=False)
    res = r.json()
    print(res)


def get_passwords(creds):
    passwords = {}
    mysql_p = get_mysql_pass(creds)
    mssql_p = get_mssql_pass(creds)
    mongo_p = get_mongo_pass(creds)
    cassandra_p = get_cassandra_pass(creds)
    if mysql_p is not None:
        passwords['MySQL_Password'] = mysql_p
    if mssql_p is not None:
        passwords['SQL_Server_Password'] = mssql_p
    if mongo_p is not None:
        passwords['Mongo_Password'] = mongo_p
    if cassandra_p is not None:
        passwords['Cassandra_Password'] = cassandra_p
    return passwords


def get_mysql_pass(creds):
    password = creds['password']
    cursor = cnx.cursor()
    query = "Select PASSWORD('" + password + "');"
    cursor.execute(query)
    result = ""
    for res in cursor:
        result = res[0]
    cursor.close()
    # print(result)
    return result


def get_mssql_pass(creds):
    password = creds['password']
    mssql_db = config['mssql']
    mssql_conn = pymssql.connect(server=mssql_db['host'], port=mssql_db['port'], user=mssql_db['user'], password=mssql_db['password'])
    cursor = mssql_conn.cursor()
    cursor.execute('Select PWDENCRYPT(%s)', password)
    raw_pass = cursor.fetchone()[0]
    mssql_pass = "0x"
    for byte in raw_pass:
        mssql_pass += int_to_hex(byte)
    mssql_conn.close()
    return mssql_pass


def get_mongo_pass(creds):
    return None


def get_cassandra_pass(creds):
    return None

def get_postgres_pass(creds):
    password = creds['password']+creds['username']
    md5 = hashlib.md5()
    md5.update(password.encode('utf8'))
    enc_bytes = md5.digest()
    enc_password = "md5"
    for byte in enc_bytes:
        enc_password += int_to_hex(byte)
    return enc_password

def get_oracle_pass(creds):
    return None

def int_to_hex(num):
    digit = {
        0:'0',
        1:'1',
        2:'2',
        3:'3',
        4:'4',
        5:'5',
        6:'6',
        7:'7',
        8:'8',
        9:'9',
        10:'A',
        11:'B',
        12:'C',
        13:'D',
        14:'E',
        15:'F'
    }
    hexstring = ""
    while num > 0:
        hexstring = digit[num%16] + hexstring
        num = num//16
    while len(hexstring)<2:
        hexstring = str(0)+hexstring
    return hexstring

def main():
    if len(sys.argv) < 2:
        print("No username given!")
        return "Failure"
    username = sys.argv[1]
    if len(sys.argv)>=3:
        password = sys.argv[2]
    else:
        password = getpass.getpass()
    change_password(username, password)


if __name__ == "__main__":
    try:
        cur_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        sec_path = os.path.join(cur_dir, 'script_creds.secret')
        secret_file = open(sec_path, 'r')
        secrets = json.load(secret_file)
        secret_file.close()
        config = secrets
        db_info = config['db']
        api_info = config['api']
        login = requests.post(api_info['host'] + '/login/', data={'email': api_info['username'], 'password': api_info['password']}, verify=False)
        response = login.json()
        if 'Success' in response and response['Success']:
            api_info['Session'] = response['Session']
        secret_file.close()
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'], database=db_info['database'], port=db_info['port'])
        kms_connection = boto3.client('kms')
        main()
        cnx.close()
    except FileNotFoundError:
        print('Error!', "No secrets file!")
        exit(-1)
