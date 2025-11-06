public with sharing class ShiftEndLogEntriesController {
    public static TimeZone userTz = UserInfo.getTimeZone();

    @AuraEnabled
    public static Map<String, String> getMobilizationList(String jobId){
        try {
            Map<String, String> result = new Map<String, String>();
            List<Mobilization__c> mobList = [SELECT Id, Name, wfrecon__Start_Date_Text__c FROM Mobilization__c WHERE Job__c = :jobId WITH USER_MODE];
            for (Mobilization__c mob : mobList) {
                result.put(mob.Id, mob.Name + '(' + mob.wfrecon__Start_Date_Text__c + ')');
            }
            return result;
        } catch (Exception e) {
            ExceptionHandler.logException(new Map<String, Object>{'className' => 'ShiftEndLogEntriesController', 'methodName' => 'getMobilizationList', 'exceptionObj' => e, 'moreDetails' =>  e.getMessage()});
            return null;
        }
    }

    @AuraEnabled
    public static Map<String, List<WrapperMember>> getMobilizationMembersWithStatus(String mobId, String jobId) {
        try {
            Map<String, List<WrapperMember>> result = new Map<String, List<WrapperMember>>();
            result.put('clockIn', new List<WrapperMember>());
            result.put('clockOut', new List<WrapperMember>());
            result.put('costCodeDetails', new List<WrapperMember>());
    
            List<Mobilization__c> mobilizationRecord = [SELECT Id, Job__c, Start_Date__c, End_Date__c FROM Mobilization__c WHERE Id = :mobId WITH USER_MODE LIMIT 1];

            List<Mobilization_Member__c> members = [SELECT Id, Contact__c, Contact__r.Name, Contact__r.RecordType.DeveloperName, Contact__r.Can_Clock_In_Out__c, Mobilization__r.Job__c
                                                    FROM Mobilization_Member__c WHERE Mobilization__c = :mobId AND Contact__c != null
                                                    AND Contact__r.Can_Clock_In_Out__c = true WITH USER_MODE];
    
            Set<Id> contactIds = new Set<Id>();
            for (Mobilization_Member__c m : members) {
                contactIds.add(m.Contact__c);
            }
    
            if (contactIds.isEmpty()) {
                return result;
            }

            List<Timesheet__c> tsList = [SELECT Id, Contact__c, Timesheet_Start_Date__c, Timesheet_End_Date__c FROM Timesheet__c WHERE Contact__c IN :contactIds
                                            AND Job__c = :jobId AND Timesheet_Start_Date__c <= :Date.valueOf(mobilizationRecord[0].Start_Date__c)
                                            AND Timesheet_End_Date__c >= :Date.valueOf(mobilizationRecord[0].End_Date__c) WITH USER_MODE];

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
    
                for (Timesheet_Entry__c e : userEntries) {
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
                    result.get('clockOut').add(wrap);
                } else if (hasCompletedEntry) {
                    // Only completed entries → eligible for ClockIn again
                    wrap.timesheetId = ts.Id;
                    wrap.isTimeSheetNull = false;
                    wrap.isTimesheetEntryNull = true;
                    wrap.isAgain = true;  // ✅ Contact is clocking in AGAIN
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
    }
}