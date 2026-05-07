import os

def replace_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Revert if needed or apply correctly
    # Let's use simpler search & replace

    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('bbf-app.html')
replace_in_file('admin.html')
replace_in_file('bbf-data.js')
