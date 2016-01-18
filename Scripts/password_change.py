import mysql.connector
import requests
import binascii
import hashlib
import getpass
import random
import codecs
import boto3
import uuid
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


def save_passwords(username, passwords, portal_creds, keyname):
    query = "Update Users set Portal_Password= %(portal_pass)s, Portal_Salt=%(portal_salt)s, "
    args = {'username': username, 'portal_pass': portal_creds['Password'], 'portal_salt':portal_creds['Salt']}
    i = 1
    for key in passwords:
        query += key + "= %(arg" + str(i) + ")s, "
        args['arg' + str(i)] = re.sub(r'b\'(.*?)\'', r'\1', str(encrypt_password(keyname, passwords[key])))
        i += 1
    query = query[0:-2] + " Where Username= %(username)s;"
    sql = query
    cursor = cnx.cursor()
    cursor.execute(sql, args)
    cnx.commit()


def change_password(username, password):
    creds = {'username': username, 'password': password}
    passwords = get_passwords(creds)
    cursor = cnx.cursor()
    query = "Select FirstName, LastName, Email, ID, Active from users where Username=%(username)s"
    cursor.execute(query, {'username': username})
    user = {
        'Username': username,
        'Groups': []
    }
    for res in cursor:
        user['FirstName'] = res[0]
        user['LastName'] = res[1]
        user['Email'] = res[2]
        user['ID'] = res[3]
        user['Active'] = res[4]
    if ('FirstName' not in user) and ('LastName' not in user) and ('Email' not in user):
        print("User is not in possible User list")
        exit(-1)
    if 'Active' in user and user['Active'] == 1:
        q2 = "Select Group_ID, Permissions, GroupAdmin from users_groups where User_ID = %(id)s"
        cursor.execute(q2, {'id': user['ID']})
        for res in cursor:
            user['Groups'].append({'ID': res[0], 'Permissions': res[1], 'GroupAdmin':res[2]})
    for key in passwords:
        user[key] = passwords[key]
    save_passwords(username, passwords, get_portal_creds(creds), config['kms_keyname'])
    r = requests.put(api_info['host'] + '/users/password/'+username, headers={'Authorization': api_info['Session']}, verify=False)
    res = r.json()
    print(res)


def get_passwords(creds):
    passwords = {}
    mysql_p = get_mysql_pass(creds)
    mssql_p = get_mssql_pass(creds)
    mongo_p = get_mongo_pass(creds)
    cassandra_p = get_cassandra_pass(creds)
    # postgres_p = get_postgres_pass(creds)
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
    s1 = hashlib.sha1()
    s2 = hashlib.sha1()
    s1.update(password.encode('utf8'))
    s2.update(binascii.unhexlify(s1.hexdigest()))
    return '*' + s2.hexdigest().upper()


def get_mssql_pass(creds):
    password = creds['password']
    chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
             'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
             'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
             'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
             'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    s1 = hashlib.sha512()
    salt = (''.join(random.choice(chars) for i in range(4))).encode('utf8')
    b1 = password.encode('utf16')[2:]
    s1.update(b1 + salt)
    digest = s1.digest()
    mssqlhash = salt + digest
    mssql_pass = '0x0200' + binascii.hexlify(mssqlhash).decode()
    return mssql_pass


def get_portal_creds(creds):
    salt = str(uuid.uuid4())
    sha512 = hashlib.sha512()
    sha512.update((salt + creds['password']).encode('utf8'))
    return {'Salt': salt, 'Password': sha512.hexdigest()}


def get_mongo_pass(creds):
    return None


def get_cassandra_pass(creds):
    return None


def get_postgres_pass(creds):
    password = creds['password'] + creds['username']
    md5 = hashlib.md5()
    md5.update(password.encode('utf8'))
    enc_password = "md5" + md5.hexdigest()
    return enc_password


def get_oracle_pass(creds):
    return None


def main():
    if len(sys.argv) < 2:
        print("No username given!")
        return "Failure"
    username = sys.argv[1]
    if len(sys.argv) >= 3:
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
        api_info = config['api']
        #db_info = config['db']
        cfj = open(os.path.join(cur_dir, '..','Portal','config.json'), 'r')
        dbconfig = json.load(cfj)
        cfj.close()
        db_info = dbconfig['DB']
        login = requests.post(api_info['host'] + '/login/', data={'Email': api_info['username'], 'Password': api_info['password']}, verify=False)
        response = login.json()
        if 'Success' in response and response['Success']:
            api_info['Session'] = response['Session']
        else:
            print('Login unsucessful')
            print(response['Error'])
            exit(1)
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'],
                                      database=db_info['database'], port=db_info['port'])
        kms_connection = boto3.client('kms')
        main()
        cnx.close()
    except FileNotFoundError:
        print('Error!', "No secrets file!")
        exit(-1)
