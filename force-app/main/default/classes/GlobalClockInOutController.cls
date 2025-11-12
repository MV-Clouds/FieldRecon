public with sharing class GlobalClockInOutController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();
    
    /**
     * Check if current user is a crew leader and return crew options
     */
    @AuraEnabled
    public static Map<String, Object> checkCrewLeaderAccess(Id jobId) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            Id userId = UserInfo.getUserId();
            
            // Get current user's contact
            List<Contact> userContacts = [
                SELECT Id, User__c 
                FROM Contact 
                WHERE User__c = :userId
                WITH USER_MODE
                LIMIT 1
            ];
            
            if (userContacts.isEmpty()) {
                response.put('isCrewLeader', false);
                response.put('message', 'No contact record found for current user');
                return response;
            }
            
            Contact userContact = userContacts[0];
            
            // Get Mobilizations related to the job
            List<Mobilization__c> mobilizations = [
                SELECT Id 
                FROM Mobilization__c 
                WHERE Job__c = :jobId 
                WITH USER_MODE
            ];
            
            if (mobilizations.isEmpty()) {
                response.put('isCrewLeader', false);
                response.put('message', 'No mobilizations found for this job');
                return response;
            }
            
            Set<Id> mobilizationIds = new Set<Id>();
            for (Mobilization__c mob : mobilizations) {
                mobilizationIds.add(mob.Id);
            }
            
            // Get Crew IDs from Mobilization Members
            Set<Id> crewIdsFromMobilizations = new Set<Id>();
            for (Mobilization_Member__c mm : [
                SELECT Crew__c 
                FROM Mobilization_Member__c 
                WHERE Mobilization__c IN :mobilizationIds
                AND Crew__c != null
                WITH USER_MODE
            ]) {
                crewIdsFromMobilizations.add(mm.Crew__c);
            }
            
            if (crewIdsFromMobilizations.isEmpty()) {
                response.put('isCrewLeader', false);
                response.put('message', 'No crews found for the job mobilizations');
                return response;
            }
            
            // Query Crew Member records where user is marked as leader
            List<Crew_Member__c> leaderCrewMembers = [
                SELECT Id, Crew__c, Crew__r.Name, Contact__c
                FROM Crew_Member__c
                WHERE Crew__c IN :crewIdsFromMobilizations
                AND Contact__c = :userContact.Id
                AND Member_Type__c = 'Leader'
                WITH USER_MODE
            ];
            
            if (leaderCrewMembers.isEmpty()) {
                response.put('isCrewLeader', false);
                response.put('message', 'Only Crew Leaders can access this page');
                return response;
            }
            
            // User is a crew leader - build crew options
            response.put('isCrewLeader', true);
            response.put('crewLeaderId', String.valueOf(userContact.Id));
            
            List<Map<String, String>> crewOptions = new List<Map<String, String>>();
            for (Crew_Member__c member : leaderCrewMembers) {
                crewOptions.add(new Map<String, String>{
                    'label' => member.Crew__r.Name,
                    'value' => String.valueOf(member.Crew__c)
                });
            }
            response.put('crewOptions', crewOptions);
            
        } catch (Exception e) {
            response.put('isCrewLeader', false);
            response.put('message', 'Error checking crew leader access: ' + e.getMessage());
            System.debug('Error in checkCrewLeaderAccess: ' + e.getMessage() + '\n' + e.getStackTraceString());
        }
        
        return response;
    }
    
    /**
     * Get mobilization dates for selected crew
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationDates(Id jobId, String crewLeaderId, String crewId) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            String todayStr = String.valueOf(Date.today());
            
            List<Mobilization__c> mobList = [
                SELECT Id, Name, wfrecon__Start_Date_Text__c, Start_Date__c, End_Date__c
                FROM Mobilization__c 
                WHERE Job__c = :jobId 
                AND Id IN (
                    SELECT Mobilization__c 
                    FROM Mobilization_Member__c 
                    WHERE wfrecon__Crew_Leader_Id__c = :crewLeaderId
                    AND Crew__c = :crewId
                )
                AND wfrecon__Start_Date_Text__c <= :todayStr
                WITH USER_MODE
                ORDER BY Start_Date__c DESC
            ];
            
            if (mobList.isEmpty()) {
                response.put('hasMobilizations', false);
                response.put('message', 'No mobilizations found for selected crew');
                return response;
            }
            
            List<Map<String, String>> mobilizationOptions = new List<Map<String, String>>();
            for (Mobilization__c mob : mobList) {
                mobilizationOptions.add(new Map<String, String>{
                    'label' => mob.wfrecon__Start_Date_Text__c,
                    'value' => String.valueOf(mob.Id)
                });
            }
            
            response.put('hasMobilizations', true);
            response.put('mobilizationOptions', mobilizationOptions);
            
        } catch (Exception e) {
            response.put('hasMobilizations', false);
            response.put('message', 'Error loading mobilizations: ' + e.getMessage());
            System.debug('Error in getMobilizationDates: ' + e.getMessage() + '\n' + e.getStackTraceString());
        }
        
        return response;
    }
    
    /**
     * Get mobilization members with clock in/out status (filtered by crew)
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationMembers(String mobId, String jobId, String crewLeaderId, String crewId) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            // Get mobilization details for date validation
            List<Mobilization__c> mobilizationRecord = [
                SELECT Id, Job__c, Start_Date__c, End_Date__c 
                FROM Mobilization__c 
                WHERE Id = :mobId 
                WITH USER_MODE 
                LIMIT 1
            ];
            
            if (mobilizationRecord.isEmpty()) {
                response.put('hasMembers', false);
                response.put('message', 'Mobilization not found');
                return response;
            }
            
            Map<String, List<JobDetailsPageController.WrapperMember>> membersWithStatus = 
                JobDetailsPageController.getMobilizationMembersWithStatus(mobId);
            
            List<JobDetailsPageController.WrapperMember> allClockInMembers = membersWithStatus.get('clockIn');
            List<JobDetailsPageController.WrapperMember> allClockOutMembers = membersWithStatus.get('clockOut');
            
            // Filter members by selected crew
            List<JobDetailsPageController.WrapperMember> clockInMembers = new List<JobDetailsPageController.WrapperMember>();
            List<JobDetailsPageController.WrapperMember> clockOutMembers = new List<JobDetailsPageController.WrapperMember>();
            
            // Get all mob members for this crew
            Set<Id> crewMemberContactIds = new Set<Id>();
            for (Mobilization_Member__c mm : [
                SELECT Id, Contact__c 
                FROM Mobilization_Member__c 
                WHERE Mobilization__c = :mobId 
                AND Crew__c = :crewId
                WITH USER_MODE
            ]) {
                crewMemberContactIds.add(mm.Contact__c);
            }
            
            // Filter clock in members
            if (allClockInMembers != null) {
                for (JobDetailsPageController.WrapperMember member : allClockInMembers) {
                    if (crewMemberContactIds.contains(member.contactId)) {
                        clockInMembers.add(member);
                    }
                }
            }
            
            // Filter clock out members
            if (allClockOutMembers != null) {
                for (JobDetailsPageController.WrapperMember member : allClockOutMembers) {
                    if (crewMemberContactIds.contains(member.contactId)) {
                        clockOutMembers.add(member);
                    }
                }
            }
            
            // Query cost codes
            List<Cost_Code__c> costCodes = [
                SELECT Id, Name, Code__c
                FROM Cost_Code__c
                WITH USER_MODE
                ORDER BY Name
            ];
            
            List<Map<String, Object>> costCodeList = new List<Map<String, Object>>();
            for (Cost_Code__c cc : costCodes) {
                Map<String, Object> costCodeMap = new Map<String, Object>();
                costCodeMap.put('label', cc.Name);
                costCodeMap.put('value', cc.Id);
                costCodeList.add(costCodeMap);
            }
            
            // Convert dates to user timezone by adding timezone offset
            DateTime jobStartWithTz = mobilizationRecord[0].Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].Start_Date__c)/1000);
            DateTime jobEndWithTz = mobilizationRecord[0].End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].End_Date__c)/1000);
            
            response.put('hasMembers', true);
            response.put('clockInMembers', clockInMembers);
            response.put('clockOutMembers', clockOutMembers);
            response.put('costCodes', costCodeList);
            response.put('jobStartDateTime', jobStartWithTz);
            response.put('jobEndDateTime', jobEndWithTz);
            
        } catch (Exception e) {
            response.put('hasMembers', false);
            response.put('message', 'Error loading members: ' + e.getMessage());
            System.debug('Error in getMobilizationMembers: ' + e.getMessage() + '\n' + e.getStackTraceString());
        }
        
        return response;
    }
    

    
    /**
     * Bulkified clock in or clock out for multiple members - Same logic as JobDetailsPageController but bulkified
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
        }
        
        return response;
    }
    
    /**
     * Bulkified Clock In - Same logic as JobDetailsPageController.createTimesheetRecords but for multiple members
     */
    private static Integer bulkClockInMembers(List<Map<String, Object>> membersList) {
        // Collect all mobMemberIds to query once
        Set<Id> mobMemberIds = new Set<Id>();
        Map<Id, Map<String, Object>> memberDataMap = new Map<Id, Map<String, Object>>();
        
        for (Map<String, Object> member : membersList) {
            Id mobMemberId = (Id) member.get('mobMemberId');
            mobMemberIds.add(mobMemberId);
            memberDataMap.put(mobMemberId, member);
        }
        
        // Query mobilization members once
        List<Mobilization_Member__c> mobMemberRecs = [
            SELECT Id, Contact__c, Mobilization__c, Mobilization__r.Job__c,
                   Mobilization__r.Mobilization_Group__c,
                   Mobilization__r.Mobilization_Group__r.Start_Date__c, 
                   Mobilization__r.Mobilization_Group__r.End_Date__c 
            FROM Mobilization_Member__c 
            WHERE Id IN :mobMemberIds 
            WITH USER_MODE
        ];
        
        // Group by contact and job to check existing timesheets
        Set<Id> contactIds = new Set<Id>();
        Set<Id> jobIds = new Set<Id>();
        Map<Id, Mobilization_Member__c> mobMemberMap = new Map<Id, Mobilization_Member__c>();
        
        for (Mobilization_Member__c mm : mobMemberRecs) {
            contactIds.add(mm.Contact__c);
            jobIds.add(mm.Mobilization__r.Job__c);
            mobMemberMap.put(mm.Id, mm);
        }
        
        // Lists for bulk insert
        List<Timesheet__c> timesheetsToInsert = new List<Timesheet__c>();
        List<Timesheet_Entry__c> entriesToInsert = new List<Timesheet_Entry__c>();
        
        // Process each member for clock in
        for (Map<String, Object> memberData : membersList) {
            Id mobMemberId = (Id) memberData.get('mobMemberId');
            Mobilization_Member__c mm = mobMemberMap.get(mobMemberId);
            
            if (mm == null) continue;
            
            String clockInTimeString = (String) memberData.get('clockInTime');
            Datetime clkInUserTz = convertUtc(clockInTimeString);
            
            Boolean isTimesheetNull = (Boolean) memberData.get('isTimesheetNull');
            String timesheetId = (String) memberData.get('timesheetId');
            String costCodeId = (String) memberData.get('costCodeId');
            String jobId = (String) memberData.get('jobId');
            String mobId = (String) memberData.get('mobId');
            
            if (isTimesheetNull == true) {
                // Create new timesheet
                Timesheet__c timesheetRec = new Timesheet__c();
                timesheetRec.Contact__c = mm.Contact__c;
                timesheetRec.Job__c = jobId;
                timesheetRec.Timesheet_Start_Date__c = mm.Mobilization__r.Mobilization_Group__r.Start_Date__c.date();
                timesheetRec.Timesheet_End_Date__c = mm.Mobilization__r.Mobilization_Group__r.End_Date__c.date();
                timesheetRec.Mobilization_Group__c = mm.Mobilization__r.Mobilization_Group__c;
                timesheetRec.Do_Not_Execute__c = true;
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
            Mobilization_Member__c mm = mobMemberMap.get(mobMemberId);
            
            if (mm == null) continue;
            
            String clockInTimeString = (String) memberData.get('clockInTime');
            Datetime clkInUserTz = convertUtc(clockInTimeString);
            Boolean isTimesheetNull = (Boolean) memberData.get('isTimesheetNull');
            String timesheetId = (String) memberData.get('timesheetId');
            String costCodeId = (String) memberData.get('costCodeId');
            String mobId = (String) memberData.get('mobId');
            
            Id tsId;
            if (isTimesheetNull == true) {
                Timesheet__c newTs = (Timesheet__c) memberData.get('newTimesheet');
                tsId = newTs.Id;
            } else {
                tsId = timesheetId;
            }
            
            Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
            timesheetEntryRec.Timesheet__c = tsId;
            timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
            timesheetEntryRec.Cost_Code__c = costCodeId;
            timesheetEntryRec.Mobilization__c = mobId;
            timesheetEntryRec.Do_Not_Execute__c = true;
            entriesToInsert.add(timesheetEntryRec);
        }
        
        // Insert all entries
        if (!entriesToInsert.isEmpty()) {
            insert entriesToInsert;
        }
        
        return membersList.size();
    }
    
    /**
     * Bulkified Clock Out - Same logic as JobDetailsPageController.createTimesheetRecords but for multiple members
     */
    private static Integer bulkClockOutMembers(List<Map<String, Object>> membersList) {
        // Collect all timesheet entry IDs
        Set<Id> timesheetEntryIds = new Set<Id>();
        Set<Id> timesheetIds = new Set<Id>();
        Map<Id, Map<String, Object>> memberDataByEntryId = new Map<Id, Map<String, Object>>();
        
        for (Map<String, Object> member : membersList) {
            Boolean isTimesheetEntryNull = (Boolean) member.get('isTimesheetEntryNull');
            String timesheetId = (String) member.get('timesheetId');
            String timesheetEntryId = (String) member.get('timesheetEntryId');
            
            if (isTimesheetEntryNull == false && timesheetEntryId != null) {
                timesheetEntryIds.add((Id) timesheetEntryId);
                memberDataByEntryId.put((Id) timesheetEntryId, member);
            } else if (isTimesheetEntryNull == true && timesheetId != null) {
                timesheetIds.add((Id) timesheetId);
            }
        }
        
        // Query existing entries
        Map<Id, Timesheet_Entry__c> existingEntriesMap = new Map<Id, Timesheet_Entry__c>();
        if (!timesheetEntryIds.isEmpty()) {
            existingEntriesMap = new Map<Id, Timesheet_Entry__c>([
                SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c, Timesheet__c 
                FROM Timesheet_Entry__c 
                WHERE Id IN :timesheetEntryIds 
                WITH USER_MODE
            ]);
        }
        
        // Lists for bulk DML
        List<Timesheet_Entry__c> entriesToInsert = new List<Timesheet_Entry__c>();
        List<Timesheet_Entry__c> entriesToUpdate = new List<Timesheet_Entry__c>();
        List<Timesheet_Entry_Item__c> itemsToInsert = new List<Timesheet_Entry_Item__c>();
        
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
            
            Boolean isTimesheetNull = (Boolean) memberData.get('isTimesheetNull');
            Boolean isTimesheetEntryNull = (Boolean) memberData.get('isTimesheetEntryNull');
            String timesheetId = (String) memberData.get('timesheetId');
            String timesheetEntryId = (String) memberData.get('timesheetEntryId');
            String mobId = (String) memberData.get('mobId');
            
            Boolean crossesMidnight = (clkInUserTz != null && clkOutUserTz != null && clkInUserTz.date() != clkOutUserTz.date());
            
            if (isTimesheetEntryNull == true) {
                if (isTimesheetNull == false && timesheetId != null) {
                    Id tsId = (Id) timesheetId;
                    
                    if (crossesMidnight) {
                        // Split Entry Across Two Days
                        Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                        Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));
                        
                        // Entry for Day 1
                        Timesheet_Entry__c entryDay1 = new Timesheet_Entry__c(
                            Timesheet__c = tsId,
                            Clock_In_Time__c = clkInUserTz,
                            Clock_Out_Time__c = firstDayEnd,
                            Mobilization__c = mobId,
                            Do_Not_Execute__c = true
                        );
                        entriesToInsert.add(entryDay1);
                        memberData.put('entryDay1', entryDay1);
                        
                        // Entry for Day 2
                        Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                            Timesheet__c = tsId,
                            Clock_In_Time__c = secondDayStart,
                            Clock_Out_Time__c = clkOutUserTz,
                            Mobilization__c = mobId,
                            Do_Not_Execute__c = true
                        );
                        entriesToInsert.add(entryDay2);
                        memberData.put('entryDay2', entryDay2);
                    } else {
                        // Same day entry
                        Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                        timesheetEntryRec.Timesheet__c = tsId;
                        timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                        timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
                        timesheetEntryRec.Mobilization__c = mobId;
                        timesheetEntryRec.Do_Not_Execute__c = true;
                        entriesToInsert.add(timesheetEntryRec);
                        memberData.put('newEntry', timesheetEntryRec);
                    }
                }
            } else {
                // Update existing entry
                if (timesheetEntryId != null) {
                    Timesheet_Entry__c existing = existingEntriesMap.get((Id) timesheetEntryId);
                    if (existing != null && existing.Clock_In_Time__c != null && clkOutUserTz != null) {
                        Boolean crossesMidnightExisting = (existing.Clock_In_Time__c.date() != clkOutUserTz.date());
                        
                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));
                            
                            // Update existing entry to end at 11:59 PM
                            existing.Clock_Out_Time__c = firstDayEnd;
                            entriesToUpdate.add(existing);
                            memberData.put('existingEntry', existing);
                            
                            // Create new entry for next day
                            Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                                Timesheet__c = existing.Timesheet__c,
                                Clock_In_Time__c = secondDayStart,
                                Clock_Out_Time__c = clkOutUserTz,
                                Cost_Code__c = existing.Cost_Code__c,
                                Mobilization__c = mobId,
                                Do_Not_Execute__c = true
                            );
                            entriesToInsert.add(entryDay2);
                            memberData.put('entryDay2', entryDay2);
                        } else {
                            // Normal same-day update
                            existing.Clock_Out_Time__c = clkOutUserTz;
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
            Boolean isTimesheetEntryNull = (Boolean) memberData.get('isTimesheetEntryNull');
            
            if (isTimesheetEntryNull == true) {
                // Check if midnight split happened
                if (memberData.containsKey('entryDay1')) {
                    Timesheet_Entry__c entryDay1 = (Timesheet_Entry__c) memberData.get('entryDay1');
                    Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                        Timesheet_Entry__c = entryDay1.Id,
                        Clock_In_Time__c = entryDay1.Clock_In_Time__c,
                        Clock_Out_Time__c = entryDay1.Clock_Out_Time__c,
                        Do_Not_Execute__c = true
                    );
                    itemsToInsert.add(itemDay1);
                    
                    Timesheet_Entry__c entryDay2 = (Timesheet_Entry__c) memberData.get('entryDay2');
                    Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                        Timesheet_Entry__c = entryDay2.Id,
                        Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                        Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                        Do_Not_Execute__c = true
                    );
                    itemsToInsert.add(itemDay2);
                } else if (memberData.containsKey('newEntry')) {
                    Timesheet_Entry__c newEntry = (Timesheet_Entry__c) memberData.get('newEntry');
                    Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c(
                        Timesheet_Entry__c = newEntry.Id,
                        Clock_In_Time__c = newEntry.Clock_In_Time__c,
                        Clock_Out_Time__c = newEntry.Clock_Out_Time__c,
                        Cost_Code__c = newEntry.Cost_Code__c,
                        Do_Not_Execute__c = true
                    );
                    itemsToInsert.add(item);
                }
            } else {
                // Existing entry updated
                if (memberData.containsKey('existingEntry')) {
                    Timesheet_Entry__c existing = (Timesheet_Entry__c) memberData.get('existingEntry');
                    Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                        Timesheet_Entry__c = existing.Id,
                        Clock_In_Time__c = existing.Clock_In_Time__c,
                        Clock_Out_Time__c = existing.Clock_Out_Time__c,
                        Cost_Code__c = existing.Cost_Code__c,
                        Do_Not_Execute__c = true
                    );
                    itemsToInsert.add(itemDay1);
                    
                    if (memberData.containsKey('entryDay2')) {
                        Timesheet_Entry__c entryDay2 = (Timesheet_Entry__c) memberData.get('entryDay2');
                        Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                            Timesheet_Entry__c = entryDay2.Id,
                            Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                            Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                            Cost_Code__c = entryDay2.Cost_Code__c,
                            Do_Not_Execute__c = true
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
    
    /**
     * Convert UTC datetime string to Datetime - Same as JobDetailsPageController
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
            Datetime dt = Datetime.valueOfGmt(utcDateTimeStr.replace('T', ' '));
            return dt;
        } catch (Exception e) {
            System.debug('Error in convertUtc: ' + e.getMessage());
            return null;
        }
    }
}