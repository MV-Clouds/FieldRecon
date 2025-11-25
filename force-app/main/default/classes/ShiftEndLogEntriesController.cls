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
                
                // Only return today's and yesterday's mobilization dates with Job Name and Status
                List<wfrecon__Mobilization__c> mobList = [SELECT Id, Name, wfrecon__Start_Date_Text__c, wfrecon__Job__r.wfrecon__Job_Name__c, wfrecon__Mobilization_Status__c 
                                                    FROM wfrecon__Mobilization__c 
                                                    WHERE wfrecon__Job__c = :jobId 
                                                    AND Id IN (SELECT wfrecon__Mobilization__c FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Crew_Leader_Id__c = :crewLeaderId)
                                                    AND (wfrecon__Start_Date_Text__c = :todayStr OR wfrecon__Start_Date_Text__c = :yesterdayStr)
                                                    WITH USER_MODE
                                                    ORDER BY wfrecon__Start_Date_Text__c DESC];
                for (wfrecon__Mobilization__c mob : mobList) {
                    String statusLabel = String.isNotBlank(mob.wfrecon__Mobilization_Status__c) ? mob.wfrecon__Mobilization_Status__c : 'N/A';
                    
                    // Return date and status separately for JS formatting
                    String displayLabel = mob.wfrecon__Start_Date_Text__c + '||' + mob.wfrecon__Job__r.wfrecon__Job_Name__c + '||' + statusLabel;
                    result.put(mob.Id, displayLabel);
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
    
            List<wfrecon__Mobilization__c> mobilizationRecord = [SELECT Id, wfrecon__Job__c, wfrecon__Start_Date__c, wfrecon__End_Date__c FROM wfrecon__Mobilization__c WHERE Id = :mobId WITH USER_MODE LIMIT 1];

            List<wfrecon__Mobilization_Member__c> members = [SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c, wfrecon__Mobilization__r.wfrecon__Job__c
                                                    FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Mobilization__c = :mobId AND wfrecon__Contact__c != null
                                                    AND wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c = true AND wfrecon__Crew_Leader_Id__c = :crewLeaderId
                                                    WITH USER_MODE ORDER BY wfrecon__Contact__r.Name ASC];
    
            Set<Id> contactIds = new Set<Id>();
            for (wfrecon__Mobilization_Member__c m : members) {
                contactIds.add(m.wfrecon__Contact__c);
            }
            
            // Add crew leader to contactIds if not already present
            if (String.isNotBlank(crewLeaderId) && !contactIds.contains(crewLeaderId)) {
                contactIds.add(crewLeaderId);
            }
    
            if (contactIds.isEmpty()) {
                return result;
            }

            List<wfrecon__Timesheet__c> tsList = [SELECT Id, wfrecon__Contact__c, wfrecon__Timesheet_Start_Date__c, wfrecon__Timesheet_End_Date__c FROM wfrecon__Timesheet__c WHERE wfrecon__Contact__c IN :contactIds
                                            AND wfrecon__Job__c = :jobId AND wfrecon__Timesheet_Start_Date__c <= :Date.valueOf(mobilizationRecord[0].wfrecon__Start_Date__c)
                                            AND wfrecon__Timesheet_End_Date__c >= :Date.valueOf(mobilizationRecord[0].wfrecon__End_Date__c) WITH USER_MODE ORDER BY wfrecon__Contact__r.Name ASC];

            Map<Id, wfrecon__Timesheet__c> contactTimesheetMap = new Map<Id, wfrecon__Timesheet__c>();
            for (wfrecon__Timesheet__c ts : tsList) {
                contactTimesheetMap.put(ts.wfrecon__Contact__c, ts);
            }

            Date startDate = mobilizationRecord[0].wfrecon__Start_Date__c.date();
            DateTime startDateTime = DateTime.newInstance(startDate, Time.newInstance(0,0,0,0));
            DateTime endDateTime   = DateTime.newInstance(startDate, Time.newInstance(23,59,59,999));
            List<wfrecon__Timesheet_Entry__c> entries = [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__r.wfrecon__Contact__c FROM wfrecon__Timesheet_Entry__c
                                                WHERE wfrecon__Timesheet__c IN :tsList AND wfrecon__Clock_In_Time__c >= :startDateTime AND wfrecon__Clock_In_Time__c < :endDateTime
                                                WITH USER_MODE];

            Map<Id, List<wfrecon__Timesheet_Entry__c>> contactEntriesMap = new Map<Id, List<wfrecon__Timesheet_Entry__c>>();
            for (wfrecon__Timesheet_Entry__c e : entries) {
                if (!contactEntriesMap.containsKey(e.wfrecon__Timesheet__r.wfrecon__Contact__c)) {
                    contactEntriesMap.put(e.wfrecon__Timesheet__r.wfrecon__Contact__c, new List<wfrecon__Timesheet_Entry__c>());
                }
                contactEntriesMap.get(e.wfrecon__Timesheet__r.wfrecon__Contact__c).add(e);
            }

            for (wfrecon__Mobilization_Member__c m : members) {
                WrapperMember wrap = new WrapperMember();
                wrap.jobStartTime = mobilizationRecord[0].wfrecon__Start_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__Start_Date__c)/1000);
                wrap.jobEndTime = mobilizationRecord[0].wfrecon__End_Date__c.addSeconds(userTz.getOffset(mobilizationRecord[0].wfrecon__End_Date__c)/1000);
                wrap.contactId = m.wfrecon__Contact__c;
                wrap.contactName = m.wfrecon__Contact__r.Name;
                wrap.mobMemberId = m.Id;
    
                wfrecon__Timesheet__c ts = contactTimesheetMap.get(m.wfrecon__Contact__c);
                List<wfrecon__Timesheet_Entry__c> userEntries = contactEntriesMap.get(m.wfrecon__Contact__c);
    
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
                wfrecon__Timesheet_Entry__c latestOpen;
                wfrecon__Timesheet_Entry__c latestCompleted;
                DateTime mostRecentClockIn;
                DateTime mostRecentClockOut;
    
                for (wfrecon__Timesheet_Entry__c e : userEntries) {
                    // Track most recent clock in/out times
                    if (e.wfrecon__Clock_In_Time__c != null) {
                        if (mostRecentClockIn == null || e.wfrecon__Clock_In_Time__c > mostRecentClockIn) {
                            mostRecentClockIn = e.wfrecon__Clock_In_Time__c;
                        }
                    }
                    if (e.wfrecon__Clock_Out_Time__c != null) {
                        if (mostRecentClockOut == null || e.wfrecon__Clock_Out_Time__c > mostRecentClockOut) {
                            mostRecentClockOut = e.wfrecon__Clock_Out_Time__c;
                        }
                    }
                    
                    if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c == null) {
                        hasOpenEntry = true;
                        latestOpen = e;
                    } else if (e.wfrecon__Clock_In_Time__c != null && e.wfrecon__Clock_Out_Time__c != null) {
                        hasCompletedEntry = true;
                        latestCompleted = e;
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
            List<wfrecon__Cost_Code__c> costCodeRecs = [SELECT Id, Name FROM wfrecon__Cost_Code__c WITH USER_MODE];
            for (wfrecon__Cost_Code__c c : costCodeRecs) {
                costCodeDetails.put(c.Id, c.Name);
            }
            WrapperMember costCodeDetailsWrap = new WrapperMember();
            costCodeDetailsWrap.costCodeDetails = costCodeDetails;
            result.get('costCodeDetails').add(costCodeDetailsWrap);
            
            // Add approval status information
            String approvalMessage = '';
            
            // Check if there are any pending logs for this job
            List<wfrecon__Log_Entry__c> pendingLogs = [SELECT Id, wfrecon__Status__c, wfrecon__Work_Performed_Date__c 
                                              FROM wfrecon__Log_Entry__c 
                                              WHERE wfrecon__Job__c = :jobId 
                                              AND wfrecon__Log_Type__c = 'Shift End'
                                              AND wfrecon__Status__c = 'Pending'
                                              WITH USER_MODE
                                              LIMIT 1];
            
            if (!pendingLogs.isEmpty()) {
                approvalMessage = 'Note: All previous pending entries will be automatically approved when you submit this log. This entry will be marked as pending for approval.';
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
            List<wfrecon__Mobilization__c> mobRec = [SELECT Id, Name, wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, wfrecon__Mobilization_Group__r.wfrecon__End_Date__c FROM wfrecon__Mobilization__c 
                                            WHERE Id = :mobId WITH USER_MODE];

            mobGroupId = mobRec[0].wfrecon__Mobilization_Group__r.Id;
            
            List<wfrecon__Mobilization_Member__c> mobMemberRecs = [SELECT Id, wfrecon__Contact__c, wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c, wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c FROM wfrecon__Mobilization_Member__c WHERE Id = :(String)paramsMap.get('mobMemberId') WITH USER_MODE];

            if((String) paramsMap.get('actionType') == 'clockIn') {
                
                // Convert clockInTime to UTC to user timezone
                String clockInTimeString = (String)paramsMap.get('clockInTime');
                Datetime clkInUserTz = convertUtc(clockInTimeString);

                // If first clockin for moblization group for contact > Create Timesheet and Timesheet Entry
                if(paramsMap.get('isTimeSheetNull') == true) {
                    wfrecon__Timesheet__c timesheetRec = new wfrecon__Timesheet__c();
                    timesheetRec.wfrecon__Contact__c = mobMemberRecs[0].wfrecon__Contact__c;
                    timesheetRec.wfrecon__Job__c = jobId;
                    timesheetRec.wfrecon__Timesheet_Start_Date__c = mobMemberRecs[0].wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__Start_Date__c.date();
                    timesheetRec.wfrecon__Timesheet_End_Date__c = mobMemberRecs[0].wfrecon__Mobilization__r.wfrecon__Mobilization_Group__r.wfrecon__End_Date__c.date();
                    timesheetRec.wfrecon__Mobilization_Group__c = mobGroupId;
                    timesheetRec.wfrecon__Do_Not_Execute__c = true;
                    insert timesheetRec;
    
                    wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                    timesheetEntryRec.wfrecon__Timesheet__c = timesheetRec.Id;
                    timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.wfrecon__Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                    timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                    insert timesheetEntryRec;
                } else {
                    List<wfrecon__Timesheet__c> timesheetRecs = [SELECT Id FROM wfrecon__Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];
                    
                    wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                    timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                    timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                    timesheetEntryRec.wfrecon__Cost_Code__c = (String)paramsMap.get('costCodeId');
                    timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                    timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
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
                        List<wfrecon__Timesheet__c> timesheetRecs = [SELECT Id FROM wfrecon__Timesheet__c WHERE Id = :(String)paramsMap.get('timesheetId') WITH USER_MODE];

                        if (!timesheetRecs.isEmpty()) {
                            Id tsId = timesheetRecs[0].Id;
                            
                            if (crossesMidnight) {
                                // 🕛 Split Entry Across Two Days
                                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                                // 1️⃣ Entry for Day 1 (till 11:59 PM)
                                wfrecon__Timesheet_Entry__c entryDay1 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = tsId,
                                    wfrecon__Clock_In_Time__c = clkInUserTz,
                                    wfrecon__Clock_Out_Time__c = firstDayEnd,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert entryDay1;

                                wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay1.Id,
                                    wfrecon__Clock_In_Time__c = entryDay1.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay1.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert itemDay1;

                                // 2️⃣ Entry for Day 2 (from 12:00 AM)
                                wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                    wfrecon__Timesheet__c = tsId,
                                    wfrecon__Clock_In_Time__c = secondDayStart,
                                    wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                    wfrecon__Mobilization__c = mobId,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert entryDay2;

                                wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                    wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                    wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                    wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                    wfrecon__Do_Not_Execute__c = true
                                );
                                insert itemDay2;

                            } else {
                                wfrecon__Timesheet_Entry__c timesheetEntryRec = new wfrecon__Timesheet_Entry__c();
                                timesheetEntryRec.wfrecon__Timesheet__c = timesheetRecs[0].Id;
                                timesheetEntryRec.wfrecon__Clock_In_Time__c = clkInUserTz;
                                timesheetEntryRec.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                                timesheetEntryRec.wfrecon__Mobilization__c = mobId;
                                timesheetEntryRec.wfrecon__Do_Not_Execute__c = true;
                                insert timesheetEntryRec;
        
                                wfrecon__Timesheet_Entry_Item__c timesheetEntryItemRec = new wfrecon__Timesheet_Entry_Item__c();
                                timesheetEntryItemRec.wfrecon__Timesheet_Entry__c = timesheetEntryRec.Id;
                                timesheetEntryItemRec.wfrecon__Clock_In_Time__c = timesheetEntryRec.wfrecon__Clock_In_Time__c;
                                timesheetEntryItemRec.wfrecon__Clock_Out_Time__c = timesheetEntryRec.wfrecon__Clock_Out_Time__c;
                                timesheetEntryItemRec.wfrecon__Cost_Code__c = timesheetEntryRec.wfrecon__Cost_Code__c;
                                timesheetEntryItemRec.wfrecon__Do_Not_Execute__c = true;
                                insert timesheetEntryItemRec;
                            }
                        }
                    }
                } else {
                    List<wfrecon__Timesheet_Entry__c> timesheetEntryRecs = [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Cost_Code__c, wfrecon__Timesheet__c FROM wfrecon__Timesheet_Entry__c WHERE Id = :(String)paramsMap.get('timesheetEntryId') WITH USER_MODE];
                    if (!timesheetEntryRecs.isEmpty()) {
                        wfrecon__Timesheet_Entry__c existing = timesheetEntryRecs[0];
                        Boolean crossesMidnightExisting = (existing.wfrecon__Clock_In_Time__c.date() != clkOutUserTz.date());

                        if (crossesMidnightExisting) {
                            Datetime firstDayEnd = DateTime.newInstance(existing.wfrecon__Clock_In_Time__c.date(), Time.newInstance(23, 59, 59, 999));
                            Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                            // Update existing entry to end at 11:59 PM
                            existing.wfrecon__Clock_Out_Time__c = firstDayEnd;
                            update existing;

                            // Create Timesheet Entry Item for day 1
                            wfrecon__Timesheet_Entry_Item__c itemDay1 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            insert itemDay1;

                            // Create new entry for next day
                            wfrecon__Timesheet_Entry__c entryDay2 = new wfrecon__Timesheet_Entry__c(
                                wfrecon__Timesheet__c = existing.wfrecon__Timesheet__c,
                                wfrecon__Clock_In_Time__c = secondDayStart,
                                wfrecon__Clock_Out_Time__c = clkOutUserTz,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Mobilization__c = mobId,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            insert entryDay2;

                            // Create Timesheet Entry Item for day 2
                            wfrecon__Timesheet_Entry_Item__c itemDay2 = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = entryDay2.Id,
                                wfrecon__Clock_In_Time__c = entryDay2.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = entryDay2.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = entryDay2.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
                            );
                            insert itemDay2;
                        } else {
                            // Normal same-day update
                            existing.wfrecon__Clock_Out_Time__c = clkOutUserTz;
                            update existing;

                            wfrecon__Timesheet_Entry_Item__c item = new wfrecon__Timesheet_Entry_Item__c(
                                wfrecon__Timesheet_Entry__c = existing.Id,
                                wfrecon__Clock_In_Time__c = existing.wfrecon__Clock_In_Time__c,
                                wfrecon__Clock_Out_Time__c = existing.wfrecon__Clock_Out_Time__c,
                                wfrecon__Cost_Code__c = existing.wfrecon__Cost_Code__c,
                                wfrecon__Do_Not_Execute__c = true
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
            List<wfrecon__Mobilization_Member__c> members = [SELECT Id, wfrecon__Contact__c, wfrecon__Contact__r.Name, wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c, wfrecon__Mobilization__r.wfrecon__Job__c
                                                    FROM wfrecon__Mobilization_Member__c WHERE wfrecon__Mobilization__c = :mobId AND wfrecon__Contact__c != null
                                                    AND wfrecon__Contact__r.wfrecon__Can_Clock_In_Out__c = true AND wfrecon__Crew_Leader_Id__c = :crewLeaderId
                                                    WITH USER_MODE ORDER BY wfrecon__Contact__r.Name ASC];
    
            Set<Id> contactIds = new Set<Id>();
            for (wfrecon__Mobilization_Member__c m : members) {
                contactIds.add(m.wfrecon__Contact__c);
            }
            
            // Add crew leader to contactIds if not already present
            if (String.isNotBlank(crewLeaderId) && !contactIds.contains(crewLeaderId)) {
                contactIds.add(crewLeaderId);
            }

            if (contactIds.isEmpty()) {
                return null;
            }

            Date startDate = Date.valueOf(jobStartDate);

            List<wfrecon__Timesheet_Entry_Item__c> items = [SELECT Id, wfrecon__Timesheet_Entry__c, wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__c, 
                                                    wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.Name, 
                                                    wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Total_Time__c, 
                                                    wfrecon__Cost_Code__r.Name, wfrecon__Clock_In_Date__c, wfrecon__Premium__c, wfrecon__Status__c, wfrecon__Approval_Data__c FROM wfrecon__Timesheet_Entry_Item__c 
                                                    WHERE wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Job__c = :jobId AND wfrecon__Clock_In_Date__c = :startDate
                                                    AND wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__c IN :contactIds
                                                    WITH USER_MODE ORDER BY wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.Name ASC];

            List<TimesheetEntryItemWrapper> result = new List<TimesheetEntryItemWrapper>();
            for(wfrecon__Timesheet_Entry_Item__c item : items) {
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
            wfrecon__Timesheet_Entry_Item__c tsItem = [SELECT Id, wfrecon__Travel_Time__c, wfrecon__Per_Diem__c, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Premium__c, wfrecon__Status__c, 
                                                wfrecon__Approval_Data__c FROM wfrecon__Timesheet_Entry_Item__c 
                                                WHERE Id = :(String)jsonList.get('Id') WITH USER_MODE LIMIT 1];

            wfrecon__Timesheet_Entry__c tsEntry = [SELECT Id, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c, wfrecon__Timesheet__c, wfrecon__Cost_Code__c, wfrecon__Status__c,
                                            wfrecon__Approval_Data__c FROM wfrecon__Timesheet_Entry__c 
                                            WHERE Id = :(String)jsonList.get('TSEId') WITH USER_MODE LIMIT 1];

            // Convert clock-in and clock-out strings to Datetime
            String newClkInUser = (String)jsonList.get('newClockIn') + ':00.000Z';
            String newClkOutUser = (String)jsonList.get('newClockOut') + ':00.000Z';

            String oldClkInUser = (String)jsonList.get('oldClockIn') + ':00.000Z';
            String oldClkOutUser = (String)jsonList.get('oldClockOut') + ':00.000Z';

            Decimal travelTime = Decimal.valueOf((String)jsonList.get('TravelTime'));
            
            // Build approval data JSON for changes
            List<Map<String, Object>> approvalDataList = new List<Map<String, Object>>();
            
            // Store Clock_In_Time__c change if different
            if (oldClkInUser != newClkInUser) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'wfrecon__Clock_In_Time__c',
                    'oldValue' => oldClkInUser,
                    'newValue' => newClkInUser
                });
            }
            
            // Store Clock_Out_Time__c change if different
            if (oldClkOutUser != newClkOutUser) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'wfrecon__Clock_Out_Time__c',
                    'oldValue' => oldClkOutUser,
                    'newValue' => newClkOutUser
                });
            }
            
            // Store Travel_Time__c change if different
            if (tsItem.wfrecon__Travel_Time__c != travelTime) {
                approvalDataList.add(new Map<String, Object>{
                    'fieldApiName' => 'wfrecon__Travel_Time__c',
                    'oldValue' => tsItem.wfrecon__Travel_Time__c,
                    'newValue' => travelTime
                });
            }
            
            // Only update if there are changes
            if (!approvalDataList.isEmpty()) {
                String approvalDataJson = JSON.serialize(approvalDataList);
                System.debug('Approval Data JSON: ' + approvalDataJson);
                
                // Store approval data and set status to Pending for both Entry and Item
                tsEntry.wfrecon__Approval_Data__c = approvalDataJson;
                tsEntry.wfrecon__Status__c = 'Pending';
                tsItem.wfrecon__Approval_Data__c = approvalDataJson;
                tsItem.wfrecon__Status__c = 'Pending';
                
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
    public static Map<String, Object> getJobLocationProcesses(Id jobId) {
        Map<String, Object> result = new Map<String, Object>();
        List<wfrecon__Location_Process__c> processes = new List<wfrecon__Location_Process__c>();
        Map<String, Map<String, Object>> pendingApprovalData = new Map<String, Map<String, Object>>();
        
        try {
            processes = [SELECT Id, Name, wfrecon__Completed_Percentage__c, wfrecon__Sequence__c,
                            wfrecon__Location__c, wfrecon__Location__r.Name,
                            wfrecon__Scope_Entry_Process__r.wfrecon__Process_Name__c
                            FROM wfrecon__Location_Process__c WHERE wfrecon__Location__r.wfrecon__Job__c = :jobId WITH USER_MODE
                            ORDER BY wfrecon__Location__r.Name ASC, wfrecon__Sequence__c ASC NULLS LAST, CreatedDate ASC];
            
            // Query ALL pending log entries (not just today) to get approval data
            // This ensures visibility of pending approvals from previous days as well
            // Note: Cannot filter on Approval_Data__c in WHERE clause (Long Text Area field)
            List<wfrecon__Log_Entry__c> pendingLogs = [
                SELECT Id, wfrecon__Approval_Data__c, wfrecon__Work_Performed_Date__c
                FROM wfrecon__Log_Entry__c
                WHERE wfrecon__Job__c = :jobId
                AND wfrecon__Status__c = 'Pending'
                AND wfrecon__Log_Type__c = 'Shift End'
                WITH USER_MODE
                ORDER BY wfrecon__Work_Performed_Date__c DESC
            ];
            
            // Parse approval data to get full approval details (oldValue, newValue)
            // Now supports both old structure (array) and new structure (object with locationProcessChanges)
            for(wfrecon__Log_Entry__c log : pendingLogs) {
                // Check if Approval_Data__c is not null
                if(String.isBlank(log.wfrecon__Approval_Data__c)) {
                    continue;
                }
                
                try {
                    Object approvalDataObj = JSON.deserializeUntyped(log.wfrecon__Approval_Data__c);
                    List<Object> approvalList = new List<Object>();
                    
                    if(approvalDataObj instanceof Map<String, Object>) {
                        // New structure: { locationProcessChanges: [], timesheetEntryChanges: {} }
                        Map<String, Object> approvalData = (Map<String, Object>) approvalDataObj;
                        Object locationProcessChanges = approvalData.get('locationProcessChanges');
                        if(locationProcessChanges != null && locationProcessChanges instanceof List<Object>) {
                            approvalList = (List<Object>) locationProcessChanges;
                        }
                    } else if(approvalDataObj instanceof List<Object>) {
                        // Old structure: [{ id, oldValue, newValue }]
                        approvalList = (List<Object>) approvalDataObj;
                    }
                    
                    for(Object obj : approvalList) {
                        Map<String, Object> approval = (Map<String, Object>) obj;
                        String processId = (String) approval.get('id');
                        if(String.isNotBlank(processId)) {
                            // Store full approval data for this process (oldValue, newValue)
                            Map<String, Object> approvalDetails = new Map<String, Object>();
                            approvalDetails.put('oldValue', approval.get('oldValue'));
                            approvalDetails.put('newValue', approval.get('newValue'));
                            pendingApprovalData.put(processId, approvalDetails);
                        }
                    }
                } catch(Exception ex) {
                    System.debug('Error parsing approval data for log ' + log.Id + ': ' + ex.getMessage());
                }
            }
            
            System.debug('Found ' + pendingApprovalData.size() + ' location processes with pending approvals');
            
            result.put('processes', processes);
            result.put('pendingApprovalData', pendingApprovalData);
            
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getJobLocationProcesses', 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Location Processes for Job ID: ' + jobId, 'apiResponse' => null});
        }
        return result;
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
    
            // Split date and time
            List<String> parts = utcDateTimeStr.split(' ');
            Date d = Date.valueOf(parts[0]);

            // Split time manually
            List<String> tParts = parts[1].split(':');

            Integer hh = Integer.valueOf(tParts[0]);
            Integer mm = Integer.valueOf(tParts[1]);
            Integer ss = Integer.valueOf(tParts[2]);

            Time t = Time.newInstance(hh, mm, ss, 0);

            // Create datetime WITHOUT timezone conversion
            Datetime fixedDT = Datetime.newInstance(d, t);

            System.debug('FINAL FIXED DT: ' + fixedDT);

            return fixedDT;
        } catch (Exception e) {
            System.debug('Error in convertUtc: ' + e.getMessage());
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'JobDetailsPageController', 'methodName' => 'convertUtc', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public Id TSEId;
        @AuraEnabled public Id contactId;
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

        public TimesheetEntryItemWrapper(wfrecon__Timesheet_Entry_Item__c item) {
            this.id = item.Id;
            this.TSEId = item.wfrecon__Timesheet_Entry__c;
            this.contactId = item.wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__c;
            this.contactName = item.wfrecon__Timesheet_Entry__r.wfrecon__Timesheet__r.wfrecon__Contact__r.Name;
            
            // Convert to user timezone
            this.clockInTime  = item.wfrecon__Clock_In_Time__c  != null ? item.wfrecon__Clock_In_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_In_Time__c)/1000)  : null;
            this.clockOutTime = item.wfrecon__Clock_Out_Time__c != null ? item.wfrecon__Clock_Out_Time__c.addSeconds(userTz.getOffset(item.wfrecon__Clock_Out_Time__c)/1000) : null;

            this.travelTime = item.wfrecon__Travel_Time__c != null ? item.wfrecon__Travel_Time__c : 0.00;
            this.perDiem = item.wfrecon__Per_Diem__c != null ? item.wfrecon__Per_Diem__c : 0;
            this.workHours = item.wfrecon__Total_Time__c != null ? item.wfrecon__Total_Time__c : 0.00;
            this.totalTime = this.workHours + this.travelTime;
            this.costCodeName = item.wfrecon__Cost_Code__r != null ? item.wfrecon__Cost_Code__r.Name : '-';
            this.premium = item.wfrecon__Premium__c;
            this.clockInDate = item.wfrecon__Clock_In_Date__c;
            this.status = item.wfrecon__Status__c;
            this.approvalData = item.wfrecon__Approval_Data__c;
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
            
            // Auto-approve ALL previous pending entries for this job
            autoApproveAllPendingEntries(jobId);
            
            // Parse work date
            Date workDate = Date.valueOf(workPerformedDate.substring(0, 10));
            
            // All new entries are always Pending (will be approved when next entry is created)
            String logStatus = 'Pending';
            
            // Create Log Entry record
            wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c();
            logEntry.wfrecon__Job__c = jobId;
            logEntry.wfrecon__Mobilization__c = mobilizationId; // Save the Mobilization lookup
            logEntry.wfrecon__Log_Type__c = 'Shift End';
            logEntry.wfrecon__Work_Performed__c = (String) step3Data.get('whatWeDone');
            logEntry.wfrecon__Plan_for_Tomorrow__c = (String) step3Data.get('planForTomorrow');
            logEntry.wfrecon__Exceptions__c = (String) step3Data.get('exceptions');
            logEntry.wfrecon__Notes_to_Office__c = (String) step3Data.get('notesToOffice');
            logEntry.wfrecon__Work_Performed_Date__c = workDate;
            logEntry.wfrecon__Status__c = logStatus;
            
            // Store approval data JSON directly from LWC (format: [{"id":"recordId","oldValue":73,"newValue":79}])
            if (String.isNotBlank(approvalDataJson)) {
                logEntry.wfrecon__Approval_Data__c = approvalDataJson;
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
            
            // query job
            wfrecon__Job__c jobRec = [SELECT Id, Name, wfrecon__Job_Name__c FROM wfrecon__Job__c WHERE Id = :jobId WITH USER_MODE LIMIT 1];
            // Send notifications to approvers
            String notificationContent = 'A new Shift End Log has been created for Job ' + jobRec.wfrecon__Job_Name__c + '. Tap to review.';
            sendCustomNotification(logEntry.Id, notificationContent);
            
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
    
    @AuraEnabled
    public static Boolean moveTimesheetBackToRegular(String timesheetEntryItemId) {
        try {
            if (String.isBlank(timesheetEntryItemId)) {
                throw new AuraHandledException('Timesheet Entry Item ID is required');
            }

            // Query the Timesheet Entry Item
            wfrecon__Timesheet_Entry_Item__c tsItem = [
                SELECT Id, wfrecon__Timesheet_Entry__c, wfrecon__Status__c, wfrecon__Approval_Data__c 
                FROM wfrecon__Timesheet_Entry_Item__c 
                WHERE Id = :timesheetEntryItemId 
                WITH USER_MODE 
                LIMIT 1
            ];

            // Query the related Timesheet Entry
            wfrecon__Timesheet_Entry__c tsEntry = [
                SELECT Id, wfrecon__Status__c, wfrecon__Approval_Data__c 
                FROM wfrecon__Timesheet_Entry__c 
                WHERE Id = :tsItem.wfrecon__Timesheet_Entry__c 
                WITH USER_MODE 
                LIMIT 1
            ];

            // Clear approval data and status for both records
            tsItem.wfrecon__Approval_Data__c = null;
            tsItem.wfrecon__Status__c = null;
            
            tsEntry.wfrecon__Approval_Data__c = null;
            tsEntry.wfrecon__Status__c = null;

            // Update both records
            update tsItem;
            update tsEntry;

            return true;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController','methodName' => 'moveTimesheetBackToRegular','exceptionObj' => e,'moreDetails' => e.getMessage()});
            throw new AuraHandledException('Error moving timesheet back to regular: ' + e.getMessage());
        }
    }
    
    // Helper method: Auto-approve ALL pending entries for a job
    private static void autoApproveAllPendingEntries(String jobId) {
        try {
            Date approvedDate = Date.today();

            // ---------------------------
            // 1. Get ALL Pending Shift End Logs for this Job
            // ---------------------------
            List<wfrecon__Log_Entry__c> pendingLogs = [
                SELECT Id, wfrecon__Status__c, wfrecon__Approval_Data__c, wfrecon__Mobilization__c
                FROM wfrecon__Log_Entry__c 
                WHERE wfrecon__Job__c = :jobId
                AND wfrecon__Log_Type__c = 'Shift End'
                AND wfrecon__Status__c = 'Pending'
                WITH USER_MODE
            ];

            if (pendingLogs.isEmpty()) {
                return; // Nothing to approve
            }

            Set<Id> locationProcessIds = new Set<Id>();
            Set<Id> mobilizationIds = new Set<Id>();

            // Collect Location Process Ids and Mobilization Ids from approval data
            for (wfrecon__Log_Entry__c log : pendingLogs) {
                mobilizationIds.add(log.wfrecon__Mobilization__c);
                
                if (String.isNotBlank(log.wfrecon__Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(log.wfrecon__Approval_Data__c);
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
                
                // Update log entry status
                log.wfrecon__Status__c = 'Auto-Approved';
                log.wfrecon__Approved_Date__c = approvedDate;
            }

            // ---------------------------
            // 2. Update Location Processes with approval data
            // ---------------------------
            if (!locationProcessIds.isEmpty()) {
                Map<Id, wfrecon__Location_Process__c> lpMap = new Map<Id, wfrecon__Location_Process__c>(
                    [
                        SELECT Id, wfrecon__Completed_Percentage__c
                        FROM wfrecon__Location_Process__c
                        WHERE Id IN :locationProcessIds
                        WITH USER_MODE
                    ]
                );

                // Apply changes from approval data to location processes
                for (wfrecon__Log_Entry__c log : pendingLogs) {
                    if (String.isNotBlank(log.wfrecon__Approval_Data__c)) {
                        Object parsed = JSON.deserializeUntyped(log.wfrecon__Approval_Data__c);
                        if (parsed instanceof List<Object>) {
                            for (Object o : (List<Object>) parsed) {
                                Map<String, Object> mapVal = (Map<String, Object>) o;
                                String recId = (String) mapVal.get('id');
                                Object newValueObj = mapVal.get('newValue');

                                if (lpMap.containsKey(recId) && newValueObj != null) {
                                    lpMap.get(recId).wfrecon__Completed_Percentage__c =
                                        Decimal.valueOf(String.valueOf(newValueObj));
                                }
                            }
                        }
                    }
                }

                if (!lpMap.isEmpty()) {
                    update as user lpMap.values();
                }
            }

            // Update log entries
            update pendingLogs;

            // ---------------------------
            // 3. Get ALL Pending Timesheet Entries for these mobilizations
            // ---------------------------
            List<wfrecon__Timesheet_Entry__c> tsEntries = [
                SELECT Id, wfrecon__Status__c, wfrecon__Approval_Data__c, wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c
                FROM wfrecon__Timesheet_Entry__c
                WHERE wfrecon__Mobilization__c IN :mobilizationIds
                AND wfrecon__Status__c = 'Pending'
                WITH USER_MODE
            ];

            Set<Id> tsEntryIds = new Set<Id>();

            // Apply changes from approval data to timesheet entries
            for (wfrecon__Timesheet_Entry__c ts : tsEntries) {
                ts.wfrecon__Status__c = 'Auto-Approved';
                ts.wfrecon__Approved_Date__c = approvedDate;
                tsEntryIds.add(ts.Id);

                if (String.isNotBlank(ts.wfrecon__Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(ts.wfrecon__Approval_Data__c);

                    if (parsed instanceof List<Object>) {
                        for (Object o : (List<Object>) parsed) {
                            Map<String, Object> mapVal = (Map<String, Object>) o;
                            String fieldApi = (String) mapVal.get('fieldApiName');
                            Object newValueObj = mapVal.get('newValue');

                            if (String.isNotBlank(fieldApi) && newValueObj != null) {
                                // Handle DateTime fields
                                if (fieldApi == 'wfrecon__Clock_In_Time__c' || fieldApi == 'wfrecon__Clock_Out_Time__c') {
                                    // Convert ISO format (2025-11-21T09:05:00.000Z) to Apex DateTime
                                    String dateTimeStr = String.valueOf(newValueObj);
                                    // Remove 'Z' and milliseconds, replace 'T' with space
                                    dateTimeStr = dateTimeStr.replace('T', ' ').replace('Z', '');
                                    if (dateTimeStr.contains('.')) {
                                        dateTimeStr = dateTimeStr.substring(0, dateTimeStr.indexOf('.'));
                                    }
                                    ts.put(fieldApi, DateTime.valueOf(dateTimeStr));
                                }
                            }
                        }
                    }
                }
            }

            if (!tsEntries.isEmpty()) {
                update tsEntries;
            }

            // ---------------------------
            // 4. Get ALL Pending Timesheet Entry Items
            // ---------------------------
            List<wfrecon__Timesheet_Entry_Item__c> tsItems = [
                SELECT Id, wfrecon__Status__c, wfrecon__Approval_Data__c
                FROM wfrecon__Timesheet_Entry_Item__c
                WHERE wfrecon__Timesheet_Entry__c IN :tsEntryIds
                AND wfrecon__Status__c = 'Pending'
                WITH USER_MODE
            ];

            // Apply changes from approval data to timesheet entry items
            for (wfrecon__Timesheet_Entry_Item__c item : tsItems) {
                item.wfrecon__Status__c = 'Auto-Approved';
                item.wfrecon__Approved_Date__c = approvedDate;

                if (String.isNotBlank(item.wfrecon__Approval_Data__c)) {
                    Object parsed = JSON.deserializeUntyped(item.wfrecon__Approval_Data__c);

                    if (parsed instanceof List<Object>) {
                        for (Object o : (List<Object>) parsed) {
                            Map<String, Object> mapVal = (Map<String, Object>) o;
                            String fieldApi = (String) mapVal.get('fieldApiName');
                            Object newValueObj = mapVal.get('newValue');

                            if (String.isNotBlank(fieldApi) && newValueObj != null) {
                                // Handle DateTime fields (wfrecon__Clock_In_Time__c, wfrecon__Clock_Out_Time__c)
                                if (fieldApi == 'wfrecon__Clock_In_Time__c' || fieldApi == 'wfrecon__Clock_Out_Time__c') {
                                    String dateTimeStr = String.valueOf(newValueObj);
                                    // Remove 'Z' and milliseconds, replace 'T' with space
                                    dateTimeStr = dateTimeStr.replace('T', ' ').replace('Z', '');
                                    if (dateTimeStr.contains('.')) {
                                        dateTimeStr = dateTimeStr.substring(0, dateTimeStr.indexOf('.'));
                                    }
                                    item.put(fieldApi, DateTime.valueOf(dateTimeStr));
                                } else {
                                    // Handle numeric fields (wfrecon__Travel_Time__c, etc.)
                                    item.put(fieldApi, Decimal.valueOf(String.valueOf(newValueObj)));
                                }
                            }
                        }
                    }
                }
            }

            if (!tsItems.isEmpty()) {
                update tsItems;
            }
            
            System.debug('Auto-approved ' + pendingLogs.size() + ' log entries, ' + 
                        tsEntries.size() + ' timesheet entries, and ' + 
                        tsItems.size() + ' timesheet items for Job: ' + jobId);
        }
        catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController','methodName' => 'autoApproveAllPendingEntries','exceptionObj' => e,'moreDetails' => e.getMessage()});
        }
    }
    
    /**
     * Generic method to send custom notifications to users from custom metadata
     * @param recordId - The record ID to link the notification to
     * @param content - The notification message content
     */
    private static void sendCustomNotification(Id recordId, String content) {
        try {
            // Query the metadata to get approver user IDs
            List<wfrecon__Log_Entry_Approver__mdt> approverMetadata = [
                SELECT Id, DeveloperName, wfrecon__Approvers_JSON__c 
                FROM wfrecon__Log_Entry_Approver__mdt 
                WHERE DeveloperName = 'Approvers_JSON' 
                LIMIT 1
            ];
            
            Set<String> addressee = new Set<String>();
            
            // Parse approvers JSON from metadata
            if (!approverMetadata.isEmpty() && String.isNotBlank(approverMetadata[0].wfrecon__Approvers_JSON__c)) {
                try {
                    Map<String, Object> approversMap = (Map<String, Object>) JSON.deserializeUntyped(approverMetadata[0].wfrecon__Approvers_JSON__c);
                    
                    // Extract user IDs from the JSON (values in the map)
                    for (String userName : approversMap.keySet()) {
                        Object userIdObj = approversMap.get(userName);
                        if (userIdObj != null) {
                            String userId = String.valueOf(userIdObj);
                            if (String.isNotBlank(userId)) {
                                addressee.add(userId);
                            }
                        }
                    }
                } catch (Exception jsonEx) {
                    System.debug('Error parsing approvers JSON: ' + jsonEx.getMessage());
                }
            }
            
            // If no approvers found in metadata
            if (addressee.isEmpty()) {
                System.debug('No approvers found in metadata');
                return;
            }
            
            // Query for Custom Notification Type
            List<CustomNotificationType> cnType = [
                SELECT Id 
                FROM CustomNotificationType 
                WHERE DeveloperName = 'Field_Recon_Notification' 
                LIMIT 1
            ];
            
            if (cnType.isEmpty()) {
                System.debug('No Custom Notification Type found with DeveloperName: Field_Recon_Notification');
                return;
            }
            
            // Send notification if we have addressees
            if (!addressee.isEmpty()) {
                Map<String, Object> pageRef = new Map<String, Object>{
                    'type' => 'standard__navItemPage',
                    'attributes' => new Map<String, Object>{
                        'apiName' => 'wfrecon__Shift_Log_Approval' // Tab API Name (namespaced)
                    }
                };
                String title = 'New Shift End Log Entry Created';

                Messaging.CustomNotification customNotificationObj = new Messaging.CustomNotification();
                customNotificationObj.setBody(content);
                customNotificationObj.setTitle(title);
                customNotificationObj.setNotificationTypeId(cnType[0].Id);
                customNotificationObj.setTargetPageRef(JSON.serialize(pageRef));
                customNotificationObj.send(addressee);
                
                System.debug('Custom notification sent to ' + addressee.size() + ' users for record: ' + recordId);
            } else {
                System.debug('No addressees found to send notification');
            }
            
        } catch (Exception e) {
            // Log the exception but don't fail the main transaction
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController','methodName' => 'sendCustomNotification','exceptionObj' => e,'moreDetails' => 'Error sending custom notification for record: ' + recordId + ' - ' + e.getMessage()});
            System.debug('Error sending custom notification: ' + e.getMessage());
        }
    }
}