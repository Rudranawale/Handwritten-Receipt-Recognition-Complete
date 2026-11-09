from db_config import get_db_connection

connection = get_db_connection()

if connection and connection.is_connected():
    print("MySQL database connected successfully!")

    cursor = connection.cursor()
    cursor.execute("SHOW TABLES")

    print("Available tables:")
    for table in cursor.fetchall():
        print(table[0])

    cursor.close()
    connection.close()
else:
    print("Database connection failed.")