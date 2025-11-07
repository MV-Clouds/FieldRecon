/**
 * Description: Controller for Mobilization Scheduler LWC. Exposes methods to read mobilizations, resources and perform assignments/removals with user-mode enforcement.
 * Test Class: MobSchedulerControllerTest - 93% (2025-11-07)
 * Created By: Kevin Suvagiya
 * Created Date: 2025-10-06
 * Update: 2025-10-27 (Kevin)   - Updated the logic for the start and end date to fix timezone based issues
 * Update: 2025-10-28 (Kevin)   - Updated the logic for the removal of assigned resources from the mobilization, now with future removal as well
 * Update: 2025-10-29 (Kevin)   - Updated for the Crew Based Resources View Data Fetch
 * Update: 2025-10-30 (Kevin)   - Updated for the Crew Based Resources for the color for the Crew as well as Crew Members
 * Update: 2025-10-30 (Kevin)   - Modified code to allow assignments from the Calendar, by getting the first mobilization of the group to assign resources
 * Update: 2025-10-31 (Dhairya) - Modified the resource assignment according to the crew implementation and fixed the duplicate assignment bug for resource assignment to mob
 * Update: 2025-11-03 (Kevin)   - Updated the return statement for already assigned resource
 * Update: 2025-11-06 (Kevin)   - Updated the getDefaultValues methods to also retrieve the status options
 * Update: 2025-11-07 (Kevin)   - Updated the DML operations with the large data set with the batch class
 */
