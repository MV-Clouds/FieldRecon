public with sharing class HomepageController {
    public List<Timesheet_Entry__c> lstTimesheet { get; set; }
    public static Id UserId = UserInfo.getUserId();

    @AuraEnabled
    public static list<jobLocationWrapper> getDefaults() {
        if(!Util.secondLevelFeatureAccess()){
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        String userId = UserInfo.getUserId();

        Date dt = System.today();
        list<jobLocationWrapper> lstALW = new List<jobLocationWrapper>();
        List<Mobilization_Member__c> memberList = new List<Mobilization_Member__c>();
        List<Mobilization__c> mobilizationList = new List<Mobilization__c>();
        String mobilizationQuery = 'SELECT Id, Start_Date__c, End_Date__c, Job__r.Street__c, Job__r.Zip_Code__c, Job__r.City__c, Job__r.State__c, Job__r.Country__c, Job__r.Geocode__longitude__s, Job__r.Geocode__latitude__s, Job__r.Job_Name__c, Job__r.Name, Job__r.Id, Job__r.Description__c';
        if(Util.thirdLevelFeatureAccess()){
            mobilizationQuery += ',  ( SELECT Id, Name, Active__c, Equipment__c,Equipment__r.Name,Mobilization__r.Job__c FROM Mobilization_Assets__r) ';
        }
        
        Job_Clock_In_Check__c timeCheck = Job_Clock_In_Check__c.getOrgDefaults();
        if(timeCheck.Can_Clock_Out_After__c){
        	mobilizationQuery += ' FROM Mobilization__c WHERE Id in ( SELECT Mobilization__c FROM Mobilization_Member__c WHERE Contact__r.User__c =:arg1 AND (DAY_ONLY(convertTimezone(Mobilization__r.Start_Date__c) ) =:arg2 OR DAY_ONLY(convertTimezone(Mobilization__r.Start_Date_With_Extra__c) ) =:arg2) )';
        }
        else
        {
        	mobilizationQuery += ' FROM Mobilization__c WHERE Id in ( SELECT Mobilization__c FROM Mobilization_Member__c WHERE Contact__r.User__c =:arg1 AND (DAY_ONLY(convertTimezone(Mobilization__r.Start_Date__c) ) =:arg2) )';          
        }
     
        mobilizationList = Lib_Security.ws().dbQuery(mobilizationQuery, new List<Object>{ userId, dt });

        Set<Id> mobIds = new Set<Id>();
        for(Mobilization__c mob : mobilizationList) {
            mobIds.add(mob.Id);
        }
         
        memberList = Lib_Security.ws()
            .dbQuery(
                Util.getQueryData(
                    'Mobilization_Member__c',
                    ', Mobilization__r.Job__c,Contact__r.User__c, Contact__r.Name'
                ) + ' WHERE Contact__r.User__c !=:arg1 AND DAY_ONLY(Mobilization__r.Start_Date__c) =:arg2  AND Mobilization__c In :arg3',
                new List<Object>{ UserId, dt, mobIds}
            );
        for (Mobilization__c fm : mobilizationList) {
            List<crewmembersWrapper> lstcrew = new List<crewmembersWrapper>();
            List<AssetsWrapperList> lstAsset = new List<AssetsWrapperList>();

            locationDetailWrapper ldw = new locationDetailWrapper(
                fm.Job__r.Street__c,
                fm.Job__r.Zip_Code__c,
                fm.Job__r.City__c,
                fm.Job__r.State__c,
                fm.Job__r.Country__c,
                fm.Job__r.Geocode__longitude__s,
                fm.Job__r.Geocode__latitude__s
            );

            for (Mobilization_Member__c ml : memberList) {
                if (fm.Job__c == ml.Mobilization__r.Job__c) {
                    lstcrew.add(new crewmembersWrapper(ml.Contact__r.Name, ml.Contact__r.User__c));
                }
            }

            if(Util.thirdLevelFeatureAccess()){
                for (Mobilization_Asset__c ast : fm.Mobilization_Assets__r) {
                    if (fm.Job__c == ast.Mobilization__r.Job__c) {
                        lstAsset.add(new AssetsWrapperList(ast.Equipment__r.Name, ast.Equipment__c));
                    }
                }
            }

            lstALW.add(
                new jobLocationWrapper(
                    'action:map',
                    fm.Job__r.Job_Name__c,
                    fm.Job__r.Job_Name__c,
                    fm.Job__r.Name,
                    fm.Job__r.Id,
                    fm.Job__r.Description__c,
                    fm.Job__r.Name,
                    fm.Start_Date__c.date(),
                    fm.Start_Date__c.format('h:mm a'),
                    fm.End_Date__c.format('h:mm a'),
                    fm.Start_Date__c.format('EEEE'),
                    ldw,
                    lstcrew,
                    lstAsset
                )
            );
        }

        return lstALW;
    }

    @AuraEnabled
    public static Map<String, Map<String, List<TimesheetEntryItemWrapper>>> getTimesheet() {
        if(!Util.secondLevelFeatureAccess()){
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        list<Mobilization__c> lstFM = new List<Mobilization__c>();
        String query = '';
        if(Util.thirdLevelFeatureAccess()){
            query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c,Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) , ' +
            ' (SELECT Id, Name, Active__c, Equipment__c FROM Mobilization_Assets__r)'
            );
        }
        else{
            query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c,Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) '
            );
        }

        query += ' a WHERE a.Id IN (SELECT Mobilization__c FROM Mobilization_Member__c WHERE  Contact__r.User__c =:arg2)';

        Set<Id> jobIds = new Set<Id>();

        for (
            Mobilization__c mob : (Mobilization__c[]) Lib_Security.ws()
                .dbQuery(query, new List<Object>{ UserId, UserId })
        ) {
            jobIds.add(mob.Job__c);
        }

        Map<String, Map<String, List<TimesheetEntryItemWrapper>>> LogMap = new Map<String, Map<String, List<TimesheetEntryItemWrapper>>>{
            system.now().addDays(1).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(2).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(3).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(4).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(5).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(6).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>(),
            system.now().addDays(7).format('EEEE') => new Map<String, List<TimesheetEntryItemWrapper>>()
        };

        String soql =
            'SELECT Id,Name,Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,' +
            'Timesheet_Entry__r.TimeSheet__r.Job__r.Name,Timesheet_Entry__r.TimeSheet__r.Total_Timesheet_Time__c,Timesheet_Entry__r.TimeSheet__r.Name,' +
            'Total_Time__c,Clock_In_Time__c,Clock_Out_Time__c,createdDate FROM Timesheet_Entry_Item__c' +
            ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c IN :arg1' +
            ' AND Timesheet_Entry__r.Entry_Date__c >= Last_N_Days:7' +
            ' AND Timesheet_Entry__r.Entry_Date__c <= TODAY' +
            ' AND Timesheet_Entry__r.Timesheet__r.Contact__r.User__c = :arg2' +
            ' WITH SECURITY_ENFORCED ORDER BY Timesheet_Entry__r.Entry_Date__c DESC';

        List<Timesheet_Entry_Item__c> lstTime = Lib_Security.ws().dbQuery(soql, new List<Object>{ jobIds, UserId });
        for (Timesheet_Entry_Item__c timesheetentryitem : lstTime) {
            TimesheetEntryItemWrapper tsEntryItemWrapper = new TimesheetEntryItemWrapper(timesheetentryitem);
            if (!LogMap.containsKey(timesheetentryitem.createdDate.format('EEEE'))) {
                Map<String, List<TimesheetEntryItemWrapper>> TimesheetMap = new Map<String, List<TimesheetEntryItemWrapper>>();
                if (
                    !TimesheetMap.containskey(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    )
                ) {
                    List<TimesheetEntryItemWrapper> lstLog = new List<TimesheetEntryItemWrapper>();
                    lstLog.add(tsEntryItemWrapper);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                } else {
                    List<TimesheetEntryItemWrapper> lstLog = TimesheetMap.get(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    );
                    lstLog.add(tsEntryItemWrapper);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                }
                LogMap.put(timesheetentryitem.createdDate.format('EEEE'), TimesheetMap);
            } else {
                Map<String, List<TimesheetEntryItemWrapper>> TimesheetMap = LogMap.get(
                    timesheetentryitem.createdDate.format('EEEE')
                );
                if (
                    !TimesheetMap.containskey(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    )
                ) {
                    List<TimesheetEntryItemWrapper> lstLog = new List<TimesheetEntryItemWrapper>();
                    lstLog.add(tsEntryItemWrapper);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                } else {
                    List<TimesheetEntryItemWrapper> lstLog = TimesheetMap.get(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    );
                    lstLog.add(tsEntryItemWrapper);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                }
                LogMap.put(timesheetentryitem.createdDate.format('EEEE'), TimesheetMap);
            }
        }
        return LogMap;
    }

    // Commented unused code
    /* @AuraEnabled
    public static Map<String, Map<String, List<Timesheet_Entry_Item__c>>> getNextTimesheet() {
        list<Mobilization__c> lstFM = new List<Mobilization__c>();
        String query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c, Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) , ' +
            ' (SELECT Id, Name, Active__c, Equipment__c FROM Mobilization_Assets__r)'
        );

        query += ' a WHERE a.Id IN (SELECT Mobilization__c FROM   Mobilization_Member__c WHERE  Contact__r.User__c =:arg2)';

        Set<Id> jobIds = new Set<Id>();

        for (
            Mobilization__c mob : (Mobilization__c[]) Lib_Security.ws()
                .dbQuery(query, new List<Object>{ UserId, UserId })
        ) {
            jobIds.add(mob.Job__c);
        }

        Map<String, Map<String, List<Timesheet_Entry_Item__c>>> LogMap = new Map<String, Map<String, List<Timesheet_Entry_Item__c>>>{
            system.now().addDays(1).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(2).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(3).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(4).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(5).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(6).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>(),
            system.now().addDays(7).format('EEEE') => new Map<String, List<Timesheet_Entry_Item__c>>()
        };

        String soql =
            'SELECT Id,Name,Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,' +
            'Timesheet_Entry__r.TimeSheet__r.Job__r.Name,Timesheet_Entry__r.TimeSheet__r.Total_Timesheet_Time__c,Timesheet_Entry__r.TimeSheet__r.Name,' +
            'Total_Time__c,Clock_In_Time__c,Clock_Out_Time__c,createdDate FROM Timesheet_Entry_Item__c' +
            ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c IN :arg1' +
            ' AND Timesheet_Entry__r.Entry_Date__c >= Last_N_Days:7' +
            ' AND Timesheet_Entry__r.Entry_Date__c <= TODAY' +
            ' AND Timesheet_Entry__r.Timesheet__r.Contact__r.User__c = :arg2' +
            ' WITH SECURITY_ENFORCED ORDER BY Timesheet_Entry__r.Entry_Date__c DESC';

        List<Timesheet_Entry_Item__c> lstTime = Lib_Security.ws().dbQuery(soql, new List<Object>{ jobIds, UserId });
        for (Timesheet_Entry_Item__c timesheetentryitem : lstTime) {
            if (!LogMap.containsKey(timesheetentryitem.createdDate.format('EEEE'))) {
                Map<String, List<Timesheet_Entry_Item__c>> TimesheetMap = new Map<String, List<Timesheet_Entry_Item__c>>();
                if (
                    !TimesheetMap.containskey(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    )
                ) {
                    List<Timesheet_Entry_Item__c> lstLog = new List<Timesheet_Entry_Item__c>();
                    lstLog.add(timesheetentryitem);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                } else {
                    List<Timesheet_Entry_Item__c> lstLog = TimesheetMap.get(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    );
                    lstLog.add(timesheetentryitem);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                }
                LogMap.put(timesheetentryitem.createdDate.format('EEEE'), TimesheetMap);
            } else {
                Map<String, List<Timesheet_Entry_Item__c>> TimesheetMap = LogMap.get(
                    timesheetentryitem.createdDate.format('EEEE')
                );
                if (
                    !TimesheetMap.containskey(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    )
                ) {
                    List<Timesheet_Entry_Item__c> lstLog = new List<Timesheet_Entry_Item__c>();
                    lstLog.add(timesheetentryitem);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                } else {
                    List<Timesheet_Entry_Item__c> lstLog = TimesheetMap.get(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c
                    );
                    lstLog.add(timesheetentryitem);
                    TimesheetMap.put(
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Name +
                        ' ' +
                        timesheetentryitem.Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c,
                        lstLog
                    );
                }
                LogMap.put(timesheetentryitem.createdDate.format('EEEE'), TimesheetMap);
            }
        }

        return LogMap;
    } */

    // Commented unused code
    // Added by Kishan
    /* @AuraEnabled
    public static list<Timesheet_Entry_Item__c> getPreviousTimesheet() {
        list<Mobilization__c> lstFM = new List<Mobilization__c>();
        String query = Util.getQueryData(
            'Mobilization__c',
            ' , (SELECT Name, Date_on_Site__c, Contact__c, Contact__r.User__c FROM ' +
            ' Mobilization_Members__r WHERE  Contact__r.User__c =:arg1) , ' +
            ' (SELECT Id, Name, Active__c, Equipment__c FROM Mobilization_Assets__r)'
        );

        query += ' a WHERE a.Id IN (SELECT Mobilization__c FROM   Mobilization_Member__c WHERE  Contact__r.User__c =:arg2)';

        Set<Id> jobIds = new Set<Id>();

        for (
            Mobilization__c mob : (Mobilization__c[]) Lib_Security.ws()
                .dbQuery(query, new List<Object>{ UserId, UserId })
        ) {
            jobIds.add(mob.Job__c);
        }

        list<Timesheet_Entry_Item__c> lstTime = new List<Timesheet_Entry_Item__c>();

        String timesheetentryitem = Util.getQueryData(
            'Timesheet_Entry_Item__c',
            ', Timesheet_Entry__r.TimeSheet__r.Job__r.Job_Name__c, ' +
            ' Timesheet_Entry__r.TimeSheet__r.Job__r.Name, Timesheet_Entry__r.TimeSheet__r.Job__c, ' +
            ' Timesheet_Entry__r.TimeSheet__r.Total_Timesheet_Time__c, Timesheet_Entry__r.TimeSheet__r.Name, ' +
            ' Timesheet_Entry__r.Entry_Date__c, Timesheet_Entry__r.Timesheet_Entry_Day__c'
        );

        timesheetentryitem += ' WHERE Timesheet_Entry__r.Timesheet__r.Job__c IN:arg1 AND Timesheet_Entry__r.Entry_Date__c >= Last_N_Days:7 AND Timesheet_Entry__r.Entry_Date__c <= TODAY AND Timesheet_Entry__r.Timesheet__r.Contact__r.User__c  =:arg2 ORDER BY Timesheet_Entry__r.Entry_Date__c DESC';

        lstTime = Lib_Security.ws().dbQuery(timesheetentryitem, new List<Object>{ jobIds, UserId });

        return lstTime;
    } */

    @AuraEnabled
    public static String getExpenses() {
        if(!Util.secondLevelFeatureAccess()){
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        String expenseQuery = 'SELECT Id, Name, Status__c,Description__c, Contact__c, Job__c, Transaction_Date__c, Payment_Type__c, Reimbursable__c, Amount__c, Acknowledge__c FROM Expense__c WHERE Contact__r.User__c = :arg1 AND Acknowledge__c = false';
        List<Expense__c> expenses = Lib_Security.ws().dbQuery(expenseQuery, new List<Object>{userId});
        List<ExpenseMsg> expenseMsgs = new List<ExpenseMsg>();
        
        for(Expense__c exp : expenses) {
            expenseMsgs.add(new ExpenseMsg(exp));
        }

        return JSON.serialize(expenseMsgs);
    }

    @AuraEnabled
    public static void archiveExpense(String expId) {
        String expenseQuery = 'SELECT Id, Acknowledge__c FROM Expense__c WHERE Contact__r.User__c = :arg1 AND Id = :arg2';
        List<Expense__c> expenses = Lib_Security.ws().dbQuery(expenseQuery, new List<Object>{userId, String.escapeSingleQuotes(expId)});

        for(Expense__c exp : expenses) {
            exp.Acknowledge__c = true;
        }
        Lib_Security.ws().dbUpdate(expenses);
    }

    @AuraEnabled
    public static List<DaysWrapper> getWeeklyData() {
        if(!Util.secondLevelFeatureAccess()){
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        Set<String> WeekDays = new Set<String>();
        Map<String, List<jobLocationWrapper>> jobLocationWrapperMap = new Map<String, List<jobLocationWrapper>>{
            system.now().addDays(1).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(2).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(3).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(4).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(5).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(6).format('EEEE') => new List<jobLocationWrapper>(),
            system.now().addDays(7).format('EEEE') => new List<jobLocationWrapper>()
        };
        String mobilizationQuery = 'SELECT Id, Start_Date__c, End_Date__c, Job__r.Street__c, Job__r.Zip_Code__c, Job__r.City__c, Job__r.State__c, Job__r.Country__c, Job__r.Geocode__longitude__s, Job__r.Geocode__latitude__s, Job__r.Job_Name__c, Job__r.Name, Job__r.Id, Job__r.Description__c';
        if(Util.thirdLevelFeatureAccess()){
            mobilizationQuery += ',  ( SELECT Id, Name, Active__c, Equipment__c,Equipment__r.Name,Mobilization__r.Job__c FROM Mobilization_Assets__r)';
        }
        mobilizationQuery += ', (SELECT Name, Date_on_Site__c, Contact__r.User__r.Name,Contact__r.User__c,Mobilization__r.Job__c FROM   Mobilization_Members__r WHERE Contact__r.User__c !=:arg1  )';
        mobilizationQuery += ' FROM Mobilization__c';
        mobilizationQuery += ' WHERE  Id in (SELECT Mobilization__c FROM   Mobilization_Member__c WHERE  Contact__r.User__c =:arg2 ';
        mobilizationQuery += ' AND Mobilization__r.Start_Date__c > TODAY ';
        mobilizationQuery += ' AND Mobilization__r.End_Date__c <= NEXT_N_DAYS:7) ORDER BY Start_Date__c ASC';
        List<Mobilization__c> mobilizationList = (List<Mobilization__c>) Lib_Security.ws()
            .dbQuery(mobilizationQuery, new List<Object>{ UserId, UserId });

        for (Mobilization__c mem : mobilizationList) {
            List<crewmembersWrapper> lstcrew = new List<crewmembersWrapper>();
            List<AssetsWrapperList> lstAsset = new List<AssetsWrapperList>();

            locationDetailWrapper oLocationWrap = new locationDetailWrapper(
                mem.Job__r.Street__c,
                mem.Job__r.Zip_Code__c,
                mem.Job__r.City__c,
                mem.Job__r.State__c,
                mem.Job__r.Country__c,
                mem.Job__r.Geocode__longitude__s,
                mem.Job__r.Geocode__latitude__s
            );

            for (Mobilization_Member__c fmem : mem.Mobilization_Members__r) {
                if (mem.Job__c == fmem.Mobilization__r.Job__c) {
                    lstcrew.add(new crewmembersWrapper(fmem.Contact__r.User__r.Name, fmem.Contact__r.User__c));
                }
            }

            if(Util.thirdLevelFeatureAccess()){
                for (Mobilization_Asset__c ast : mem.Mobilization_Assets__r)
                    if (mem.Job__c == ast.Mobilization__r.Job__c)
                        lstAsset.add(new AssetsWrapperList(ast.Equipment__r.Name, ast.Equipment__c));
            }

            List<jobLocationWrapper> lstmem = jobLocationWrapperMap.get(mem.Start_Date__c.format('EEEE'));

            lstmem.add(
                new jobLocationWrapper(
                    'action:map',
                    mem.Job__r.Job_Name__c,
                    mem.Job__r.Job_Name__c,
                    mem.Job__r.Name,
                    mem.Job__r.Id,
                    mem.Job__r.Description__c,
                    mem.Job__r.Name,
                    mem.Start_Date__c.date(),
                    mem.Start_Date__c.format('h:mm a'),
                    mem.End_Date__c.format('h:mm a'),
                    mem.Start_Date__c.format('EEEE'),
                    oLocationWrap,
                    lstcrew,
                    lstAsset
                )
            );

            jobLocationWrapperMap.put(mem.Start_Date__c.format('EEEE'), lstmem);
        }

        List<DaysWrapper> DaysWrapperList = new List<DaysWrapper>();

        for (String s : jobLocationWrapperMap.keyset()) {
            DaysWrapperList.add(new DaysWrapper(s, jobLocationWrapperMap.get(s)));
        }

        return DaysWrapperList;
    }

    public class TimesheetEntryItemWrapper {
        @AuraEnabled
        public String id;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String jobId;
        @AuraEnabled
        public String jobName;
        @AuraEnabled
        public String jobNumber;
        @AuraEnabled
        public String timesheetId;
        @AuraEnabled
        public String timesheetURL;
        @AuraEnabled
        public String timesheetName;
        @AuraEnabled
        public Decimal totalTimesheetTime;
        @AuraEnabled
        public Decimal totalTime;
        @AuraEnabled
        public Datetime clockInTime;
        @AuraEnabled
        public Datetime clockOutTime;
        @AuraEnabled
        public Datetime createdDate;
        
        public TimesheetEntryItemWrapper() {}
        public TimesheetEntryItemWrapper(Timesheet_Entry_Item__c entryItem) {
            this.id = entryItem.Id;
            this.name = entryItem.Name;
            this.jobId = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Job__r?.Id;
            this.jobName = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Job__r?.Job_Name__c;
            this.jobNumber = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Job__r?.Name;
            this.timesheetId = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Id;
            this.timesheetURL = '/' + this.timesheetId;
            this.timesheetName = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Name;
            this.totalTimesheetTime = entryItem.Timesheet_Entry__r?.TimeSheet__r?.Total_Timesheet_Time__c;
            this.totalTime = entryItem.Total_Time__c;
            this.clockInTime = entryItem.Clock_In_Time__c;
            this.clockOutTime = entryItem.Clock_Out_Time__c;
            this.createdDate = entryItem.CreatedDate;
        }
    }

    public class jobLocationWrapper {
        @AuraEnabled
        public string icon { get; set; }
        @AuraEnabled
        public string title { get; set; }
        @AuraEnabled
        public string description { get; set; }
        @AuraEnabled
        public string JobName { get; set; }
        @AuraEnabled
        public string JobNumber { get; set; }
        @AuraEnabled
        public Id JobId { get; set; }
        @AuraEnabled
        public string JobDesc { get; set; }
        @AuraEnabled
        public Date todayDate { get; set; }
        @AuraEnabled
        public String todayTime { get; set; }
        @AuraEnabled
        public String todayTime1 { get; set; }
        @AuraEnabled
        public String DayName { get; set; }
        @AuraEnabled
        public locationDetailWrapper location { get; set; }
        @AuraEnabled
        public List<crewmembersWrapper> crewWrap { get; set; }
        @AuraEnabled
        public List<AssetsWrapperList> AssetWrap { get; set; }

        public jobLocationWrapper(
            String icon,
            String title,
            String JobName,
            String JobNumber,
            Id JobId,
            String JobDesc,
            String description,
            Date todayDate,
            String todayTime,
            String todayTime1,
            String DayName,
            locationDetailWrapper location,
            List<crewmembersWrapper> crewWrap,
            List<AssetsWrapperList> AssetWrap
        ) {
            this.icon = icon;
            this.JobName = JobName;
            this.JobNumber = JobNumber;
            this.JobId = JobId;
            this.JobDesc = JobDesc;
            this.description = title + description;
            this.todayDate = todayDate;
            this.todayTime = todayTime;
            this.todayTime1 = todayTime1;
            this.DayName = DayName;
            this.location = location;
            this.crewWrap = crewWrap;
            this.AssetWrap = AssetWrap;
        }
    }

    public class locationDetailWrapper {
        @AuraEnabled
        public String Street { get; set; }
        @AuraEnabled
        public String PostalCode { get; set; }
        @AuraEnabled
        public String City { get; set; }
        @AuraEnabled
        public String State { get; set; }
        @AuraEnabled
        public String Country { get; set; }
        @AuraEnabled
        public decimal longitude { get; set; }
        @AuraEnabled
        public decimal latitude { get; set; }

        public locationDetailWrapper(
            String Street,
            String PostalCode,
            String City,
            String State,
            String Country,
            Decimal longitude,
            Decimal latitude
        ) {
            this.Street = Street;
            this.PostalCode = PostalCode;
            this.City = City;
            this.State = State;
            this.Country = Country;
            this.longitude = longitude;
            this.latitude = latitude;
        }
    }

    public class crewmembersWrapper {
        @AuraEnabled
        public string coworker { get; set; }
        @AuraEnabled
        public string coworkerId { get; set; }

        public crewmembersWrapper(String coworker, String coworkerId) {
            this.coworker = coworker;
            this.coworkerId = coworkerId;
        }
    }

    public class AssetsWrapperList {
        @AuraEnabled
        public string asset { get; set; }
        @AuraEnabled
        public string assetId { get; set; }

        public AssetsWrapperList(String asset, String assetId) {
            this.asset = asset;
            this.assetId = assetId;
        }
    }

    public class DaysWrapper {
        @AuraEnabled
        public string dayName { get; set; }
        @AuraEnabled
        public List<jobLocationWrapper> jobLocationWrapperList { get; set; }

        public DaysWrapper(String dayName, List<jobLocationWrapper> jobLocationWrapperList) {
            this.dayName = dayName;
            this.jobLocationWrapperList = jobLocationWrapperList;
        }
    }
}