public with sharing class WholeCrewClockInOutController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();
    
    /**
     * Get mobilization details with date validation for a job
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationsForJob(Id jobId, String clientDate) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            Date targetDate;
            if (String.isNotBlank(clientDate)) {
                // Expecting YYYY-MM-DD format from JS
                targetDate = Date.valueOf(clientDate);
            } else {
                targetDate = Date.today();
            }

            // 2. Construct Start and End of Day based on the Target Date
            DateTime startOfDay = DateTime.newInstance(targetDate, Time.newInstance(0,0,0,0));
            DateTime endOfDay = DateTime.newInstance(targetDate, Time.newInstance(23,59,59,999));
            
            // Query mobilizations that are scheduled for today or include today in their date range
            List<wfrecon__Mobilization__c> mobilizations = [
                SELECT Id, Name, wfrecon__Start_Date_Text__c, wfrecon__Start_Date__c, wfrecon__End_Date__c,
                       wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Mobilization_Status__c
                FROM wfrecon__Mobilization__c 
                WHERE wfrecon__Job__c = :jobId 
                AND wfrecon__Start_Date__c >= :startOfDay
                AND wfrecon__Start_Date__c <= :endOfDay
                WITH USER_MODE
                ORDER BY wfrecon__Start_Date__c DESC
            ];
            
            if (mobilizations.isEmpty()) {
                response.put('hasMobilizations', false);
                response.put('message', 'No mobilizations scheduled for today on this job');
                return response;
            }
            
            List<Map<String, String>> mobilizationOptions = new List<Map<String, String>>();
            for (wfrecon__Mobilization__c mob : mobilizations) {
                String statusLabel = String.isNotBlank(mob.wfrecon__Mobilization_Status__c) ? mob.wfrecon__Mobilization_Status__c : 'N/A';
                String displayLabel = mob.wfrecon__Job__r.wfrecon__Job_Name__c + ' (Status - ' + statusLabel + ')';
                mobilizationOptions.add(new Map<String, String>{
                    'label' => displayLabel,
                    'value' => String.valueOf(mob.Id)
                });
            }

            // Determine default mobilization - prioritize where user is crew leader
            Id defaultMobilizationId = mobilizations[0].Id; // Default to first
            
            if (mobilizations.size() > 1) {
                // Get logged in user's contact
                Id userId = UserInfo.getUserId();
                List<Contact> userContacts = [
                    SELECT Id 
                    FROM Contact 
                    WHERE wfrecon__User__c = :userId
                    WITH USER_MODE
                    LIMIT 1
                ];
                
                if (!userContacts.isEmpty()) {
                    Contact userContact = userContacts[0];
                    
                    // Get all mobilization IDs
                    Set<Id> mobilizationIds = new Set<Id>();
                    for (wfrecon__Mobilization__c mob : mobilizations) {
                        mobilizationIds.add(mob.Id);
                    }
                    
                    // Get Crew IDs from these mobilizations
                    Map<Id, Set<Id>> mobIdToCrewIds = new Map<Id, Set<Id>>();
                    for (wfrecon__Mobilization_Member__c mm : [
                        SELECT wfrecon__Mobilization__c, wfrecon__Crew__c 
                        FROM wfrecon__Mobilization_Member__c 
                        WHERE wfrecon__Mobilization__c IN :mobilizationIds
                        AND wfrecon__Mobilization__r.wfrecon__Job__c = :jobId
                        AND wfrecon__Crew__c != null
                        WITH USER_MODE
                    ]) {
                        if (!mobIdToCrewIds.containsKey(mm.wfrecon__Mobilization__c)) {
                            mobIdToCrewIds.put(mm.wfrecon__Mobilization__c, new Set<Id>());
                        }
                        mobIdToCrewIds.get(mm.wfrecon__Mobilization__c).add(mm.wfrecon__Crew__c);
                    }
                    
                    // Get all unique crew IDs
                    Set<Id> allCrewIds = new Set<Id>();
                    for (Set<Id> crewIds : mobIdToCrewIds.values()) {
                        allCrewIds.addAll(crewIds);
                    }
                    
                    // Check if user is a crew leader in any of these crews
                    if (!allCrewIds.isEmpty()) {
                        Map<Id, Id> crewIdToMobId = new Map<Id, Id>();
                        for (Id mobId : mobIdToCrewIds.keySet()) {
                            for (Id crewId : mobIdToCrewIds.get(mobId)) {
                                crewIdToMobId.put(crewId, mobId);
                            }
                        }
                        
                        List<wfrecon__Crew_Member__c> leaderCrewMembers = [
                            SELECT Id, wfrecon__Crew__c
                            FROM wfrecon__Crew_Member__c
                            WHERE wfrecon__Crew__c IN :allCrewIds
                            AND wfrecon__Contact__c = :userContact.Id
                            AND wfrecon__Member_Type__c = 'Leader'
                            WITH USER_MODE
                            LIMIT 1
                        ];
                        
                        if (!leaderCrewMembers.isEmpty()) {
                            // User is a crew leader - set default to their mobilization
                            Id leaderCrewId = leaderCrewMembers[0].wfrecon__Crew__c;
                            if (crewIdToMobId.containsKey(leaderCrewId)) {
                                defaultMobilizationId = crewIdToMobId.get(leaderCrewId);
                            }
                        }
                    }
                }
            }
            
            response.put('hasMobilizations', true);
            response.put('mobilizationOptions', mobilizationOptions);
            response.put('defaultMobilizationId', String.valueOf(defaultMobilizationId));
            
        } catch (Exception e) {
            response.put('hasMobilizations', false);
            response.put('message', 'Error loading mobilizations: ' + e.getMessage());
            System.debug('Error in getMobilizationsForJob: ' + e.getMessage() + '\n' + e.getStackTraceString());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'getMobilizationsForJob', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});  
        }
        
        return response;
    }
    
    /**
     * Get mobilization members with clock in/out status - shows only completed sessions in recent times
     */
    private static Map<String, List<WrapperMember>> getMobilizationMembersWithCompletedSessions(String mobId, String jobId) {
        try{
            Map<String, List<WrapperMember>> result = new Map<String, List<WrapperMember>>();
            result.put('clockIn', new List<WrapperMember>());
            result.put('clockOut', new List<WrapperMember>());
            
            // Query mobilization members
            List<wfrecon__Mobilization_Member__c> mobMembers = [
                SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Mobilization__c 
                FROM wfrecon__Mobilization_Member__c 
                WHERE wfrecon__Mobilization__c = :mobId 
                AND wfrecon__Mobilization__r.wfrecon__Job__c = :jobId
                WITH USER_MODE
            ];
            
            if (mobMembers.isEmpty()) {
                return result;
            }
            
            Set<Id> contactIds = new Set<Id>();
            for (wfrecon__Mobilization_Member__c mm : mobMembers) {
                contactIds.add(mm.wfrecon__Contact__c);
            }
            
            // Query timesheets
            Map<Id, wfrecon__Timesheet__c> contactToTimesheetMap = new Map<Id, wfrecon__Timesheet__c>();
            for (wfrecon__Timesheet__c ts : [
                SELECT Id, wfrecon__Contact__c 
                FROM wfrecon__Timesheet__c 
                WHERE wfrecon__Contact__c IN :contactIds AND wfrecon__Job__c=:jobId // JobId added to ensure correct timesheet
                WITH USER_MODE
            ]) {
                contactToTimesheetMap.put(ts.wfrecon__Contact__c, ts);
            }
            
            // Query timesheet entries for these contacts filtered by current mobilization
            Map<Id, List<wfrecon__Timesheet_Entry__c>> contactEntriesMap = new Map<Id, List<wfrecon__Timesheet_Entry__c>>();
            for (wfrecon__Timesheet_Entry__c entry : [
                SELECT Id, wfrecon__Timesheet__c, wfrecon__Timesheet__r.wfrecon__Contact__c,
                       wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c 
                FROM wfrecon__Timesheet_Entry__c 
                WHERE wfrecon__Timesheet__r.wfrecon__Contact__c IN :contactIds 
                AND wfrecon__Mobilization__c = :mobId AND wfrecon__Timesheet__r.wfrecon__Job__c = :jobId // JobId added to ensure correct timesheet
                WITH USER_MODE 
                ORDER BY CreatedDate DESC
            ]) {
                Id contactId = entry.wfrecon__Timesheet__r.wfrecon__Contact__c;
                if (!contactEntriesMap.containsKey(contactId)) {
                    contactEntriesMap.put(contactId, new List<wfrecon__Timesheet_Entry__c>());
                }
                contactEntriesMap.get(contactId).add(entry);
            }
            
            // Process each mobilization member
            for (wfrecon__Mobilization_Member__c m : mobMembers) {
                WrapperMember wrap = new WrapperMember();
                wrap.mobMemberId = m.Id;
                wrap.contactId = m.wfrecon__Contact__c;
                wrap.contactName = m.wfrecon__Contact__r.Name;
                
                wfrecon__Timesheet__c ts = contactToTimesheetMap.get(m.wfrecon__Contact__c);
                List<wfrecon__Timesheet_Entry__c> userEntries = contactEntriesMap.get(m.wfrecon__Contact__c);
                
                if (ts == null) {
                    wrap.isTimeSheetNull = true;
                    wrap.isTimeSheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
                
                if (userEntries == null || userEntries.isEmpty()) {
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimeSheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
                
                Boolean hasOpenEntry = false;
                Boolean hasCompletedEntry = false;
                wfrecon__Timesheet_Entry__c latestOpen;
                wfrecon__Timesheet_Entry__c latestCompleted;
                DateTime mostRecentCompletedClockIn;
                DateTime mostRecentCompletedClockOut;
                for (wfrecon__Timesheet_Entry__c e : userEntries) {
                    if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c == null) {
                        hasOpenEntry = true;
                        latestOpen = e;
                    } else if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c != null) {
                        hasCompletedEntry = true;
                        if (latestCompleted == null) {
                            latestCompleted = e;
                        }
                        // Track most recent completed session for display (only if both times exist)
                        //if (mostRecentCompletedClockIn == null || e.wfrecon__Clock_In_Time__c > mostRecentCompletedClockIn) {
                        if (mostRecentCompletedClockIn == null) {
                            mostRecentCompletedClockIn = e.wfrecon__Clock_In_Time__c;
                            mostRecentCompletedClockOut = e.wfrecon__Clock_Out_Time__c;
                        }
                    } else if (e.wfrecon__Clock_In_Time__c == null && e.wfrecon__Clock_Out_Time__c != null) {
                        // Edge case → treat as open
                        hasOpenEntry = true;
                        latestOpen = e;
                    }
                }
                
                if (hasOpenEntry) {
                    // ClockOut case → must pass the ClockIn time
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimeSheetEntryNull = false;
                    wrap.timesheetEntryId = latestOpen.Id;
                    wrap.clockInTime = (latestOpen.wfrecon__Clock_In_Time__c != null)
                        ? latestOpen.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(latestOpen.wfrecon__Clock_In_Time__c)/1000)
                        : null;
                    wrap.isAgain = false; // Not a new shift yet, finishing current one
                    wrap.recentClockIn = mostRecentCompletedClockIn != null ? mostRecentCompletedClockIn.addSeconds(userTz.getOffset(mostRecentCompletedClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentCompletedClockOut != null ? mostRecentCompletedClockOut.addSeconds(userTz.getOffset(mostRecentCompletedClockOut)/1000) : null;
                    result.get('clockOut').add(wrap);
                } else if (hasCompletedEntry) {
                    // Only completed entries → eligible for ClockIn again
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimeSheetEntryNull = true;
                    wrap.isAgain = true;  // ✅ Contact is clocking in AGAIN
                    wrap.recentClockIn = mostRecentCompletedClockIn != null ? mostRecentCompletedClockIn.addSeconds(userTz.getOffset(mostRecentCompletedClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentCompletedClockOut != null ? mostRecentCompletedClockOut.addSeconds(userTz.getOffset(mostRecentCompletedClockOut)/1000) : null;
                    result.get('clockIn').add(wrap);
                } else {
                    // Default → treat as new ClockIn
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimeSheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                }
            }
            return result;
        }catch(Exception e){
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'getMobilizationMembersWithCompletedSessions', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return new Map<String, List<WrapperMember>>();
        }
    }
    
    /**
     * Get mobilization members with clock in/out status for whole crew selection
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationMembersForSelection(String mobId, String jobId) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            // Get mobilization details for date validation
            List<wfrecon__Mobilization__c> mobilizationRecord = [
                SELECT Id, wfrecon__Job__c, wfrecon__Start_Date__c, wfrecon__End_Date__c 
                FROM wfrecon__Mobilization__c 
                WHERE Id = :mobId 
                WITH USER_MODE 
                LIMIT 1
            ];
            
            if (mobilizationRecord.isEmpty()) {
                response.put('hasMembers', false);
                response.put('message', 'Mobilization not found');
                return response;
            }
            
            Map<String, List<WrapperMember>> membersWithStatus = 
                getMobilizationMembersWithCompletedSessions(mobId, jobId);
            
            List<WrapperMember> allClockInMembers = membersWithStatus.get('clockIn');
            List<WrapperMember> allClockOutMembers = membersWithStatus.get('clockOut');
            
            // Query crew information for all members
            Map<Id, String> contactToCrewMap = new Map<Id, String>();
            for (wfrecon__Mobilization_Member__c mm : [
                SELECT Id, wfrecon__Contact__c, wfrecon__Crew__r.Name 
                FROM wfrecon__Mobilization_Member__c 
                WHERE wfrecon__Mobilization__c = :mobId
                AND wfrecon__Crew__c != null
                WITH USER_MODE
            ]) {
                contactToCrewMap.put(mm.wfrecon__Contact__c, mm.wfrecon__Crew__r.Name);
            }
            
            // Enhance members with crew name
            List<WrapperMember> clockInMembers = new List<WrapperMember>();
            if (allClockInMembers != null) {
                for (WrapperMember member : allClockInMembers) {
                    member.crewName = contactToCrewMap.get(member.contactId);
                    clockInMembers.add(member);
                }
            }
            
            List<WrapperMember> clockOutMembers = new List<WrapperMember>();
            if (allClockOutMembers != null) {
                for (WrapperMember member : allClockOutMembers) {
                    member.crewName = contactToCrewMap.get(member.contactId);
                    clockOutMembers.add(member);
                }
            }
            
            // Query cost codes
            List<wfrecon__Cost_Code__c> costCodes = [
                SELECT Id, Name, wfrecon__Code__c
                FROM wfrecon__Cost_Code__c
                WITH USER_MODE
                ORDER BY Name
            ];
            
            List<Map<String, Object>> costCodeList = new List<Map<String, Object>>();
            for (wfrecon__Cost_Code__c cc : costCodes) {
                Map<String, Object> costCodeMap = new Map<String, Object>();
                costCodeMap.put('label', cc.Name);
                costCodeMap.put('value', cc.Id);
                costCodeList.add(costCodeMap);
            }
            
            // Convert dates to user timezone by adding timezone offset
            DateTime jobStartWithTz = mobilizationRecord[0].wfrecon__Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__Start_Date__c)/1000);
            DateTime jobEndWithTz = mobilizationRecord[0].wfrecon__End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__End_Date__c)/1000);
            
            // Check if there are actually any members in either list
            Boolean hasMembersInLists = (!clockInMembers.isEmpty() || !clockOutMembers.isEmpty());
            
            response.put('hasMembers', hasMembersInLists);
            response.put('clockInMembers', clockInMembers);
            response.put('clockOutMembers', clockOutMembers);
            response.put('costCodes', costCodeList);
            response.put('jobStartDateTime', jobStartWithTz);
            response.put('jobEndDateTime', jobEndWithTz);
            
            if (!hasMembersInLists) {
                response.put('message', 'No crew members found for this mobilization. Please ensure crew members are assigned.');
            }
            
        } catch (Exception e) {
            response.put('hasMembers', false);
            response.put('message', 'Error loading members: ' + e.getMessage());
            System.debug('Error in getMobilizationMembersForSelection: ' + e.getMessage() + '\n' + e.getStackTraceString());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'getMobilizationMembersForSelection', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return response;
    }
    
    /**
     * Bulkified clock in or clock out for selected members - Uses same logic as GlobalClockInOutController
     */
    @AuraEnabled
    public static Map<String, Object> bulkClockInOut(String params) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            Map<String, Object> paramMap = (Map<String, Object>) JSON.deserializeUntyped(params);
            
            String action = (String) paramMap.get('action');
            List<Object> membersObj = (List<Object>) paramMap.get('members');
            
            if (action == null || membersObj == null || membersObj.isEmpty()) {
                response.put('success', false);
                response.put('message', 'Missing required parameters');
                return response;
            }
            
            // Parse all member data
            List<Map<String, Object>> membersList = new List<Map<String, Object>>();
            for (Object memberObj : membersObj) {
                membersList.add((Map<String, Object>) memberObj);
            }
            
            Integer successCount = 0;
            
            if (action == 'clockIn') {
                successCount = bulkClockInMembers(membersList);
            } else if (action == 'clockOut') {
                successCount = bulkClockOutMembers(membersList);
            }
            
            response.put('success', true);
            response.put('message', 'Successfully processed ' + successCount + ' member(s)');
            response.put('count', successCount);
            
        } catch (Exception e) {
            response.put('success', false);
            response.put('message', 'Error: ' + e.getMessage());
            System.debug('Error in bulkClockInOut: ' + e.getMessage() + '\n' + e.getStackTraceString());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'bulkClockInOut', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return response;
    }
    
    /**
     * Bulkified Clock In - Same logic as GlobalClockInOutController
     */
    private static Integer bulkClockInMembers(List<Map<String, Object>> membersList) {
        try{
            // Collect all mobMemberIds to query once
            Set<Id> mobMemberIds = new Set<Id>();
            Map<Id, Map<String, Object>> memberDataMap = new Map<Id, Map<String, Object>>();
            
            for (Map<String, Object> member : membersList) {
                Id mobMemberId = (Id) member.get('mobMemberId');
                mobMemberIds.add(mobMemberId);
                memberDataMap.put(mobMemberId, member);
            }
            
            // Query mobilization members once
            List<wfrecon__Mobilization_Member__c> mobMemberRecs = [
                SELECT Id, wfrecon__Contact__c, wfrecon__Mobilization__c, wfrecon__Mobilization__r.wfrecon__Job__c,
                    wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c,
                    wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, 
                    wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c 
                FROM wfrecon__Mobilization_Member__c 
                WHERE Id IN :mobMemberIds 
                WITH USER_MODE
            ];
            
            // Group by contact and job to check existing timesheets
            Set<Id> contactIds = new Set<Id>();
            Set<Id> jobIds = new Set<Id>();
            Map<Id, wfrecon__Mobilization_Member__c> mobMemberMap = new Map<Id, wfrecon__Mobilization_Member__c>();
            
            for (wfrecon__Mobilization_Member__c mm : mobMemberRecs) {
                contactIds.add(mm.wfrecon__Contact__c);
                jobIds.add(mm.wfrecon__Mobilization__r.wfrecon__Job__c);
                mobMemberMap.put(mm.Id, mm);
            }
            
            // Lists for bulk insert
            List<wfrecon__Timesheet__c> timesheetsToInsert = new List<wfrecon__Timesheet__c>();
            List<wfrecon__Timesheet_Entry__c> entriesToInsert = new List<wfrecon__Timesheet_Entry__c>();
            
            // Process each member for clock in
            for (Map<String, Object> memberData : membersList) {
                Id mobMemberId = (Id) memberData.get('mobMemberId');
                wfrecon__Mobilization_Member__c mm = mobMemberMap.get(mobMemberId);
                
                if (mm == null) continue;
                
                String clockInTimeString = (String) memberData.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);
                Boolean isTimeSheetNull = (Boolean) memberData.get('isTimeSheetNull');
                String timesheetId = (String) memberData.get('timesheetId');
                String costCodeId = (String) memberData.get('costCodeId');
                String jobId = (String) memberData.get('jobId');
                String mobId = (String) memberData.get('mobId');
                
                if (isTimeSheetNull == true) {
                    // Create new timesheet
                    wfrecon__Timesheet__c timesheetRec = new wfrecon__Timesheet__c();
                    timesheetRec.wfrecon__Contact__c = mm.wfrecon__Contact__c;
                    timesheetRec.wfrecon__Job__c = jobId;
                    timesheetRec.wfrecon__Timesheet_Start_Date__c = mm.wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c.date();
                    timesheetRec.wfrecon__Timesheet_End_Date__c = mm.wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c.date();
                    timesheetRec.wfrecon__Mobilization_Group__c = mm.wfrecon__Mobilization__r.wfrecon__Mobilization_Group__c;
                    timesheetRec.wfrecon__Do_Not_Execute__c = true;
                    timesheetsToInsert.add(timesheetRec);
                    
                    // Store reference for entry creation later
                    memberData.put('newTimesheet', timesheetRec);
                }
            }

            // Insert new timesheets
            if (!timesheetsToInsert.isEmpty()) {
                insert timesheetsToInsert;
            }
            
            // Create timesheet entries
            for (Map<String, Object> memberData : membersList) {
                Id mobMemberId = (Id) memberData.get('mobMemberId');
                wfrecon__Mobilization_Member__c mm = mobMemberMap.get(mobMemberId);
                
                if (mm == null) continue;
                
                String clockInTimeString = (String) memberData.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);
                Boolean isTimeSheetNull = (Boolean) memberData.get('isTimeSheetNull');
                String timesheetId = (String) memberData.get('timesheetId');
                String costCodeId = (String) memberData.get('costCodeId');
                String mobId = (String) memberData.get('mobId');
                
                Id tsId;
                if (isTimeSheetNull == true) {
                    wfrecon__Timesheet__c newTs = (wfrecon__Timesheet__c) memberData.get('newTimesheet');
                    tsId = newTs.Id;
                } else {
                    tsId = timesheetId;
                }
                
                wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                timesheetEntryRec.wfrecon__Timesheet__c = tsId;
                timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                timesheetEntryRec.wfrecon__Cost_Code__c = costCodeId;
                timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                entriesToInsert.add(timesheetEntryRec);
            }
            // Insert all entries
            if (!entriesToInsert.isEmpty()) {
                insert entriesToInsert;
            }
            
            return membersList.size();
        }catch(Exception e){
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'bulkClockInMembers', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});  
            return 0;
        }
    }
    
    /**
     * Bulkified Clock Out - Same logic as GlobalClockInOutController
     */
    private static Integer bulkClockOutMembers(List<Map<String, Object>> membersList) {
        try{
            // Collect all timesheet entry IDs
            Set<Id> timesheetEntryIds = new Set<Id>();
            Set<Id> timesheetIds = new Set<Id>();
            Map<Id, Map<String, Object>> memberDataByEntryId = new Map<Id, Map<String, Object>>();
            
            for (Map<String, Object> member : membersList) {
                Boolean isTimeSheetEntryNull = (Boolean) member.get('isTimeSheetEntryNull');
                String timesheetId = (String) member.get('timesheetId');
                String timesheetEntryId = (String) member.get('timesheetEntryId');
                
                if (isTimeSheetEntryNull == false && timesheetEntryId != null) {
                    timesheetEntryIds.add((Id) timesheetEntryId);
                    memberDataByEntryId.put((Id) timesheetEntryId, member);
                } else if (isTimeSheetEntryNull == true && timesheetId != null) {
                    timesheetIds.add((Id) timesheetId);
                }
            }
            
            // Query existing entries
            Map<Id, wfrecon__Timesheet_Entry__c> existingEntriesMap = new Map<Id, wfrecon__Timesheet_Entry__c>();
            if (!timesheetEntryIds.isEmpty()) {
                existingEntriesMap = new Map<Id, wfrecon__Timesheet_Entry__c>([
                    SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Cost_Code__c, wfrecon__Timesheet__c 
                    FROM wfrecon__Timesheet_Entry__c 
                    WHERE Id IN :timesheetEntryIds 
                    WITH USER_MODE
                ]);
            }
            
            // Lists for bulk DML
            List<wfrecon__Timesheet_Entry__c> entriesToInsert = new List<wfrecon__Timesheet_Entry__c>();
            List<wfrecon__Timesheet_Entry__c> entriesToUpdate = new List<wfrecon__Timesheet_Entry__c>();
            List<wfrecon__Timesheet_Entry_Item__c> itemsToInsert = new List<wfrecon__Timesheet_Entry_Item__c>();
            
            // Process each member for clock out
            for (Map<String, Object> memberData : membersList) {
                String clockOutTimeString = (String) memberData.get('clockOutTime');
                String clockInTimeString = (String) memberData.get('clockInTime');
                Datetime clkOutUserTz = convertUtc(clockOutTimeString);
                Datetime clkInUserTz = null;
                
                // Safely parse clockInTime
                if (String.isNotBlank(clockInTimeString)) {
                    try {
                        clkInUserTz = Datetime.valueOfGmt(clockInTimeString.replace('T',' ').replace('Z',''));
                    } catch (Exception e) {
                        System.debug('Error parsing clockInTime: ' + e.getMessage());
                    }
                }
                
                Boolean isTimeSheetNull = (Boolean) memberData.get('isTimeSheetNull');
                Boolean isTimeSheetEntryNull = (Boolean) memberData.get('isTimeSheetEntryNull');
                String timesheetId = (String) memberData.get('timesheetId');
                String timesheetEntryId = (String) memberData.get('timesheetEntryId');
                String mobId = (String) memberData.get('mobId');
                
                Boolean crossesMidnight = (clkInUserTz != null && clkOutUserTz != null && clkInUserTz.date() != clkOutUserTz.date());
                
                if (isTimeSheetEntryNull == true) {
                    if (isTimeSheetNull == false && timesheetId != null) {
                        Id tsId = (Id) timesheetId;
                        
                        if (crossesMidnight) {
                            // Split Entry Across Two Days
                            Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));
                            
                            // Entry for Day 1
                            wfrecon__Timesheet_Entry__c entryDay1 = new wfrecon__Timesheet_Entry__c(
                                wfrecon__Timesheet__c = tsId,
                                wfrecon__Clock_In_Time__c = clkInUserTz,
                                wfrecon__Clock_Out_Time__c = firstDayEnd,
                                wfrecon__Mobilization__c = mobId,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            entriesToInsert.add(entryDay1);
                            memberData.put('entryDay1', entryDay1);
                            
                            // Entry for Day 2
                            wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                wfrecon__Timesheet__c = tsId,
                                wfrecon__Clock_In_Time__c = secondDayStart,
                                wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                wfrecon__Mobilization__c = mobId,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            entriesToInsert.add(entryDay2);
                            memberData.put('entryDay2', entryDay2);
                        } else {
                            // Same day entry
                            wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                            timesheetEntryRec.wfrecon__Timesheet__c = tsId;
                            timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                            timesheetEntryRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                            timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                            timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                            entriesToInsert.add(timesheetEntryRec);
                            memberData.put('newEntry', timesheetEntryRec);
                        }
                    }
                } else {
                    // Update existing entry
                    if (timesheetEntryId != null) {
                        wfrecon__Timesheet_Entry__c existing = existingEntriesMap.get((Id) timesheetEntryId);
                        if (existing != null && existing.wfrecon__Clock_In_Time__c != null && clkOutUserTz != null) {
                            Boolean crossesMidnightExisting = (existing.wfrecon__Clock_In_Time__c.date() != clkOutUserTz.date());
                            
                            if (crossesMidnightExisting) {
                                Datetime firstDayEnd = DateTime.newInstance(existing.wfrecon__Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));
                                
                                // Update existing entry to end at 11:59 PM
                                existing.wfrecon__Clock_Out_Time__c = firstDayEnd;
                                entriesToUpdate.add(existing);
                                memberData.put('existingEntry', existing);
                                
                                // Create new entry for next day
                                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = existing.wfrecon__Timesheet__c,
                                    wfrecon__Clock_In_Time__c = secondDayStart,
                                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                    wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                entriesToInsert.add(entryDay2);
                                memberData.put('entryDay2', entryDay2);
                            } else {
                                // Normal same-day update
                                existing.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                                entriesToUpdate.add(existing);
                                memberData.put('existingEntry', existing);
                            }
                        }
                    }
                }
            }
            
            // Insert new entries
            if (!entriesToInsert.isEmpty()) {
                insert entriesToInsert;
            }
            
            // Update existing entries
            if (!entriesToUpdate.isEmpty()) {
                update entriesToUpdate;
            }
            
            // Create timesheet entry items
            for (Map<String, Object> memberData : membersList) {
                Boolean isTimeSheetEntryNull = (Boolean) memberData.get('isTimeSheetEntryNull');
                
                if (isTimesheetEntryNull == true) {
                    // Check if midnight split happened
                    if (memberData.containsKey('entryDay1')) {
                        wfrecon__Timesheet_Entry__c entryDay1 = (wfrecon__Timesheet_Entry__c) memberData.get('entryDay1');
                        wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                            wfrecon__Timesheet_Entry__c = entryDay1.Id,
                            wfrecon__Clock_In_Time__c = entryDay1.wfrecon__Clock_In_Time__c,
                            wfrecon__Clock_Out_Time__c = entryDay1.wfrecon__Clock_Out_Time__c,
                            wfrecon__Do_Not_Execute__c = true
                        );
                        itemsToInsert.add(itemDay1);
                        
                        wfrecon__Timesheet_Entry__c entryDay2 = (wfrecon__Timesheet_Entry__c) memberData.get('entryDay2');
                        wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                            wfrecon__Timesheet_Entry__c = entryDay2.Id,
                            wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                            wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                            wfrecon__Do_Not_Execute__c = true
                        );
                        itemsToInsert.add(itemDay2);
                    } else if (memberData.containsKey('newEntry')) {
                        wfrecon__Timesheet_Entry__c newEntry = (wfrecon__Timesheet_Entry__c) memberData.get('newEntry');
                        wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
                            wfrecon__Timesheet_Entry__c = newEntry.Id,
                            wfrecon__Clock_In_Time__c = newEntry.wfrecon__Clock_In_Time__c,
                            wfrecon__Clock_Out_Time__c = newEntry.wfrecon__Clock_Out_Time__c,
                            wfrecon__Cost_Code__c = newEntry.wfrecon__Cost_Code__c,
                            wfrecon__Do_Not_Execute__c = true
                        );
                        itemsToInsert.add(item);
                    }
                } else {
                    // Existing entry updated
                    if (memberData.containsKey('existingEntry')) {
                        wfrecon__Timesheet_Entry__c existing = (wfrecon__Timesheet_Entry__c) memberData.get('existingEntry');
                        wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                            wfrecon__Timesheet_Entry__c = existing.Id,
                            wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                            wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                            wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                            wfrecon__Do_Not_Execute__c = true
                        );
                        itemsToInsert.add(itemDay1);
                        
                        if (memberData.containsKey('entryDay2')) {
                            wfrecon__Timesheet_Entry__c entryDay2 = (wfrecon__Timesheet_Entry__c) memberData.get('entryDay2');
                            wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = entryDay2.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            itemsToInsert.add(itemDay2);
                        }
                    }
                }
            }
            
            // Insert all items
            if (!itemsToInsert.isEmpty()) {
                insert itemsToInsert;
            }
            
            return membersList.size();
        }
        catch(Exception e){
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'bulkClockOutMembers', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return 0;
        }
    }
    
    /**
     * Convert UTC datetime string to Datetime - Same as GlobalClockInOutController
     */
    public static Datetime convertUtc(String utcDateTimeStr) {
        try {
            if (String.isBlank(utcDateTimeStr)) return null;

            // Trim spaces
            utcDateTimeStr = utcDateTimeStr.trim();

            // Remove trailing 'Z' (UTC marker)
            if (utcDateTimeStr.endsWith('Z')) {
                utcDateTimeStr = utcDateTimeStr.replace('Z', '');
            }

            // Remove timezone offsets like +05:30 or -04:00
            utcDateTimeStr = utcDateTimeStr.replaceAll('(\\+|\\-)\\d{2}:?\\d{2}$', '');

            // Normalize milliseconds — if present, strip them
            utcDateTimeStr = utcDateTimeStr.replaceAll('\\.\\d{1,3}', '');

            // Now ensure it ends with seconds
            if (Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$', utcDateTimeStr)) {
                utcDateTimeStr += ':00';
            }

            // Finally parse it
            Datetime dt = Datetime.valueOf(utcDateTimeStr.replace('T', ' '));
            return dt;
        } catch (Exception e) {
            System.debug('Error in convertUtc: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'convertUtc', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    /**
     * Check if user has access (Admin or Crew Leader for the job)
     */
    @AuraEnabled
    public static Map<String, Object> checkUserAccess(Id jobId, String clientDate) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            Id userId = UserInfo.getUserId();
            Boolean hasAccess = false;
            Boolean isCrewLeader = false;
            String accessErrorMessage = '';
            
            // Check if user is System Admin
            List<PermissionSetAssignment> adminAssignments = [
                SELECT Id
                FROM PermissionSetAssignment
                WHERE AssigneeId = :userId
                AND PermissionSet.Name IN ('FR_Admin', 'FR_Crew_Boss')
                LIMIT 1
            ];
            
            if (!adminAssignments.isEmpty()) {
                hasAccess = true;
                response.put('hasAccess', true);
                response.put('isCrewLeader', false);
                response.put('accessErrorMessage', '');
                return response;
            }
            
            // Check if user is a Crew Leader for this job
            List<Contact> userContacts = [
                SELECT Id, wfrecon__User__c 
                FROM Contact 
                WHERE wfrecon__User__c = :userId
                WITH USER_MODE
                LIMIT 1
            ];
            
            if (!userContacts.isEmpty() && jobId != null) {
                Contact userContact = userContacts[0];

                Date targetDate;
                if (String.isNotBlank(clientDate)) {
                    // Expecting YYYY-MM-DD format from JS
                    targetDate = Date.valueOf(clientDate);
                } else {
                    targetDate = Date.today();
                }

                // 2. Construct Start and End of Day based on the Target Date
                DateTime startOfDay = DateTime.newInstance(targetDate, Time.newInstance(0,0,0,0));
                DateTime endOfDay = DateTime.newInstance(targetDate, Time.newInstance(23,59,59,999));
                
                List<wfrecon__Mobilization__c> mobilizations = [
                    SELECT Id 
                    FROM wfrecon__Mobilization__c 
                    WHERE wfrecon__Job__c = :jobId 
                    AND wfrecon__Start_Date__c >= :startOfDay
                    AND wfrecon__Start_Date__c <= :endOfDay
                    WITH USER_MODE
                ];
                
                if (!mobilizations.isEmpty()) {
                    Set<Id> mobilizationIds = new Set<Id>();
                    for (wfrecon__Mobilization__c mob : mobilizations) {
                        mobilizationIds.add(mob.Id);
                    }
                    
                    // Get Crew IDs from today's Mobilization Members
                    Set<Id> crewIdsFromMobilizations = new Set<Id>();
                    for (wfrecon__Mobilization_Member__c mm : [
                        SELECT wfrecon__Crew__c 
                        FROM wfrecon__Mobilization_Member__c 
                        WHERE wfrecon__Mobilization__c IN :mobilizationIds
                        AND wfrecon__Crew__c != null
                        WITH USER_MODE
                    ]) {
                        crewIdsFromMobilizations.add(mm.wfrecon__Crew__c);
                    }
                    
                    // Check if user is a Crew Leader in any of today's crews
                    if (!crewIdsFromMobilizations.isEmpty()) {
                        List<wfrecon__Crew_Member__c> leaderCrewMembers = [
                            SELECT Id, wfrecon__Crew__c, wfrecon__Contact__c
                            FROM wfrecon__Crew_Member__c
                            WHERE wfrecon__Crew__c IN :crewIdsFromMobilizations
                            AND wfrecon__Contact__c = :userContact.Id
                            AND wfrecon__Member_Type__c = 'Leader'
                            WITH USER_MODE
                        ];
                        
                        if (!leaderCrewMembers.isEmpty()) {
                            hasAccess = true;
                            isCrewLeader = true;
                        }
                    }
                }
            }
            
            if (!hasAccess) {
                accessErrorMessage = 'You don\'t have permission to access this page. Only Crew Leaders and Admins can manage crew clock in/out.';
            }
            
            response.put('hasAccess', hasAccess);
            response.put('isCrewLeader', isCrewLeader);
            response.put('accessErrorMessage', accessErrorMessage);
            
        } catch (Exception e) {
            response.put('hasAccess', false);
            response.put('isCrewLeader', false);
            response.put('accessErrorMessage', 'An error occurred while checking permissions. Please try again or contact your system administrator.');
            System.debug('Error in checkUserAccess: ' + e.getMessage() + '\n' + e.getStackTraceString());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'WholeCrewClockInOutController', 'methodName' => 'checkUserAccess', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
        }
        
        return response;
    }

    public class WrapperMember {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public DateTime jobStartTime;
        @AuraEnabled public DateTime jobEndTime;
        @AuraEnabled public DateTime clockInTime;
        @AuraEnabled public Boolean isTimeSheetNull;
        @AuraEnabled public String timesheetId;
        @AuraEnabled public Boolean isTimeSheetEntryNull;
        @AuraEnabled public String timesheetEntryId;
        @AuraEnabled public String mobMemberId;
        @AuraEnabled public Map<Id, String> costCodeDetails;
        @AuraEnabled public Boolean isAgain;
        @AuraEnabled public String crewName;
        @AuraEnabled public DateTime recentClockIn;
        @AuraEnabled public DateTime recentClockOut;
    }
}