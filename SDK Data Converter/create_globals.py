


import json 
import os 

def create_globals_json ():



    global_bases ={
    "UWorld":"0x173BDD18",
    "GNames":"0x167B6600"
    }



    engine_offsets ={
    "UWorld":{
    "OwningGameInstance":"0x248",
    "GameState":"0x1D0",
    "PersistentLevel":"0x40"
    },
    "UGameInstance":{
    "LocalPlayers":"0x38"
    },
    "ULocalPlayer":{
    "PlayerController":"0x30"
    },
    "APlayerController":{
    "PlayerCameraManager":"0x360",
    "AcknowledgedPawn":"0x358",
    "PlayerState":"0x2D0"
    },
    "APlayerState":{
    "TeamIndex":"0x11A9",
    "Platform":"0x440",
    "KillScore":"0x11A8",
    "PlayerName":"0xA00",
    "RankedProgress":"0xD8"
    },
    "APawn":{
    "RootComponent":"0x1B0",
    "PawnPrivate":"0x328"
    },
    "AActor":{
    "RootComponent":"0x1B0"
    },
    "AFortPawn":{
    "Mesh":"0x330",
    "CurrentWeapon":"0x990",
    "CurrentVehicle":"0x2C18",
    "IsDying":"0x728",
    "IsDBNO":"0x841",
    "TargetedFortPawn":"0x1900",
    "PlayerAim":"0x2BC0",
    "HabaneroComponent":"0x940"
    },
    "USkeletalMeshComponent":{
    "BoneArray":"0x5E8",
    "BoneCache":"0x5F8",
    "ComponentToWorld":"0x1E0",
    "ComponentVelocity":"0x188"
    },
    "USceneComponent":{
    "RelativeLocation":"0x140",
    "ComponentToWorld":"0x1E0"
    },
    "APlayerCameraManager":{
    "CameraLocation":"0x180",
    "CameraRotation":"0x190",
    "CameraFOV":"0x3B4"
    },
    "AFortWeapon":{
    "WeaponData":"0x5A0",
    "AmmoCount":"0x14D4"
    },
    "UFortItemDefinition":{
    "ItemName":"0x40",
    "ItemRarity":"0xAA",
    "Tier":"0xA2"
    },
    "AFortPickup":{
    "PrimaryPickupItemEntry":"0x3A8",
    "bAlreadySearched":"0xD52"
    },
    "UFortProjectileAthena":{
    "ProjectileSpeed":"0x2488",
    "ProjectileGravity":"0x21D8"
    },
    "AGameStateBase":{
    "PlayerArray":"0x2C8"
    },
    "ULevel":{
    "AActor":"0x128",
    "Levels":"0x1E8"
    }
    }


    common_offsets ={
    "UObject":{
    "Class":"0x10",
    "Name":"0x18",
    "Outer":"0x20"
    },
    "UClass":{
    "DefaultObject":"0x110"
    },
    "FName":{
    "Index":"0x0",
    "Number":"0x4"
    },
    "FString":{
    "Data":"0x0",
    "Length":"0x10",
    "MaxLength":"0x14"
    },
    "TArray":{
    "Data":"0x0",
    "Count":"0x8",
    "Max":"0xC"
    }
    }


    all_offsets ={**engine_offsets ,**common_offsets }


    globals_data ={
    "bases":global_bases ,
    "offsets":all_offsets ,
    "version":"38.10",
    "notes":"Generated from paysonism/Fortnite-Offsets repository",
    "last_updated":"2024-11-14"
    }


    os .makedirs ("Data",exist_ok =True )


    globals_file ="Data/globals.json"
    with open (globals_file ,'w')as f :
        json .dump (globals_data ,f ,indent =2 )

    print (f"Created {globals_file } with:")
    print (f"  - {len (global_bases )} global base addresses")
    print (f"  - {len (all_offsets )} classes with member offsets")
    print (f"  - Total of {sum (len (members )for members in all_offsets .values ())} individual offsets")

    return globals_data 

def update_existing_globals ():
    

    globals_file ="Data/globals.json"


    if os .path .exists (globals_file ):
        print (f"Updating existing {globals_file }...")

        try :
            with open (globals_file ,'r')as f :
                existing_data =json .load (f )
        except :
            print ("Error reading existing file, creating new one...")
            return create_globals_json ()


        new_data =create_globals_json ()


        if 'bases'not in existing_data :
            existing_data ['bases']={}
        existing_data ['bases'].update (new_data ['bases'])


        if 'offsets'not in existing_data :
            existing_data ['offsets']={}

        for class_name ,class_offsets in new_data ['offsets'].items ():
            if class_name not in existing_data ['offsets']:
                existing_data ['offsets'][class_name ]=class_offsets 
            else :

                existing_data ['offsets'][class_name ].update (class_offsets )


        existing_data ['version']=new_data ['version']
        existing_data ['last_updated']=new_data ['last_updated']


        with open (globals_file ,'w')as f :
            json .dump (existing_data ,f ,indent =2 )

        print (f"Updated {globals_file }")
        return existing_data 

    else :
        print (f"Creating new {globals_file }...")
        return create_globals_json ()

if __name__ =="__main__":
    print ("Creating Fortnite globals.json from offsets...")


    globals_data =update_existing_globals ()

    print ("\nGlobals.json structure:")
    print ("- bases: Global memory addresses")
    print ("- offsets: Class member offsets organized by class name")
    print ("- These offsets are typically not found in SDK dumps")
    print ("- Use these for runtime memory access and game hacking")


    print (f"\nSample global bases:")
    for name ,address in list (globals_data ['bases'].items ())[:3 ]:
        print (f"  {name }: {address }")

    print (f"\nSample class offsets:")
    for class_name ,offsets in list (globals_data ['offsets'].items ())[:2 ]:
        print (f"  {class_name }:")
        for offset_name ,offset_value in list (offsets .items ())[:3 ]:
            print (f"    {offset_name }: {offset_value }")