public with sharing class WholeCrewClockInOutController {
    
    public static TimeZone userTz = UserInfo.getTimeZone();
    
    /**
     * Get mobilization details with date validation for a job
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationsForJob(Id jobId) {
        Map<String, Object> response = new Map<String, Object>();
        
        try {
            Date today = Date.today();
            DateTime startOfDay = DateTime.newInstance(today, Time.newInstance(0,0,0,0));
            DateTime endOfDay = DateTime.newInstance(today, Time.newInstance(23,59,59,999));
            
            // Query mobilizations that are scheduled for today or include today in their date range
            List<Mobilization__c> mobilizations = [
                SELECT Id, Name, wfrecon__Start_Date_Text__c, Start_Date__c, End_Date__c,
                       Job__r.Job_Name__c, Mobilization_Status__c
                FROM Mobilization__c 
                WHERE Job__c = :jobId 
                AND Start_Date__c >= :startOfDay
                AND Start_Date__c <= :endOfDay
                WITH USER_MODE
                ORDER BY Start_Date__c DESC
            ];
            
            if (mobilizations.isEmpty()) {
                response.put('hasMobilizations', false);
                response.put('message', 'No mobilizations scheduled for today on this job');
                return response;
            }
            
            List<Map<String, String>> mobilizationOptions = new List<Map<String, String>>();
            for (Mobilization__c mob : mobilizations) {
                String statusLabel = String.isNotBlank(mob.Mobilization_Status__c) ? mob.Mobilization_Status__c : 'N/A';
                String displayLabel = mob.Job__r.Job_Name__c + ' (Status - ' + statusLabel + ')';
                mobilizationOptions.add(new Map<String, String>{
                    'label' => displayLabel,
                    'value' => String.valueOf(mob.Id)
                });
            }
            
            response.put('hasMobilizations', true);
            response.put('mobilizationOptions', mobilizationOptions);
            response.put('defaultMobilizationId', String.valueOf(mobilizations[0].Id));
            
        } catch (Exception e) {
            response.put('hasMobilizations', false);
            response.put('message', 'Error loading mobilizations: ' + e.getMessage());
            System.debug('Error in getMobilizationsForJob: ' + e.getMessage() + '\n' + e.getStackTraceString());
        }
        
        return response;
    }
    
    /**
     * Get mobilization members with clock in/out status for whole crew selection
     */
    @AuraEnabled
    public static Map<String, Object> getMobilizationMembersForSelection(String mobId, String jobId) {
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
            
            // Query crew information for all members
            Map<Id, String> contactToCrewMap = new Map<Id, String>();
            for (Mobilization_Member__c mm : [
                SELECT Id, Contact__c, Crew__r.Name 
                FROM Mobilization_Member__c 
                WHERE Mobilization__c = :mobId
                AND Crew__c != null
                WITH USER_MODE
            ]) {
                contactToCrewMap.put(mm.Contact__c, mm.Crew__r.Name);
            }
            
            // Enhance members with crew name
            List<JobDetailsPageController.WrapperMember> clockInMembers = new List<JobDetailsPageController.WrapperMember>();
            if (allClockInMembers != null) {
                for (JobDetailsPageController.WrapperMember member : allClockInMembers) {
                    member.crewName = contactToCrewMap.get(member.contactId);
                    clockInMembers.add(member);
                }
            }
            
            List<JobDetailsPageController.WrapperMember> clockOutMembers = new List<JobDetailsPageController.WrapperMember>();
            if (allClockOutMembers != null) {
                for (JobDetailsPageController.WrapperMember member : allClockOutMembers) {
                    member.crewName = contactToCrewMap.get(member.contactId);
                    clockOutMembers.add(member);
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
            System.debug('Error in getMobilizationMembersForSelection: ' + e.getMessage() + '\n' + e.getStackTraceString());
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
        }
        
        return response;
    }
    
    /**
     * Bulkified Clock In - Same logic as GlobalClockInOutController
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
            Boolean isTimeSheetNull = (Boolean) memberData.get('isTimeSheetNull');
            String timesheetId = (String) memberData.get('timesheetId');
            String costCodeId = (String) memberData.get('costCodeId');
            String jobId = (String) memberData.get('jobId');
            String mobId = (String) memberData.get('mobId');
            
            if (isTimeSheetNull == true) {
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
            Boolean isTimeSheetNull = (Boolean) memberData.get('isTimeSheetNull');
            String timesheetId = (String) memberData.get('timesheetId');
            String costCodeId = (String) memberData.get('costCodeId');
            String mobId = (String) memberData.get('mobId');
            
            Id tsId;
            if (isTimeSheetNull == true) {
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
     * Bulkified Clock Out - Same logic as GlobalClockInOutController
     */
    private static Integer bulkClockOutMembers(List<Map<String, Object>> membersList) {
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
            return null;
        }
    }
}