import os

downloads_dir = r"C:\Users\jatin\Downloads"
search_terms = ["accessCode", "evaluation-service", "authorization", "ownerEmail", "githubUsername"]

print("Starting scan in Downloads...")
for root, dirs, files in os.walk(downloads_dir):
    # skip node_modules and SpendWise
    if "node_modules" in root or "SpendWise" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith(('.txt', '.md', '.json', '.sql', '.py', '.js', '.ts', '.html', '.pdf', '.docx', '.xlsx')):
            file_path = os.path.join(root, file)
            try:
                # read text file
                if file.endswith(('.txt', '.md', '.json', '.sql', '.py', '.js', '.ts', '.html')):
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        for term in search_terms:
                            if term.lower() in content.lower():
                                print(f"Match for '{term}' in {file_path}")
                                # Print matching lines
                                for line in content.splitlines():
                                    if term.lower() in line.lower():
                                        print(f"  Line: {line.strip()[:150]}")
            except Exception as e:
                pass
print("Scan completed.")
