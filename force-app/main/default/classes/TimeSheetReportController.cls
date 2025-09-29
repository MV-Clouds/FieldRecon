public with sharing class TimeSheetReportController {
    private static Boolean costCodeAccess = false;

    @AuraEnabled
    public static Boolean checkSecondLevelAccess(){
        try {
            return Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess();
        } catch (Exception e) {
            return false;
        }
    }

    @AuraEnabled
    public static Boolean checkCostCodeAccess(){
        try {
            TimeSheetReportController.costCodeAccess  = Util.thirdLevelFeatureAccess();
            return TimeSheetReportController.costCodeAccess;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    /**
     * Get timesheet report data according to the selected filters
     * 
     * @param flt (Filter) : Selected filters (Date, User)
     * @return List<TimesheetData> : Timesheet data to display
     */
    @AuraEnabled
    public static List<TimesheetData> getTimesheetData(Object flts){
        Filter flt = (Filter)JSON.deserialize(JSON.serialize(flts),Filter.Class);
        try {
            Boolean hasLevelTwoAccess = Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess();
            if(!hasLevelTwoAccess){
                throw new HandledException('Second Level Feature Pack Required! Please Contact Your Admin!');
            }
            if(flt == null) {
                throw new AuraHandledException('Filter cannot be null');
            }
            return prepareTimesheetDataList(flt);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<EmployeeTimeEntryData> getEmployeeTimeEntryData(Object emplData) {
        EmployeeFilter empData=(EmployeeFilter)JSON.deserialize(JSON.serialize(emplData),EmployeeFilter.class);
        try {
            if(empData == null || String.isEmpty(empData.employeeId)) {
                throw new AuraHandledException('employeeId cannot be null');
            }
            return prepareEmployeeTimeEntryDataList(empData);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * Get timesheet report data according to the selected filters
     * 
     * @param flt (Filter) : Selected filters (Date, User)
     * @return List<TimesheetData> : Timesheet data to display
     */
    private static List<TimesheetData> prepareTimesheetDataList(Filter flt) {
        List<TimesheetData> timesheetDataList = new List<TimesheetData>();

        Object[] arguments = new Object[]{flt.userId, flt.startDate, flt.endDate, flt.costCodeId, flt.jobStatus};
        TimeSheetReportController.costCodeAccess = checkCostCodeAccess();

        Map<String, List<TimesheetDataItem>> groupedTimesheets = new Map<String, List<TimesheetDataItem>>();

        if(flt.dateFilterType == 'weekly') {
            List<Timesheet__c> timesheets = Lib_Security.ws().dbQuery(getWeeklyTimesheetQuery(flt), arguments);
            groupedTimesheets = groupTimesheetsByWeek(timesheets);
        } else if(flt.dateFilterType == 'daily' || flt.dateFilterType == 'custom') {
            List<Timesheet_Entry__c> timesheetEntries = Lib_Security.ws().dbQuery(getDailyTimesheetEntryQuery(flt), arguments);
            groupedTimesheets = groupTimesheetsByDay(timesheetEntries);
        } else if(flt.dateFilterType == 'monthly') {
            List<Timesheet_Entry__c> timesheetEntries = Lib_Security.ws().dbQuery(getDailyTimesheetEntryQuery(flt), arguments);
            groupedTimesheets = groupTimesheetsByMonth(timesheetEntries);
        }

        for(String key: groupedTimesheets.keySet()) {
            TimesheetData tsData = new TimesheetData(key, groupedTimesheets.get(key));
            timesheetDataList.add(tsData);
        }
        return timesheetDataList;
    }

    private static List<EmployeeTimeEntryData> prepareEmployeeTimeEntryDataList(EmployeeFilter empData) {
        List<Timesheet_Entry__c> timesheetEntriesWithItems = Lib_Security.ws().dbQuery(getTimesheetEntryWithItemsQuery(empData), new Object[] {empData.employeeId,empData.startDate,empData.endDate,empData.jobId});
        List<EmployeeTimeEntryData> empTimeEntryDataList = new List<EmployeeTimeEntryData>();

        for(Timesheet_Entry__c entryWithItem : timesheetEntriesWithItems) {
            List<Timesheet_Entry_Item__c> entryItems = entryWithItem.Timesheet_Entry_Items__r;
            List<EmployeeTimeEntryDataItem> empTimeEntryDataItems = new List<EmployeeTimeEntryDataItem>();
            if(entryItems != null && !entryItems.isEmpty()) {
                for(Timesheet_Entry_Item__c entryItem : entryItems) {
                    empTimeEntryDataItems.add(
                        new EmployeeTimeEntryDataItem(entryItem.Id,entryWithItem.Timesheet__r.Job__r.Job_Name__c,entryWithItem.Timesheet__r.Job__c,entryWithItem.Timesheet__r.Job__r.Name)
                        .setClockTime(entryItem.Clock_In_Time__c, entryItem.Clock_Out_Time__c)
                        .setTotalClockTime(entryItem.Total_Time__c)
                    );
                }
                empTimeEntryDataList.add(new EmployeeTimeEntryData(
                    entryWithItem.Timesheet__r.Contact__r.Name,
                    formatDate(entryWithItem.Entry_Date__c),
                    empTimeEntryDataItems
                ));
            }
        }
        
        return empTimeEntryDataList;
    }

    /**
     * Group timesheet data by month, return map with key = timesheet report group title
     * 
     * @param timesheetEntries (List<Timesheet_Entry__c>) : A list of Timesheet Entries
     * @return Map<String, List<TimesheetDataItem>> : List of TimesheetDataItem mapped by group key (title)
     */
    private static Map<String, List<TimesheetDataItem>> groupTimesheetsByMonth(List<Timesheet_Entry__c> timesheetEntries) {
        Map<String, List<TimesheetDataItem>> groupedTimesheets = new Map<String, List<TimesheetDataItem>>();
        Map<String, Map<String, TimesheetDataItem>> tsGroupedByMemberAndJob = new Map<String, Map<String, TimesheetDataItem>>();
        Integer count = 0;
        for(Timesheet_Entry__c entry : timesheetEntries) {
            Date startOfMonth = entry.Entry_Date__c.toStartOfMonth();
            Date endOfMonth = startOfMonth.addMonths(1).addDays(-1);

            String key = formatDate(startOfMonth) + ' - ' + formatDate(endOfMonth);

            Map<String, TimesheetDataItem> tsDataItemGroupedByMemberAndJob = tsGroupedByMemberAndJob.get(key);
            if(tsDataItemGroupedByMemberAndJob == null) {
                tsDataItemGroupedByMemberAndJob = new Map<String, TimesheetDataItem>();
            }
            Timesheet__c ts = entry.Timesheet__r;

            // For grouping data by unique member and job
            String memberAndJobKey = ts.Contact__r.Id + ':' + ts.Job__r.Id;
            TimesheetDataItem tsDataItem = tsDataItemGroupedByMemberAndJob.get(memberAndJobKey);

            if(tsDataItem == null) {
                tsDataItem = createTSDataItem(ts, entry.Total_Clock_In_Time__c,startOfMonth,endOfMonth);
            } else {
                tsDataItem.setTimeLog(tsDataItem.timeLog + entry.Total_Clock_In_Time__c);
            }

            tsDataItemGroupedByMemberAndJob.put(memberAndJobKey, tsDataItem);
            tsGroupedByMemberAndJob.put(key, tsDataItemGroupedByMemberAndJob);
        }
        for(String key : tsGroupedByMemberAndJob.keySet()) {
            Map<String, TimesheetDataItem> tsDataItemGroupedByMemberAndJob = tsGroupedByMemberAndJob.get(key);
            if(tsDataItemGroupedByMemberAndJob != null) {
                groupedTimesheets.put(key, tsDataItemGroupedByMemberAndJob.values());
            }
        }
        return groupedTimesheets;
    }

    /**
     * Group timesheet data by week, return map with key = timesheet report group title
     * 
     * @param timesheets (List<Timesheet__c>) : A list of Timesheets
     * @return Map<String, List<TimesheetDataItem>> : List of TimesheetDataItem mapped by group key (title)
     */
    private static Map<String, List<TimesheetDataItem>> groupTimesheetsByWeek(List<Timesheet__c> timesheets) {
        Map<String, List<TimesheetDataItem>> groupedTimesheets = new Map<String, List<TimesheetDataItem>>();
        for(Timesheet__c t : timesheets) {
            if(t.Timesheet_Start_Date__c == null || t.Timesheet_End_Date__c == null) {  continue;}
            String key = formatDate(t.Timesheet_Start_Date__c) + ' - ' + formatDate(t.Timesheet_End_Date__c);
            List<TimesheetDataItem> currentGroupedTimesheets = groupedTimesheets.get(key);
            if(currentGroupedTimesheets == null) {
                currentGroupedTimesheets = new List<TimesheetDataItem>();
            }
            currentGroupedTimesheets.add(createTSDataItem(t, t.Total_Timesheet_Time__c,t.Timesheet_Start_Date__c,t.Timesheet_End_Date__c));
            groupedTimesheets.put(key, currentGroupedTimesheets);
        }
        return groupedTimesheets;
    }

    /**
     * Group timesheet data by day, return map with key = timesheet report group title
     * 
     * @param timesheetEntries (List<Timesheet_Entry__c>) : A list of Timesheet Entries
     * @return Map<String, List<TimesheetDataItem>> : List of TimesheetDataItem mapped by group key (title)
     */
    private static Map<String, List<TimesheetDataItem>> groupTimesheetsByDay(List<Timesheet_Entry__c> timesheetEntries) {
        Map<String, List<TimesheetDataItem>> groupedTimesheets = new Map<String, List<TimesheetDataItem>>();
        for(Timesheet_Entry__c entry : timesheetEntries) {
            String key = formatDate(entry.Entry_Date__c) + ' - ' + formatDate(entry.Entry_Date__c, 'EEEE');
            List<TimesheetDataItem> currentGroupedTimesheets = groupedTimesheets.get(key);
            if(currentGroupedTimesheets == null) {
                currentGroupedTimesheets = new List<TimesheetDataItem>();
            }
            currentGroupedTimesheets.add(createTSDataItem(entry.Timesheet__r, entry.Total_Clock_In_Time__c,entry.Entry_Date__c));
            groupedTimesheets.put(key, currentGroupedTimesheets);
        }
        return groupedTimesheets;
    }

    /**
     * Creates a new TimesheetDataItem object
     * 
     * @param ts (Timesheet__c) : Timesheet object
     * @param timeLog (Decimal) : Number of hours logged
     * @return TimesheetDataItem : New TimesheetDataItem
     */
    private static TimesheetDataItem createTSDataItem(Timesheet__c ts, Decimal timeLog,Date start) {
        TimesheetDataItem tsdi = new TimesheetDataItem()
        .setMember(ts.Contact__r?.Name, ts?.Contact__c)
        .setJob(ts.Job__r?.Job_Name__c, '/' + ts?.Job__c,ts.Job__r?.Name);
        if(TimeSheetReportController.costCodeAccess) {
        	tsdi = tsdi.setCostCode(ts.Cost_Code__r?.Name);
        }
        return tsdi.setTimeLog(timeLog)
        .setStartDate(start);
    }
    private static TimesheetDataItem createTSDataItem(Timesheet__c ts, Decimal timeLog,Date start,Date endTime) {
        TimesheetDataItem tsdi = new TimesheetDataItem()
        .setMember(ts.Contact__r?.Name, ts?.Contact__c)
        .setJob(ts.Job__r?.Job_Name__c, '/' + ts?.Job__c,ts.Job__r?.Name);
        if(TimeSheetReportController.costCodeAccess) {
        	tsdi = tsdi.setCostCode(ts.Cost_Code__r?.Name);
        }
        return tsdi.setTimeLog(timeLog)
        .setStartDate(start)
        .setEndDate(endTime);
    }

    /**
     * Get query for querying daily timesheet entries
     * 
     * @param flt (Filter) : Selected filters (Date, User)
     * @return String : query
     */
    private static String getDailyTimesheetEntryQuery(Filter flt) {
        String query = 
            'SELECT ' +
                'Id, ' +
                'Entry_Date__c, ' + 
                'Total_Clock_In_Time__c, ' +
                'Timesheet__r.Contact__c, Timesheet__r.Contact__r.Name, ' +
                'Timesheet__r.Job__c, Timesheet__r.Job__r.Job_Name__c,Timesheet__r.Job__r.Name, ';
       	if(TimeSheetReportController.costCodeAccess) {
         	  query += 'Timesheet__r.Cost_Code__c, Timesheet__r.Cost_Code__r.Name, ';
        }
        query += 'Timesheet__r.Timesheet_Start_Date__c, Timesheet__r.Timesheet_End_Date__c, ' +
                'Timesheet__r.Total_Timesheet_Time__c ' +
            'FROM Timesheet_Entry__c WHERE ((Timesheet__r.Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\' AND Timesheet__r.Contact__r.User__c != null) OR (Timesheet__r.Contact__c != null AND Timesheet__r.Contact__r.RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Timesheet__r.Contact__r.Can_Log_In_Out__c = TRUE)) ';

        Boolean hasCustomStartEndDateFilter = flt.dateFilterType == 'custom' && flt.startDate != null && flt.endDate != null;

        if(String.isNotBlank(flt.userId)) {
            query += ' AND Timesheet__r.Contact__c = :arg1';
        }
        if(String.isNotBlank(flt.costCodeId)) {
            query += ' AND Timesheet__r.Cost_Code__c = :arg4';
        }
        if(String.isNotBlank(flt.jobStatus)) {
            query += ' AND Timesheet__r.Job__r.Status__c = :arg5';
        }
        if(hasCustomStartEndDateFilter) {
            query += ' AND Entry_Date__c >= :arg2 AND Entry_Date__c <= :arg3';
        }
        query += ' ORDER BY Entry_Date__c DESC';
        return query;
    }

    /**
     * Get query for querying weekly timesheets
     * 
     * @param flt (Filter) : Selected filters (Date, User)
     * @return String : query
     */
    private static String getWeeklyTimesheetQuery(Filter flt) {
        String query = 
            'SELECT ' + 
                'Id, ' +
                'Contact__c, Contact__r.Name, ' +
                'Job__c, Job__r.Job_Name__c,Job__r.Name, ';
        if(TimeSheetReportController.costCodeAccess) {
         	  query += 'Cost_Code__c, Cost_Code__r.Name, ' ;
        }
        query += 'Timesheet_Start_Date__c, Timesheet_End_Date__c, ' +
                'Total_Timesheet_Time__c ' +
            'FROM Timesheet__c WHERE ((Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\' AND Contact__r.User__c != null) OR (Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Contact__r.Can_Log_In_Out__c = TRUE)) AND Timesheet_Start_Date__c != null AND Timesheet_End_Date__c != null';

        if(String.isNotBlank(flt.userId)) {
            query += ' AND Contact__c = :arg1';
        }
        if(String.isNotBlank(flt.costCodeId)) {
            query += ' AND Cost_Code__c = :arg4';
        }
        if(String.isNotBlank(flt.jobStatus)) {
            query += ' AND Job__r.Status__c = :arg5';
        }
        query += ' ORDER BY Timesheet_Start_Date__c DESC';
        return query;
    }

    private static String getTimesheetEntryWithItemsQuery(EmployeeFilter empData) {
        String query = 
            'SELECT ' +
                'Id, ' +
                'Entry_Date__c, ' + 
                'Timesheet__r.Contact__r.Name, ' +
                'Timesheet__r.Job__c,Timesheet__r.Job__r.Job_Name__c,Timesheet__r.Job__r.Name, '+ 
                '(SELECT Clock_In_Time__c, Clock_Out_Time__c, Total_Time__c FROM Timesheet_Entry_Items__r) ' +
            'FROM Timesheet_Entry__c WHERE Timesheet__r.Contact__c = :arg1 ';
            if(empData.startDate != null && empData.endDate != null) {
                query += ' AND Entry_Date__c >= :arg2 AND Entry_Date__c <= :arg3 ';
            }
            else if(empData.startDate != null) {
                query += ' AND Entry_Date__c = :arg2 ';
            }
            if(empData.jobId != null) {
                query += ' AND Timesheet__r.Job__c = :arg4 ';
            }
            query += 'ORDER BY Entry_Date__c DESC ';
        return query;            
    }

    // Format date in MMMDDYYYY format
    private static String formatDate(Date d) {
        return formatDate(d, 'MMM') + ' ' + d.day() + ', ' + d.year();
    }

    // Get month name from date (MMM)
    private static String formatDate(Date d, String format) {
        if(d != null) {
            Datetime dt = DateTime.newInstance(d, Time.newInstance(0,0,0,0));
            return dt.format(format);
        }
        return null;
    }


    public class Filter {
        @AuraEnabled
        public String dateFilterType {get; set;}
        @AuraEnabled
        public Date startDate {get; set;}
        @AuraEnabled
        public Date endDate {get; set;}
        @AuraEnabled
        public String userId {get; set;}
        @AuraEnabled
        public String costCodeId {get; set;}
        @AuraEnabled
        public String jobStatus {get; set;}
    }

    public class TimesheetData {
        @AuraEnabled
        public String title;
        @AuraEnabled
        public List<TimesheetDataItem> data;

        public TimesheetData(String title, List<TimesheetDataItem> data) {
            this.title = title;
            this.data = data;
        }
    }

    public class TimesheetDataItem {
        @AuraEnabled
        public String memberName;
        @AuraEnabled
        public String memberId;
        @AuraEnabled
        public String jobName;
        @AuraEnabled
        public String jobLink;
        @AuraEnabled
        public Decimal timeLog;
        @AuraEnabled
        public String costCode;
        @AuraEnabled
        public Date startDate;
        @AuraEnabled
        public Date endDate;
        @AuraEnabled
        public String jobAutoName;
        @AuraEnabled
        public Boolean hasJobName;
        

        public TimesheetDataItem() {}

        public TimesheetDataItem setMember(String memberName, String memberId) {
            this.memberName = memberName;
            this.memberId = memberId;
            return this;
        }

        public TimesheetDataItem setJob(String jobName, String jobLink,String jobAutoName) {
            this.jobName = jobName;
            this.jobLink = jobLink;
            this.jobAutoName = jobAutoName;
            this.hasJobName = jobName == null ? false : true; 
            return this;
        }

        public TimesheetDataItem setTimeLog(Decimal timeLog) {
            this.timeLog = timeLog;
            return this;
        }

        public TimesheetDataItem setCostCode(String code) {
            this.costCode = code;
            return this;
        }
        public TimesheetDataItem setStartDate(Date start) {
            this.startDate = start;
            return this;
        }
        public TimesheetDataItem setEndDate(Date endTime) {
            this.endDate = endTime;
            return this;
        }
    }

    public class EmployeeFilter {
        @AuraEnabled
        public String employeeId {get; set;}
        @AuraEnabled
        public Date startDate {get; set;}
        @AuraEnabled
        public Date endDate {get; set;}
        @AuraEnabled
        public Id jobId {get; set;}
    }

    public class EmployeeTimeEntryData {
        @AuraEnabled
        public String employeeName;
        @AuraEnabled
        public String title; 
        @AuraEnabled
        public List<EmployeeTimeEntryDataItem> entries;

        public EmployeeTimeEntryData(String employeeName, String title, List<EmployeeTimeEntryDataItem> entries) {
            this.employeeName = employeeName;
            this.title = title;
            this.entries = entries;
        }
    }

    class EmployeeTimeEntryDataItem {
        @AuraEnabled
        public String recordLink;
        @AuraEnabled
        public String clockInTime;
        @AuraEnabled
        public String clockOutTime;
        @AuraEnabled
        public Decimal totalTime;
        @AuraEnabled
        public String jobName;
        @AuraEnabled
        public String jobLink;

        public EmployeeTimeEntryDataItem(String id,String jobName, String jobLink,String jobAutoName) {
            this.recordLink = '/' + id;
            this.jobName = jobName == NULL || jobName == '' ? jobAutoName : jobName;
            this.jobLink = '/' + jobLink;
        }

        public EmployeeTimeEntryDataItem setClockTime(Datetime clockInTime, Datetime clockOutTime) {
            this.clockInTime = clockInTime.format('hh:mm a');
            this.clockOutTime = clockOutTime.format('hh:mm a');
            return this;
        }

        public EmployeeTimeEntryDataItem setTotalClockTime(Decimal totalTime) {
            this.totalTime = totalTime;
            return this;
        }
    }
}