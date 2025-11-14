import os
from pathlib import Path

def analyze_sdk_format(sdk_path="SDK-Extracted"):
    """Analyze what format the SDK dump actually is"""
    
    sdk_dir = Path(sdk_path)
    if not sdk_dir.exists():
        print(f"❌ Directory {sdk_path} not found")
        return
    
    # Get file types
    all_files = list(sdk_dir.rglob("*"))
    file_types = {}
    
    for file in all_files:
        if file.is_file():
            ext = file.suffix.lower()
            file_types[ext] = file_types.get(ext, 0) + 1
    
    print(f"📁 Files found in {sdk_path}:")
    for ext, count in sorted(file_types.items()):
        print(f"  {ext or '(no extension)'}: {count} files")
    
    # Look at a few sample files
    h_files = list(sdk_dir.rglob("*.h"))
    if h_files:
        print(f"\n📄 Sample .h file contents:")
        sample_file = h_files[0]
        print(f"File: {sample_file.name}")
        
        try:
            with open(sample_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')[:30]  # First 30 lines
                
            for i, line in enumerate(lines, 1):
                if line.strip():
                    print(f"  {i:2d}: {ldine}")
                    
            print(f"\n📊 File analysis:")
            print(f"  Total lines: {len(content.split())}")
            print(f"  Has 'class': {'class ' in content}")
            print(f"  Has offsets (0x): {'0x' in content}")
            print(f"  Has static_assert: {'static_assert' in content}")
            
        except Exception as e:
            print(f"  ❌ Error reading file: {e}")
    
    else:
        print("❌ No .h files found!")
        
        # Check what other files exist
        other_files = [f for f in all_files if f.is_file()][:10]
        print(f"\n📄 Other files found:")
        for file in other_files:
            print(f"  {file}")

if __name__ == "__main__":
    analyze_sdk_format()