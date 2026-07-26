import sqlite3

conn = sqlite3.connect('recipe/recipe.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables in recipe.db:", tables)

for table_name in tables:
    t = table_name[0]
    print(f"\n--- TABLE: {t} ---")
    cursor.execute(f"PRAGMA table_info({t});")
    columns = cursor.fetchall()
    print("Columns:", [c[1] for c in columns])
    cursor.execute(f"SELECT * FROM {t} LIMIT 5;")
    rows = cursor.fetchall()
    print("Sample Rows:", rows)

conn.close()
