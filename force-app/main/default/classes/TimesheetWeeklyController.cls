public with sharing class TimesheetWeeklyController {
    public List<Timesheet__c> TimesheetList { get; set; }
    public List<document> documentList { get; set; }
    public Map<Id, Map<Id, Map<Date, Timesheet_Entry__c>>> jbdateTimeMap { get; set; }
    public String UserId { get; set; }
    public String recordId { get; set; }
    public Decimal totaltseTime = 0;
    public Date StartDate { get; set; }
    public Decimal Totalsize { get; set; }
    public Decimal TotalUser { get; set; }
    public Date EndDate { get; set; }
    public List<String> weekDateList { get; set; }
    public List<String> weekFullDateList { get; set; }
    public List<Timesheet_Entry__c> tsEntry { get; set; }
    public Map<Id, Decimal> TotalTime { get; set; }
    public Map<Id, String> jobName { get; set; }
    public List<Decimal> totalEntryTime { get; set; }
    public Map<Id, User> UserListName { get; set; }
    public Set<String> weekList { get; set; }
    public List<User> userList { get; set; }
    public List<String> weekDaysList { get; set; }
    public List<Decimal> TotalSum { get; set; }
    public Map<Id, Map<Date, Decimal>> TotalSumMap { get; set; }
    
    public TimesheetWeeklyController() {
        documentList = Lib_Security.ws().dbQuery('SELECT Id, Name FROM document WITH SECURITY_ENFORCED ORDER BY CreatedDate DESC LIMIT 1', new Object[]{});
        UserId = ApexPages.currentPage().getParameters().get('UserId');
        recordId = ApexPages.currentPage().getParameters().get('recordId');
        StartDate = Date.valueOf(ApexPages.currentPage().getParameters().get('StartDate'));
        EndDate = Date.valueOf(ApexPages.currentPage().getParameters().get('EndDate'));
        DateTime StartDateNew = (DateTime) Date.valueOf(ApexPages.currentPage().getParameters().get('StartDate'));
        DateTime EndDateNew = (DateTime) Date.valueOf(ApexPages.currentPage().getParameters().get('EndDate'));
        totaltseTime = 0;
        jbdateTimeMap = new Map<Id, Map<Id, Map<Date, Timesheet_Entry__c>>>();
        Map<Id, List<Timesheet_Entry__c>> tsTsEntryMap = new Map<Id, List<Timesheet_Entry__c>>();
        jobName = new Map<Id, String>();
        UserListName = new Map<Id, User>();
        TotalTime = new Map<Id, Decimal>();
        tsEntry = new List<Timesheet_Entry__c>();
        TotalSumMap = new Map<Id, Map<Date, Decimal>>();
        weekList = new Set<String>();
        totalEntryTime = new List<Decimal>();
        TotalSum = new List<Decimal>();
        weekDateList = new List<String>();
        weekDaysList = new List<String>();
        weekFullDateList = new List<String>();
        for (Integer i = 0; i < 7; i++) {
            weekFullDateList.add(StartDate.addDays(i).format());
        }
        
        for (Integer i = 0; i < 7; i++) {
            weekDateList.add(StartDateNew.addDays(i).format('dd/MM'));
        }
        
        for (Integer i = 0; i < 7; i++) {
            weekDaysList.add(StartDateNew.addDays(i).format('EEEE'));
        }
        
        String timedata =
            'SELECT Contact__r.Name,Job__r.Name,Contact__r.User__c, Job__r.Job_Name__c,' +
            util.getDynamicFields('Timesheet__c', '');
        
        timedata += ' FROM  Timesheet__c WHERE Timesheet_End_Date__c <=:arg1 AND Timesheet_Start_Date__c >=:arg2 ';
        
        if (UserId != '') {
            timedata += ' AND Contact__r.User__c =:arg3 ';
        }
        if (recordId != '') {
            timedata += ' AND Job__c =:arg4 WITH SECURITY_ENFORCED';
        }
        TimesheetList = Lib_Security.ws().dbQuery(timedata,new Object[]{EndDate,StartDate,UserId,recordId});
        set<Id> usIds = new Set<Id>();
        set<Id> tsIds = new Set<Id>();
        set<Id> jbIds = new Set<Id>();
        for (Timesheet__c usdata : TimesheetList) {
            usIds.add(usdata.Contact__r.User__c);
            tsIds.add(usdata.Id);
            jbIds.add(usdata.Job__c);
            if (usdata.Job__r.Job_Name__c != null) {
                jobName.put(usdata.Job__c, usdata.Job__r.Job_Name__c);
            } else {
                jobName.put(usdata.Job__c, usdata.Job__r.Name);
            }
        }
        
        String userdata = ' SELECT Id,Name,AboutMe,Address,CompanyName,Department,MobilePhone,EmployeeNumber,SenderEmail, Email FROM User ';
        if (UserId != '') {
            userdata += ' WHERE Id =:arg1 ';
        } else {
            userdata += ' WHERE Id =:arg2 ';
        }
        userdata += ' WITH SECURITY_ENFORCED';
        userList = Lib_Security.ws().dbQuery(userdata,new Object[]{UserId,usIds});
        TotalUser = userList.size();
        
        for (User us : userList) {
            UserListName.put(us.Id, us);
        }
        
        String entryData = ' SELECT Id,TimeSheet__c,TimeSheet__r.Job__c, Timesheet__r.Contact__r.User__c,Entry_Date__c,Total_Clock_In_Time__c FROM Timesheet_Entry__c ';
        if (UserId != '') {
            entryData += ' WHERE TimeSheet__r.Contact__r.User__c =:arg1 AND TimeSheet__r.Timesheet_End_Date__c <=:arg2 AND TimeSheet__r.Timesheet_Start_Date__c >=:arg3 AND TimeSheet__r.Job__c =:arg4 WITH SECURITY_ENFORCED ORDER BY CreatedDate ASC ';
        } else {
            entryData += ' WHERE TimeSheet__r.Contact__r.User__c =:arg5 AND TimeSheet__r.Timesheet_End_Date__c <=:arg6 AND TimeSheet__r.Timesheet_Start_Date__c >=:arg7 AND  TimeSheet__r.Job__c =:arg8 WITH SECURITY_ENFORCED ORDER BY CreatedDate ASC ';
        }
        tsEntry = Lib_Security.ws().dbQuery(entryData,new Object[]{UserId,EndDate,StartDate,jbIds,usIds,EndDate,StartDate,jbIds});
        
        String tseQuery = 'SELECT Id, TimeSheet__c, TimeSheet__r.Total_Timesheet_Time__c, Entry_Date__c, Total_Clock_In_Time__c '+
            'FROM Timesheet_Entry__c WHERE TimeSheet__c = :arg1 WITH SECURITY_ENFORCED';
        
        for (Timesheet_Entry__c tse :  (Timesheet_Entry__c[])Lib_Security.ws().dbQuery(tseQuery,new Object[]{tsIds})){
            if (tsTsEntryMap.containsKey(tse.TimeSheet__c)) {
                tsTsEntryMap.get(tse.TimeSheet__c).add(tse);
            } else {
                tsTsEntryMap.put(tse.TimeSheet__c, new List<Timesheet_Entry__c>{ tse });
            }
        }
        Totalsize = TimesheetList.size();
        for (Timesheet__c ts : TimesheetList) {
            Map<Id, Map<Date, Timesheet_Entry__c>> userMap = new Map<Id, Map<Date, Timesheet_Entry__c>>();
            if (!jbdateTimeMap.containsKey(ts.Contact__r.User__c)) {
                Map<Date, Timesheet_Entry__c> tempMap = new Map<Date, Timesheet_Entry__c>{
                    StartDate => new Timesheet_Entry__c(),
                        StartDate.addDays(1) => new Timesheet_Entry__c(),
                        StartDate.addDays(2) => new Timesheet_Entry__c(),
                        StartDate.addDays(3) => new Timesheet_Entry__c(),
                        StartDate.addDays(4) => new Timesheet_Entry__c(),
                        StartDate.addDays(5) => new Timesheet_Entry__c(),
                        StartDate.addDays(6) => new Timesheet_Entry__c()
                        };
                            
                            if (!userMap.containsKey(ts.Job__c)) {
                                TotalTime.put(ts.Job__c, ts.Total_Timesheet_Time__c);
                                if (!tsTsEntryMap.containsKey(ts.Id)) {
                                    userMap.put(ts.Job__c, tempMap);
                                } else {
                                    for (Timesheet_Entry__c tse : tsTsEntryMap.get(ts.Id)) {
                                        if (tempMap.containsKey(tse.Entry_Date__c)) {
                                            tempMap.put(tse.Entry_Date__c, tse);
                                            weekList.add(tse.Entry_Date__c.format());
                                        }
                                    }
                                }
                                userMap.put(ts.Job__c, tempMap);
                            } else {
                                tempMap = userMap.get(ts.Job__c);
                                TotalTime.put(ts.Job__c, ts.Total_Timesheet_Time__c);
                                if (!tsTsEntryMap.containsKey(ts.Id)) {
                                    userMap.put(ts.Job__c, tempMap);
                                } else {
                                    for (Timesheet_Entry__c tse : tsTsEntryMap.get(ts.Id)) {
                                        if (tempMap.containsKey(tse.Entry_Date__c)) {
                                            tempMap.put(tse.Entry_Date__c, tse);
                                            weekList.add(tse.Entry_Date__c.format());
                                        }
                                    }
                                }
                                userMap.put(ts.Job__c, tempMap);
                            }
                jbdateTimeMap.put(ts.Contact__r.User__c, userMap);
            } else {
                userMap = jbdateTimeMap.get(ts.Contact__r.User__c);
                Map<Date, Timesheet_Entry__c> tempMap = new Map<Date, Timesheet_Entry__c>{
                    StartDate => new Timesheet_Entry__c(),
                        StartDate.addDays(1) => new Timesheet_Entry__c(),
                        StartDate.addDays(2) => new Timesheet_Entry__c(),
                        StartDate.addDays(3) => new Timesheet_Entry__c(),
                        StartDate.addDays(4) => new Timesheet_Entry__c(),
                        StartDate.addDays(5) => new Timesheet_Entry__c(),
                        StartDate.addDays(6) => new Timesheet_Entry__c()
                        };
                            
                            if (!userMap.containsKey(ts.Job__c)) {
                                TotalTime.put(ts.Job__c, ts.Total_Timesheet_Time__c);
                                if (!tsTsEntryMap.containsKey(ts.Id)) {
                                    userMap.put(ts.Job__c, tempMap);
                                } else {
                                    for (Timesheet_Entry__c tse : tsTsEntryMap.get(ts.Id)) {
                                        if (tempMap.containsKey(tse.Entry_Date__c)) {
                                            tempMap.put(tse.Entry_Date__c, tse);
                                            weekList.add(tse.Entry_Date__c.format());
                                        }
                                    }
                                }
                                userMap.put(ts.Job__c, tempMap);
                            } else {
                                tempMap = userMap.get(ts.Job__c);
                                TotalTime.put(ts.Job__c, ts.Total_Timesheet_Time__c);
                                if (!tsTsEntryMap.containsKey(ts.Id)) {
                                    userMap.put(ts.Job__c, tempMap);
                                } else {
                                    for (Timesheet_Entry__c tse : tsTsEntryMap.get(ts.Id)) {
                                        if (tempMap.containsKey(tse.Entry_Date__c)) {
                                            tempMap.put(tse.Entry_Date__c, tse);
                                            weekList.add(tse.Entry_Date__c.format());
                                        }
                                    }
                                }
                                userMap.put(ts.Job__c, tempMap);
                            }
                
                jbdateTimeMap.put(ts.Contact__r.User__c, userMap);
            }
        }
        
        for (User us : userList) {
            Map<Date, Decimal> SumMap = new Map<Date, Decimal>();
            if (!TotalSumMap.containsKey(us.Id)) {
                for (Integer i = 0; i < weekFullDateList.size(); i++) {
                    Decimal Sum = 0;
                    Date WeekDate = Date.parse(weekFullDateList[i]);
                    
                    for (Timesheet_Entry__c ts : tsEntry) {
                        if (us.Id == ts.Timesheet__r.Contact__r.User__c) {
                            if (WeekDate == ts.Entry_Date__c) {
                                if (Sum == 0) {
                                    Sum = Sum + ts.Total_Clock_In_Time__c;
                                } else {
                                    Sum += ts.Total_Clock_In_Time__c;
                                }
                            }
                        }
                        SumMap.put(WeekDate, Sum);
                    }
                }
                TotalSumMap.put(us.Id, SumMap);
            } else {
                SumMap = TotalSumMap.get(us.Id);
                for (Integer i = 0; i < weekFullDateList.size(); i++) {
                    Decimal Sum = 0;
                    Date WeekDate = Date.parse(weekFullDateList[i]);
                    
                    for (Timesheet_Entry__c ts : tsEntry) {
                        if (us.Id == ts.Timesheet__r.Contact__r.User__c) {
                            if (WeekDate == ts.Entry_Date__c) {
                                if (Sum == 0) {
                                    Sum = Sum + ts.Total_Clock_In_Time__c;
                                } else {
                                    Sum += ts.Total_Clock_In_Time__c;
                                }
                            }
                        }
                        SumMap.put(WeekDate, Sum);
                    }
                }
                TotalSumMap.put(us.Id, SumMap);
            }
        }
    }
}