public with sharing class ShiftEndLogEntriesController {
    public static TimeZone userTz = UserInfo.getTimeZone();

    @AuraEnabled
    public static Map<String, String> getMobilizationList(String jobId, String crewLeaderId){
        try {
            Map<String, String> result = new Map<String, String>();
            if (String.isNotBlank(crewLeaderId) && crewLeaderId != null) {
                String todayStr = String.valueOf(Date.today());
                
                List<Mobilization__c> mobList = [SELECT Id, Name, wfrecon__Start_Date_Text__c FROM Mobilization__c WHERE Job__c = :jobId 
                                                    AND Id IN (SELECT Mobilization__c FROM Mobilization_Member__c WHERE wfrecon__Crew_Leader_Id__c = :crewLeaderId)
                                                    AND wfrecon__Start_Date_Text__c <= :todayStr
                                                    WITH USER_MODE];
                for (Mobilization__c mob : mobList) {
                    result.put(mob.Id, mob.Name + '(' + mob.wfrecon__Start_Date_Text__c + ')');
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
                                                    AND Contact__r.Can_Clock_In_Out__c = true AND wfrecon__Crew_Leader_Id__c = :crewLeaderId
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
            List<Timesheet_Entry__c> entries = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__r.Contact__c FROM Timesheet_Entry__c
                                                WHERE Timesheet__c IN :tsList AND Clock_In_Time__c >= :startDate AND Clock_In_Time__c < :startDate.addDays(1)
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
                                                    AND Contact__r.Can_Clock_In_Out__c = true AND wfrecon__Crew_Leader_Id__c = :crewLeaderId
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
                                                    Cost_Code__r.Name, Clock_In_Date__c, Premium__c FROM Timesheet_Entry_Item__c 
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
            Timesheet_Entry_Item__c tsItem = [SELECT Id, Travel_Time__c, Per_Diem__c, Clock_In_Time__c, Clock_Out_Time__c, Premium__c FROM Timesheet_Entry_Item__c 
                                                WHERE Id = :(String)jsonList.get('Id') WITH USER_MODE LIMIT 1];

            Timesheet_Entry__c tsEntry = [SELECT Id, Clock_In_Time__c, Clock_Out_Time__c, Timesheet__c, Cost_Code__c FROM Timesheet_Entry__c 
                                            WHERE Id = :(String)jsonList.get('TSEId') WITH USER_MODE LIMIT 1];

            // Convert clock-in and clock-out strings to Datetime
            Datetime clkInUserTz = convertUtc((String)jsonList.get('ClockIn'));
            Datetime clkOutUserTz = convertUtc((String)jsonList.get('ClockOut'));

            Decimal travelTime = Decimal.valueOf((String)jsonList.get('TravelTime'));
            Integer perDiem = Integer.valueOf((String)jsonList.get('PerDiem'));
            Boolean premium = Boolean.valueOf((String)jsonList.get('premium'));
            
            Boolean crossesMidnight = (clkInUserTz.date() != clkOutUserTz.date());

            if (crossesMidnight) {
                Datetime firstDayEnd = DateTime.newInstance(clkInUserTz.date(), Time.newInstance(23, 59, 59, 999));
                Datetime secondDayStart = DateTime.newInstance(clkOutUserTz.date(), Time.newInstance(0, 0, 0, 0));

                // Update current entry to end day 1
                tsEntry.Clock_In_Time__c = clkInUserTz;
                tsEntry.Clock_Out_Time__c = firstDayEnd;
                update tsEntry;

                tsItem.Clock_In_Time__c = clkInUserTz;
                tsItem.Clock_Out_Time__c = firstDayEnd;
                tsItem.Travel_Time__c = travelTime;
                tsItem.Per_Diem__c = perDiem;
                tsItem.Premium__c = premium;
                update tsItem;

                // Create new entry for day 2
                Timesheet_Entry__c entryDay2 = new Timesheet_Entry__c(
                    Timesheet__c = tsEntry.Timesheet__c,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = tsEntry.Cost_Code__c,
                    Do_Not_Execute__c = true
                );
                insert entryDay2;

                Timesheet_Entry_Item__c itemDay2 = new Timesheet_Entry_Item__c(
                    Timesheet_Entry__c = entryDay2.Id,
                    Clock_In_Time__c = secondDayStart,
                    Clock_Out_Time__c = clkOutUserTz,
                    Cost_Code__c = tsEntry.Cost_Code__c,
                    Do_Not_Execute__c = true
                );
                insert itemDay2;
            } else {
                // Normal same-day update
                tsItem.Clock_In_Time__c = clkInUserTz;
                tsItem.Clock_Out_Time__c = clkOutUserTz;
                tsItem.Travel_Time__c = travelTime;
                tsItem.Per_Diem__c = perDiem;
                tsItem.Premium__c = premium;
                update tsItem;

                tsEntry.Clock_In_Time__c = clkInUserTz;
                tsEntry.Clock_Out_Time__c = clkOutUserTz;
                update tsEntry;
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
            processes = [SELECT Id, Name, Contract_Price__c, Completed_Percentage__c, Current_Completed_Value__c, Process_Status__c, Sequence__c,
                            Location__c, Location__r.Name, Location__r.Job__c FROM Location_Process__c WHERE Location__r.Job__c = :jobId WITH USER_MODE
                            ORDER BY Location__r.Name ASC, Sequence__c ASC NULLS LAST, CreatedDate ASC];
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getJobLocationProcesses', 'exceptionObj' => e, 'moreDetails' => 'Error occurred while fetching Location Processes for Job ID: ' + jobId, 'apiResponse' => null});
        }
        return processes;
    }

    @AuraEnabled
    public static BatchUpdateResult batchUpdateProcessCompletion(List<ProcessUpdateWrapper> processUpdates) {
        BatchUpdateResult result = new BatchUpdateResult();
        result.isSuccess = true;
        result.successCount = 0;
        result.errorCount = 0;
        result.errorDetails = new List<String>();
        
        if (processUpdates == null || processUpdates.isEmpty()) {
            result.isSuccess = false;
            result.errorDetails.add('No processes provided for update');
            return result;
        }
        
        try {
            // Get all process IDs
            Set<Id> processIds = new Set<Id>();
            for (ProcessUpdateWrapper updateInstance : processUpdates) {
                processIds.add(updateInstance.processId);
            }
            
            // Query existing processes
            Map<Id, Location_Process__c> processMap = new Map<Id, Location_Process__c>([
                SELECT Id, Completed_Percentage__c 
                FROM Location_Process__c 
                WHERE Id IN :processIds 
                WITH USER_MODE
            ]);
            
            // Prepare processes for update
            List<Location_Process__c> processesToUpdate = new List<Location_Process__c>();
            
            for (ProcessUpdateWrapper updateInstance : processUpdates) {
                if (processMap.containsKey(updateInstance.processId)) {
                    Location_Process__c processToUpdate = processMap.get(updateInstance.processId);
                    processToUpdate.Completed_Percentage__c = updateInstance.completionPercentage;
                    processesToUpdate.add(processToUpdate);
                } else {
                    result.errorCount++;
                    result.errorDetails.add('Process not found: ' + updateInstance.processId);
                }
            }
            
            // Perform batch update
            if (!processesToUpdate.isEmpty()) {
                List<Database.SaveResult> saveResults = Database.update(processesToUpdate, false);
                
                // Process results
                for (Integer i = 0; i < saveResults.size(); i++) {
                    Database.SaveResult saveResult = saveResults[i];
                    if (saveResult.isSuccess()) {
                        result.successCount++;
                    } else {
                        result.errorCount++;
                        String errorMsg = 'Process ID: ' + processesToUpdate[i].Id + ' - ';
                        for (Database.Error error : saveResult.getErrors()) {
                            errorMsg += error.getMessage() + '; ';
                        }
                        result.errorDetails.add(errorMsg);
                    }
                }
            }
            
            // Set overall success status
            result.isSuccess = (result.errorCount == 0);
            result.message = result.isSuccess ? 
                'All processes updated successfully' : 
                'Some processes failed to update';
                
        } catch (Exception e) {
            result.isSuccess = false;
            result.errorCount = processUpdates.size();
            result.message = 'Batch update failed: ' + e.getMessage();
            result.errorDetails.add(e.getMessage());
            
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'batchUpdateProcessCompletion', 'exceptionObj' => e, 'moreDetails' => 'Error occurred during batch update of Location Processes', 'apiResponse' => null});
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
                }
            }
    
            // Replace T with space for DateTime.valueOf
            utcDateTimeStr = utcDateTimeStr.replace('T',' ');
    
            // Convert to Datetime (interpreted as GMT/UTC)
            Datetime utcDT = Datetime.valueOf(utcDateTimeStr);

            return utcDT;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'convertUtc', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
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
        }
    }

    public class ProcessUpdateWrapper {
        @AuraEnabled public Id processId { get; set; }
        @AuraEnabled public Decimal completionPercentage { get; set; }
    }

    public class BatchUpdateResult {
        @AuraEnabled public Boolean isSuccess { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public Integer successCount { get; set; }
        @AuraEnabled public Integer errorCount { get; set; }
        @AuraEnabled public List<String> errorDetails { get; set; }
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
    }

    @AuraEnabled
    public static void createLogEntry(String jobId, String step3DataJson, List<String> contentDocumentIds, String cameraPhotosJson, String workPerformedDate) {
        try {
            // Deserialize step3 data
            Map<String, Object> step3Data = (Map<String, Object>) JSON.deserializeUntyped(step3DataJson);
            
            // Create Log Entry record
            wfrecon__Log_Entry__c logEntry = new wfrecon__Log_Entry__c();
            logEntry.wfrecon__Job__c = jobId;
            logEntry.wfrecon__Log_Type__c = 'Shift End';
            logEntry.wfrecon__Work_Performed__c = (String) step3Data.get('whatWeDone');
            logEntry.wfrecon__Plan_for_Tomorrow__c = (String) step3Data.get('planForTomorrow');
            logEntry.wfrecon__Exceptions__c = (String) step3Data.get('exceptions');
            logEntry.wfrecon__Notes_to_Office__c = (String) step3Data.get('notesToOffice');
            logEntry.wfrecon__Work_Performed_Date__c = Date.valueOf(workPerformedDate.substring(0, 10));
            
            insert as user logEntry;
            
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
                    // Links are automatically created by FirstPublishLocationId
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
}