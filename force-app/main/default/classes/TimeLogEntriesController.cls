public class TimeLogEntriesController {
    public static string TIMESHEET = 'timesheet';
    public static string TIMESHEETENTRY = 'timesheetentries';
    public static string TIMESHEETITEM = 'timesheetitmes';
    
    @AuraEnabled
    public static timelogMainWrapper getLogEntries(
        String JobId,
        String UserId,
        String Selectedtab,
        Date StartDatebegin,
        Date StartDateend,
        Date EndDatebegin,
        Date EndDateend,
        String starthourBegin,
        String pageNumber,
        String pageSize
    ) {
        Integer pSize = pageSize != null ? Integer.valueOf(pageSize) : 1;
        Integer pNumber = pageNumber != null ? Integer.valueOf(pageNumber) : 1;
        
        Integer offset = (pNumber - 1) * pSize;
        Integer recordEnd = pSize * pNumber;
        
        return Selectedtab == TIMESHEET
            ? getTimesheets(
                JobId,
                UserId,
                Selectedtab,
                StartDatebegin,
                StartDateend,
                EndDatebegin,
                EndDateend,
                starthourBegin,
                pSize,
                pNumber,
                offset,
                recordEnd
            )
            : Selectedtab == TIMESHEETENTRY
                ? getTimesheetsEntry(
                    JobId,
                    UserId,
                    Selectedtab,
                    StartDatebegin,
                    StartDateend,
                    starthourBegin,
                    pSize,
                    pNumber,
                    offset,
                    recordEnd
                )
                : getTimesheetsItem(
                    JobId,
                    UserId,
                    Selectedtab,
                    StartDatebegin,
                    StartDateend,
                    EndDatebegin,
                    EndDateend,
                    starthourBegin,
                    pSize,
                    pNumber,
                    offset,
                    recordEnd
                );
    }
    
    public static timelogMainWrapper getTimesheets(
        String JobId,
        String UserId,
        String Selectedtab,
        Date StartDatebegin,
        Date StartDateend,
        Date EndDatebegin,
        Date EndDateend,
        String starthourBegin,
        Integer pSize,
        Integer pNumber,
        Integer offset,
        Integer recordEnd
    ) {
        Decimal totalHours = String.isNotBlank(starthourBegin) && String.isNotEmpty(starthourBegin)
            ? Integer.valueOf(starthourBegin)
            : -1;
        Decimal NextHours = totalHours < 100 ? totalHours + 10 : totalHours;
        
        String totalRecord = ' SELECT COUNT() FROM Timesheet__c ';
        
        String dispalyRecord = Util.getQueryData(
            'Timesheet__c',
            ' ,Contact__r.User__r.Name, Job__r.Name '
        );
        
        String logEntries = ' WHERE Timesheet_Start_Date__c >= :arg1 AND Timesheet_Start_Date__c <= :arg2 ';
        
        logEntries += ' AND Timesheet_End_Date__c >= :arg3 AND Timesheet_End_Date__c <= :arg4 ';
        
        logEntries += String.isNotBlank(JobId) && String.isNotEmpty(JobId) ? ' AND Job__c = :arg5 ' : '';
        
        logEntries += String.isNotBlank(UserId) && String.isNotEmpty(UserId)
            ? ' AND Contact__r.User__c = :arg6 '
            : '';
        
        logEntries += totalHours >= 0 &&
            totalHours <= 100
            ? ' AND Total_Timesheet_Time__c >= :arg7 ' + ' AND Total_Timesheet_Time__c <= :arg8 '
            : '';
        
        logEntries += totalHours > 100 ? ' AND Total_Timesheet_Time__c >= :arg9' : '';
        
        Set<Id> userIdSet = new Set<Id>();
        Set<Id> JobIdSet = new Set<Id>();
        List<Timesheet__c> timesheetList = Lib_Security.ws().dbQuery(dispalyRecord + logEntries, new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours});
        for (Timesheet__c ts : timesheetList) {
            userIdSet.add(ts.Contact__r.User__c);
            JobIdSet.add(ts.Job__c);
        }
        
        timesheetList = Lib_Security.ws().dbQuery(dispalyRecord + logEntries +
                                                  ' WITH SECURITY_ENFORCED ORDER BY Timesheet_Start_Date__c DESC LIMIT :arg10 OFFSET :arg11',
                                                  new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours,pSize,offset}
                                                 );
        
        Integer totalRecords = Lib_Security.ws().dbCountQuery(totalRecord, logEntries,new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours});
        
        List<timelogWrapper> TimeLogWrapper = new List<TimeLogWrapper>();
        
        for (Timesheet__c ts : timesheetList) {
            TimeLogWrapper.add(
                new timelogWrapper(
                    ts.Contact__r.User__r.Name,
                    ts.Job__r.Name,
                    ts.Time_In__c,
                    ts.Time_Out__c,
                    ts.Total_Timesheet_Time__c,
                    ts.Timesheet_Start_Date__c,
                    ts.Timesheet_End_Date__c,
                    ts.Time_In_Geolocation__Latitude__s,
                    ts.Time_In_Geolocation__Longitude__s,
                    ts.Time_Out_Geolocation__Latitude__s,
                    ts.Time_Out_Geolocation__Longitude__s,
                    null,
                    null
                )
            );
        }
        
        return new timelogMainWrapper(
            userIdSet,
            TimeLogWrapper,
            JobIdSet,
            pSize,
            pNumber,
            offset,
            recordEnd,
            totalRecords,
            getDefaults()
        );
    }
    
    public static timelogMainWrapper getTimesheetsEntry(
        String JobId,
        String UserId,
        String Selectedtab,
        Date StartDatebegin,
        Date StartDateend,
        String starthourBegin,
        Integer pSize,
        Integer pNumber,
        Integer offset,
        Integer recordEnd
    ) {
        Decimal totalHours = String.isNotBlank(starthourBegin) && String.isNotEmpty(starthourBegin)
            ? Integer.valueOf(starthourBegin)
            : -1;
        
        Decimal NextHours = totalHours < 10 ? totalHours + 1 : totalHours;
        
        String totalRecord = ' SELECT COUNT() FROM Timesheet_Entry__c ';
        
        String dispalyRecord = Util.getQueryData(
            'Timesheet_Entry__c',
            ' ,TimeSheet__r.Contact__r.User__r.Name, ' +
            ' TimeSheet__r.Job__r.Name, TimeSheet__r.Timesheet_Start_Date__c'
        );
        
        String logEntries = ' WHERE Entry_Date__c >= :arg1 AND Entry_Date__c <= :arg2';
        
        logEntries += String.isNotBlank(JobId) && String.isNotEmpty(JobId) ? ' AND TimeSheet__r.Job__c =:arg3 ' : '';
        
        logEntries += String.isNotBlank(UserId) && String.isNotEmpty(UserId)
            ? ' AND TimeSheet__r.Contact__r.User__c =:arg4'
            : '';
        
        logEntries += totalHours >= 0 &&
            totalHours < 10
            ? ' AND Total_Clock_In_Time__c >=:arg5 ' + ' AND Total_Clock_In_Time__c <=:arg6'
            : '';
        
        logEntries += totalHours >= 10 ? ' AND Total_Clock_In_Time__c >=:arg7' : '';
        
        Set<Id> userIdSet = new Set<Id>();
        Set<Id> JobIdSet = new Set<Id>();
        
        List<Timesheet_Entry__c> timesheetList = Lib_Security.ws().dbQuery(dispalyRecord + logEntries, new Object[]{StartDatebegin,StartDateend,JobId,UserId,totalHours,NextHours,totalHours});
        for (Timesheet_Entry__c ts : timesheetList) {
            userIdSet.add(ts.TimeSheet__r.Contact__r.User__c);
            JobIdSet.add(ts.TimeSheet__r.Job__c);
        }
        
        timesheetList = Lib_Security.ws().dbQuery(
            dispalyRecord +
            logEntries +
            ' WITH SECURITY_ENFORCED ORDER BY Entry_Date__c DESC LIMIT :arg8 OFFSET :arg9',
            new Object[]{StartDatebegin,StartDateend,JobId,UserId,totalHours,NextHours,totalHours,pSize,offset}
        );
        
        Integer totalRecords = Lib_Security.ws().dbCountQuery(totalRecord, logEntries,new Object[]{StartDatebegin,StartDateend,JobId,UserId,totalHours,NextHours,totalHours});
        List<timelogWrapper> TimeLogWrapper = new List<TimeLogWrapper>();
        
        for (Timesheet_Entry__c ts : timesheetList) {
            TimeLogWrapper.add(
                new timelogWrapper(
                    ts.TimeSheet__r.Contact__r.User__r.Name,
                    ts.TimeSheet__r.Job__r.Name,
                    null,
                    null,
                    ts.Total_Clock_In_Time__c,
                    ts.Entry_Date__c,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
                )
            );
        }
        
        return new timelogMainWrapper(
            userIdSet,
            TimeLogWrapper,
            JobIdSet,
            pSize,
            pNumber,
            offset,
            recordEnd,
            totalRecords,
            getDefaults()
        );
    }
    
    public static timelogMainWrapper getTimesheetsItem(
        String JobId,
        String UserId,
        String Selectedtab,
        Date StartDatebegin,
        Date StartDateend,
        Date EndDatebegin,
        Date EndDateend,
        String starthourBegin,
        Integer pSize,
        Integer pNumber,
        Integer offset,
        Integer recordEnd
    ) {
        Decimal totalHours = String.isNotBlank(starthourBegin) && String.isNotEmpty(starthourBegin)
            ? Integer.valueOf(starthourBegin)
            : -1;
        Decimal NextHours = totalHours < 100 ? totalHours + 10 : totalHours;
        
        String totalRecord = ' SELECT COUNT() FROM Timesheet_Entry_Item__c ';
        
        String dispalyRecord = Util.getQueryData(
            'Timesheet_Entry_Item__c',
            ' ,Timesheet_Entry__r.TimeSheet__r.Contact__r.User__r.Name, ' +
            ' Timesheet_Entry__r.TimeSheet__r.Job__r.Name'
        );
        
        String logEntries = ' WHERE DAY_ONLY(Clock_In_Time__c) >= :arg1 AND DAY_ONLY(Clock_In_Time__c) <= :arg2';
        
        logEntries += ' AND DAY_ONLY(Clock_Out_Time__c) >= :arg3 AND DAY_ONLY(Clock_Out_Time__c) <= :arg4';
        
        logEntries += String.isNotBlank(JobId) && String.isNotEmpty(JobId)
            ? ' AND Timesheet_Entry__r.TimeSheet__r.Job__c =:arg5 '
            : '';
        
        logEntries += String.isNotBlank(UserId) && String.isNotEmpty(UserId)
            ? ' AND Timesheet_Entry__r.TimeSheet__r.Contact__r.User__c =:arg6'
            : '';
        
        logEntries += totalHours >= 0 &&
            totalHours < 100
            ? ' AND Total_Time__c >=:arg7 ' + ' AND Total_Time__c <=:arg8'
            : '';
        
        logEntries += totalHours > 100 ? ' AND Total_Time__c >=:arg9' : '';
        
        List<Timesheet_Entry_Item__c> timesheetList = Lib_Security.ws().dbQuery(dispalyRecord + logEntries, new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours});
        
        Set<Id> userIdSet = new Set<Id>();
        Set<Id> JobIdSet = new Set<Id>();
        
        for (Timesheet_Entry_Item__c ts : timesheetList) {
            userIdSet.add(ts.Timesheet_Entry__r.TimeSheet__r.Contact__r.User__c);
            JobIdSet.add(ts.Timesheet_Entry__r.TimeSheet__r.Job__c);
        }
        
        timesheetList = Lib_Security.ws().dbQuery(
            dispalyRecord +
            logEntries +
            ' ORDER BY Clock_In_Time__c DESC LIMIT :arg10 OFFSET :arg11 ',
            new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours,pSize,offset}
        );
        
        Integer totalRecords = Lib_Security.ws().dbCountQuery(totalRecord, logEntries,new Object[]{StartDatebegin,StartDateend,EndDatebegin,EndDateend,JobId,UserId,totalHours,NextHours,totalHours});
        List<timelogWrapper> TimeLogWrapper = new List<TimeLogWrapper>();
        
        for (Timesheet_Entry_Item__c ts : timesheetList) {
            TimeLogWrapper.add(
                new timelogWrapper(
                    ts.Timesheet_Entry__r.TimeSheet__r.Contact__r.User__r.Name,
                    ts.Timesheet_Entry__r.TimeSheet__r.Job__r.Name,
                    ts.Clock_In_Time__c,
                    ts.Clock_Out_Time__c,
                    ts.Total_Time__c,
                    date.newinstance(
                        ts.Clock_In_Time__c.year(),
                        ts.Clock_In_Time__c.month(),
                        ts.Clock_In_Time__c.day()
                    ),
                    date.newinstance(
                        ts.Clock_Out_Time__c.year(),
                        ts.Clock_Out_Time__c.month(),
                        ts.Clock_Out_Time__c.day()
                    ),
                    ts.Clock_In_Location__Latitude__s,
                    ts.Clock_In_Location__Longitude__s,
                    ts.Clock_Out_Location__Latitude__s,
                    ts.Clock_Out_Location__Longitude__s,
                    ts.Clock_In_Distance__c,
                    ts.Clock_Out_Distance__c
                )
            );
        }
        
        return new timelogMainWrapper(
            userIdSet,
            TimeLogWrapper,
            JobIdSet,
            pSize,
            pNumber,
            offset,
            recordEnd,
            totalRecords,
            getDefaults()
        );
    }
    
    public static Double getDefaults() {
        Default_Values__c DefalutValues = new Default_Values__c();
        DefalutValues = Default_Values__c.getValues('Default Max Indicator Distance');
        
        return DefalutValues != null ? DefalutValues.Max_Indicator_Distance__c : null;
    }
    
    public class timelogMainWrapper {
        @AuraEnabled
        public Set<Id> UserList { get; set; }
        @AuraEnabled
        public Set<Id> JobList { get; set; }
        @AuraEnabled
        public Integer pageSize { get; set; }
        @AuraEnabled
        public Integer pageNumber { get; set; }
        @AuraEnabled
        public Integer totalRecords { get; set; }
        @AuraEnabled
        public Integer recordStart { get; set; }
        @AuraEnabled
        public Integer recordEnd { get; set; }
        @AuraEnabled
        public Double DefaultValues { get; set; }
        
        @AuraEnabled
        public List<timelogWrapper> timelogWrapperList { get; set; }
        
        public timelogMainWrapper(
            Set<Id> UserList,
            List<timelogWrapper> timelogWrapperList,
            Set<Id> JobList,
            Integer pSize,
            Integer pNumber,
            Integer offset,
            Integer recordEnd,
            Integer totalRecords,
            Double DefaultValues
        ) {
            this.UserList = UserList;
            this.timelogWrapperList = timelogWrapperList;
            this.JobList = JobList;
            
            this.pageSize = pSize;
            this.pageNumber = pNumber;
            this.totalRecords = totalRecords;
            this.recordStart = offset + 1;
            this.recordEnd = recordEnd;
            this.DefaultValues = DefaultValues;
        }
    }
    
    public class timelogWrapper {
        @AuraEnabled
        public String UserName { get; set; }
        @AuraEnabled
        public String JobName { get; set; }
        @AuraEnabled
        public DateTime ClockInTime { get; set; }
        @AuraEnabled
        public DateTime ClockOutTime { get; set; }
        @AuraEnabled
        public Decimal TotalTime { get; set; }
        @AuraEnabled
        public Date StartDate { get; set; }
        @AuraEnabled
        public Date EndDate { get; set; }
        @AuraEnabled
        public Decimal InLatitude { get; set; }
        @AuraEnabled
        public Decimal InLongitude { get; set; }
        @AuraEnabled
        public Decimal OutLatitude { get; set; }
        @AuraEnabled
        public Decimal OutLongitude { get; set; }
        @AuraEnabled
        public Decimal ClockIndistance { get; set; }
        @AuraEnabled
        public Decimal ClockOutdistance { get; set; }
        
        public timelogWrapper(
            String UserName,
            String JobName,
            DateTime ClockInTime,
            DateTime ClockOutTime,
            Decimal TotalTime,
            Date StartDate,
            Date EndDate,
            Decimal InLatitude,
            Decimal InLongitude,
            Decimal OutLatitude,
            Decimal OutLongitude,
            Decimal ClockIndistance,
            Decimal ClockOutdistance
        ) {
            this.UserName = UserName;
            this.JobName = JobName;
            this.ClockInTime = ClockInTime;
            this.ClockOutTime = ClockOutTime;
            this.TotalTime = TotalTime;
            this.StartDate = StartDate;
            this.EndDate = EndDate;
            this.StartDate = StartDate;
            this.EndDate = EndDate;
            this.InLatitude = InLatitude;
            this.InLongitude = InLongitude;
            this.OutLatitude = OutLatitude;
            this.OutLongitude = OutLongitude;
            this.ClockIndistance = ClockIndistance;
            this.ClockOutdistance = ClockOutdistance;
        }
    }
}