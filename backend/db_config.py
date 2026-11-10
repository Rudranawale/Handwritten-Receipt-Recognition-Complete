import os
import mysql.connector
from mysql.connector import Error

def get_db_connection():
    try:
        config = {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": int(os.getenv("DB_PORT", "3306")),
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD"),
            "database": os.getenv("DB_NAME", "receipt_recognition"),
        }

        ssl_ca = os.getenv("DB_SSL_CA")

        if ssl_ca:
            config.update({
                "ssl_ca": ssl_ca,
                "ssl_verify_cert": True,
                "ssl_verify_identity": True,
                "use_pure": True,
            })

        return mysql.connector.connect(**config)

    except Error as error:
        print("Database connection error:", error)
        return None
