


import os 
import re 
import json 
from pathlib import Path 
from typing import List ,Dict ,Any 

class FortniteSDKConverter :
    def __init__ (self ):
        self .classes =[]
        self .globals_data ={"bases":{},"offsets":{}}

    def convert_sdk_directory (self ,sdk_path :str )->None :

        sdk_dir =Path (sdk_path )

        if not sdk_dir .exists ():
            print (f"❌ SDK directory not found: {sdk_path }")
            return 


        h_files =list (sdk_dir .rglob ("*.h"))

        if not h_files :
            print (f"❌ No .h files found in {sdk_path }")
            return 

        print (f"📦 Found {len (h_files )} .h files")
        print (f"🔄 Processing SDK files...")

        processed =0 
        classes_found =0 
        members_found =0 

        for h_file in h_files :
            try :
                with open (h_file ,'r',encoding ='utf-8',errors ='ignore')as f :
                    content =f .read ()


                file_classes =self .parse_dumper7_format (content ,h_file .name )

                if file_classes :
                    self .classes .extend (file_classes )
                    classes_found +=len (file_classes )
                    members_found +=sum (len (c ["M"])for c in file_classes )

                processed +=1 

                if processed %1000 ==0 :
                    print (f"  📄 Processed {processed } files, found {classes_found } classes with {members_found } members...")

            except Exception as e :
                print (f"❌ Error processing {h_file .name }: {e }")
                continue 

        print (f"✅ Processed {processed } files")
        print (f"🎯 Found {len (self .classes )} classes with {members_found } total members")

    def parse_dumper7_format (self ,content :str ,filename :str )->List [Dict [str ,Any ]]:
        
        classes =[]



        class_pattern =r'(?:class|struct)\s+([A-Z][A-Za-z0-9_]*)\s+(?:final\s+)?(?::\s*public\s+([A-Za-z0-9_:]+))?\s*\n\s*\{\s*\n(.*?)\n\s*\};'

        matches =re .finditer (class_pattern ,content ,re .MULTILINE |re .DOTALL )

        for match in matches :
            class_name =match .group (1 )
            parent_class =match .group (2 )if match .group (2 )else ""
            class_body =match .group (3 )if match .group (3 )else ""


            if not self .is_valid_class_name (class_name ):
                continue 


            members =self .parse_members_dumper7 (class_body )


            class_size =self .calculate_class_size (content ,class_name ,members )

            classes .append ({
            "N":class_name ,
            "P":self .clean_parent_name (parent_class ),
            "S":class_size ,
            "T":"class",
            "M":members 
            })

        return classes 

    def parse_members_dumper7 (self ,class_body :str )->List [Dict [str ,str ]]:
        """Parse member variables from class body - Dumper-7 format"""
        members =[]


        lines =class_body .split ('\n')

        for line in lines :
            line =line .strip ()
            if not line :
                continue 


            if line in ['public:','private:','protected:']or line .startswith ('//'):
                continue 





            member_patterns =[

            r'^([A-Za-z0-9_:<>,\s\*\[\]&]+)\s+([A-Za-z0-9_]+);\s*//\s*0x([0-9A-Fa-f]+)\(0x([0-9A-Fa-f]+)\)',

            r'^([A-Za-z0-9_:<>,\s\*\[\]&]+)\s+([A-Za-z0-9_]+);\s*//\s*0x([0-9A-Fa-f]+)\s*\(0x([0-9A-Fa-f]+)\)',

            r'^([A-Za-z0-9_:<>,\s\*\[\]&]+)\s+([A-Za-z0-9_]+);\s*//\s*0x([0-9A-Fa-f]+)',

            r'^([A-Za-z0-9_:<>,\s\*\[\]&]+)\s+([A-Za-z0-9_]+);\s*//\s*Offset:\s*0x([0-9A-Fa-f]+)(?:,\s*Size:\s*0x([0-9A-Fa-f]+))?',
            ]

            for pattern_index ,pattern in enumerate (member_patterns ):
                match =re .match (pattern ,line )
                if match :
                    member_type =self .clean_type_name (match .group (1 ))
                    member_name =match .group (2 ).strip ()
                    offset =match .group (3 ).strip ()


                    if len (match .groups ())>=4 and match .group (4 ):
                        size =match .group (4 ).strip ()
                    else :

                        size =self .guess_type_size (member_type )


                    if self .should_skip_member (member_name ):
                        continue 

                    members .append ({
                    "N":member_name ,
                    "T":member_type ,
                    "O":f"0x{offset .upper ()}",
                    "S":f"0x{size .upper ()}"if isinstance (size ,str )else f"0x{size :X}"
                    })
                    break 


        members .sort (key =lambda x :int (x ["O"],16 ))
        return members 

    def guess_type_size (self ,type_name :str )->str :
        """Guess the size of a type based on common C++ types"""
        type_sizes ={
        'bool':'01',
        'char':'01',
        'uint8':'01',
        'int8':'01',
        'uint16':'02',
        'int16':'02',
        'short':'02',
        'uint32':'04',
        'int32':'04',
        'int':'04',
        'float':'04',
        'uint64':'08',
        'int64':'08',
        'double':'08',
        'long long':'08',
        }


        clean_type =type_name .strip ().lower ()


        if '*'in type_name :
            return '08'


        if '['in type_name :
            return '04'


        for known_type ,size in type_sizes .items ():
            if known_type in clean_type :
                return size 


        return '04'

    def calculate_class_size (self ,content :str ,class_name :str ,members :List [Dict ])->int :
        """Calculate class size from members or find size comments"""


        size_patterns =[
        rf'//\s*0x([0-9A-Fa-f]+)\s*\(0x[0-9A-Fa-f]+\).*{re .escape (class_name )}',
        rf'{re .escape (class_name )}.*//\s*0x([0-9A-Fa-f]+)',
        rf'sizeof\s*\(\s*{re .escape (class_name )}\s*\)\s*==\s*0x([0-9A-Fa-f]+)',
        ]

        for pattern in size_patterns :
            match =re .search (pattern ,content ,re .IGNORECASE )
            if match :
                return int (match .group (1 ),16 )


        if members :
            max_offset =0 
            max_size =0 

            for member in members :
                try :
                    offset =int (member ["O"],16 )
                    size =int (member ["S"],16 )
                    end_offset =offset +size 
                    if end_offset >max_offset +max_size :
                        max_offset =offset 
                        max_size =size 
                except :
                    continue 

            return max_offset +max_size 

        return 0 

    def is_valid_class_name (self ,name :str )->bool :
        """Check if class name is valid"""
        if not name or len (name )<2 :
            return False 


        invalid_patterns =['<','>','Param_','Parms','EventGraph','__']
        return not any (pattern in name for pattern in invalid_patterns )

    def clean_parent_name (self ,parent :str )->str :
        """Clean up parent class name"""
        if not parent :
            return ""


        parent =parent .replace ('SDK::','').replace ('::','')


        if '<'in parent :
            parent =parent .split ('<')[0 ]

        return parent .strip ()

    def should_skip_member (self ,member_name :str )->bool :
        """Skip padding and irrelevant members"""
        skip_patterns =[
        'Pad_','pad_','UnknownData','UberGraphFrame',
        '__padding','Padding','Reserved','bPad_'
        ]
        return any (pattern in member_name for pattern in skip_patterns )

    def clean_type_name (self ,type_name :str )->str :
        """Clean up C++ type names"""

        type_name =re .sub (r'\s+',' ',type_name .strip ())


        type_name =re .sub (r'\b(class|struct|enum)\s+','',type_name )


        replacements ={
        'unsigned char':'uint8',
        'unsigned short':'uint16',
        'unsigned int':'uint32',
        'unsigned long long':'uint64',
        'signed char':'int8',
        'short':'int16',
        'long long':'int64',
        }

        for old ,new in replacements .items ():
            type_name =type_name .replace (old ,new )

        return type_name .strip ()

    def save_to_json (self ,output_dir :str ="Data")->None :
        """Save converted data to JSON files"""
        os .makedirs (output_dir ,exist_ok =True )


        sdk_file =os .path .join (output_dir ,"sdk_data.json")
        with open (sdk_file ,'w')as f :
            json .dump (self .classes ,f ,indent =2 )

        print (f"✅ Saved {len (self .classes )} classes to {sdk_file }")


        classes_with_members =[c for c in self .classes if c ["M"]]
        total_members =sum (len (c ["M"])for c in self .classes )

        print (f"📊 Classes with members: {len (classes_with_members )}")
        print (f"📊 Total members found: {total_members }")

        if classes_with_members :
            avg_members =total_members /len (classes_with_members )
            print (f"📊 Average members per class: {avg_members :.1f}")


        globals_file =os .path .join (output_dir ,"globals.json")
        with open (globals_file ,'w')as f :
            json .dump ({
            "bases":{
            "GWorld":"0x0",
            "GNames":"0x0",
            "GObjects":"0x0"
            },
            "offsets":{}
            },f ,indent =2 )

        print (f"✅ Saved globals to {globals_file }")

def main ():
    import argparse 

    parser =argparse .ArgumentParser (description ='Convert Fortnite Dumper-7 SDK to JSON')
    parser .add_argument ('sdk_path',help ='Path to SDK directory containing .h files')
    parser .add_argument ('-o','--output',default ='Data',help ='Output directory')

    args =parser .parse_args ()

    converter =FortniteSDKConverter ()

    print (f"🚀 Converting Fortnite SDK from: {args .sdk_path }")
    converter .convert_sdk_directory (args .sdk_path )
    converter .save_to_json (args .output )

    print (f"\n🎉 Conversion complete!")

if __name__ =="__main__":
    main ()