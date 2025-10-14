public with sharing class MobSchedulerController {

    @AuraEnabled
    public static Map<String,Object> getMobilizationDetails(Date startDate, Date endDate) {
        Map<String,Object> result = new Map<String,Object>{'weekEvents' => null};
        try{
            // Map to store data for LWC
    
            List<Mobilization__c> mobilizations = [
                SELECT Id, Name, Job__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Mobilization_Group__r.Name,
                       Start_Date__c, End_Date__c, Mobilization_Status__c,
                       Job__r.Address__c,
                       (SELECT Id, Contact__r.RecordType.DeveloperName, Contact__c, Contact__r.Name
                        FROM Mobilization_Members__r
                        WHERE Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                        ORDER BY Mobilization__r.Start_Date__c),
                       (SELECT Id, Equipment__c, Equipment__r.Name
                        FROM Mobilization_Assets__r 
                        ORDER BY Mobilization__r.Start_Date__c)
                FROM Mobilization__c
                WHERE DAY_ONLY(Start_Date__c) >= :startDate
                  AND DAY_ONLY(End_Date__c) <= :endDate
                WITH USER_MODE
                ORDER BY Start_Date__c
            ];
    
            List<Map<String,Object>> employees = new List<Map<String,Object>>();
            List<Map<String,Object>> weekEvents = new List<Map<String,Object>>();
    
            for(Mobilization__c mob : mobilizations){
                // Process members
                // List<Map<String,Object>> membersAndAssets = new List<Map<String,Object>>();
                List<Map<String,Object>> crewMembersList = new List<Map<String,Object>>();
                List<Map<String,Object>> subContractorsList = new List<Map<String,Object>>();
                for(Mobilization_Member__c mem : mob.Mobilization_Members__r){
                    Map<String,Object> member = new Map<String,Object>{
                        'id' => mem.Contact__c,
                        'name' => mem.Contact__r.Name,
                        'type' => mem.Contact__r.RecordType.DeveloperName,
                        'junctionId' => mem.Id
                    };
                    // membersAndAssets.add(member);
                    if(mem.Contact__r.RecordType.DeveloperName == 'Employee_WF_Recon'){
                        crewMembersList.add(member);
                    }else if(mem.Contact__r.RecordType.DeveloperName == 'Sub_Contractor_WF_Recon'){
                        subContractorsList.add(member);
                    }
                }
    
                // Process assets if needed
                List<Map<String,Object>> assetsList = new List<Map<String,Object>>();
                for(Mobilization_Asset__c asset : mob.Mobilization_Assets__r){
                    Map<String,Object> assetToUse = new Map<String,Object>{
                        'id' => asset.Equipment__c,
                        'name' => asset.Equipment__r.Name,
                        'junctionId' => asset.Id
                    };
                    // membersAndAssets.add(assetToUse);
                    assetsList.add(assetToUse);
                }
    
                // For week view
                weekEvents.add(new Map<String,Object>{
                    'id' => mob.Id,
                    'jobId' => mob.Job__r.Name,
                    'jobName' => mob.Job__r.Job_Name__c,
                    'location' => mob.Job__r.Address__c,
                    'start' => mob.Start_Date__c.format(),
                    'end' => mob.End_Date__c.format(),
                    'status' => mob.Mobilization_Status__c,
                    'crew' => crewMembersList,
                    'subcontractors' => subContractorsList,
                    'assets' => assetsList
                });
    
                // For employee view: create entry per employee
                // for(Map<String,Object> member : membersAndAssets){
                //     String empId = (String)member.get('id');
                //     Map<String,Object> empData;
                //     if(!result.containsKey(empId)){
                //         empData = new Map<String,Object>{
                //             'id' => empId,
                //             'name' => (String)member.get('name'),
                //             'days' => new List<Map<String,Object>>() // will fill in LWC per week
                //         };
                //         result.put(empId, empData);
                //     } else {
                //         empData = (Map<String,Object>)result.get(empId);
                //     }
                // }
            }
    
            result.put('weekEvents', weekEvents);
        }catch (Exception e){
            System.debug('MobSchedulerController.getMobilizationDetails(): ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Job_Default_Times__c getDefaultValues(){
        try {
            return [SELECT Id, Name, Start_Time__c, End_Time__c, Include_Saturday__c, Include_Sunday__c FROM Job_Default_Times__c WITH USER_MODE];
        } catch (Exception e) {
            System.debug('MobSchedulerController.getDefaultValues(): ' + e.getMessage());
            return null;
        }
    }

    // @AuraEnabled
    // public static Map<String, Object> getAllResources(){
    //     Map<String, Object> resources = new Map<String, Object>{'crew' => null, 'subcontractors' => null, 'assets' => null};
    //     try {
    //         resources.put('crew', [SELECT Id, Name FROM Contact WHERE RecordType.DeveloperName = 'Employee_WF_Recon' WITH USER_MODE]);
    //         resources.put('subcontractors', [SELECT Id, Name FROM Contact WHERE RecordType.DeveloperName = 'Sub_Contractor_WF_Recon' WITH USER_MODE]);
    //         resources.put('assets', [SELECT Id, Name FROM Equipment__c WITH USER_MODE]);
    //     } catch (Exception e) {
    //         System.debug('MobSchedulerController.getDefaultValues(): ' + e.getMessage());
    //     }
    //     return resources;
    // }

    @AuraEnabled
    public static Map<String, Object> getAllResources(Date selectedDate) {
        Map<String, Object> resources = new Map<String, Object>{
            'crew' => new List<Map<String, Object>>(),
            'subcontractors' => new List<Map<String, Object>>(),
            'assets' => new List<Map<String, Object>>()
        };

        try {
            // 1️⃣ Find which crew/subcontractors/assets are busy on the selected date
            Set<Id> busyCrewIds = new Set<Id>();
            Set<Id> busySubcontractorIds = new Set<Id>();
            Set<Id> busyAssetIds = new Set<Id>();

            List<Map<String, Object>> crewMembers = new List<Map<String, Object>>();
            List<Map<String, Object>> subContractors = new List<Map<String, Object>>();
            List<Map<String, Object>> assets = new List<Map<String, Object>>();

            // 2️⃣ Query Mobilizations happening on the selected date
            List<Mobilization__c> activeMobs = [
                SELECT Id,
                    (SELECT Contact__c, Contact__r.RecordType.DeveloperName 
                        FROM Mobilization_Members__r),
                    (SELECT Equipment__c 
                        FROM Mobilization_Assets__r)
                FROM Mobilization__c
                WHERE DAY_ONLY(Start_Date__c) = :selectedDate
                WITH USER_MODE
            ];

            System.debug('The Active One Are :: ' + activeMobs.size());
            // 3️⃣ Collect all busy resource IDs
            for (Mobilization__c mob : activeMobs) {
                System.debug('The Active One Are :: ' + mob.Mobilization_Members__r.size());
                for (Mobilization_Member__c mem : mob.Mobilization_Members__r) {
                    if (mem.Contact__r.RecordType.DeveloperName == 'Employee_WF_Recon') {
                        busyCrewIds.add(mem.Contact__c);
                    } else if (mem.Contact__r.RecordType.DeveloperName == 'Sub_Contractor_WF_Recon') {
                        busySubcontractorIds.add(mem.Contact__c);
                    }
                }
                for (Mobilization_Asset__c asset : mob.Mobilization_Assets__r) {
                    busyAssetIds.add(asset.Equipment__c);
                }
            }

            // 4️⃣ Query all Crew
            for (Contact c : [
                SELECT Id, Name
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                WITH USER_MODE
            ]) {
                crewMembers.add(new Map<String, Object>{
                    'id' => c.Id,
                    'name' => c.Name,
                    'isAvailable' => !busyCrewIds.contains(c.Id)
                });
            }

            // 5️⃣ Query all Subcontractors
            for (Contact sc : [
                SELECT Id, Name
                FROM Contact
                WHERE RecordType.DeveloperName = 'Sub_Contractor_WF_Recon'
                WITH USER_MODE
            ]) {
                subContractors.add(new Map<String, Object>{
                    'id' => sc.Id,
                    'name' => sc.Name,
                    'isAvailable' => !busySubcontractorIds.contains(sc.Id)
                });
            }

            // 6️⃣ Query all Assets
            for (Equipment__c eq : [
                SELECT Id, Name
                FROM Equipment__c
                WITH USER_MODE
            ]) {
                assets.add(new Map<String, Object>{
                    'id' => eq.Id,
                    'name' => eq.Name,
                    'isAvailable' => !busyAssetIds.contains(eq.Id)
                });
            }

            // 7️⃣ Final assignment
            resources.put('crew', crewMembers);
            resources.put('subcontractors', subContractors);
            resources.put('assets', assets);

        } catch (Exception e) {
            System.debug('MobSchedulerController.getAllResources(): ' + e.getMessage());
        }

        return resources;
    }



    @AuraEnabled
    public static List<Map<String,Object>> getResourceDetails(Date startDate, Date endDate, String resourceType) {
        List<Map<String,Object>> result = new List<Map<String,Object>>();
        try {
            if(resourceType == null) return result;

            String memberRecordType = '';
            Boolean fetchAssets = false;

            if(resourceType == 'Crew') {
                memberRecordType = 'Employee_WF_Recon';
            } else if(resourceType == 'SubContractor') {
                memberRecordType = 'Sub_Contractor_WF_Recon';
            } else if(resourceType == 'Asset') {
                fetchAssets = true;
            } else {
                return result; // invalid type
            }

            List<Mobilization__c> mobilizations;

            if(fetchAssets){
                mobilizations = [
                    SELECT Id, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Job__r.Address__c, Start_Date__c, End_Date__c,
                        (SELECT Id, Equipment__c, Equipment__r.Name
                            FROM Mobilization_Assets__r 
                            ORDER BY Mobilization__r.Start_Date__c)
                    FROM Mobilization__c
                    WHERE DAY_ONLY(Start_Date__c) >= :startDate
                    AND DAY_ONLY(End_Date__c) <= :endDate
                    WITH USER_MODE
                    ORDER BY Start_Date__c
                ];
            } else {
                mobilizations = [
                    SELECT Id, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Job__r.Address__c, Start_Date__c, End_Date__c,
                        (SELECT Id, Contact__c, Contact__r.Name
                            FROM Mobilization_Members__r
                            WHERE Contact__r.RecordType.DeveloperName = :memberRecordType
                            ORDER BY Mobilization__r.Start_Date__c)
                    FROM Mobilization__c
                    WHERE DAY_ONLY(Start_Date__c) >= :startDate
                    AND DAY_ONLY(End_Date__c) <= :endDate
                    WITH USER_MODE
                    ORDER BY Start_Date__c
                ];
            }

            for(Mobilization__c mob : mobilizations){
                if(fetchAssets){
                    for(Mobilization_Asset__c asset : mob.Mobilization_Assets__r){
                        result.add(new Map<String,Object>{
                            'id' => asset.Equipment__c,
                            'name' => asset.Equipment__r.Name,
                            'jobId' => mob.Job__r.Name,
                            'jobName' => mob.Job__r.Job_Name__c,
                            'junctionId' => asset.Id,
                            'location' => mob.Job__r.Address__c,
                            'start' => mob.Start_Date__c.format(),
                            'end' => mob.End_Date__c.format()
                        });
                    }
                } else {
                    for(Mobilization_Member__c mem : mob.Mobilization_Members__r){
                        result.add(new Map<String,Object>{
                            'id' => mem.Contact__c,
                            'name' => mem.Contact__r.Name,
                            'jobId' => mob.Job__r.Name,
                            'jobName' => mob.Job__r.Job_Name__c,
                            'junctionId' => mem.Id,
                            'location' => mob.Job__r.Address__c,
                            'start' => mob.Start_Date__c.format(),
                            'end' => mob.End_Date__c.format()
                        });
                    }
                }
            }
        } catch (Exception e) {
            System.debug('MobSchedulerController.getMobilizationDetails(): ' + e.getMessage());
        }
        
        return result;
    }

    @AuraEnabled
    public static string removeJobResource(String id, String type){
        try {
            if(type == 'Crew' || type == 'SubContractor'){
                Mobilization_Member__c mobMember = new Mobilization_Member__c(Id = id);
                delete as user mobMember;
            } else if (type == 'Asset'){
                Mobilization_Asset__c mobAsset = new Mobilization_Asset__c(Id = id);
                delete as user mobAsset;
            }
            return 'success';
        } catch (Exception e) {
            System.debug('MobSchedulerController.removeJobResource(): ' + e.getMessage());
            return e.getMessage();
        }
    }

    @AuraEnabled
    public static String assignResourceToMob(Map<String,Object> assignmentData) {
        try {
            String resourceId = (String) assignmentData.get('resourceId');
            String mobId = (String) assignmentData.get('mobId');
            String type = (String) assignmentData.get('type');
            Boolean allowOverlap = (Boolean) assignmentData.get('allowOverlap');

            if(!allowOverlap){
                // Get the mobilization dates for the new assignment
                Mobilization__c mob = [
                    SELECT Id, Start_Date__c, End_Date__c
                    FROM Mobilization__c
                    WHERE Id = :mobId
                    WITH USER_MODE
                    LIMIT 1
                ];
    
                Date newStart = mob.Start_Date__c.date();
                DateTime newEnd   = mob.End_Date__c;
    
                // Query existing mobilizations for the same resource
                List<sObject> overlappingMobs;
    
                if (type == 'Crew' || type == 'SubContractor') {
                    overlappingMobs = [
                        SELECT Id
                        FROM Mobilization_Member__c
                        WHERE Contact__c = :resourceId
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) = :newStart
                        WITH USER_MODE
                    ];
                } else if (type == 'Asset') {
                    overlappingMobs = [
                        SELECT Id
                        FROM Mobilization_Asset__c
                        WHERE Equipment__c = :resourceId
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) = :newStart
                        WITH USER_MODE
                    ];
                }
    
                // If overlapping found, return
                if (!overlappingMobs.isEmpty()) {
                    return 'OVERLAP';
                }
            }

            // Insert new assignment
            if (type == 'Crew' || type == 'SubContractor') {
                Mobilization_Member__c mobMember = new Mobilization_Member__c(
                    Mobilization__c = mobId,
                    Contact__c = resourceId
                );
                insert as user mobMember;
            } else if (type == 'Asset') {
                Mobilization_Asset__c mobAsset = new Mobilization_Asset__c(
                    Mobilization__c = mobId,
                    Equipment__c = resourceId
                );
                insert as user mobAsset;
            }

            return 'success';
        } catch (Exception e) {
            System.debug('MobSchedulerController.assignResourceToMob(): ' + e.getMessage());
            return e.getMessage();
        }
    }

    // @AuraEnabled
    // public static String assignResourceToJob(Map<String, Object> assignmentData) {
    //     try {
    //         List<String> resourceIds = String.valueOf((assignmentData.get('resourceIds'))).split(',');
    //         String mobId = (String) assignmentData.get('mobId');
    //         String type = (String) assignmentData.get('type');
    //         Boolean allowOverlap = (Boolean) assignmentData.get('allowOverlap');
    //         Boolean noOverlap = (Boolean) assignmentData.get('noOverlap');
    //         Map<String, Boolean> allowOverlapMap = new Map<String, Boolean>();
    //         Map<Object, Object> untypedMap = (Map<Object, Object>) assignmentData.get('allowOverlapMap');


    //         // 1️⃣ Get mobilization details + parent Job
    //         Mobilization__c selectedMob = [
    //             SELECT Id, Job__c, Job__r.Job_Name__c, Mobilization_Group__c, Start_Date__c
    //             FROM Mobilization__c
    //             WHERE Id = :mobId
    //             WITH USER_MODE
    //             LIMIT 1
    //         ];

    //         if (selectedMob == null) {
    //             return JSON.serialize(new Map<String, Object>{
    //                 'status' => 'ERROR',
    //                 'message' => 'Mobilization not found'
    //             });
    //         }

    //         // 2️⃣ Get all sibling mobilizations under the same Job
    //         List<Mobilization__c> siblingMobs = [
    //             SELECT Id, Start_Date__c, Job__r.Job_Name__c
    //             FROM Mobilization__c
    //             WHERE Job__c = :selectedMob.Job__c
    //             AND Mobilization_Group__c = :selectedMob.Mobilization_Group__c
    //             AND DAY_ONLY(Start_Date__c) >= :selectedMob.Start_Date__c.date()
    //             WITH USER_MODE
    //         ];

    //         if (siblingMobs.isEmpty()) {
    //             return JSON.serialize(new Map<String, Object>{
    //                 'status' => 'ERROR',
    //                 'message' => 'No sibling mobilizations found'
    //             });
    //         }

    //         // 🟡 Track overlapping mobilizations
    //         List<Map<String, Object>> overlapDetails = new List<Map<String, Object>>();

    //         if (!allowOverlap) {
    //             // 3️⃣ Gather all sibling mobilization Ids
    //             Set<Id> siblingMobIds = new Set<Id>();
    //             for (Mobilization__c mob : siblingMobs) {
    //                 siblingMobIds.add(mob.Id);
    //             }

    //             // 4️⃣ Query existing resource assignments across sibling mobilizations
    //             List<SObject> overlappingAssignments = new List<SObject>();

    //             if (type == 'Crew' || type == 'SubContractor') {
    //                 overlappingAssignments = [
    //                     SELECT Id, Mobilization__c
    //                     FROM Mobilization_Member__c
    //                     WHERE Contact__c IN :resourceIds
    //                     AND Mobilization__c IN :siblingMobIds
    //                     WITH USER_MODE
    //                 ];
    //             } else if (type == 'Asset') {
    //                 overlappingAssignments = [
    //                     SELECT Id, Mobilization__c
    //                     FROM Mobilization_Asset__c
    //                     WHERE Equipment__c IN :resourceIds
    //                     AND Mobilization__c IN :siblingMobIds
    //                     WITH USER_MODE
    //                 ];
    //             }

    //             // 5️⃣ Build overlap map if found (deduplicated)
    //             if (!overlappingAssignments.isEmpty()) {
    //                 // Create a quick lookup for Start Dates and Job Names
    //                 // Map<Id, Mobilization__c> mobMap = new Map<Id, Mobilization__c>();
    //                 // for (Mobilization__c mob : siblingMobs) {
    //                 //     mobMap.put(mob.Id, mob);
    //                 // }

    //                 // // Use a set to track which mobilization Ids we already added
    //                 // Set<Id> addedMobIds = new Set<Id>();

    //                 // for (SObject overlap : overlappingAssignments) {
    //                 //     Id overlappingMobId = (Id) overlap.get('Mobilization__c');
                        
    //                 //     // Only add if not already added
    //                 //     if (!addedMobIds.contains(overlappingMobId)) {
    //                 //         addedMobIds.add(overlappingMobId);
                            
    //                 //         Mobilization__c mob = mobMap.get(overlappingMobId);
    //                 //         if (mob != null) {
    //                 //             overlapDetails.add(new Map<String, Object>{
    //                 //                 'Id' => overlappingMobId,
    //                 //                 'label' => mob.Job__r.Job_Name__c + ' (' + mob.Start_Date__c.format() + ')'
    //                 //             });
    //                 //         }
    //                 //     }
    //                 // }

    //                 return JSON.serialize(new Map<String, Object>{
    //                     'status' => 'OVERLAP',
    //                     'overlaps' => null
    //                 });
    //             }
    //         // }else{
    //         //     for (Object key : untypedMap.keySet()) {
    //         //         if (key instanceof String && untypedMap.get(key) instanceof Boolean) {
    //         //             allowOverlapMap.put((String) key, (Boolean) untypedMap.get(key));
    //         //         }
    //         //     }
    //         }

    //         // 6️⃣ No overlaps → Assign resource to all sibling mobilizations
    //         List<SObject> newAssignments = new List<SObject>();
    //         for (Mobilization__c mob : siblingMobs) {
    //             // Boolean canAssign = true;
    //             // if (allowOverlapMap != null && allowOverlapMap.containsKey(mob.Id)) {
    //             //     canAssign = allowOverlapMap.get(mob.Id);
    //             // }


    //             if (!noOverlap) {
    //                 if (type == 'Crew' || type == 'SubContractor') {
    //                     for (String resourceId : resourceIds) {
    //                         newAssignments.add(new Mobilization_Member__c(
    //                             Mobilization__c = mob.Id,
    //                             Contact__c = resourceId
    //                         ));
    //                     }
    //                 } else if (type == 'Asset') {
    //                     for (String resourceId : resourceIds) {
    //                         newAssignments.add(new Mobilization_Asset__c(
    //                             Mobilization__c = mob.Id,
    //                             Equipment__c = resourceId
    //                         ));
    //                     }
    //                 }
    //             }
    //         }


    //         if (!newAssignments.isEmpty()) {
    //             insert as user newAssignments;
    //         }

    //         return JSON.serialize(new Map<String, Object>{
    //             'status' => 'SUCCESS'
    //         });
    //     } catch (Exception e) {
    //         System.debug('MobSchedulerController.assignResourceToJob(): Exception => ' + e.getMessage());
    //         return JSON.serialize(new Map<String, Object>{
    //             'status' => 'ERROR',
    //             'message' => e.getMessage()
    //         });
    //     }
    // }

    @AuraEnabled
    public static String assignResourceToJob(Map<String, Object> assignmentData) {
        try {
            List<String> resourceIds = String.valueOf((assignmentData.get('resourceIds'))).split(',');
            String mobId = (String) assignmentData.get('mobId');
            String type = (String) assignmentData.get('type');
            Boolean allowOverlap = (Boolean) assignmentData.get('allowOverlap');
            String overlapMode = (String) assignmentData.get('overlapMode'); // "ALL" or "SKIP"

            // 🟢 Validate input
            if (resourceIds == null || resourceIds.isEmpty()) {
                return JSON.serialize(new Map<String, Object>{
                    'status' => 'ERROR',
                    'message' => 'No resources provided for assignment.'
                });
            }

            // 1️⃣ Get mobilization details + parent Job
            Mobilization__c selectedMob = [
                SELECT Id, Job__c, Job__r.Job_Name__c, Mobilization_Group__c, Start_Date__c
                FROM Mobilization__c
                WHERE Id = :mobId
                WITH USER_MODE
                LIMIT 1
            ];

            if (selectedMob == null) {
                return JSON.serialize(new Map<String, Object>{
                    'status' => 'ERROR',
                    'message' => 'Mobilization not found.'
                });
            }

            // 2️⃣ Get all sibling mobilizations
            List<Mobilization__c> siblingMobs = [
                SELECT Id, Start_Date__c, Job__r.Job_Name__c
                FROM Mobilization__c
                WHERE Job__c = :selectedMob.Job__c
                AND Mobilization_Group__c = :selectedMob.Mobilization_Group__c
                AND DAY_ONLY(Start_Date__c) >= :selectedMob.Start_Date__c.date()
                WITH USER_MODE
            ];

            if (siblingMobs.isEmpty()) {
                return JSON.serialize(new Map<String, Object>{
                    'status' => 'ERROR',
                    'message' => 'No sibling mobilizations found.'
                });
            }

            // 🔹 Prepare for overlap checks
            Set<Id> siblingMobIds = new Set<Id>();
            Set<Date> siblingMobDates = new Set<Date>();
            for (Mobilization__c mob : siblingMobs) {
                siblingMobIds.add(mob.Id);
                siblingMobDates.add(mob.Start_Date__c.date());
            }

            List<Map<String, Object>> overlapDetails = new List<Map<String, Object>>();

            // 3️⃣ If overlap not allowed, check before inserting
            if (!allowOverlap) {
                for (String resourceId : resourceIds) {
                    List<SObject> overlaps = new List<SObject>();

                    if (type == 'Crew' || type == 'SubContractor') {
                        overlaps = [
                            SELECT Id, Mobilization__c
                            FROM Mobilization_Member__c
                            WHERE Contact__c = :resourceId
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.date()
                            WITH USER_MODE
                        ];
                    } else if (type == 'Asset') {
                        overlaps = [
                            SELECT Id, Mobilization__c
                            FROM Mobilization_Asset__c
                            WHERE Equipment__c = :resourceId
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.date()
                            WITH USER_MODE
                        ];
                    }

                    if (!overlaps.isEmpty()) {
                        // Only report one overlapping mobilization per resource
                        overlapDetails.add(new Map<String, Object>{
                            'resourceId' => resourceId,
                            'count' => overlaps.size()
                        });
                    }
                }

                if (!overlapDetails.isEmpty()) {
                    return JSON.serialize(new Map<String, Object>{
                        'status' => 'OVERLAP',
                        'overlaps' => overlapDetails
                    });
                }
            }

            // 4️⃣ Proceed with assignment
            List<SObject> newAssignments = new List<SObject>();

            for (String resourceId : resourceIds) {
                // Get existing overlaps (needed only for overlapMode == SKIP)
                Set<Id> overlappingMobIds = new Set<Id>();
                Set<Date> overlappingMobDates = new Set<Date>();
                if (allowOverlap && overlapMode == 'SKIP') {
                    if (type == 'Crew' || type == 'SubContractor') {
                        List<Mobilization_Member__c> overlaps = [
                            SELECT Mobilization__c, Mobilization__r.Start_Date__c
                            FROM Mobilization_Member__c
                            WHERE Contact__c = :resourceId
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.date()
                            WITH USER_MODE
                        ];

                        for (Mobilization_Member__c o : overlaps) {
                            overlappingMobIds.add(o.Mobilization__c);
                            overlappingMobDates.add(o.Mobilization__r.Start_Date__c.date());
                        }
                    } else if (type == 'Asset') {
                        List<Mobilization_Asset__c> overlaps = [
                            SELECT Mobilization__c, Mobilization__r.Start_Date__c
                            FROM Mobilization_Asset__c
                            WHERE Equipment__c = :resourceId
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                            AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.date()
                            WITH USER_MODE
                        ];

                        for (Mobilization_Asset__c o : overlaps) {
                            overlappingMobIds.add(o.Mobilization__c);
                            overlappingMobDates.add(o.Mobilization__r.Start_Date__c.date());
                        }
                    }
                }

                System.debug('Overlapping Mob Ids :: '+ overlappingMobIds);
                System.debug('Overlapping Mob Dates :: '+ overlappingMobDates);

                for (Mobilization__c mob : siblingMobs) {
                    Boolean shouldAssign = true;

                    if (allowOverlap && overlapMode == 'SKIP' && overlappingMobDates.contains(mob.Start_Date__c.date())) {
                        shouldAssign = false;
                    }

                    System.debug(' Assigning :: ' + shouldAssign + ' :: ' + mob.Id + ' :: ' + resourceId + ' :: ' + type);
                    if (shouldAssign) {
                        if (type == 'Crew' || type == 'SubContractor') {
                            newAssignments.add(new Mobilization_Member__c(
                                Mobilization__c = mob.Id,
                                Contact__c = resourceId
                            ));
                        } else if (type == 'Asset') {
                            newAssignments.add(new Mobilization_Asset__c(
                                Mobilization__c = mob.Id,
                                Equipment__c = resourceId
                            ));
                        }
                    }
                }
            }

            System.debug('Assignments :: '+ newAssignments);
            // 5️⃣ Insert all assignments
            if (!newAssignments.isEmpty()) {
                insert as user newAssignments;
            }

            return JSON.serialize(new Map<String, Object>{
                'status' => 'SUCCESS'
            });

        } catch (Exception e) {
            System.debug('MobSchedulerController.assignResourceToJob(): Exception => ' + e.getMessage());
            return JSON.serialize(new Map<String, Object>{
                'status' => 'ERROR',
                'message' => e.getMessage()
            });
        }
    }


    @AuraEnabled
    public static string deleteMobilization(String mobId){
        try {
            Mobilization__c mob = [SELECT Id, (SELECT Id FROM Mobilization_Members__r), (SELECT Id FROM Mobilization_Assets__r) FROM Mobilization__c WHERE Id =:mobId WITH USER_MODE];
            List<Mobilization_Member__c> mobMembersToDelete = mob.Mobilization_Members__r;
            List<Mobilization_Asset__c> mobAssetsToDelete = mob.Mobilization_Assets__r;
            delete as user mobMembersToDelete;
            delete as user mobAssetsToDelete;
            delete as user mob;
            return 'success';
        } catch (Exception e) {
            System.debug('MobSchedulerController.deleteMobilization(): ' + e.getMessage());
            return e.getMessage();
        }
    }
}