public with sharing class MobSchedulerController {
    private static final String CLASSNAME = 'MobSchedulerController';
    private static Map<String, Mobilization_Status_Color__c> statusColorMap = Mobilization_Status_Color__c.getAll();

    /**
     * Description: Returns mobilization entries within the date range for week view.
     * Parameters: startDate (Date) - inclusive start; endDate (Date) - inclusive end.
     * Return: Map<String,Object> with key 'weekEvents' -> List of event maps (job info, dates, status, resources).
     */
    @AuraEnabled
    public static Map<String,Object> getMobilizationDetails(Date startDate, Date endDate) {
        Map<String,Object> result = new Map<String,Object>{'weekEvents' => null};

        DateTime startOfDay = DateTime.newInstance(startDate, Time.newInstance(0,0,0,0));
        DateTime endOfDay = DateTime.newInstance(endDate.addDays(1), Time.newInstance(23,59,59,999));

        try{
            // Instruction: Query mobilizations and shape data for LWC consumption.
    
            List<Mobilization__c> mobilizations = [
                SELECT Id, Name, Job__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Mobilization_Group__r.Name,
                       Start_Date__c, End_Date__c, Mobilization_Status__c,
                       Job__r.Address__c,
                       (SELECT Id, Contact__r.RecordType.DeveloperName, Contact__c, Contact__r.Name, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                        FROM Mobilization_Members__r
                        WHERE Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                        ORDER BY CreatedDate DESC),
                       (SELECT Id, Equipment__c, Equipment__r.Name
                        FROM Mobilization_Assets__r 
                        ORDER BY CreatedDate DESC)
                FROM Mobilization__c
                WHERE Start_Date__c >= :startOfDay
                  AND End_Date__c <= :endOfDay
                WITH USER_MODE
                ORDER BY Start_Date__c
            ];
    
            List<Map<String,Object>> weekEvents = new List<Map<String,Object>>();
    
            for(Mobilization__c mob : mobilizations){
                // Instruction: Split members into Crew and SubContractor lists.
                List<Map<String,Object>> crewMembersList = new List<Map<String,Object>>();
                List<Map<String,Object>> subContractorsList = new List<Map<String,Object>>();
                for(Mobilization_Member__c mem : mob.Mobilization_Members__r){
                    String memberType = mem.Contact__r.RecordType.DeveloperName;
                    Map<String,Object> member = new Map<String,Object>{
                        'id' => mem.Contact__c,
                        'name' => mem.Contact__r.Name,
                        'type' => memberType,
                        'junctionId' => mem.Id
                    };
                    if(memberType == 'Employee_WF_Recon'){
                        if(mem.Crew__c != null){
                            member.put('crewId', mem.Crew__c);
                            member.put('crewName', mem.Crew__r.Name);
                            member.put('crewColor', mem.Crew__r.Color_Code__c);
                            member.put('bgStyle', 'background-color: color(from ' + mem.Crew__r.Color_Code__c + ' srgb r g b / 0.2); border: 1px solid ' + mem.Crew__r.Color_Code__c + ';');
                        }else{
                            member.put('crewName', 'Individual Employees');
                        }
                        crewMembersList.add(member);
                    }else if(memberType == 'Sub_Contractor_WF_Recon'){
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
                    assetsList.add(assetToUse);
                }
    
                // Instruction: Build event payload for week view card rendering.
                weekEvents.add(new Map<String,Object>{
                    'id' => mob.Id,
                    'jId' => mob.Job__c,
                    'jobId' => mob.Job__r.Name,
                    'jobName' => mob.Job__r.Job_Name__c != null ? mob.Job__r.Job_Name__c : '--',
                    'location' => mob.Job__r.Address__c != null ? mob.Job__r.Address__c : '--',
                    'start' => mob.Start_Date__c.format(),
                    'end' => mob.End_Date__c.format(),
                    'status' => mob.Mobilization_Status__c,
                    'crew' => crewMembersList,
                    'subcontractors' => subContractorsList,
                    'assets' => assetsList,
                    'bgColor' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Background_Color__c : '#C4C4C4',
                    'color' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Color__c : '#000000'
                });
    
            }
    
            result.put('weekEvents', weekEvents);
        }catch (Exception e){
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getMobilizationDetails', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching mobilization details for calendar.', 'apiResponse' => null});
        }
        return result;
    }

    /**
     * Description: Fetches default job time configuration.
     * Parameters: none.
     * Return: Job_Default_Times__c record or null if none found/error.
     */
    @AuraEnabled
    public static Map<String, Object> getDefaultValues() {
        Map<String, Object> defaultValues = new Map<String, Object>{'statusOptions' => null, 'time' => null, 'status' => null, 'result' => null};

        try {
            List<Job_Default_Times__c> timeDefaults = [
                SELECT Id, Name, Start_Time__c, End_Time__c, Include_Saturday__c, Include_Sunday__c 
                FROM Job_Default_Times__c 
                WITH USER_MODE
            ];
            List<Mobilization_Status_Color__c> statusDefaults = [
                SELECT Id, Name, Color__c, Background_Color__c 
                FROM Mobilization_Status_Color__c 
                WITH USER_MODE
            ];

            List<Map<String,String>> options = new List<Map<String,String>>();
            Schema.DescribeFieldResult fieldResult = Mobilization__c.Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            for( Schema.PicklistEntry f : ple){
                options.add(new Map<String,String>{'label' => f.getLabel(), 'value' => f.getValue()});
            }

            defaultValues.put('statusOptions', options);

            if(timeDefaults != null && !timeDefaults.isEmpty()) {
                Map<String, Object> defaultMap = new Map<String, Object>{'start' => null, 'end' => null, 'includeSaturday' => timeDefaults[0].Include_Saturday__c, 'includeSunday' => timeDefaults[0].Include_Sunday__c};
                
                // Get today's date
                Date today = Date.today();
                
                // Start Time
                String startTimeStr = timeDefaults[0].Start_Time__c; // e.g., "07:00 AM"
                if(startTimeStr != null) {
                    List<String> startParts = startTimeStr.split(' ');
                    List<String> hm = startParts[0].split(':');
                    Integer hour = Integer.valueOf(hm[0]);
                    Integer minute = Integer.valueOf(hm[1]);
                    String modifier = startParts[1];
                    
                    if(modifier == 'PM' && hour < 12) hour += 12;
                    if(modifier == 'AM' && hour == 12) hour = 0;
                    
                    defaultMap.put('start', DateTime.newInstance(today, Time.newInstance(hour, minute, 0, 0)));
                }
                
                // End Time
                String endTimeStr = timeDefaults[0].End_Time__c; // e.g., "06:20 PM"
                if(endTimeStr != null) {
                    List<String> endParts = endTimeStr.split(' ');
                    List<String> hm = endParts[0].split(':');
                    Integer hour = Integer.valueOf(hm[0]);
                    Integer minute = Integer.valueOf(hm[1]);
                    String modifier = endParts[1];
                    
                    if(modifier == 'PM' && hour < 12) hour += 12;
                    if(modifier == 'AM' && hour == 12) hour = 0;
                    
                    defaultMap.put('end', DateTime.newInstance(today, Time.newInstance(hour, minute, 0, 0)));
                }

                defaultValues.put('time', defaultMap);
            }

            if(statusDefaults != null && !statusDefaults.isEmpty()) {
                defaultValues.put('status', statusDefaults);
            }

            defaultValues.put('result', 'SUCCESS');

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getDefaultValues', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching default job time values.', 'apiResponse' => null });
            defaultValues.put('result', e.getMessage());
        }

        return defaultValues;
    }


    /**
     * Description: Returns all resources with an availability flag for the selected date.
     * Parameters: selectedDate (Date) - date to evaluate availability.
     * Return: Map with keys 'crew', 'subcontractors', 'assets' each as List<Map> with id, name, isAvailable.
     */
    @AuraEnabled
    public static Map<String, Object> getAllResources(Date selectedDate) {

        DateTime startOfDay = DateTime.newInstance(selectedDate, Time.newInstance(0,0,0,0));
        DateTime endOfDay = DateTime.newInstance(selectedDate, Time.newInstance(23,59,59,999));
        Map<String, Object> resources = new Map<String, Object>{
            'crew' => new List<Map<String, Object>>(),
            'subcontractors' => new List<Map<String, Object>>(),
            'assets' => new List<Map<String, Object>>()
        };

        try {
            // Instruction: Build busy sets from mobilizations on selected date then mark availability per resource.
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
                WHERE Start_Date__c >= :startOfDay
                AND Start_Date__c <= :endOfDay
                WITH USER_MODE
            ];

            // Instruction: Collect all busy resource IDs.
            for (Mobilization__c mob : activeMobs) {
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
                SELECT Id, Name, (SELECT Id, Crew__c, Crew__r.Name, Crew__r.Color_Code__c FROM Crew_Members__r )
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND User__r.IsActive = true
                WITH USER_MODE
            ]) {
                if(c.Crew_Members__r != null && c.Crew_Members__r.size() > 0){
                    for(Crew_Member__c crewMember : c.Crew_Members__r){
                        crewMembers.add(new Map<String, Object>{
                            'id' => c.Id,
                            'name' => c.Name,
                            'crewId' => crewMember.Crew__c != null ? crewMember.Crew__c : null,
                            'crewName' => crewMember.Crew__r.Name != null ? crewMember.Crew__r.Name : null,
                            'bgColor' => crewMember.Crew__r.Color_Code__c != null ? crewMember.Crew__r.Color_Code__c : null,
                            'isAvailable' => !busyCrewIds.contains(c.Id)
                        });
                    }
                }else{
                    crewMembers.add(new Map<String, Object>{
                        'id' => c.Id,
                        'name' => c.Name,
                        'isAvailable' => !busyCrewIds.contains(c.Id)
                    });
                }
            }

            // 5️⃣ Query all Subcontractors
            for (Contact sc : [
                SELECT Id, Name
                FROM Contact
                WHERE RecordType.DeveloperName = 'Sub_Contractor_WF_Recon'
                AND User__r.IsActive = true
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
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getAllResources', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching all resources and availability.', 'apiResponse' => null});
        }

        return resources;
    }

    /**
     * Description: Lists resource assignments for a given type within a date range.
     * Parameters: startDate (Date), endDate (Date), resourceType (String: 'Crew'|'SubContractor'|'Asset').
     * Return: List<Map<String,Object>> of resource entries (id, name, job info, dates, status, junctionId).
     */
    @AuraEnabled
    public static List<Map<String,Object>> getResourceDetails(Date startDate, Date endDate, String resourceType) {

        List<Map<String,Object>> result = new List<Map<String,Object>>();
        DateTime startOfDay = DateTime.newInstance(startDate, Time.newInstance(0,0,0,0));
        DateTime endOfDay = DateTime.newInstance(endDate, Time.newInstance(23,59,59,999));
        try {
            if(resourceType == null) return result;

            String memberRecordType = '';
            Boolean fetchAssets = false;

            if(resourceType == 'Crew' || resourceType == 'CrewMaster') {
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
                    SELECT Id, Job__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Job__r.Address__c, Start_Date__c, End_Date__c, Mobilization_Status__c,
                        (SELECT Id, Equipment__c, Equipment__r.Name
                            FROM Mobilization_Assets__r 
                            ORDER BY Mobilization__r.Start_Date__c)
                    FROM Mobilization__c
                    WHERE Start_Date__c >= :startOfDay
                    AND End_Date__c <= :endOfDay
                    WITH USER_MODE
                    ORDER BY Start_Date__c
                ];
            } else {
                mobilizations = [
                    SELECT Id, Job__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Description__c, Job__r.Address__c, Start_Date__c, End_Date__c, Mobilization_Status__c,
                        (SELECT Id, Contact__c, Contact__r.Name, Crew__c, Crew__r.Name, Crew__r.Color_Code__c
                            FROM Mobilization_Members__r
                            WHERE Contact__r.RecordType.DeveloperName = :memberRecordType
                            ORDER BY Mobilization__r.Start_Date__c)
                    FROM Mobilization__c
                    WHERE Start_Date__c >= :startOfDay
                    AND End_Date__c <= :endOfDay
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
                            'jId' => mob.Job__c,
                            'mobId' => mob.id,
                            'status' => mob.Mobilization_Status__c,
                            'jobId' => mob.Job__r.Name,
                            'jobName' => mob.Job__r.Job_Name__c != null ? mob.Job__r.Job_Name__c : '--',
                            'junctionId' => asset.Id,
                            'location' => mob.Job__r.Address__c != null ? mob.Job__r.Address__c : '--',
                            'start' => mob.Start_Date__c.format(),
                            'end' => mob.End_Date__c.format(),
                            'bgColor' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Background_Color__c : '#C4C4C4',
                            'color' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Color__c : '#000000',
                            'statusStyle' => 'background-color: color(from ' + (statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Background_Color__c : '#C4C4C4') + ' srgb r g b / 0.2);' + 'color: ' + (statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Color__c : '#000000')
                        });
                    }
                } else {
                    Set<Id> processedCrewIds = new Set<Id>();

                    for(Mobilization_Member__c mem : mob.Mobilization_Members__r){

                        if (resourceType=='CrewMaster' && (mem.Crew__c == null || processedCrewIds.contains(mem.Crew__c))) continue; // skip individuals with no crew

                        if (resourceType=='CrewMaster' && !processedCrewIds.contains(mem.Crew__c)) {
                            processedCrewIds.add(mem.Crew__c);
                        }
                        result.add(new Map<String,Object>{
                            'id' => resourceType=='CrewMaster' ? mem.Crew__c : mem.Contact__c,
                            'name' => resourceType=='CrewMaster' ? mem.Crew__r.Name : mem.Contact__r.Name,
                            'crewStyle' => mem.Crew__r.Color_Code__c != null ? 'color:' + mem.Crew__r.Color_Code__c + ';' : null,
                            'jId' => mob.Job__c,
                            'mobId' => mob.id,
                            'status' => mob.Mobilization_Status__c,
                            'jobId' => mob.Job__r.Name,
                            'jobName' => mob.Job__r.Job_Name__c != null ? mob.Job__r.Job_Name__c : '--',
                            'junctionId' => mem.Id,
                            'location' => mob.Job__r.Address__c != null ? mob.Job__r.Address__c : '--',
                            'start' => mob.Start_Date__c.format(),
                            'end' => mob.End_Date__c.format(),
                            'bgColor' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Background_Color__c : '#C4C4C4',
                            'color' => statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Color__c : '#000000',
                            'statusStyle' => 'background-color: color(from ' + (statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Background_Color__c : '#C4C4C4') + ' srgb r g b / 0.2);' + 'color: ' + (statusColorMap.get(mob.Mobilization_Status__c) != null ? statusColorMap.get(mob.Mobilization_Status__c).Color__c : '#000000')
                        });
                    }
                }
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'getResourceDetails', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching resource details.', 'apiResponse' => null});
        }
        
        return result;
    }

    /**
     * Description: Removes a resource assignment (member or asset) by junction Id.
     * Parameters: id (String) - junction Id; 
     *             type (String) - 'CrewMaster'|'Crew'|'SubContractor'|'Asset';
     *             mobId (String) - Mobilization Id.
     *             allUpcoming (String) - 'true'|'false' - delete all upcoming mobilizations under the same Mobilization Group.
     * Return: 'success' on delete; otherwise error message.
     */
    @AuraEnabled
    public static string removeJobResource(String id, String type, String mobId, String allUpcoming){
        try {
            // Get Details about the Mobilization Group
            Mobilization__c currentMob = new Mobilization__c();
            List<SObject> recordsToDelete = new List<SObject>();

            if(allUpcoming == 'true'){
                currentMob = [SELECT Id, Mobilization_Group__c FROM Mobilization__c WHERE Id = :mobId WITH USER_MODE LIMIT 1];
                // Delete all upcoming mobilizations under the same Mobilization Group
                DateTime nowDT = System.now();
                if(type == 'CrewMaster'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Member__c WHERE Crew__c = :id AND Mobilization__r.Mobilization_Group__c = :currentMob.Mobilization_Group__c AND Mobilization__r.End_Date__c > :nowDT WITH USER_MODE];
                } else if(type == 'Crew' || type == 'SubContractor'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c = :id AND Mobilization__r.Mobilization_Group__c = :currentMob.Mobilization_Group__c AND Mobilization__r.End_Date__c > :nowDT WITH USER_MODE];
                } else if (type == 'Asset'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Asset__c WHERE Equipment__c = :id AND Mobilization__r.Mobilization_Group__c = :currentMob.Mobilization_Group__c AND Mobilization__r.End_Date__c > :nowDT WITH USER_MODE];
                }
            }else{
                if(type == 'CrewMaster'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Member__c WHERE Crew__c = :id AND Mobilization__c = :mobId WITH USER_MODE];
                } else if(type == 'Crew' || type == 'SubContractor'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Member__c WHERE Contact__c = :id AND Mobilization__c = :mobId WITH USER_MODE];
                } else if (type == 'Asset'){
                    recordsToDelete = [SELECT Id FROM Mobilization_Asset__c WHERE Equipment__c = :id AND Mobilization__c = :mobId WITH USER_MODE];
                }
            }

            if(recordsToDelete?.size() >= 10000 || Test.isRunningTest()){
                Database.executeBatch(new GenericDmlBatch(recordsToDelete, 'DELETE'), 200);
            }else{
                delete as user recordsToDelete;
            }
            return 'success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'removeJobResource', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while removing a job resource.', 'apiResponse' => null});
            return 'Error occurred while removing a job resource.';
        }
    }

    /**
     * Description: Assigns a single resource to a mobilization with optional overlap check.
     * Parameters: assignmentData (Map) - { resourceId, mobId, type, allowOverlap }.
     * Return: 'success' if assigned; 'OVERLAP' if conflict; otherwise error message.
     */
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
                    SELECT Id, Start_Date__c, End_Date__c, (SELECT Id, Contact__c FROM Mobilization_Members__r), (SELECT Id, Equipment__c FROM Mobilization_Assets__r)
                    FROM Mobilization__c
                    WHERE Id = :mobId
                    WITH USER_MODE
                    LIMIT 1
                ];

                if(mob != null && (mob.Mobilization_Members__r?.size() > 0 || mob.Mobilization_Assets__r?.size() > 0)){
                    List<SObject> ovlRess = (type == 'Asset' ? (List<SObject>) mob.Mobilization_Assets__r : (List<SObject>) mob.Mobilization_Members__r);
                    for (SObject ovlRes : ovlRess) {
                        if((type == 'Asset' ? (ovlRes.get('Equipment__c') == resourceId) : (ovlRes.get('Contact__c') == resourceId))) {
                            return 'ASSIGNED';
                        }
                    }
                }
    
                Date newStart = mob.Start_Date__c.dateGmt();
                DateTime newEnd   = mob.End_Date__c;
    
                // Query existing mobilizations for the same resource
                List<sObject> overlappingMobs;
    
                if (type == 'Crew' || type == 'SubContractor') {
                    overlappingMobs = [
                        SELECT Id, Mobilization__c
                        FROM Mobilization_Member__c
                        WHERE Contact__c = :resourceId
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) = :newStart
                        AND Mobilization__c != :mobId
                        WITH USER_MODE
                    ];
                } else if (type == 'Asset') {
                    overlappingMobs = [
                        SELECT Id, Mobilization__c
                        FROM Mobilization_Asset__c
                        WHERE Equipment__c = :resourceId
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) = :newStart
                        AND Mobilization__c != :mobId
                        WITH USER_MODE
                    ];
                } else if (type == 'CrewMaster') {
                    overlappingMobs = [
                        SELECT Id, Mobilization__c
                        FROM Mobilization_Member__c
                        WHERE Crew__c = :resourceId
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) = :newStart
                        AND Mobilization__c != :mobId
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
                List<Mobilization_Member__c> existingMobilizationMember = [
                    SELECT Mobilization__c FROM Mobilization_Member__c 
                    WHERE Contact__c = :resourceId AND Mobilization__c = :mobId 
                    WITH USER_MODE
                    LIMIT 1
                ];
                if(!existingMobilizationMember.isEmpty()){
                    return 'ASSIGNED';
                }
                Mobilization_Member__c mobMember = new Mobilization_Member__c(
                    Mobilization__c = mobId,
                    Contact__c = resourceId
                );
                insert as user mobMember;
            } else if (type == 'Asset') {
                List<Mobilization_Asset__c> existingMobilizationAsset = [
                    SELECT Mobilization__c FROM Mobilization_Asset__c 
                    WHERE Equipment__c = :resourceId AND Mobilization__c = :mobId 
                    WITH USER_MODE
                    LIMIT 1
                ];
                if(!existingMobilizationAsset.isEmpty()){
                    return 'ASSIGNED';
                }
                Mobilization_Asset__c mobAsset = new Mobilization_Asset__c(
                    Mobilization__c = mobId,
                    Equipment__c = resourceId
                );
                insert as user mobAsset;
            } else if (type == 'CrewMaster') {
                List<Crew_Member__c> crewMembers = [SELECT Contact__c FROM Crew_Member__c WHERE Crew__c = :resourceId WITH USER_MODE];
                Set<String> contactIds = new Set<String>();
                for(Crew_Member__c cm : crewMembers){
                    contactIds.add(cm.Contact__c);
                }
                // Check for existing assignments to avoid duplicates
                List<Mobilization_Member__c> existingMembers = [
                    SELECT Contact__c FROM Mobilization_Member__c 
                    WHERE Mobilization__c = :mobId AND Contact__c IN :contactIds
                    WITH USER_MODE
                ];

                // Create a set of existing contact IDs for quick lookup
                Set<String> existingContactIds = new Set<String>();
                for(Mobilization_Member__c existingMember : existingMembers){
                    existingContactIds.add(existingMember.Contact__c);
                }

                List<Mobilization_Member__c> mobMembersToInsert = new List<Mobilization_Member__c>();
                for (Crew_Member__c crewMember : crewMembers) {
                    // Only create new record if contact is not already assigned
                    if(!existingContactIds.contains(crewMember.Contact__c)){
                        Mobilization_Member__c mobMember = new Mobilization_Member__c(
                            Mobilization__c = mobId,
                            Crew__c = resourceId,
                            Contact__c = crewMember.Contact__c
                        );
                        mobMembersToInsert.add(mobMember);
                    }
                }
                insert as user mobMembersToInsert;
            }

            return 'success';
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'assignResourceToMob', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while assigning a single resource to a mobilization.', 'apiResponse' => null});
            return 'Error occurred while assigning a single resource to a mobilization.';
        }
    }

    /**
     * Description: Assigns multiple resources to sibling mobilizations from a selected mobilization.
     * Parameters: assignmentData (Map) - { resourceIds (csv), mobId, type, allowOverlap (Bool), overlapMode ('ALL'|'SKIP') }.
     * Return: JSON string { status: 'SUCCESS'|'OVERLAP'|'ERROR', overlaps?: List, message?: String }.
     */
    @AuraEnabled
    public static String assignResourceToJob(Map<String, Object> assignmentData) {
        try {
            List<String> resourceIds = String.valueOf((assignmentData.get('resourceIds'))).split(',');
            // String mobId = (String) assignmentData.get('mobId');
            String mobId = assignmentData.containsKey('mobId') ? (String) assignmentData.get('mobId') : null;
            String mobGroupId = assignmentData.containsKey('mobGroupId') ? (String) assignmentData.get('mobGroupId') : null;
            String type = (String) assignmentData.get('type');
            Boolean allowOverlap = (Boolean) assignmentData.get('allowOverlap');
            String overlapMode = (String) assignmentData.get('overlapMode'); // "ALL" or "SKIP"
            Map<String, Object> resourceMap = (Map<String, Object>) JSON.deserializeUntyped((String) assignmentData.get('resourceMap'));

            if(type == 'Crew' && resourceMap != null){
                resourceIds = new List<String>(resourceMap.keySet());
            }

            // Validate input
            if (resourceIds == null || resourceIds.isEmpty()) {
                return JSON.serialize(new Map<String, Object>{
                    'status' => 'ERROR',
                    'message' => 'No resources provided for assignment.'
                });
            }

            Mobilization__c selectedMob = new Mobilization__c();

            // Get mobilization details + parent Job
            if(mobId != null){
                selectedMob = [
                    SELECT Id, Job__c, Job__r.Job_Name__c, Mobilization_Group__c, Start_Date__c
                    FROM Mobilization__c
                    WHERE Id = :mobId
                    WITH USER_MODE
                    LIMIT 1
                ];
            }else if(mobGroupId != null){
                selectedMob = [
                    SELECT Id, Job__c, Job__r.Job_Name__c, Mobilization_Group__c, Start_Date__c
                    FROM Mobilization__c
                    WHERE Mobilization_Group__c = :mobGroupId
                    AND End_Date__c >= :system.now()
                    WITH USER_MODE
                    ORDER BY End_Date__c ASC
                    LIMIT 1
                ];
            }

            if (selectedMob == null) {
                return JSON.serialize(new Map<String, Object>{
                    'status' => 'ERROR',
                    'message' => 'Mobilization not found.'
                });
            }

            // Get all sibling mobilizations
            List<Mobilization__c> siblingMobs = [
                SELECT Id, Start_Date__c, Job__r.Job_Name__c
                FROM Mobilization__c
                WHERE Job__c = :selectedMob.Job__c
                AND Mobilization_Group__c = :selectedMob.Mobilization_Group__c
                AND DAY_ONLY(Start_Date__c) >= :selectedMob.Start_Date__c.dateGmt()
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
                siblingMobDates.add(mob.Start_Date__c.dateGmt());
            }

            List<Map<String, Object>> overlapDetails = new List<Map<String, Object>>();

            // If overlap not allowed, check before inserting
            if (!allowOverlap) {
                // Move SOQL query outside of loop
                List<SObject> allOverlaps = new List<SObject>();
                
                if (type == 'Crew' || type == 'SubContractor') {
                    allOverlaps = [
                        SELECT Id, Mobilization__c, Contact__c
                        FROM Mobilization_Member__c
                        WHERE Contact__c IN :resourceIds
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.dateGmt()
                        AND Mobilization__c NOT IN :siblingMobIds
                        WITH USER_MODE
                    ];
                } else if (type == 'Asset') {
                    allOverlaps = [
                        SELECT Id, Mobilization__c, Equipment__c
                        FROM Mobilization_Asset__c
                        WHERE Equipment__c IN :resourceIds
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.dateGmt()
                        AND Mobilization__c NOT IN :siblingMobIds
                        WITH USER_MODE
                    ];
                }

                // Process overlaps after collecting all data
                Map<String, Integer> overlapCounts = new Map<String, Integer>();
                for (SObject overlap : allOverlaps) {
                    String resourceId = (type == 'Crew' || type == 'SubContractor') ? 
                        String.valueOf(overlap.get('Contact__c')) : 
                        String.valueOf(overlap.get('Equipment__c'));
                    
                    if (!overlapCounts.containsKey(resourceId)) {
                        overlapCounts.put(resourceId, 0);
                    }
                    overlapCounts.put(resourceId, overlapCounts.get(resourceId) + 1);
                }

                for (String resourceId : resourceIds) {
                    if (overlapCounts.containsKey(resourceId)) {
                        overlapDetails.add(new Map<String, Object>{
                            'resourceId' => resourceId,
                            'count' => overlapCounts.get(resourceId)
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

            // Proceed with assignment
            List<SObject> newAssignments = new List<SObject>();

            // ✅ Step: Preload existing assignments to prevent duplicates
            Map<String, Set<Id>> existingAssignmentsMap = new Map<String, Set<Id>>();

            // Move SOQL query outside of loop
            List<SObject> existingAssignments = new List<SObject>();
            
            if (type == 'Crew' || type == 'SubContractor') {
                existingAssignments = [
                    SELECT Mobilization__c, Contact__c
                    FROM Mobilization_Member__c
                    WHERE Mobilization__c IN :siblingMobIds
                    AND Contact__c IN :resourceIds
                    WITH USER_MODE
                ];
            } else if (type == 'Asset') {
                existingAssignments = [
                    SELECT Mobilization__c, Equipment__c
                    FROM Mobilization_Asset__c
                    WHERE Mobilization__c IN :siblingMobIds
                    AND Equipment__c IN :resourceIds
                    WITH USER_MODE
                ];
            }

            // Process existing assignments
            for (SObject ea : existingAssignments) {
                String resourceId = (type == 'Crew' || type == 'SubContractor') ? 
                    String.valueOf(ea.get('Contact__c')) : 
                    String.valueOf(ea.get('Equipment__c'));
                
                if (!existingAssignmentsMap.containsKey(resourceId)) {
                    existingAssignmentsMap.put(resourceId, new Set<Id>());
                }
                existingAssignmentsMap.get(resourceId).add((Id)ea.get('Mobilization__c'));
            }

            // Handle overlapMode == SKIP scenario
            Map<String, Set<Date>> overlappingMobDatesMap = new Map<String, Set<Date>>();
            
            if (allowOverlap && overlapMode == 'SKIP') {
                if (type == 'Crew' || type == 'SubContractor') {
                    // Query for Crew/SubContractor overlaps
                    List<Mobilization_Member__c> allOverlapsForSkip = [
                        SELECT Mobilization__c, Mobilization__r.Start_Date__c, Contact__c
                        FROM Mobilization_Member__c
                        WHERE Contact__c IN :resourceIds
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.dateGmt()
                        WITH USER_MODE
                    ];

                    // Process overlaps for Crew/SubContractor
                    for (Mobilization_Member__c overlap : allOverlapsForSkip) {
                        String resourceId = overlap.Contact__c;
                        Date overlapDate = overlap.Mobilization__r.Start_Date__c.dateGmt();

                        if (!overlappingMobDatesMap.containsKey(resourceId)) {
                            overlappingMobDatesMap.put(resourceId, new Set<Date>());
                        }
                        overlappingMobDatesMap.get(resourceId).add(overlapDate);
                    }

                } else if (type == 'Asset') {
                    // Query for Asset overlaps
                    List<Mobilization_Asset__c> allOverlapsForSkip = [
                        SELECT Mobilization__c, Mobilization__r.Start_Date__c, Equipment__c
                        FROM Mobilization_Asset__c
                        WHERE Equipment__c IN :resourceIds
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(Mobilization__r.Start_Date__c) >= :selectedMob.Start_Date__c.dateGmt()
                        WITH USER_MODE
                    ];

                    // Process overlaps for Assets
                    for (Mobilization_Asset__c overlap : allOverlapsForSkip) {
                        String resourceId = overlap.Equipment__c;
                        Date overlapDate = overlap.Mobilization__r.Start_Date__c.dateGmt();

                        if (!overlappingMobDatesMap.containsKey(resourceId)) {
                            overlappingMobDatesMap.put(resourceId, new Set<Date>());
                        }
                        overlappingMobDatesMap.get(resourceId).add(overlapDate);
                    }
                }
            }


            // Now process assignments
            for (String resourceId : resourceIds) {
                for (Mobilization__c mob : siblingMobs) {
                    Boolean shouldAssign = true;

                    if (existingAssignmentsMap.containsKey(resourceId) && 
                        existingAssignmentsMap.get(resourceId).contains(mob.Id)) {
                        shouldAssign = false;
                    }

                    if (allowOverlap && overlapMode == 'SKIP' && 
                        overlappingMobDatesMap.containsKey(resourceId) && 
                        overlappingMobDatesMap.get(resourceId).contains(mob.Start_Date__c.dateGmt())) {
                        shouldAssign = false;
                    }

                    if (shouldAssign) {
                        if (type == 'Crew' || type == 'SubContractor') {
                            newAssignments.add(new Mobilization_Member__c(
                                Mobilization__c = mob.Id,
                                Contact__c = resourceId,
                                Crew__c = (type == 'Crew' && resourceMap != null && resourceMap.containsKey(resourceId)) ? (String) resourceMap.get(resourceId) : null
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

            // Instruction: Insert new assignments in user mode when any prepared.
            if (!newAssignments.isEmpty()) {
                if (newAssignments.size() >= 10000 || Test.isRunningTest()){
                    Database.executeBatch(new GenericDmlBatch(newAssignments, 'INSERT'), 200);
                } else {
                    insert as user newAssignments;
                }
            }

            return JSON.serialize(new Map<String, Object>{
                'status' => 'SUCCESS'
            });

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'assignResourceToJob', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while assigning multiple resources across sibling mobilizations.', 'apiResponse' => null});
            return JSON.serialize(new Map<String, Object>{
                'status' => 'ERROR',
                'message' => 'Error occurred while assigning multiple resources across sibling mobilizations.'
            });
        }
    }

    /**
     * Description: Deletes a mobilization and its related member and asset junction records.
     * Parameters: mobId (String) - Mobilization Id.
     * Return: 'success' on delete; otherwise error message.
     */
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
            ExceptionHandler.logException(new Map<String, Object>{ 'className' => CLASSNAME, 'methodName' => 'deleteMobilization', 'isApiException' => false, 'statusCode' => null, 'exceptionObj' => e, 'moreDetails' => 'Error occurred while deleting mobilization and related resources.', 'apiResponse' => null});
            return 'Error occurred while deleting mobilization and related resources.';
        }
    }
}