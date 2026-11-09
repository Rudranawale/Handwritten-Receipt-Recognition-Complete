import mysql.connector
from mysql.connector import Error

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="rudra@2345",
            database="receipt_recognition"
        )
        return connection

    except Error as error:
        print("Database connection error:", error)
        return None