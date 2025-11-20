"""
HPP to SDK JSON Converter
Converts C++ SDK HPP files to structured JSON format

Format mapping:
HPP: class ClassName : public ParentClass { members... }
JSON: {"N": "ClassName", "P": "ParentClass", "S": size, "M": [...], "T": "class"}

Author: SDK Converter
Date: November 19, 2025
"""

import json
import re
import sys
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass
import os


# Enable ANSI color support for Windows CMD
def enable_windows_colors():
    """Enable ANSI escape sequence support in Windows CMD"""
    if sys.platform == 'win32':
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            # Enable ANSI escape sequences in console
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

enable_windows_colors()


# Configure advanced logging
class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for Windows CMD"""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'
    }
    
    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        reset = self.COLORS['RESET']
        
        # Add timestamp, level, and message
        formatted = f"{log_color}[{record.levelname:8}]{reset} "
        formatted += f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] "
        formatted += f"{record.getMessage()}"
        
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"
            
        return formatted


def setup_logging(verbose: bool = True) -> logging.Logger:
    """Setup comprehensive logging with file and console handlers"""
    logger = logging.getLogger('HPPConverter')
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Console handler with colors (Windows CMD compatible)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if verbose else logging.INFO)
    console_handler.setFormatter(ColoredFormatter())
    logger.addHandler(console_handler)
    
    # File handler for detailed logs
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file = Path(__file__).parent / f'converter_log_{timestamp}.txt'
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    logger.info(f"Logging initialized. Log file: {log_file}")
    return logger


@dataclass
class ParseStats:
    """Statistics tracker for parsing operations"""
    total_lines: int = 0
    classes_found: int = 0
    structs_found: int = 0
    members_found: int = 0
    errors: int = 0
    warnings: int = 0
    start_time: float = 0
    
    def __post_init__(self):
        self.start_time = time.time()
    
    def get_elapsed(self) -> float:
        return time.time() - self.start_time
    
    def log_summary(self, logger: logging.Logger):
        """Log comprehensive statistics"""
        elapsed = self.get_elapsed()
        logger.info("=" * 70)
        logger.info("PARSING STATISTICS SUMMARY")
        logger.info("=" * 70)
        logger.info(f"Total Lines Processed:    {self.total_lines:,}")
        logger.info(f"Classes Found:            {self.classes_found:,}")
        logger.info(f"Structs Found:            {self.structs_found:,}")
        logger.info(f"Total Structures:         {self.classes_found + self.structs_found:,}")
        logger.info(f"Total Members Found:      {self.members_found:,}")
        logger.info(f"Errors Encountered:       {self.errors}")
        logger.info(f"Warnings:                 {self.warnings}")
        logger.info(f"Processing Time:          {elapsed:.2f} seconds")
        if self.total_lines > 0:
            logger.info(f"Processing Speed:         {self.total_lines / elapsed:,.0f} lines/sec")
        logger.info("=" * 70)


class HPPToJSONConverter:
    """
    Converts HPP SDK format to JSON SDK format with comprehensive logging
    """
    
    # Regex patterns for parsing
    CLASS_PATTERN = re.compile(
        r'^class\s+(\w+)(?:\s*:\s*public\s+(\w+))?\s*{',
        re.MULTILINE
    )
    
    STRUCT_PATTERN = re.compile(
        r'^struct\s+(\w+)(?:\s*:\s*public\s+(\w+))?\s*{',
        re.MULTILINE
    )
    
    MEMBER_PATTERN = re.compile(
        r'^\s+static\s+const\s+uint32_t\s+(\w+)\s+=\s+(0x[0-9a-fA-F]+);\s*//\s*\((0x[0-9a-fA-F]+)\)',
        re.MULTILINE
    )
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.stats = ParseStats()
        self.current_structure: Optional[Dict] = None
        self.structures: List[Dict] = []
        
    def parse_hpp_file(self, hpp_path: Path) -> List[Dict]:
        """
        Parse HPP file and extract all structures with members
        
        Args:
            hpp_path: Path to the HPP file
            
        Returns:
            List of structure dictionaries in SDK JSON format
        """
        self.logger.info("=" * 70)
        self.logger.info(f"Starting HPP file parsing: {hpp_path}")
        self.logger.info("=" * 70)
        
        if not hpp_path.exists():
            self.logger.error(f"File not found: {hpp_path}")
            self.stats.errors += 1
            return []
        
        file_size = hpp_path.stat().st_size
        self.logger.info(f"File size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
        
        try:
            self.logger.info("Reading file content...")
            with open(hpp_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            lines = content.split('\n')
            self.stats.total_lines = len(lines)
            self.logger.info(f"Total lines to process: {self.stats.total_lines:,}")
            
            self.logger.info("Beginning line-by-line parsing...")
            self._parse_content(content)
            
            self.logger.info(f"Parsing complete! Found {len(self.structures)} structures")
            return self.structures
            
        except Exception as e:
            self.logger.error(f"Fatal error reading file: {e}", exc_info=True)
            self.stats.errors += 1
            return []
    
    def _parse_content(self, content: str):
        """Parse content and extract structures"""
        lines = content.split('\n')
        current_class_name = None
        current_parent = None
        current_type = None
        current_members = []
        in_class = False
        brace_count = 0
        
        progress_interval = max(1, len(lines) // 100)  # Log every 1%
        
        for line_num, line in enumerate(lines, 1):
            # Progress logging
            if line_num % progress_interval == 0:
                progress = (line_num / len(lines)) * 100
                self.logger.debug(
                    f"Progress: {progress:.1f}% ({line_num:,}/{len(lines):,} lines) | "
                    f"Structures: {len(self.structures)} | "
                    f"Members: {self.stats.members_found}"
                )
            
            stripped = line.strip()
            
            # Skip empty lines and comments
            if not stripped or stripped.startswith('//'):
                continue
            
            # Check for class/struct definition
            if not in_class:
                class_match = self.CLASS_PATTERN.match(stripped)
                struct_match = self.STRUCT_PATTERN.match(stripped)
                
                if class_match:
                    current_class_name = class_match.group(1)
                    current_parent = class_match.group(2) if class_match.group(2) else ""
                    current_type = "class"
                    current_members = []
                    in_class = True
                    brace_count = 1
                    self.stats.classes_found += 1
                    self.logger.debug(f"Found class: {current_class_name} (parent: {current_parent or 'none'})")
                    
                elif struct_match:
                    current_class_name = struct_match.group(1)
                    current_parent = struct_match.group(2) if struct_match.group(2) else ""
                    current_type = "struct"
                    current_members = []
                    in_class = True
                    brace_count = 1
                    self.stats.structs_found += 1
                    self.logger.debug(f"Found struct: {current_class_name} (parent: {current_parent or 'none'})")
                    
            else:
                # Count braces to track nesting
                brace_count += stripped.count('{')
                brace_count -= stripped.count('}')
                
                # Parse member if inside class
                if brace_count > 0:
                    member_match = self.MEMBER_PATTERN.match(line)
                    if member_match:
                        member_name = member_match.group(1)
                        offset = member_match.group(2)
                        size = member_match.group(3)
                        
                        member = {
                            "N": member_name,
                            "T": self._infer_type(member_name, size),
                            "O": offset,
                            "S": size
                        }
                        current_members.append(member)
                        self.stats.members_found += 1
                        self.logger.debug(f"  └─ Member: {member_name} @ {offset} (size: {size})")
                
                # End of class/struct
                if brace_count == 0 and in_class:
                    # Skip structures with no members
                    if len(current_members) == 0:
                        self.logger.debug(
                            f"Skipping {current_type}: {current_class_name} (no members)"
                        )
                        in_class = False
                        continue
                    
                    # Calculate structure size from members
                    struct_size = self._calculate_size(current_members)
                    
                    structure = {
                        "N": current_class_name,
                        "P": current_parent,
                        "S": struct_size,
                        "M": current_members,
                        "T": current_type
                    }
                    
                    self.structures.append(structure)
                    self.logger.info(
                        f"Completed {current_type}: {current_class_name} "
                        f"(size: {struct_size}, members: {len(current_members)})"
                    )
                    
                    # Reset state
                    in_class = False
                    current_class_name = None
                    current_parent = None
                    current_type = None
                    current_members = []
    
    def _infer_type(self, name: str, size: str) -> str:
        """
        Infer member type from name and size
        
        Args:
            name: Member name
            size: Member size in hex
            
        Returns:
            Inferred type string
        """
        size_int = int(size, 16)
        
        # Type inference based on size
        if size_int == 0x1:
            if 'b' in name.lower() and name.startswith('b'):
                return 'bool'
            return 'uint8_t'
        elif size_int == 0x2:
            return 'uint16_t'
        elif size_int == 0x4:
            if 'float' in name.lower():
                return 'float'
            return 'int32_t'
        elif size_int == 0x8:
            # Could be pointer or uint64
            if any(word in name.lower() for word in ['component', 'actor', 'object', 'class', 'ptr']):
                # Try to infer pointer type from name
                for word in name.split('_'):
                    if word and word[0].isupper():
                        return f'U{word}*' if word.startswith('U') else f'A{word}*'
                return 'UObject*'
            return 'uint64_t'
        elif size_int == 0x10:
            if 'string' in name.lower() or 'name' in name.lower():
                return 'FString'
            return 'TArray<uint8_t>'
        elif size_int == 0x20:
            return 'TArray<uint8_t>'
        else:
            return f'uint8_t[{size_int}]'
    
    def _calculate_size(self, members: List[Dict]) -> int:
        """
        Calculate total structure size from members
        
        Args:
            members: List of member dictionaries
            
        Returns:
            Total size in bytes
        """
        if not members:
            return 0
        
        try:
            # Find the last member's offset + size
            max_offset = 0
            max_size = 0
            
            for member in members:
                offset = int(member['O'], 16)
                size = int(member['S'], 16)
                
                if offset >= max_offset:
                    max_offset = offset
                    max_size = size
            
            return max_offset + max_size
            
        except Exception as e:
            self.logger.warning(f"Error calculating size: {e}")
            self.stats.warnings += 1
            return 0
    
    def save_to_json(self, output_path: Path) -> bool:
        """
        Save parsed structures to JSON file
        
        Args:
            output_path: Path to output JSON file
            
        Returns:
            True if successful, False otherwise
        """
        self.logger.info("=" * 70)
        self.logger.info(f"Saving structures to JSON: {output_path}")
        
        try:
            self.logger.info(f"Writing {len(self.structures)} structures to file...")
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.structures, f, indent=2, ensure_ascii=False)
            
            file_size = output_path.stat().st_size
            self.logger.info(f"Successfully saved JSON file")
            self.logger.info(f"Output file size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")
            
            # Log sample of first structure
            if self.structures:
                self.logger.debug("First structure sample:")
                self.logger.debug(json.dumps(self.structures[0], indent=2))
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving JSON file: {e}", exc_info=True)
            self.stats.errors += 1
            return False


def main():
    """Main execution function with comprehensive logging"""
    print("\n" + "=" * 70)
    print("HPP to SDK JSON Converter")
    print("=" * 70 + "\n")
    
    # Setup logging
    logger = setup_logging(verbose=True)
    
    # Get file paths
    script_dir = Path(__file__).parent
    hpp_file = script_dir / "++Fortnite+Release-38.11-CL-48390828.hpp"
    output_file = script_dir / "sdk_data_converted.json"
    
    logger.info(f"Script directory: {script_dir}")
    logger.info(f"Input HPP file: {hpp_file}")
    logger.info(f"Output JSON file: {output_file}")
    
    # Check if input file exists
    if not hpp_file.exists():
        logger.error(f"Input file not found: {hpp_file}")
        logger.error("Please ensure the HPP file is in the same directory as this script")
        return 1
    
    # Create converter and parse
    converter = HPPToJSONConverter(logger)
    
    logger.info("\n" + "=" * 70)
    logger.info("PHASE 1: PARSING HPP FILE")
    logger.info("=" * 70)
    
    structures = converter.parse_hpp_file(hpp_file)
    
    if not structures:
        logger.error("No structures found in HPP file!")
        converter.stats.log_summary(logger)
        return 1
    
    logger.info("\n" + "=" * 70)
    logger.info("PHASE 2: SAVING TO JSON")
    logger.info("=" * 70)
    
    success = converter.save_to_json(output_file)
    
    # Log final statistics
    logger.info("\n")
    converter.stats.log_summary(logger)
    
    if success:
        logger.info("\n" + "=" * 70)
        logger.info("CONVERSION COMPLETED SUCCESSFULLY!")
        logger.info("=" * 70)
        logger.info(f"✓ Output file: {output_file}")
        logger.info(f"✓ Total structures: {len(structures)}")
        logger.info(f"✓ Processing time: {converter.stats.get_elapsed():.2f} seconds")
        return 0
    else:
        logger.error("\n" + "=" * 70)
        logger.error("CONVERSION FAILED!")
        logger.error("=" * 70)
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nConversion interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
