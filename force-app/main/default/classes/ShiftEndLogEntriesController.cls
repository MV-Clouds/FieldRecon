public with sharing class ShiftEndLogEntriesController {
    public static TimeZone userTz = UserInfo.getTimeZone();

    @AuraEnabled
    public static Map<String, String> getMobilizationList(String jobId, String crewLeaderId){
        try {
            Map<String, String> result = new Map<String, String>();
            if (String.isNotBlank(crewLeaderId) && crewLeaderId != null) {
                Date today = Date.today();
                Date yesterday = today.addDays(-1);
                String todayStr = String.valueOf(today);
                String yesterdayStr = String.valueOf(yesterday);
                
                // Only return today's and yesterday's mobilization dates
                List<Mobilization__c> mobList = [SELECT Id, Name, Start_Date_Text__c FROM Mobilization__c WHERE Job__c = :jobId 
                                                    AND Id IN (SELECT Mobilization__c FROM Mobilization_Member__c WHERE Crew_Leader_Id__c = :crewLeaderId)
                                                    AND (Start_Date_Text__c = :todayStr OR Start_Date_Text__c = :yesterdayStr)
                                                    WITH USER_MODE];
                for (Mobilization__c mob : mobList) {
                    result.put(mob.Id, mob.Start_Date_Text__c);
                }
            }

            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getMobilizationList', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static Map<String, List<WrapperMember>> getMobilizationMembersWithStatus(String mobId, String jobId, String crewLeaderId) {
        try {
            Map<String, List<WrapperMember>> result = new Map<String, List<WrapperMember>>();
            result.put('clockIn', new List<WrapperMember>());
            result.put('clockOut', new List<WrapperMember>());
            result.put('costCodeDetails', new List<WrapperMember>());
    
            List<Mobilization__c> mobilizationRecord = [SELECT Id, Job__c, Start_Date__c, End_Date__c FROM Mobilization__c WHERE Id = :mobId WITH USER_MODE LIMIT 1];

            List<Mobilization_Member__c> members = [SELECT Id, Contact__c, Contact__r.Name, Contact__r.Can_Clock_In_Out__c, Mobilization__r.Job__c
                                                    FROM Mobilization_Member__c WHERE Mobilization__c = :mobId AND Contact__c != null
                                                    AND Contact__r.Can_Clock_In_Out__c = true AND Crew_Leader_Id__c = :crewLeaderId
                                                    WITH USER_MODE ORDER BY Contact__r.Name ASC];
    
            Set<Id> contactIds = new Set<Id>();
            for (Mobilization_Member__c m : members) {
                contactIds.add(m.Contact__c);
            }
            
            // Add crew leader to contactIds if not already present
            if (String.isNotBlank(crewLeaderId) && !contactIds.contains(crewLeaderId)) {
                contactIds.add(crewLeaderId);
            }
    
            if (contactIds.isEmpty()) {
                return result;
            }

            List<Timesheet__c> tsList = [SELECT Id, Contact__c, Timesheet_Start_Date__c, Timesheet_End_Date__c FROM Timesheet__c WHERE Contact__c IN :contactIds
                                            AND Job__c = :jobId AND Timesheet_Start_Date__c <= :Date.valueOf(mobilizationRecord[0].Start_Date__c)
                                            AND Timesheet_End_Date__c >= :Date.valueOf(mobilizationRecord[0].End_Date__c) WITH USER_MODE ORDER BY Contact__r.Name ASC];

            Map<Id, Timesheet__c> contactTimesheetMap = new Map<Id, Timesheet__c>();
            for (Timesheet__c ts : tsList) {
                contactTimesheetMap.put(ts.Contact__c, ts);
            }

            Date startDate = mobilizationRecord[0].Start_Date__c.date();
            DateTime startDateTime = DateTime.newInstance(startDate, Time.newInstance(0,0,0,0));
            DateTime endDateTime   = DateTime.newInstance(startDate, Time.newInstance(23,59,59,999));
            List<Timesheet_Entry__c> entries = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Contact__c FROM Timesheet_Entry__c
                                                WHERE Timesheet__c IN :tsList AND Clock_In_Time__c >= :startDateTime AND Clock_In_Time__c < :endDateTime
                                                WITH USER_MODE];

            Map<Id, List<Timesheet_Entry__c>> contactEntriesMap = new Map<Id, List<Timesheet_Entry__c>>();
            for (Timesheet_Entry__c e : entries) {
                if (!contactEntriesMap.containsKey(e.Timesheet__r.Contact__c)) {
                    contactEntriesMap.put(e.Timesheet__r.Contact__c, new List<Timesheet_Entry__c>());
                }
                contactEntriesMap.get(e.Timesheet__r.Contact__c).add(e);
            }

            for (Mobilization_Member__c m : members) {
                WrapperMember wrap = new WrapperMember();
                wrap.jobStartTime = mobilizationRecord[0].Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].Start_Date__c)/1000);
                wrap.jobEndTime = mobilizationRecord[0].End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].End_Date__c)/1000);
                wrap.contactId = m.Contact__c;
                wrap.contactName = m.Contact__r.Name;
                wrap.mobMemberId = m.Id;
    
                Timesheet__c ts = contactTimesheetMap.get(m.Contact__c);
                List<Timesheet_Entry__c> userEntries = contactEntriesMap.get(m.Contact__c);
    
                if (ts == null) {
                    wrap.isTimesheetNull = true;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
    
                if (userEntries == null || userEntries.isEmpty()) {
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                    continue;
                }
    
                Boolean hasOpenEntry = false;
                Boolean hasCompletedEntry = false;
                Timesheet_Entry__c latestOpen;
                Timesheet_Entry__c latestCompleted;
                DateTime mostRecentClockIn;
                DateTime mostRecentClockOut;
    
                for (Timesheet_Entry__c e : userEntries) {
                    // Track most recent clock in/out times
                    if (e.Clock_In_Time__c != null) {
                        if (mostRecentClockIn == null || e.Clock_In_Time__c > mostRecentClockIn) {
                            mostRecentClockIn = e.Clock_In_Time__c;
                        }
                    }
                    if (e.Clock_Out_Time__c != null) {
                        if (mostRecentClockOut == null || e.Clock_Out_Time__c > mostRecentClockOut) {
                            mostRecentClockOut = e.Clock_Out_Time__c;
                        }
                    }
                    
                    if (e.Clock_In_Time__c != null && e.Clock_Out_Time__c == null) {
                        hasOpenEntry = true;
                        latestOpen = e;
                    } else if (e.Clock_In_Time__c != null && e.Clock_Out_Time__c != null) {
                        hasCompletedEntry = true;
                        latestCompleted = e;
                    } else if (e.Clock_In_Time__c == null && e.Clock_Out_Time__c != null) {
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
                    wrap.clockInTime = (latestOpen.Clock_In_Time__c != null)
                        ? latestOpen.Clock_In_Time__c.addSeconds(userTz.getOffset(latestOpen.Clock_In_Time__c)/1000)
                        : null;
                    wrap.isAgain = false; // Not a new shift yet, finishing current one
                    wrap.recentClockIn = mostRecentClockIn != null ? mostRecentClockIn.addSeconds(userTz.getOffset(mostRecentClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentClockOut != null ? mostRecentClockOut.addSeconds(userTz.getOffset(mostRecentClockOut)/1000) : null;
                    result.get('clockOut').add(wrap);
                } else if (hasCompletedEntry) {
                    // Only completed entries → eligible for ClockIn again
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = true;  // ✅ Contact is clocking in AGAIN
                    wrap.recentClockIn = mostRecentClockIn != null ? mostRecentClockIn.addSeconds(userTz.getOffset(mostRecentClockIn)/1000) : null;
                    wrap.recentClockOut = mostRecentClockOut != null ? mostRecentClockOut.addSeconds(userTz.getOffset(mostRecentClockOut)/1000) : null;
                    result.get('clockIn').add(wrap);
                } else {
                    // Default → treat as new ClockIn
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = false;
                    result.get('clockIn').add(wrap);
                }
                
            }
            // 5. Build cost code details
            Map<Id, String> costCodeDetails = new Map<Id, String>();
            List<Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM Cost_Code__c WITH USER_MODE];
            for (Cost_Code__c c : costCodeRecs) {
                costCodeDetails.put(c.Id, c.Name);
            }
            WrapperMember costCodeDetailsWrap = new WrapperMember();
            costCodeDetailsWrap.costCodeDetails = costCodeDetails;
            result.get('costCodeDetails').add(costCodeDetailsWrap);
            
            // Add approval status information
            Date workDate = mobilizationRecord[0].Start_Date__c.date();
            Date today = Date.today();
            
            String approvalMessage = '';
            
            // If creating entry for a past date, show pending approval message
            if (workDate < today) {
                approvalMessage = 'This entry will go into pending approval status.';
            }
            
            WrapperMember approvalStatusWrap = new WrapperMember();
            approvalStatusWrap.approvalMessage = approvalMessage;
            approvalStatusWrap.canEditTimesheet = true;
            result.put('approvalStatus', new List<WrapperMember>{approvalStatusWrap});

            System.debug('Approval Status: ' + approvalStatusWrap);
            
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getMobilizationMembersWithStatus', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static Boolean createTimesheetRecords(String params){
        try {
            Map<String, Object> paramsMap = (Map<String, Object>) JSON.deserializeUntyped(params);

            String jobId = (String)paramsMap.get('jobId');
            String mobId = (String)paramsMap.get('mobId');
            String mobGroupId;
            List<Mobilization__c> mobRec = [SELECT Id, Name, Mobilization_Group__r.Start_Date__c, Mobilization_Group__r.End_Date__c FROM Mobilization__c 
                                            WHERE Id = :mobId WITH USER_MODE];

            mobGroupId = mobRec[0].Mobilization_Group__r.Id;
            
            List<Mobilization_Member__c> mobMemberRecs = [SELECT Id, Contact__c, Mobilization__r.Mobilization_Group__r.Start_Date__c, Mobilization__r.Mobilization_Group__r.End_Date__c FROM Mobilization_Member__c WHERE Id = :(String)paramsMap.get('mobMemberId') WITH USER_MODE];

            if((String) paramsMap.get('actionType') == 'clockIn') {
                
                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);

                // If first clockin for moblization group for contact > Create Timesheet and Timesheet Entry
                if(paramsMap.get('isTimeSheetNull') == true) {
                    Timesheet__c timesheetRec = new Timesheet__c();
                    timesheetRec.Contact__c = mobMemberRecs[0].Contact__c;
                    timesheetRec.Job__c = jobId;
                    timesheetRec.Timesheet_Start_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.Start_Date__c.date();
                    timesheetRec.Timesheet_End_Date__c = mobMemberRecs[0].Mobilization__r.Mobilization_Group__r.End_Date__c.date();
                    timesheetRec.Mobilization_Group__c = mobGroupId;
                    timesheetRec.Do_Not_Execute__c = true;
                    insert timesheetRec;
    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRec.Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Mobilization__c = mobId;
                    timesheetEntryRec.Do_Not_Execute__c = true;
                    insert timesheetEntryRec;
                } else {
                    List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];
                    
                    Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                    timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.Mobilization__c = mobId;
                    timesheetEntryRec.Do_Not_Execute__c = true;
                    insert timesheetEntryRec;
                }
            }

            if((String) paramsMap.get('actionType') == 'clockOut') {

                // Convert clockOutTime to UTC to user timezone
                String clockOutTimeString = (String)paramsMap.get('clockOutTime');
                Datetime clkOutUserTz = convertUtc(clockOutTimeString);

                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz  = Datetime.valueOfGmt(clockInTimeString.replace('T',' ').replace('Z',''));

                // Helper to check date difference
                Boolean crossesMidnight = (clkInUserTz.date() != clkOutUserTz.date());

                if(paramsMap.get('isTimeSheetEntryNull') == true) {
                    if(paramsMap.get('isTimeSheetNull') == false) {
                        List<Timesheet__c> timesheetRecs = [SELECT Id FROM Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];

                        if (!timesheetRecs.isEmpty()) {
                            Id tsId = timesheetRecs[0].Id;
                            
                            if (crossesMidnight) {
                                // 🕛 Split Entry Across Two Days
                                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                                // 1️⃣ Entry for Day 1 (till 11:59 PM)
                                Timesheet_Entry__c entryDay1 = new Timesheet_Entry__c(
                                    Timesheet__c = tsId,
                                    Clock_In_Time__c = clkInUserTz,
                                    Clock_Out_Time__c = firstDayEnd,
                                    Mobilization__c = mobId,
                                    Do_Not_Execute__c = true
                                );
                                insert entryDay1;

                                Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                                    Timesheet_Entry__c = entryDay1.Id,
                                    Clock_In_Time__c = entryDay1.Clock_In_Time__c,
                                    Clock_Out_Time__c = entryDay1.Clock_Out_Time__c,
                                    Do_Not_Execute__c = true
                                );
                                insert itemDay1;

                                // 2️⃣ Entry for Day 2 (from 12:00 AM)
                                Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                                    Timesheet__c = tsId,
                                    Clock_In_Time__c = secondDayStart,
                                    Clock_Out_Time__c = clkOutUserTz,
                                    Mobilization__c = mobId,
                                    Do_Not_Execute__c = true
                                );
                                insert entryDay2;

                                Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                                    Timesheet_Entry__c = entryDay2.Id,
                                    Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                                    Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                                    Do_Not_Execute__c = true
                                );
                                insert itemDay2;

                            } else {
                                Timesheet_Entry__c timesheetEntryRec = new Timesheet_Entry__c();
                                timesheetEntryRec.Timesheet__c = timesheetRecs[0].Id;
                                timesheetEntryRec.Clock_In_Time__c = clkInUserTz;
                                timesheetEntryRec.Clock_Out_Time__c = clkOutUserTz;
                                timesheetEntryRec.Mobilization__c = mobId;
                                timesheetEntryRec.Do_Not_Execute__c = true;
                                insert timesheetEntryRec;
        
                                Timesheet_Entry_Item__c timesheetEntryItemRec = new Timesheet_Entry_Item__c();
                                timesheetEntryItemRec.Timesheet_Entry__c = timesheetEntryRec.Id;
                                timesheetEntryItemRec.Clock_In_Time__c = timesheetEntryRec.Clock_In_Time__c;
                                timesheetEntryItemRec.Clock_Out_Time__c = timesheetEntryRec.Clock_Out_Time__c;
                                timesheetEntryItemRec.Cost_Code__c = timesheetEntryRec.Cost_Code__c;
                                timesheetEntryItemRec.Do_Not_Execute__c = true;
                                insert timesheetEntryItemRec;
                            }
                        }
                    }
                } else {
                    List<Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Cost_Code__c, Timesheet__c FROM Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId') WITH USER_MODE];
                    if (!timesheetEntryRecs.isEmpty()) {
                        Timesheet_Entry__c existing = timesheetEntryRecs[0];
                        Boolean crossesMidnightExisting = (existing.Clock_In_Time__c.date() != clkOutUserTz.date());

                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                            // Update existing entry to end at 11:59 PM
                            existing.Clock_Out_Time__c = firstDayEnd;
                            update existing;

                            // Create Timesheet Entry Item for day 1
                            Timesheet_Entry_Item__c itemDay1 = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = existing.Id,
                                Clock_In_Time__c = existing.Clock_In_Time__c,
                                Clock_Out_Time__c = existing.Clock_Out_Time__c,
                                Cost_Code__c = existing.Cost_Code__c,
                                Do_Not_Execute__c = true
                            );
                            insert itemDay1;

                            // Create new entry for next day
                            Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                                Timesheet__c = existing.Timesheet__c,
                                Clock_In_Time__c = secondDayStart,
                                Clock_Out_Time__c = clkOutUserTz,
                                Cost_Code__c = existing.Cost_Code__c,
                                Mobilization__c = mobId,
                                Do_Not_Execute__c = true
                            );
                            insert entryDay2;

                            // Create Timesheet Entry Item for day 2
                            Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = entryDay2.Id,
                                Clock_In_Time__c = entryDay2.Clock_In_Time__c,
                                Clock_Out_Time__c = entryDay2.Clock_Out_Time__c,
                                Cost_Code__c = entryDay2.Cost_Code__c,
                                Do_Not_Execute__c = true
                            );
                            insert itemDay2;
                        } else {
                            // Normal same-day update
                            existing.Clock_Out_Time__c = clkOutUserTz;
                            update existing;

                            Timesheet_Entry_Item__c item = new Timesheet_Entry_Item__c(
                                Timesheet_Entry__c = existing.Id,
                                Clock_In_Time__c = existing.Clock_In_Time__c,
                                Clock_Out_Time__c = existing.Clock_Out_Time__c,
                                Cost_Code__c = existing.Cost_Code__c,
                                Do_Not_Execute__c = true
                            );
                            insert item;
                        }
                    }
                }
            }

            return true;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'createTimesheetRecords', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return false;
        }
    }

    @AuraEnabled
    public static List<TimesheetEntryItemWrapper> getTimeSheetEntryItems(String jobId, String jobStartDate, String mobId, String crewLeaderId){
        try {
            List<Mobilization_Member__c> members = [SELECT Id, Contact__c, Contact__r.Name, Contact__r.Can_Clock_In_Out__c, Mobilization__r.Job__c
                                                    FROM Mobilization_Member__c WHERE Mobilization__c = :mobId AND Contact__c != null
                                                    AND Contact__r.Can_Clock_In_Out__c = true AND Crew_Leader_Id__c = :crewLeaderId
                                                    WITH USER_MODE ORDER BY Contact__r.Name ASC];
    
            Set<Id> contactIds = new Set<Id>();
            for (Mobilization_Member__c m : members) {
                contactIds.add(m.Contact__c);
            }
            
            // Add crew leader to contactIds if not already present
            if (String.isNotBlank(crewLeaderId) && !contactIds.contains(crewLeaderId)) {
                contactIds.add(crewLeaderId);
            }

            if (contactIds.isEmpty()) {
                return null;
            }

            Date startDate = Date.valueOf(jobStartDate);

            List<Timesheet_Entry_Item__c> items = [SELECT Id, Timesheet_Entry__c, Timesheet_Entry__r.TimeSheet__r.Contact__r.Name, 
                                                    Clock_In_Time__c, Clock_Out_Time__c, Travel_Time__c, Per_Diem__c, Total_Time__c, 
                                                    Cost_Code__r.Name, Clock_In_Date__c, Premium__c, Status__c, Approval_Data__c FROM Timesheet_Entry_Item__c 
                                                    WHERE Timesheet_Entry__r.TimeSheet__r.Job__c = :jobId AND Clock_In_Date__c = :startDate
                                                    AND Timesheet_Entry__r.TimeSheet__r.Contact__c IN :contactIds
                                                    WITH USER_MODE ORDER BY Timesheet_Entry__r.TimeSheet__r.Contact__r.Name ASC];

            List<TimesheetEntryItemWrapper> result = new List<TimesheetEntryItemWrapper>();
            for(Timesheet_Entry_Item__c item : items) {
                result.add(new TimesheetEntryItemWrapper(item));
            }

            return result;

        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getTimeSheetEntryItems', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static Boolean updateTimesheets(String params){
        try {
            Map<String, Object> jsonList = (Map<String, Object>) JSON.deserializeUntyped(params);

            // Query records
            Timesheet_Entry_Item__c tsItem = [SELECT Id, Travel_Time__c, Per_Diem__c, Clock_In_Time__c, Clock_Out_Time__c, Premium__c, Status__c, 
                                                Approval_Data__c FROM Timesheet_Entry_Item__c 
                                                WHERE Id = :(String)jsonList.get('Id') WITH USER_MODE LIMIT 1];

            Timesheet_Entry__c tsEntry = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__c, Cost_Code__c, Status__c,
                                            Approval_Data__c FROM Timesheet_Entry__c 
                                            WHERE Id = :(String)jsonList.get('TSEId') WITH USER_MODE LIMIT 1];

            // Convert clock-in and clock-out strings to Datetime
            Datetime clkInUserTz = convertUtc((String)jsonList.get('ClockIn'));
            Datetime clkOutUserTz = convertUtc((String)jsonList.get('ClockOut'));

            Decimal travelTime = Decimal.valueOf((String)jsonList.get('TravelTime'));
            
            // Build approval data JSON for changes
            List<Map<String, Object>> approvalDataList = new List<Map<String, Object>>();
            
            // Store Clock_In_Time__c change if different
            if (tsEntry.Clock_In_Time__c != clkInUserTz) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'Clock_In_Time__c',
                    'oldValue' => tsEntry.Clock_In_Time__c,
                    'newValue' => clkInUserTz
                });
            }
            
            // Store Clock_Out_Time__c change if different
            if (tsEntry.Clock_Out_Time__c != clkOutUserTz) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'Clock_Out_Time__c',
                    'oldValue' => tsEntry.Clock_Out_Time__c,
                    'newValue' => clkOutUserTz
                });
            }
            
            // Store Travel_Time__c change if different
            if (tsItem.Travel_Time__c != travelTime) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'Travel_Time__c',
                    'oldValue' => tsItem.Travel_Time__c,
                    'newValue' => travelTime
                });
            }
            
            // Only update if there are changes
            if (!approvalDataList.isEmpty()) {
                String approvalDataJson = JSON.serialize(approvalDataList);
                
                // Store approval data and set status to Pending for both Entry and Item
                tsEntry.Approval_Data__c = approvalDataJson;
                tsEntry.Status__c = 'Pending';
                tsItem.Approval_Data__c = approvalDataJson;
                tsItem.Status__c = 'Pending';
                
                update tsEntry;
                update tsItem;
            }

            return true;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'updateTimesheets', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return false;
        }
    }

    @AuraEnabled
    public static List<Location_Process__c> getJobLocationProcesses(Id jobId) {
        List<Location_Process__c> processes = new List<Location_Process__c>();
        try {
            processes = [SELECT Id, Name, Completed_Percentage__c, Sequence__c,
                            Location__c, Location__r.Name,
                            Scope_Entry_Process__r.Process_Name__c
                            FROM Location_Process__c WHERE Location__r.Job__c = :jobId WITH USER_MODE
                            ORDER BY Location__r.Name ASC, Sequence__c ASC NULLS LAST, CreatedDate ASC];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getJobLocationProcesses', 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Location Processes for Job ID: ' + jobId, 'apiResponse' => null});
        }
        return processes;
    }

    public static Datetime convertUtc(String utcDateTimeStr) {
        try {
            if(String.isBlank(utcDateTimeStr)) return null;
    
            // Normalize string: if seconds missing, add ':00'
            if(!Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', utcDateTimeStr)) {
                if(Pattern.matches('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}', utcDateTimeStr)) {
                    utcDateTimeStr += ':00';
                } else {
                    // Invalid format
                    System.debug('Invalid datetime format: ' + utcDateTimeStr);
                }
            }
    
            // Replace T with space for DateTime.valueOf
            utcDateTimeStr = utcDateTimeStr.replace('T',' ');
    
            // Convert to Datetime (interpreted as GMT/UTC)
            Datetime utcDT = Datetime.valueOf(utcDateTimeStr);

            return utcDT;
        } catch (Exception e) {
            System.debug('Error in convertUtc: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'convertUtc', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public Id TSEId;
        @AuraEnabled public String contactName;
        @AuraEnabled public Datetime clockInTime;
        @AuraEnabled public Datetime clockOutTime;
        @AuraEnabled public Decimal workHours;
        @AuraEnabled public Decimal travelTime;
        @AuraEnabled public Decimal perDiem;
        @AuraEnabled public Decimal totalTime;
        @AuraEnabled public Boolean premium;
        @AuraEnabled public String costCodeName;
        @AuraEnabled public Date clockInDate;
        @AuraEnabled public String status;
        @AuraEnabled public String approvalData;

        public TimesheetEntryItemWrapper(Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.TSEId = item.Timesheet_Entry__c;
            this.contactName = item.Timesheet_Entry__r.TimeSheet__r.Contact__r.Name;
            
            // Convert to user timezone
            this.clockInTime  = item.Clock_In_Time__c  != null ? item.Clock_In_Time__c.addSeconds(userTz.getOffset(item.Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.Clock_Out_Time__c != null ? item.Clock_Out_Time__c.addSeconds(userTz.getOffset(item.Clock_Out_Time__c)/1000) : null;

            this.travelTime = item.Travel_Time__c != null ? item.Travel_Time__c : 0.00;
            this.perDiem = item.Per_Diem__c != null ? item.Per_Diem__c : 0;
            this.workHours = item.Total_Time__c != null ? item.Total_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.Cost_Code__r != null ? item.Cost_Code__r.Name : '-';
            this.premium = item.Premium__c;
            this.clockInDate = item.Clock_In_Date__c;
            this.status = item.Status__c;
            this.approvalData = item.Approval_Data__c;
        }
    }

    public class WrapperMember {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public DateTime jobStartTime;
        @AuraEnabled public DateTime jobEndTime;
        @AuraEnabled public DateTime clockInTime;
        @AuraEnabled public Boolean isTimesheetNull;
        @AuraEnabled public String timesheetId;
        @AuraEnabled public Boolean isTimesheetEntryNull;
        @AuraEnabled public String timesheetEntryId;
        @AuraEnabled public String mobMemberId;
        @AuraEnabled public Map<Id, String> costCodeDetails;
        @AuraEnabled public Boolean isAgain;
        @AuraEnabled public DateTime recentClockIn;
        @AuraEnabled public DateTime recentClockOut;
        @AuraEnabled public String approvalMessage;
        @AuraEnabled public Boolean canEditTimesheet;
    }

    @AuraEnabled
    public static void createLogEntry(String jobId, String step3DataJson, List<String> contentDocumentIds, String cameraPhotosJson, String workPerformedDate, String approvalDataJson, String mobilizationId) {
        try {
            // Deserialize step3 data
            Map<String, Object> step3Data = (Map<String, Object>) JSON.deserializeUntyped(step3DataJson);
            
            // Check approval status logic
            Date workDate = Date.valueOf(workPerformedDate.substring(0, 10));
            Date yesterday = workDate.addDays(-1);
            Date today = Date.today();
            String logStatus = 'Pending'; // Default status
            
            // Check if there are already pending or approved logs for today
            List<Log_Entry__c> todayLogs = [SELECT Id, Status__c FROM Log_Entry__c 
                                            WHERE Job__c = :jobId 
                                            AND Mobilization__c = :mobilizationId 
                                            AND Work_Performed_Date__c = :today 
                                            AND Log_Type__c = 'Shift End'
                                            WITH USER_MODE];
            
            Boolean hasTodayLogs = !todayLogs.isEmpty();
            
            // If creating today's entry
            if (workDate == today) {
                // Find yesterday's mobilization to check for pending logs
                List<Log_Entry__c> yesterdayLogsList = [SELECT Id, Mobilization__c FROM Log_Entry__c 
                                                        WHERE Job__c = :jobId 
                                                        AND Work_Performed_Date__c = :yesterday 
                                                        AND Log_Type__c = 'Shift End'
                                                        AND Status__c = 'Pending'
                                                        WITH USER_MODE 
                                                        LIMIT 1];
                
                if (!yesterdayLogsList.isEmpty()) {
                    String yesterdayMobId = yesterdayLogsList[0].Mobilization__c;
                    System.debug('Found yesterday mobilization: ' + yesterdayMobId + ' with pending logs');
                    // Auto-approve yesterday's logs using yesterday's mobilization ID
                    autoApproveYesterdayLogs(jobId, yesterdayMobId);
                }
                
                logStatus = 'Pending';
            } else if (workDate == yesterday) {
                if (hasTodayLogs) {
                    logStatus = 'Pending';
                } else {
                    // Check if yesterday already has unapproved logs
                    Boolean hasYesterdayPendingLogs = checkTodayPendingLogs(jobId, mobilizationId, yesterday);
                    logStatus = hasYesterdayPendingLogs ? 'Pending' : 'Approved';
                }
            }
            
            // Create Log Entry record
            Log_Entry__c logEntry = new Log_Entry__c();
            logEntry.Job__c = jobId;
            logEntry.Mobilization__c = mobilizationId; // Save the Mobilization lookup
            logEntry.Log_Type__c = 'Shift End';
            logEntry.Work_Performed__c = (String) step3Data.get('whatWeDone');
            logEntry.Plan_for_Tomorrow__c = (String) step3Data.get('planForTomorrow');
            logEntry.Exceptions__c = (String) step3Data.get('exceptions');
            logEntry.Notes_to_Office__c = (String) step3Data.get('notesToOffice');
            logEntry.Work_Performed_Date__c = workDate;
            logEntry.Status__c = logStatus;
            
            // Store approval data JSON directly from LWC (format: [{"id":"recordId","oldValue":73,"newValue":79}])
            if (String.isNotBlank(approvalDataJson)) {
                logEntry.Approval_Data__c = approvalDataJson;
            }
            
            insert logEntry;
            
            // Process camera photos if any
            // Note: FirstPublishLocationId automatically creates ContentDocumentLink, so no manual linking needed
            if (String.isNotBlank(cameraPhotosJson)) {
                List<Object> cameraPhotos = (List<Object>) JSON.deserializeUntyped(cameraPhotosJson);
                List<ContentVersion> contentVersions = new List<ContentVersion>();
                
                for (Object photoObj : cameraPhotos) {
                    Map<String, Object> photo = (Map<String, Object>) photoObj;
                    String fileName = (String) photo.get('fileName');
                    String base64Data = (String) photo.get('base64Data');
                    
                    ContentVersion cv = new ContentVersion();
                    cv.Title = fileName;
                    cv.PathOnClient = fileName;
                    cv.VersionData = EncodingUtil.base64Decode(base64Data);
                    cv.FirstPublishLocationId = logEntry.Id; // This automatically creates the link
                    contentVersions.add(cv);
                }
                
                if (!contentVersions.isEmpty()) {
                    insert as user contentVersions;
                }
            }
            
            // Link regular uploaded files to Log Entry if any
            if (contentDocumentIds != null && !contentDocumentIds.isEmpty()) {
                List<ContentDocumentLink> links = new List<ContentDocumentLink>();
                for (String docId : contentDocumentIds) {
                    ContentDocumentLink link = new ContentDocumentLink();
                    link.ContentDocumentId = docId;
                    link.LinkedEntityId = logEntry.Id;
                    link.ShareType = 'V';
                    link.Visibility = 'AllUsers';
                    links.add(link);
                }
                insert as user links;
            }
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'createLogEntry',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            throw new AuraHandledException('Error creating Log Entry: ' + e.getMessage());
        }
    }    
    
    @AuraEnabled
    public static void deleteContentDocuments(List<String> contentDocumentIds) {
        try {
            if (contentDocumentIds == null || contentDocumentIds.isEmpty()) {
                return;
            }

            List<ContentDocument> docsToDelete = [SELECT Id FROM ContentDocument WHERE Id IN :contentDocumentIds WITH USER_MODE];
            delete as user docsToDelete;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'deleteContentDocuments',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            throw new AuraHandledException('Error deleting content documents: ' + e.getMessage());
        }
    }
    
    // Helper method: Auto-approve yesterday's pending logs and clear approval data
    private static void autoApproveYesterdayLogs(String jobId, String mobilizationId) {
        try {
            Date yesterday = Date.today().addDays(-1);
            Date approvedDate = Date.today();

            // ---------------------------
            // 1. Yesterday Shift End Logs
            // ---------------------------
            List<Log_Entry__c> yesterdayLogs = [
                SELECT Id, Status__c, Approval_Data__c 
                FROM Log_Entry__c 
                WHERE Job__c = :jobId
                AND Mobilization__c = :mobilizationId
                AND Work_Performed_Date__c = :yesterday
                AND Log_Type__c = 'Shift End'
                AND Status__c = 'Pending'
                WITH USER_MODE
            ];

            Set<Id> locationProcessIds = new Set<Id>();

            // Collect LocationProcess Ids
            for (Log_Entry__c log : yesterdayLogs) {
                if (String.isNotBlank(log.Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(log.Approval_Data__c);
                    if (parsed instanceof List<Object>) {
                        for (Object o : (List<Object>) parsed) {
                            if (o instanceof Map<String, Object>) {
                                Map<String, Object> mapVal = (Map<String, Object>) o;
                                String recId = (String) mapVal.get('id');
                                if (String.isNotBlank(recId)) {
                                    locationProcessIds.add(recId);
                                }
                            }
                        }
                    }
                }
                log.Status__c = 'Auto-Approved';
                log.Approved_Date__c = approvedDate;
            }

            // ---------------------------
            // 2. Update Location Process
            // ---------------------------
            if (!locationProcessIds.isEmpty()) {
                Map<Id, Location_Process__c> lpMap = new Map<Id, Location_Process__c>(
                    [
                        SELECT Id, Completed_Percentage__c
                        FROM Location_Process__c
                        WHERE Id IN :locationProcessIds
                        WITH USER_MODE
                    ]
                );

                for (Log_Entry__c log : yesterdayLogs) {
                    if (String.isNotBlank(log.Approval_Data__c)) {
                        Object parsed = JSON.deserializeUntyped(log.Approval_Data__c);
                        if (parsed instanceof List<Object>) {
                            for (Object o : (List<Object>) parsed) {
                                Map<String, Object> mapVal = (Map<String, Object>) o;
                                String recId = (String) mapVal.get('id');
                                Object newValueObj = mapVal.get('newValue');

                                if (lpMap.containsKey(recId) && newValueObj != null) {
                                    lpMap.get(recId).Completed_Percentage__c =
                                        Decimal.valueOf(String.valueOf(newValueObj));
                                }
                            }
                        }
                    }
                }

                update as user lpMap.values();
            }

            update yesterdayLogs;

            // ---------------------------
            // 3. Timesheet Entries
            // ---------------------------
            List<Timesheet_Entry__c> tsEntries = [
                SELECT Id, Status__c, Approval_Data__c
                FROM Timesheet_Entry__c
                WHERE Mobilization__c = :mobilizationId
                AND Status__c = 'Pending'
                WITH USER_MODE
            ];

            Set<Id> tsEntryIds = new Set<Id>();

            for (Timesheet_Entry__c ts : tsEntries) {
                ts.Status__c = 'Auto-Approved';
                ts.Approved_Date__c = approvedDate;
                tsEntryIds.add(ts.Id);

                if (String.isNotBlank(ts.Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(ts.Approval_Data__c);

                    if (parsed instanceof List<Object>) {
                        for (Object o : (List<Object>) parsed) {
                            Map<String, Object> mapVal = (Map<String, Object>) o;
                            String fieldApi = (String) mapVal.get('fieldApiName');
                            Object newValueObj = mapVal.get('newValue');

                            if (String.isNotBlank(fieldApi) && newValueObj != null) {
                                ts.put(fieldApi, Decimal.valueOf(String.valueOf(newValueObj)));
                            }
                        }
                    }
                }
            }

            update tsEntries;

            // ---------------------------
            // 4. Timesheet Items
            // ---------------------------
            List<Timesheet_Entry_Item__c> tsItems = [
                SELECT Id, Status__c, Approval_Data__c
                FROM Timesheet_Entry_Item__c
                WHERE Timesheet_Entry__c IN :tsEntryIds
                AND Status__c = 'Pending'
                WITH USER_MODE
            ];

            for (Timesheet_Entry_Item__c item : tsItems) {
                item.Status__c = 'Auto-Approved';
                item.Approved_Date__c = approvedDate;

                if (String.isNotBlank(item.Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(item.Approval_Data__c);

                    if (parsed instanceof List<Object>) {
                        for (Object o : (List<Object>) parsed) {
                            Map<String, Object> mapVal = (Map<String, Object>) o;
                            String fieldApi = (String) mapVal.get('fieldApiName');
                            Object newValueObj = mapVal.get('newValue');

                            if (String.isNotBlank(fieldApi) && newValueObj != null) {
                                item.put(fieldApi, Decimal.valueOf(String.valueOf(newValueObj)));
                            }
                        }
                    }
                }
            }

            update tsItems;
        }
        catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'autoApproveYesterdayLogs',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
        }
    }
    
    // Helper method: Check if yesterday's log entry is unapproved
    private static Boolean checkYesterdayUnapproved(String jobId, String mobilizationId, Date yesterday) {
        try {
            List<Log_Entry__c> yesterdayLogs = [SELECT Id, Status__c 
                                                FROM Log_Entry__c 
                                                WHERE Job__c = :jobId 
                                                AND Mobilization__c = :mobilizationId 
                                                AND Work_Performed_Date__c = :yesterday 
                                                AND Log_Type__c = 'Shift End'
                                                WITH USER_MODE 
                                                LIMIT 1];
            
            // Return true if yesterday's log exists and is not approved
            if (!yesterdayLogs.isEmpty()) {
                return yesterdayLogs[0].Status__c != 'Approved';
            }
            return false;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'checkYesterdayUnapproved',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return false;
        }
    }
    
    // Helper method: Check if there are already pending logs for today
    private static Boolean checkTodayPendingLogs(String jobId, String mobilizationId, Date today) {

        System.debug('Checking today pending logs for Job: ' + jobId + ', Mobilization: ' + mobilizationId + ', Date: ' + today);
        try {
            List<Log_Entry__c> todayLogs = [SELECT Id, Status__c 
                                            FROM Log_Entry__c 
                                            WHERE Job__c = :jobId 
                                            AND Mobilization__c = :mobilizationId 
                                            AND Work_Performed_Date__c = :today 
                                            AND Log_Type__c = 'Shift End'
                                            AND Status__c = 'Pending'
                                            WITH USER_MODE];
            
            // Return true if there are any pending logs for today

            System.debug('Today logs: ' + todayLogs);
            return !todayLogs.isEmpty();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'checkTodayPendingLogs',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return false;
        }
    }
    
    // Helper method to check if yesterday's logs are approved
    private static Boolean checkYesterdayApproved(String jobId, String mobilizationId, Date yesterday) {
        try {
            List<Log_Entry__c> yesterdayLogs = [SELECT Id, Status__c 
                                            FROM Log_Entry__c 
                                            WHERE Job__c = :jobId 
                                            AND Mobilization__c = :mobilizationId 
                                            AND Work_Performed_Date__c = :yesterday 
                                            AND Log_Type__c = 'Shift End'
                                            WITH USER_MODE];
            
            // Return true if any yesterday's log is approved
            for (Log_Entry__c log : yesterdayLogs) {
                if (log.Status__c == 'Approved') {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'checkYesterdayApproved',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return false;
        }
    }
    
    // Helper method to check if today has any approved logs
    private static Boolean checkTodayApprovedLogs(String jobId, String mobilizationId, Date today) {
        try {
            List<Log_Entry__c> todayLogs = [SELECT Id, Status__c 
                                            FROM Log_Entry__c 
                                            WHERE Job__c = :jobId 
                                            AND Mobilization__c = :mobilizationId 
                                            AND Work_Performed_Date__c = :today 
                                            AND Log_Type__c = 'Shift End'
                                            AND Status__c = 'Approved'
                                            WITH USER_MODE];
            
            // Return true if there are any approved logs for today
            return !todayLogs.isEmpty();
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'checkTodayApprovedLogs',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            return false;
        }
    }
    
    // Method to check approval status for UI display
    @AuraEnabled
    public static Map<String, Object> checkLogApprovalStatus(String jobId, String mobilizationId, String workPerformedDate) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            Date workDate = Date.valueOf(workPerformedDate.substring(0, 10));
            Date yesterday = workDate.addDays(-1);
            
            Boolean yesterdayUnapproved = checkYesterdayUnapproved(jobId, mobilizationId, yesterday);
            Boolean hasTodayPendingLogs = checkTodayPendingLogs(jobId, mobilizationId, workDate);
            
            // Only auto-approve yesterday's logs, not today's
            Boolean isYesterday = workDate < Date.today();
            Boolean willAutoApprove = isYesterday && !yesterdayUnapproved && !hasTodayPendingLogs;
            
            result.put('yesterdayUnapproved', yesterdayUnapproved);
            result.put('hasTodayPendingLogs', hasTodayPendingLogs);
            result.put('willAutoApprove', willAutoApprove);
            
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{
                'className' => 'ShiftEndLogEntriesController',
                'methodName' => 'checkLogApprovalStatus',
                'exceptionObj' => e,
                'moreDetails' => e.getMessage()
            });
            throw new AuraHandledException('Error checking log approval status: ' + e.getMessage());
        }
    }
}