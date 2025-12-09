/**
 * Description: Controller for Mobilization Scheduler LWC. Exposes methods to read mobilizations, resources and perform assignments/removals with user-mode enforcement.
 * Test Class: MobSchedulerControllerTest - 89% (2025-11-13)
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
 * Update: 2025-11-10 (Kevin)   - Added the fallback values for the default job timing and updated the date formatting for supporting different locale settings
 * Update: 2025-11-13 (Kevin)   - Updated the date conversion logic and default date fetching logic
 */
public with sharing class MobSchedulerController {
    private static final String CLASSNAME = 'MobSchedulerController';
    private static Map<String, wfrecon__Mobilization_Status_Color__c> statusColorMap = wfrecon__Mobilization_Status_Color__c.getAll();

    /**
     * Description: Returns mobilization entries within the date range for week view.
     * Parameters: startDate (Date) - inclusive start; endDate (Date) - inclusive end.
     * Return: Map<String,Object> with key 'weekEvents' -> List of event maps (job info, dates, status, resources).
     */
    @AuraEnabled
    public static Map<String,Object> getMobilizationDetails(Date startDate, Date endDate) {
        Map<String,Object> result = new Map<String,Object>{'weekEvents' => null};

        Date startDate2 = startDate;
        Date endDate2 = endDate;
        DateTime startOfDay = DateTime.newInstance(startDate2, Time.newInstance(0,0,0,0));
        DateTime endOfDay = DateTime.newInstance(endDate2.addDays(1), Time.newInstance(23,59,59,999));
        try{
            // Instruction: Query mobilizations and shape data for LWC consumption.
    
            List<wfrecon__Mobilization__c> mobilizations = [
                SELECT Id, Name, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Description__c, wfrecon__Mobilization_Group__r.Name,
                       wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c,
                       wfrecon__Job__r.wfrecon__Address__c,
                       (SELECT Id, wfrecon__Contact__r.RecordType.DeveloperName, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Crew__c, wfrecon__Crew__r.Name, wfrecon__Crew__r.wfrecon__Color_Code__c
                        FROM wfrecon__Mobilization_Members__r
                        WHERE wfrecon__Contact__r.RecordType.DeveloperName IN ('Employee_WF_Recon','Sub_Contractor_WF_Recon')
                        ORDER BY CreatedDate DESC),
                       (SELECT Id, wfrecon__Equipment__c, wfrecon__Equipment__r.Name
                        FROM wfrecon__Mobilization_Assets__r 
                        ORDER BY CreatedDate DESC)
                FROM wfrecon__Mobilization__c
                WHERE wfrecon__Start_Date__c >= :startOfDay
                  AND wfrecon__End_Date__c <= :endOfDay
                WITH USER_MODE
                ORDER BY wfrecon__Start_Date__c
            ];
    
            List<Map<String,Object>> weekEvents = new List<Map<String,Object>>();
    
            for(wfrecon__Mobilization__c mob : mobilizations){
                // Instruction: Split members into Crew and SubContractor lists.
                List<Map<String,Object>> crewMembersList = new List<Map<String,Object>>();
                List<Map<String,Object>> subContractorsList = new List<Map<String,Object>>();
                for(wfrecon__Mobilization_Member__c mem : mob.wfrecon__Mobilization_Members__r){
                    String memberType = mem.wfrecon__Contact__r.RecordType.DeveloperName;
                    Map<String,Object> member = new Map<String,Object>{
                        'id' => mem.wfrecon__Contact__c,
                        'name' => mem.wfrecon__Contact__r.Name,
                        'type' => memberType,
                        'junctionId' => mem.Id
                    };
                    if(memberType == 'Employee_WF_Recon'){
                        if(mem.wfrecon__Crew__c != null){
                            member.put('crewId', mem.wfrecon__Crew__c);
                            member.put('crewName', mem.wfrecon__Crew__r.Name);
                            member.put('crewColor', mem.wfrecon__Crew__r.wfrecon__Color_Code__c);
                            member.put('bgStyle', 'background-color: color(from ' + mem.wfrecon__Crew__r.wfrecon__Color_Code__c + ' srgb r g b / 0.2); border: 1px solid ' + mem.wfrecon__Crew__r.wfrecon__Color_Code__c + ';');
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
                for(wfrecon__Mobilization_Asset__c asset : mob.wfrecon__Mobilization_Assets__r){
                    Map<String,Object> assetToUse = new Map<String,Object>{
                        'id' => asset.wfrecon__Equipment__c,
                        'name' => asset.wfrecon__Equipment__r.Name,
                        'junctionId' => asset.Id
                    };
                    assetsList.add(assetToUse);
                }
    
                // Instruction: Build event payload for week view card rendering.
                weekEvents.add(new Map<String,Object>{
                    'id' => mob.Id,
                    'jId' => mob.wfrecon__Job__c,
                    'jobId' => mob.wfrecon__Job__r.Name,
                    'jobName' => mob.wfrecon__Job__r.wfrecon__Job_Name__c != null ? mob.wfrecon__Job__r.wfrecon__Job_Name__c : '--',
                    'location' => mob.wfrecon__Job__r.wfrecon__Address__c != null ? mob.wfrecon__Job__r.wfrecon__Address__c : '--',
                    'start' => mob.wfrecon__Start_Date__c.format('MM/dd/yyyy, h:mm a'),
                    'end' => mob.wfrecon__End_Date__c.format('MM/dd/yyyy, h:mm a'),
                    'status' => mob.wfrecon__Mobilization_Status__c,
                    'crew' => crewMembersList,
                    'subcontractors' => subContractorsList,
                    'assets' => assetsList,
                    'bgColor' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Background_Color__c : '#C4C4C4',
                    'color' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Color__c : '#000000'
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
     * Return: wfrecon__Job_Default_Times__c record or null if none found/error.
     */
    @AuraEnabled
    public static Map<String, Object> getDefaultValues(Date startDate) {
        Map<String, Object> defaultValues = new Map<String, Object>{'statusOptions' => null, 'time' => null, 'status' => null, 'result' => null};

        try {
            List<wfrecon__Job_Default_Times__c> timeDefaults = [
                SELECT Id, Name, wfrecon__Start_Time__c, wfrecon__End_Time__c, wfrecon__Include_Saturday__c, wfrecon__Include_Sunday__c 
                FROM wfrecon__Job_Default_Times__c 
                WITH USER_MODE
            ];
            List<wfrecon__Mobilization_Status_Color__c> statusDefaults = [
                SELECT Id, Name, wfrecon__Color__c, wfrecon__Background_Color__c 
                FROM wfrecon__Mobilization_Status_Color__c 
                WITH USER_MODE
            ];

            List<Map<String,String>> options = new List<Map<String,String>>();
            Schema.DescribeFieldResult fieldResult = wfrecon__Mobilization__c.wfrecon__Mobilization_Status__c.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            for( Schema.PicklistEntry f : ple){
                options.add(new Map<String,String>{'label' => f.getLabel(), 'value' => f.getValue()});
            }

            defaultValues.put('statusOptions', options);
            // Get today's date
            Date today = startDate;

            Map<String, Object> defaultMap = new Map<String, Object>{'start' => null, 'end' => null, 'includeSaturday' => false, 'includeSunday' => false};
            if(timeDefaults != null && !timeDefaults.isEmpty()) {

                defaultMap.put('includeSaturday', timeDefaults[0].wfrecon__Include_Saturday__c);
                defaultMap.put('includeSunday', timeDefaults[0].wfrecon__Include_Sunday__c);
                
                // Start Time
                String startTimeStr = timeDefaults[0].wfrecon__Start_Time__c; // e.g., "07:00 AM"
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
                String endTimeStr = timeDefaults[0].wfrecon__End_Time__c; // e.g., "06:00 PM"
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
            }

            if(defaultMap.get('start') == null){
                defaultMap.put('start', DateTime.newInstance(today, Time.newInstance(7, 0, 0, 0)));
            }
            if(defaultMap.get('end') == null){
                defaultMap.put('end', DateTime.newInstance(today, Time.newInstance(18, 0, 0, 0)));
            }

            defaultValues.put('time', defaultMap);

            if(statusDefaults != null && !statusDefaults.isEmpty()) {
                defaultValues.put('status', statusDefaults);
            }

            TimeZone userTimeZone = UserInfo.getTimeZone();
            DateTime currentTime = DateTime.now();
            Integer offsetMilliseconds = userTimeZone.getOffset(currentTime);
            Decimal offsetHours = (Decimal)offsetMilliseconds / (1000 * 60 * 60);
            defaultValues.put('tzOffset', offsetHours);

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
            List<wfrecon__Mobilization__c> activeMobs = [
                SELECT Id,
                    (SELECT wfrecon__Contact__c, wfrecon__Contact__r.RecordType.DeveloperName 
                        FROM wfrecon__Mobilization_Members__r),
                    (SELECT wfrecon__Equipment__c 
                        FROM wfrecon__Mobilization_Assets__r)
                FROM wfrecon__Mobilization__c
                WHERE wfrecon__Start_Date__c >= :startOfDay
                AND wfrecon__Start_Date__c <= :endOfDay
                WITH USER_MODE
            ];

            // Instruction: Collect all busy resource IDs.
            for (wfrecon__Mobilization__c mob : activeMobs) {
                for (wfrecon__Mobilization_Member__c mem : mob.wfrecon__Mobilization_Members__r) {
                    if (mem.wfrecon__Contact__r.RecordType.DeveloperName == 'Employee_WF_Recon') {
                        busyCrewIds.add(mem.wfrecon__Contact__c);
                    } else if (mem.wfrecon__Contact__r.RecordType.DeveloperName == 'Sub_Contractor_WF_Recon') {
                        busySubcontractorIds.add(mem.wfrecon__Contact__c);
                    }
                }
                for (wfrecon__Mobilization_Asset__c asset : mob.wfrecon__Mobilization_Assets__r) {
                    busyAssetIds.add(asset.wfrecon__Equipment__c);
                }
            }

            // 4️⃣ Query all Crew
            for (Contact c : [
                SELECT Id, Name, (SELECT Id, wfrecon__Crew__c, wfrecon__Crew__r.Name, wfrecon__Crew__r.wfrecon__Color_Code__c FROM wfrecon__Crew_Members__r )
                FROM Contact
                WHERE RecordType.DeveloperName = 'Employee_WF_Recon'
                AND wfrecon__User__r.IsActive = true
                WITH USER_MODE
            ]) {
                if(c.wfrecon__Crew_Members__r != null && c.wfrecon__Crew_Members__r.size() > 0){
                    for(wfrecon__Crew_Member__c crewMember : c.wfrecon__Crew_Members__r){
                        crewMembers.add(new Map<String, Object>{
                            'id' => c.Id,
                            'name' => c.Name,
                            'crewId' => crewMember.wfrecon__Crew__c != null ? crewMember.wfrecon__Crew__c : null,
                            'crewName' => crewMember.wfrecon__Crew__r.Name != null ? crewMember.wfrecon__Crew__r.Name : null,
                            'bgColor' => crewMember.wfrecon__Crew__r.wfrecon__Color_Code__c != null ? crewMember.wfrecon__Crew__r.wfrecon__Color_Code__c : null,
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
                AND wfrecon__User__r.IsActive = true
                WITH USER_MODE
            ]) {
                subContractors.add(new Map<String, Object>{
                    'id' => sc.Id,
                    'name' => sc.Name,
                    'isAvailable' => !busySubcontractorIds.contains(sc.Id)
                });
            }

            // 6️⃣ Query all Assets
            for (wfrecon__Equipment__c eq : [
                SELECT Id, Name
                FROM wfrecon__Equipment__c
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

            List<wfrecon__Mobilization__c> mobilizations;

            if(fetchAssets){
                mobilizations = [
                    SELECT Id, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Description__c, wfrecon__Job__r.wfrecon__Address__c, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c,
                        (SELECT Id, wfrecon__Equipment__c, wfrecon__Equipment__r.Name
                            FROM wfrecon__Mobilization_Assets__r 
                            ORDER BY wfrecon__Mobilization__r.wfrecon__Start_Date__c)
                    FROM wfrecon__Mobilization__c
                    WHERE wfrecon__Start_Date__c >= :startOfDay
                    AND wfrecon__End_Date__c <= :endOfDay
                    WITH USER_MODE
                    ORDER BY wfrecon__Start_Date__c
                ];
            } else {
                mobilizations = [
                    SELECT Id, wfrecon__Job__c, wfrecon__Job__r.Name, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Job__r.wfrecon__Description__c, wfrecon__Job__r.wfrecon__Address__c, wfrecon__Start_Date__c, wfrecon__End_Date__c, wfrecon__Mobilization_Status__c,
                        (SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Crew__c, wfrecon__Crew__r.Name, wfrecon__Crew__r.wfrecon__Color_Code__c
                            FROM wfrecon__Mobilization_Members__r
                            WHERE wfrecon__Contact__r.RecordType.DeveloperName = :memberRecordType
                            ORDER BY wfrecon__Mobilization__r.wfrecon__Start_Date__c)
                    FROM wfrecon__Mobilization__c
                    WHERE wfrecon__Start_Date__c >= :startOfDay
                    AND wfrecon__End_Date__c <= :endOfDay
                    WITH USER_MODE
                    ORDER BY wfrecon__Start_Date__c
                ];
            }

            Map<String, String> clockStatusColorMap = new Map<String, String>();
            Map<String, String> clockStatusLabelMap = new Map<String, String>();
            
            if(!fetchAssets) {
                Set<Id> contactIds = new Set<Id>();
                
                // Collect all contacts involved in these mobilizations
                for(wfrecon__Mobilization__c mob : mobilizations){
                    for(wfrecon__Mobilization_Member__c mem : mob.wfrecon__Mobilization_Members__r){
                        if(mem.wfrecon__Contact__c != null) {
                            contactIds.add(mem.wfrecon__Contact__c);
                        }
                    }
                }

                if(!contactIds.isEmpty()) {
                    for(wfrecon__Timesheet_Entry__c entry : [
                        SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__r.wfrecon__Contact__c
                        FROM wfrecon__Timesheet_Entry__c
                        WHERE wfrecon__Timesheet__r.wfrecon__Contact__c IN :contactIds
                        AND wfrecon__Clock_In_Time__c >= :startOfDay
                        AND wfrecon__Clock_In_Time__c <= :endOfDay
                        WITH USER_MODE
                        ORDER BY CreatedDate ASC
                    ]) {
                        // Create a unique key for Contact + Day
                        String dateKey = entry.wfrecon__Clock_In_Time__c.format('yyyy-MM-dd'); 
                        String key = entry.wfrecon__Timesheet__r.wfrecon__Contact__c + '_' + dateKey;
                        
                        String color = '#ff5e5e'; // Default Red
                        String label = 'Not Clocked In';

                        if(entry.wfrecon__Clock_In_Time__c != null && entry.wfrecon__Clock_Out_Time__c == null) {
                            // Currently Clocked In
                            color = '#ffcc00'; // Yellow
                            label = 'Clocked In';
                        } else if (entry.wfrecon__Clock_In_Time__c != null && entry.wfrecon__Clock_Out_Time__c != null) {
                            // Clocked Out (Completed for this entry)
                            color = '#83ff83'; // Green
                            label = 'Clocked Out';
                        }

                        // Put in map (The loop order ensures the latest entry for the day dictates the final status)
                        clockStatusColorMap.put(key, color);
                        clockStatusLabelMap.put(key, label);
                    }
                }
            }

            for(wfrecon__Mobilization__c mob : mobilizations){
                if(fetchAssets){
                    for(wfrecon__Mobilization_Asset__c asset : mob.wfrecon__Mobilization_Assets__r){
                        result.add(new Map<String,Object>{
                            'id' => asset.wfrecon__Equipment__c,
                            'name' => asset.wfrecon__Equipment__r.Name,
                            'jId' => mob.wfrecon__Job__c,
                            'mobId' => mob.id,
                            'status' => mob.wfrecon__Mobilization_Status__c,
                            'jobId' => mob.wfrecon__Job__r.Name,
                            'jobName' => mob.wfrecon__Job__r.wfrecon__Job_Name__c != null ? mob.wfrecon__Job__r.wfrecon__Job_Name__c : '--',
                            'junctionId' => asset.Id,
                            'location' => mob.wfrecon__Job__r.wfrecon__Address__c != null ? mob.wfrecon__Job__r.wfrecon__Address__c : '--',
                            'start' => mob.wfrecon__Start_Date__c.format('MM/dd/yyyy, h:mm a'),
                            'end' => mob.wfrecon__End_Date__c.format('MM/dd/yyyy, h:mm a'),
                            'bgColor' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Background_Color__c : '#C4C4C4',
                            'color' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Color__c : '#000000',
                            'statusStyle' => 'background-color: color(from ' + (statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Background_Color__c : '#C4C4C4') + ' srgb r g b / 0.2);' + 'color: ' + (statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Color__c : '#000000'),
                            'clockStatusColor' => null,
                            'clockStatusLabel' => ''
                        });
                    }
                } else {
                    Set<Id> processedCrewIds = new Set<Id>();

                    for(wfrecon__Mobilization_Member__c mem : mob.wfrecon__Mobilization_Members__r){

                        if (resourceType=='CrewMaster' && (mem.wfrecon__Crew__c == null || processedCrewIds.contains(mem.wfrecon__Crew__c))) continue; // skip individuals with no crew

                        if (resourceType=='CrewMaster' && !processedCrewIds.contains(mem.wfrecon__Crew__c)) {
                            processedCrewIds.add(mem.wfrecon__Crew__c);
                        }

                        // Determine Clock Status Color
                        String statusColor = '#ff0000';
                        String statusLabel = 'Not Clocked In';

                        if(mem.wfrecon__Contact__c != null) {
                            String dateKey = mob.wfrecon__Start_Date__c.format('yyyy-MM-dd');
                            String key = mem.wfrecon__Contact__c + '_' + dateKey;
                            
                            if(clockStatusColorMap.containsKey(key)) {
                                statusColor = clockStatusColorMap.get(key);
                                statusLabel = clockStatusLabelMap.get(key);
                            }
                        }

                        result.add(new Map<String,Object>{
                            'id' => resourceType=='CrewMaster' ? mem.wfrecon__Crew__c : mem.wfrecon__Contact__c,
                            'name' => resourceType=='CrewMaster' ? mem.wfrecon__Crew__r.Name : mem.wfrecon__Contact__r.Name,
                            'crewStyle' => mem.wfrecon__Crew__r.wfrecon__Color_Code__c != null ? 'color:' + mem.wfrecon__Crew__r.wfrecon__Color_Code__c + ';' : null,
                            'jId' => mob.wfrecon__Job__c,
                            'mobId' => mob.id,
                            'status' => mob.wfrecon__Mobilization_Status__c,
                            'jobId' => mob.wfrecon__Job__r.Name,
                            'jobName' => mob.wfrecon__Job__r.wfrecon__Job_Name__c != null ? mob.wfrecon__Job__r.wfrecon__Job_Name__c : '--',
                            'junctionId' => mem.Id,
                            'location' => mob.wfrecon__Job__r.wfrecon__Address__c != null ? mob.wfrecon__Job__r.wfrecon__Address__c : '--',
                            'start' => mob.wfrecon__Start_Date__c.format('MM/dd/yyyy, h:mm a'),
                            'end' => mob.wfrecon__End_Date__c.format('MM/dd/yyyy, h:mm a'),
                            'bgColor' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Background_Color__c : '#C4C4C4',
                            'color' => statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Color__c : '#000000',
                            'statusStyle' => 'background-color: color(from ' + (statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Background_Color__c : '#C4C4C4') + ' srgb r g b / 0.2);' + 'color: ' + (statusColorMap.get(mob.wfrecon__Mobilization_Status__c) != null ? statusColorMap.get(mob.wfrecon__Mobilization_Status__c).wfrecon__Color__c : '#000000'),
                            'clockStatusColor' => statusColor,
                            'clockStatusLabel' => statusLabel
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
            wfrecon__Mobilization__c currentMob = new wfrecon__Mobilization__c();
            List<SObject> recordsToDelete = new List<SObject>();

            if(allUpcoming == 'true'){
                currentMob = [SELECT Id, wfrecon__Mobilization_Group__c FROM wfrecon__Mobilization__c WHERE Id = :mobId WITH USER_MODE LIMIT 1];
                // Delete all upcoming mobilizations under the same Mobilization Group
                DateTime nowDT = System.now();
                if(type == 'CrewMaster'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew__c = :id AND wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c = :currentMob.wfrecon__Mobilization_Group__c AND wfrecon__Mobilization__r.wfrecon__End_Date__c > :nowDT WITH USER_MODE];
                } else if(type == 'Crew' || type == 'SubContractor'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__c = :id AND wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c = :currentMob.wfrecon__Mobilization_Group__c AND wfrecon__Mobilization__r.wfrecon__End_Date__c > :nowDT WITH USER_MODE];
                } else if (type == 'Asset'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Asset__c WHERE wfrecon__Equipment__c = :id AND wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c = :currentMob.wfrecon__Mobilization_Group__c AND wfrecon__Mobilization__r.wfrecon__End_Date__c > :nowDT WITH USER_MODE];
                }
            }else{
                if(type == 'CrewMaster'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew__c = :id AND wfrecon__Mobilization__c = :mobId WITH USER_MODE];
                } else if(type == 'Crew' || type == 'SubContractor'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Contact__c = :id AND wfrecon__Mobilization__c = :mobId WITH USER_MODE];
                } else if (type == 'Asset'){
                    recordsToDelete = [SELECT Id FROM wfrecon__Mobilization_Asset__c WHERE wfrecon__Equipment__c = :id AND wfrecon__Mobilization__c = :mobId WITH USER_MODE];
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
                wfrecon__Mobilization__c mob = [
                    SELECT Id, wfrecon__Start_Date__c, wfrecon__End_Date__c, (SELECT Id, wfrecon__Contact__c FROM wfrecon__Mobilization_Members__r), (SELECT Id, wfrecon__Equipment__c FROM wfrecon__Mobilization_Assets__r)
                    FROM wfrecon__Mobilization__c
                    WHERE Id = :mobId
                    WITH USER_MODE
                    LIMIT 1
                ];

                if(mob != null && (mob.wfrecon__Mobilization_Members__r?.size() > 0 || mob.wfrecon__Mobilization_Assets__r?.size() > 0)){
                    List<SObject> ovlRess = (type == 'Asset' ? (List<SObject>) mob.wfrecon__Mobilization_Assets__r : (List<SObject>) mob.wfrecon__Mobilization_Members__r);
                    for (SObject ovlRes : ovlRess) {
                        if((type == 'Asset' ? (ovlRes.get('wfrecon__Equipment__c') == resourceId) : (ovlRes.get('wfrecon__Contact__c') == resourceId))) {
                            return 'ASSIGNED';
                        }
                    }
                }
    
                Date newStart = mob.wfrecon__Start_Date__c.dateGmt();
                DateTime newEnd   = mob.wfrecon__End_Date__c;
    
                // Query existing mobilizations for the same resource
                List<sObject> overlappingMobs;
    
                if (type == 'Crew' || type == 'SubContractor') {
                    overlappingMobs = [
                        SELECT Id, wfrecon__Mobilization__c
                        FROM wfrecon__Mobilization_Member__c
                        WHERE wfrecon__Contact__c = :resourceId
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) = :newStart
                        AND wfrecon__Mobilization__c != :mobId
                        WITH USER_MODE
                    ];
                } else if (type == 'Asset') {
                    overlappingMobs = [
                        SELECT Id, wfrecon__Mobilization__c
                        FROM wfrecon__Mobilization_Asset__c
                        WHERE wfrecon__Equipment__c = :resourceId
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) = :newStart
                        AND wfrecon__Mobilization__c != :mobId
                        WITH USER_MODE
                    ];
                } else if (type == 'CrewMaster') {
                    overlappingMobs = [
                        SELECT Id, wfrecon__Mobilization__c
                        FROM wfrecon__Mobilization_Member__c
                        WHERE wfrecon__Crew__c = :resourceId
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) = :newStart
                        AND wfrecon__Mobilization__c != :mobId
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
                List<wfrecon__Mobilization_Member__c> existingMobilizationMember = [
                    SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c 
                    WHERE wfrecon__Contact__c = :resourceId AND wfrecon__Mobilization__c = :mobId 
                    WITH USER_MODE
                    LIMIT 1
                ];
                if(!existingMobilizationMember.isEmpty()){
                    return 'ASSIGNED';
                }
                wfrecon__Mobilization_Member__c mobMember = new wfrecon__Mobilization_Member__c(
                    wfrecon__Mobilization__c = mobId,
                    wfrecon__Contact__c = resourceId
                );
                insert as user mobMember;
            } else if (type == 'Asset') {
                List<wfrecon__Mobilization_Asset__c> existingMobilizationAsset = [
                    SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Asset__c 
                    WHERE wfrecon__Equipment__c = :resourceId AND wfrecon__Mobilization__c = :mobId 
                    WITH USER_MODE
                    LIMIT 1
                ];
                if(!existingMobilizationAsset.isEmpty()){
                    return 'ASSIGNED';
                }
                wfrecon__Mobilization_Asset__c mobAsset = new wfrecon__Mobilization_Asset__c(
                    wfrecon__Mobilization__c = mobId,
                    wfrecon__Equipment__c = resourceId
                );
                insert as user mobAsset;
            } else if (type == 'CrewMaster') {
                List<wfrecon__Crew_Member__c> crewMembers = [SELECT wfrecon__Contact__c FROM wfrecon__Crew_Member__c WHERE wfrecon__Crew__c = :resourceId WITH USER_MODE];
                Set<String> contactIds = new Set<String>();
                for(wfrecon__Crew_Member__c cm : crewMembers){
                    contactIds.add(cm.wfrecon__Contact__c);
                }
                // Check for existing assignments to avoid duplicates
                List<wfrecon__Mobilization_Member__c> existingMembers = [
                    SELECT wfrecon__Contact__c FROM wfrecon__Mobilization_Member__c 
                    WHERE wfrecon__Mobilization__c = :mobId AND wfrecon__Contact__c IN :contactIds
                    WITH USER_MODE
                ];

                // Create a set of existing contact IDs for quick lookup
                Set<String> existingContactIds = new Set<String>();
                for(wfrecon__Mobilization_Member__c existingMember : existingMembers){
                    existingContactIds.add(existingMember.wfrecon__Contact__c);
                }

                List<wfrecon__Mobilization_Member__c> mobMembersToInsert = new List<wfrecon__Mobilization_Member__c>();
                for (wfrecon__Crew_Member__c crewMember : crewMembers) {
                    // Only create new record if contact is not already assigned
                    if(!existingContactIds.contains(crewMember.wfrecon__Contact__c)){
                        wfrecon__Mobilization_Member__c mobMember = new wfrecon__Mobilization_Member__c(
                            wfrecon__Mobilization__c = mobId,
                            wfrecon__Crew__c = resourceId,
                            wfrecon__Contact__c = crewMember.wfrecon__Contact__c
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

            wfrecon__Mobilization__c selectedMob = new wfrecon__Mobilization__c();

            // Get mobilization details + parent Job
            if(mobId != null){
                selectedMob = [
                    SELECT Id, wfrecon__Job__c, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Mobilization_Group__c, wfrecon__Start_Date__c
                    FROM wfrecon__Mobilization__c
                    WHERE Id = :mobId
                    WITH USER_MODE
                    LIMIT 1
                ];
            }else if(mobGroupId != null){
                selectedMob = [
                    SELECT Id, wfrecon__Job__c, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Mobilization_Group__c, wfrecon__Start_Date__c
                    FROM wfrecon__Mobilization__c
                    WHERE wfrecon__Mobilization_Group__c = :mobGroupId
                    AND wfrecon__End_Date__c >= :system.now()
                    WITH USER_MODE
                    ORDER BY wfrecon__End_Date__c ASC
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
            List<wfrecon__Mobilization__c> siblingMobs = [
                SELECT Id, wfrecon__Start_Date__c, wfrecon__Job__r.wfrecon__Job_Name__c
                FROM wfrecon__Mobilization__c
                WHERE wfrecon__Job__c = :selectedMob.wfrecon__Job__c
                AND wfrecon__Mobilization_Group__c = :selectedMob.wfrecon__Mobilization_Group__c
                AND DAY_ONLY(wfrecon__Start_Date__c) >= :selectedMob.wfrecon__Start_Date__c.dateGmt()
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
            for (wfrecon__Mobilization__c mob : siblingMobs) {
                siblingMobIds.add(mob.Id);
                siblingMobDates.add(mob.wfrecon__Start_Date__c.dateGmt());
            }

            List<Map<String, Object>> overlapDetails = new List<Map<String, Object>>();

            // If overlap not allowed, check before inserting
            if (!allowOverlap) {
                // Move SOQL query outside of loop
                List<SObject> allOverlaps = new List<SObject>();
                
                if (type == 'Crew' || type == 'SubContractor') {
                    allOverlaps = [
                        SELECT Id, wfrecon__Mobilization__c, wfrecon__Contact__c
                        FROM wfrecon__Mobilization_Member__c
                        WHERE wfrecon__Contact__c IN :resourceIds
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) >= :selectedMob.wfrecon__Start_Date__c.dateGmt()
                        AND wfrecon__Mobilization__c NOT IN :siblingMobIds
                        WITH USER_MODE
                    ];
                } else if (type == 'Asset') {
                    allOverlaps = [
                        SELECT Id, wfrecon__Mobilization__c, wfrecon__Equipment__c
                        FROM wfrecon__Mobilization_Asset__c
                        WHERE wfrecon__Equipment__c IN :resourceIds
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) >= :selectedMob.wfrecon__Start_Date__c.dateGmt()
                        AND wfrecon__Mobilization__c NOT IN :siblingMobIds
                        WITH USER_MODE
                    ];
                }

                // Process overlaps after collecting all data
                Map<String, Integer> overlapCounts = new Map<String, Integer>();
                for (SObject overlap : allOverlaps) {
                    String resourceId = (type == 'Crew' || type == 'SubContractor') ? 
                        String.valueOf(overlap.get('wfrecon__Contact__c')) : 
                        String.valueOf(overlap.get('wfrecon__Equipment__c'));
                    
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
                    SELECT wfrecon__Mobilization__c, wfrecon__Contact__c
                    FROM wfrecon__Mobilization_Member__c
                    WHERE wfrecon__Mobilization__c IN :siblingMobIds
                    AND wfrecon__Contact__c IN :resourceIds
                    WITH USER_MODE
                ];
            } else if (type == 'Asset') {
                existingAssignments = [
                    SELECT wfrecon__Mobilization__c, wfrecon__Equipment__c
                    FROM wfrecon__Mobilization_Asset__c
                    WHERE wfrecon__Mobilization__c IN :siblingMobIds
                    AND wfrecon__Equipment__c IN :resourceIds
                    WITH USER_MODE
                ];
            }

            // Process existing assignments
            for (SObject ea : existingAssignments) {
                String resourceId = (type == 'Crew' || type == 'SubContractor') ? 
                    String.valueOf(ea.get('wfrecon__Contact__c')) : 
                    String.valueOf(ea.get('wfrecon__Equipment__c'));
                
                if (!existingAssignmentsMap.containsKey(resourceId)) {
                    existingAssignmentsMap.put(resourceId, new Set<Id>());
                }
                existingAssignmentsMap.get(resourceId).add((Id)ea.get('wfrecon__Mobilization__c'));
            }

            // Handle overlapMode == SKIP scenario
            Map<String, Set<Date>> overlappingMobDatesMap = new Map<String, Set<Date>>();
            
            if (allowOverlap && overlapMode == 'SKIP') {
                if (type == 'Crew' || type == 'SubContractor') {
                    // Query for Crew/SubContractor overlaps
                    List<wfrecon__Mobilization_Member__c> allOverlapsForSkip = [
                        SELECT wfrecon__Mobilization__c, wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Contact__c
                        FROM wfrecon__Mobilization_Member__c
                        WHERE wfrecon__Contact__c IN :resourceIds
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) >= :selectedMob.wfrecon__Start_Date__c.dateGmt()
                        WITH USER_MODE
                    ];

                    // Process overlaps for Crew/SubContractor
                    for (wfrecon__Mobilization_Member__c overlap : allOverlapsForSkip) {
                        String resourceId = overlap.wfrecon__Contact__c;
                        Date overlapDate = overlap.wfrecon__Mobilization__r.wfrecon__Start_Date__c.dateGmt();

                        if (!overlappingMobDatesMap.containsKey(resourceId)) {
                            overlappingMobDatesMap.put(resourceId, new Set<Date>());
                        }
                        overlappingMobDatesMap.get(resourceId).add(overlapDate);
                    }

                } else if (type == 'Asset') {
                    // Query for Asset overlaps
                    List<wfrecon__Mobilization_Asset__c> allOverlapsForSkip = [
                        SELECT wfrecon__Mobilization__c, wfrecon__Mobilization__r.wfrecon__Start_Date__c, wfrecon__Equipment__c
                        FROM wfrecon__Mobilization_Asset__c
                        WHERE wfrecon__Equipment__c IN :resourceIds
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) IN :siblingMobDates
                        AND DAY_ONLY(wfrecon__Mobilization__r.wfrecon__Start_Date__c) >= :selectedMob.wfrecon__Start_Date__c.dateGmt()
                        WITH USER_MODE
                    ];

                    // Process overlaps for Assets
                    for (wfrecon__Mobilization_Asset__c overlap : allOverlapsForSkip) {
                        String resourceId = overlap.wfrecon__Equipment__c;
                        Date overlapDate = overlap.wfrecon__Mobilization__r.wfrecon__Start_Date__c.dateGmt();

                        if (!overlappingMobDatesMap.containsKey(resourceId)) {
                            overlappingMobDatesMap.put(resourceId, new Set<Date>());
                        }
                        overlappingMobDatesMap.get(resourceId).add(overlapDate);
                    }
                }
            }


            // Now process assignments
            for (String resourceId : resourceIds) {
                for (wfrecon__Mobilization__c mob : siblingMobs) {
                    Boolean shouldAssign = true;

                    if (existingAssignmentsMap.containsKey(resourceId) && 
                        existingAssignmentsMap.get(resourceId).contains(mob.Id)) {
                        shouldAssign = false;
                    }

                    if (allowOverlap && overlapMode == 'SKIP' && 
                        overlappingMobDatesMap.containsKey(resourceId) && 
                        overlappingMobDatesMap.get(resourceId).contains(mob.wfrecon__Start_Date__c.dateGmt())) {
                        shouldAssign = false;
                    }

                    if (shouldAssign) {
                        if (type == 'Crew' || type == 'SubContractor') {
                            newAssignments.add(new wfrecon__Mobilization_Member__c(
                                wfrecon__Mobilization__c = mob.Id,
                                wfrecon__Contact__c = resourceId,
                                wfrecon__Crew__c = (type == 'Crew' && resourceMap != null && resourceMap.containsKey(resourceId)) ? (String) resourceMap.get(resourceId) : null
                            ));
                        } else if (type == 'Asset') {
                            newAssignments.add(new wfrecon__Mobilization_Asset__c(
                                wfrecon__Mobilization__c = mob.Id,
                                wfrecon__Equipment__c = resourceId
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
            wfrecon__Mobilization__c mob = [SELECT Id, (SELECT Id FROM wfrecon__Mobilization_Members__r), (SELECT Id FROM wfrecon__Mobilization_Assets__r) FROM wfrecon__Mobilization__c WHERE Id =:mobId WITH USER_MODE];
            List<wfrecon__Mobilization_Member__c> mobMembersToDelete = mob.wfrecon__Mobilization_Members__r;
            List<wfrecon__Mobilization_Asset__c> mobAssetsToDelete = mob.wfrecon__Mobilization_Assets__r;
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