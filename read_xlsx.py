import zipfile
import xml.etree.ElementTree as ET

path = r"C:\Users\jatin\Downloads\Affordmedical- students shortlist for assessment.xlsx"
try:
    with zipfile.ZipFile(path, 'r') as zip_ref:
        # Load shared strings
        shared_strings = []
        try:
            with zip_ref.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                # Namespaces in xlsx XML
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for t in root.findall('.//ns:t', ns):
                    shared_strings.append(t.text)
        except Exception as e:
            print("Shared strings error:", e)
            
        # Load sheet1
        with zip_ref.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows = []
            for row in root.findall('.//ns:row', ns):
                row_data = []
                for cell in row.findall('ns:c', ns):
                    val = cell.find('ns:v', ns)
                    t = cell.get('t')
                    if val is not None:
                        val_text = val.text
                        if t == 's':
                            # shared string
                            idx = int(val_text)
                            row_data.append(shared_strings[idx] if idx < len(shared_strings) else val_text)
                        else:
                            row_data.append(val_text)
                    else:
                        row_data.append("")
                rows.append(row_data)
                
            print(f"Read {len(rows)} rows.")
            # Search for 'Jatin' or print first 100 rows
            for i, r in enumerate(rows):
                row_str = " | ".join(map(str, r))
                if "jatin" in row_str.lower():
                    print(f"Row {i}: {row_str}")
except Exception as e:
    print("Error:", e)
