__author__ = 'ayost'

import mysql.connector
import codecs
import boto3
import json
import sys
import os


def decrypt_password(enc_pass):
    dec_obj = kms_connection.decrypt(CiphertextBlob=codecs.decode(enc_pass, 'hex'))
    return dec_obj['Plaintext']


def gen_sql(users):
    sql = ""
    for user in users:
        sql += "'" + user + "', '" + user + "'@'localhost', "
    sql = sql[0:-2] + ";"
    return sql


def get_servers():
    cursor = cnx.cursor()
    cursor.execute('Select Name, Host, Port, Type, SAUser, SAPass from `databases`;')
    dbs = []
    for res in cursor:
        sapass = decrypt_password(res[5])
        db = {
            'Name': res[0],
            'Host': res[1],
            'Port': res[2],
            'Type': res[3],
            'SAUser': res[4],
            'SAPass': sapass
        }
        dbs.append(db)
    return dbs


def mysql_drop_users(server, sql1, sql2):
    mysql_cnx = mysql.connector.connect(host=server['Host'], password=server['SAPass'], user=server['SAUser'], database='mysql', port=server['Port'])
    cursor = mysql_cnx.cursor()
    cursor.execute(sql1)
    mysql_cnx.commit()
    cursor.execute(sql2)
    mysql_cnx.commit()
    mysql_cnx.close()


def main(users):
    userssql = gen_sql(users)
    tempgrant = "Grant Usage on `%`.* TO " + userssql
    drop = "Drop USER " + userssql
    servers = get_servers()
    for server in servers:
        if server['Type'] == 'mysql':
            mysql_drop_users(server, tempgrant, drop)
            print('Users dropped on ', server['Name'])
        elif server['Type'] == 'mssql':
            continue
            # mssql_drop_users(server, tempgrant, drop)


if __name__ == '__main__':
    try:
        cur_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        sec_path = os.path.join(cur_dir, 'script_creds.secret')
        secret_file = open(sec_path, 'r')
        secrets = json.load(secret_file)
        secret_file.close()
        config = secrets
        db_info = config['db']
        secret_file.close()
        kms_connection = boto3.client('kms')
        cnx = mysql.connector.connect(host=db_info['host'], password=db_info['password'], user=db_info['user'], database=db_info['database'], port=db_info['port'])
        main(sys.argv[1:])
        cnx.close()
    except FileNotFoundError:
        print('Error!', "No secrets file!")
        exit(-1)