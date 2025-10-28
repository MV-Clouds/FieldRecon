public with sharing class ClockInOutController {
    public static String UserId;
    
    @AuraEnabled
    public static Util.accessWrapper checkProfileAccess(String objName) {
        UserId = Util.checkAccess(objName).UserId;
        return Util.checkAccess(objName);
    }
    
    @AuraEnabled
    public static ClockInOutController.defaultWrapper getDefaults() {
        ClockInOutController.DefaultWrapper dw = new ClockInOutController.DefaultWrapper();
        
        if(Util.secondLevelFeatureAccess() == false){
            throw new HandledException('Second Level Feature Not Enabled!');
        }
        
        if(!Util.thirdLevelFeatureAccess()) {return dw;}
        
        dw.codeList = ClockInOutController.getClassificationOptions(true, true);
        
        dw.codeMap = new Map<String, List<CostCode>>();
        
        for (CostCode co : dw.codeList) {
            if (dw.codeMap.containskey(co.classificationType)) {
                dw.codeMap.get(co.classificationType).add(co);
            } else {
                dw.codeMap.put(co.classificationType, new List<CostCode>{ co });
            }
        }
        return dw;
    }
    
    @AuraEnabled
    public static List<ClockInOutController.CrewWrapper> getCrewDetails(String jobId) {
        List<CostCode> codeList = new List<CostCode>();
        if(checkProfileAccess('Cost_Code__c').ReadFlag) { 
            codeList = ClockInOutController.getClassificationOptions(false, false);
        }   
        
        DateTime dt = System.now();
        
        DateTime startDate = DateTime.newInstance(dt.year(), dt.month(), dt.day(), 0, 0, 0);
        Datetime endDate = DateTime.newInstance(dt.year(), dt.month(), dt.day(), 23, 59, 59);
        
        Set<Contact> userSet = getTeamMembers(ClockInOutController.getMobilizations(jobId, startDate, endDate));
        
        Map<String, TimeSheet> userLogEntryMap = ClockInOutController.getTimesheetMap(userSet, jobId);
        List<ClockInOutController.CrewWrapper> crewWrapperList = new List<ClockInOutController.CrewWrapper>();
        for (Contact u : userSet) {
            if (userLogEntryMap.containsKey(u.Id)) {
                crewWrapperList.add(
                    new ClockInOutController.CrewWrapper(u, userLogEntryMap.get(u.Id), codeList, jobId)
                );
            } else {
                Timesheet__c ts = new Timesheet__c();
                ts.Contact__c = u.Id;
                ts.Job__c = jobId;
                ts.Timesheet_Start_Date__c = System.today().toStartofWeek();
                ts.Timesheet_End_Date__c = System.today().toStartofWeek().addDays(6);
                
                crewWrapperList.add(new ClockInOutController.CrewWrapper(u, new TimeSheet(ts), codeList, jobId));
            }
        }
        return crewWrapperList;
    }
    
    @AuraEnabled
    public static TimeSheet updateLogEntries(
        String timesheet,
        Double latitude,
        Double longitude,
        Boolean clockIn
    ) {
        TimeSheet timesheetObj = (TimeSheet)JSON.deserialize(timesheet, TimeSheet.class);
        Timesheet__c ts = new Timesheet__c();
        if (clockIn) {
            List<wfrecon__Timesheet__c> records = clockOutUserFromDiffJob(new Set<Id>{timesheetObj.contactId},new Set<Id>{timesheetObj.jobId});
            if(records != null){
                Lib_Security.ws().dbUpdate(records);
            }                                      
            if (timesheetObj.Id != null) {
                ts.Id = timesheetObj.Id;
            } 
            if(timesheetObj.jobId != null && timesheetObj.jobId != ''){
                ts.Job__c = timesheetObj.jobId;
            }
            ts.Time_In__c = System.now();
            if(timesheetObj.costCodeId != null && timesheetObj.costCodeId != '' && checkProfileAccess('Cost_Code__c').ReadFlag)
                ts.Cost_Code__c = timesheetObj.costCodeId;
            
            ts.Contact__c = timesheetObj.contactId;
            
            ts.Timesheet_Start_Date__c = timesheetObj.startDate;
            ts.Timesheet_End_Date__c = timesheetObj.endDate;
            
            ts.Time_In_Geolocation__latitude__s = latitude;
            ts.Time_In_Geolocation__longitude__s = longitude;
            Lib_Security.ws().dbUpsert(new Timesheet__c[]{ts});
            
            Set<Contact> userSet = new Set<Contact>{ new Contact(Id = timesheetObj.contactId) };
                return getTimesheetMap(userSet, timesheetObj.jobId).get(timesheetObj.contactId);
        } else {
            ts.Id = timesheetObj.Id;
            ts.Time_Out__c = Test.isRunningTest() ? System.now().addHours(1) : System.now();
            
            ts.Time_Out_Geolocation__latitude__s = latitude;
            ts.Time_Out_Geolocation__longitude__s = longitude;
            Lib_Security.ws().dbUpdate(new Timesheet__c[]{ts});
            
            //return new TimeSheet(new Timesheet__c(Cost_Code__c = timesheetObj.costCodeId, Id = ts.Id));
            return new TimeSheet(ts);
        }
    }
    private static List<wfrecon__Timesheet__c> clockOutUserFromDiffJob(Set<Id> contactIds,Set<Id> jobIds){
        String query = 'SELECT Id, wfrecon__Contact__c, wfrecon__Job__c, wfrecon__Time_In__c, wfrecon__Time_Out__c FROM wfrecon__Timesheet__c '+
            ' WHERE wfrecon__Contact__c IN :arg1 AND wfrecon__Job__c NOT IN :arg2';
        
        List<wfrecon__Timesheet__c> timesheets = Lib_Security.ws().dbQuery(query, 
                                                                           new Object[]{contactIds,jobIds});
        List<wfrecon__Timesheet__c> timeSheetsToUpdate = new List<wfrecon__Timesheet__c>();
        if(!timesheets.isEmpty()){
            for(wfrecon__Timesheet__c tSheet : timesheets){
                if(tSheet.wfrecon__Time_Out__c == null || tSheet.wfrecon__Time_In__c > tSheet.wfrecon__Time_Out__c){
                    tSheet.wfrecon__Time_Out__c = System.now();
                    timeSheetsToUpdate.add(tSheet);
                }
            }
        }          
        return timeSheetsToUpdate;
    }
    @AuraEnabled
    public static boolean getLocationDefault(){
        try {
            Location_Needed__c defaultData = Location_Needed__c.getOrgDefaults(); 
            return defaultData.Need_Location__c;
            
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static Map<String, TimeSheet> clockInTeam(
        String crewListString,
        Double latitude,
        Double longitude,
        String jobId
    ) {
        List<ClockInOutController.CrewWrapper> crewList = new List<ClockInOutController.CrewWrapper>();
        
        crewList = (List<ClockInOutController.CrewWrapper>) JSON.deserialize(
            crewListString,
            List<ClockInOutController.CrewWrapper>.class
        );
        
        List<Timesheet__c> logToClockOut = new List<Timesheet__c>();
        List<Timesheet__c> returnList = new List<Timesheet__c>();
        
        Set<Id> jobIds = new Set<Id>();
        Set<Id> contactIds = new Set<Id>();
        for (CrewWrapper cw : crewList) {
            Boolean alreadyClockedIn = false;
            if (
                cw.isClockedIn && 
                cw.timesheet.timeIn != null &&
                (cw.timesheet.timeOut == null || cw.timesheet.timeOut < cw.timesheet.timeIn) &&
                cw.timesheet.Id != null
            ) {
                Timesheet__c le = new Timesheet__c();
                
                le.Id = cw.timesheet.Id;
                le.Time_Out__c = System.now();
                
                le.Time_Out_Geolocation__latitude__s = latitude;
                le.Time_Out_Geolocation__longitude__s = longitude;
                alreadyClockedIn = true;
                logToClockOut.add(le);
            }
            jobIds.add(cw.timesheet.jobId);
            contactIds.add(cw.timesheet.contactId);
            Timesheet__c ts = new Timesheet__c();
            if (cw.timesheet.Id != null)
                ts.Id = cw.timesheet.Id;
            else {
                ts.Timesheet_Start_Date__c = cw.timesheet.startDate;
                ts.Timesheet_End_Date__c = cw.timesheet.endDate;
            }
            ts.Contact__c = cw.timesheet.contactId;
            if (cw.timesheet.Id == null)
                ts.Job__c = cw.timesheet.jobId;
            ts.Time_In__c= alreadyClockedIn  ?  System.now().addSeconds(2) : System.now();
            ts.Cost_Code__c = ((cw.timesheet.costCodeId != '') && (cw.timesheet.costCodeId != null)) && (checkProfileAccess('Cost_Code__c').ReadFlag) ? cw.timesheet.costCodeId : null;
            
            ts.Time_In_Geolocation__latitude__s = latitude;
            ts.Time_In_Geolocation__longitude__s = longitude;
            
            returnList.add(ts);
        }
        Lib_Security.ws().dbUpdate(logToClockOut);
        Lib_Security.ws().dbUpsert(returnList);
        List<wfrecon__Timesheet__c> records = clockOutUserFromDiffJob(contactIds,jobIds);
        if(records != null){
            Lib_Security.ws().dbUpdate(records);
        } 
        return ClockInOutController.getUserLogEntryMap(returnList);
    }
    
    @AuraEnabled
    public static Map<String, TimeSheet> clockOutTeam(
        String crewListString,
        Double latitude,
        Double longitude,
        String jobId
    ) {
        List<ClockInOutController.CrewWrapper> crewList = (List<ClockInOutController.CrewWrapper>) JSON.deserialize(
            crewListString,
            List<ClockInOutController.CrewWrapper>.class
        );
        
        List<Timesheet__c> timesheetList = new List<Timesheet__c>();
        
        List<Timesheet_Entry_Item__c> logList = new List<Timesheet_Entry_Item__c>();
        List<Timesheet_Entry_Item__c> returnList = new List<Timesheet_Entry_Item__c>();
        
        for (CrewWrapper cw : crewList) {
            if (cw.isClockedIn && cw.timesheet.timeIn != null && cw.timesheet != null && cw.timesheet.Id != null) {
                Timesheet__c le = new Timesheet__c();
                
                le.Id = cw.timesheet.Id;
                le.Time_Out__c = System.now();
                le.Contact__c = cw.crewUser.Id;
                le.Time_Out_Geolocation__latitude__s = latitude;
                le.Time_Out_Geolocation__longitude__s = longitude;
                
                timesheetList.add(le);
            }
        }
        Lib_Security.ws().dbUpdate(timesheetList);
        
        return ClockInOutController.getUserLogEntryMap(timesheetList);
    }
    
    @AuraEnabled
    public static Map<String, TimeSheet> updateCostCode(
        String crewListString,
        Double latitude,
        Double longitude,
        String jobId
    ){
        Map<String, TimeSheet> clockOutMap = clockOutTeam(crewListString, latitude, longitude, jobId);
        return clockInTeam(crewListString, latitude, longitude, jobId);
    }
    
    public static List<CostCode> getClassificationOptions(Boolean isLevelOne, Boolean checkLevel) {
        String Type = 'Log Entry';
        String query =
            ' SELECT Id, ' +
            ' Name, ' +
            ' Classification_Type__c, ' +
            ' Level_Code__c, ' +
            ' Code__c, ' +
            ' Default_Cost_Code__c ' +
            ' FROM Cost_Code__c ' +
            ' WHERE Classification_Type__c =:arg1 '+
            ' ORDER BY Code__c';
        
        
        List<Cost_Code__c> coList = Lib_Security.ws().dbQuery(query, new Object[]{Type});
        List<CostCode> costCodes = new List<CostCode>(); 
        for(Cost_Code__c cc : coList){
            costCodes.add(new CostCode(cc));
        }
        //return coList.isEmpty() ? new List<Cost_Code__c>() : coList;
        return costCodes;
    }
    
    public static List<Mobilization__c> getMobilizations(String jobId, DateTime startDate, DateTime endDate) {
        String query;
        List<Mobilization__c> mobList = new List<Mobilization__c>();
        Job_Clock_In_Check__c timeCheck = Job_Clock_In_Check__c.getOrgDefaults();
        if(timeCheck.Can_Clock_Out_After__c){
            DateTime dt = System.now();
            
            DateTime startDate1 = DateTime.newInstance(dt.year(), dt.month(), dt.day(), dt.hour(), dt.minute(), dt.second());
            Datetime endDate2 = DateTime.newInstance(dt.year(), dt.month(), dt.day(), dt.hour(), dt.minute(), dt.second());
            query =
                ' SELECT Id, Name, Job__r.Job_Name__c, Job__c, Mobilization_Name__c, Start_Date__c, End_Date__c, Mobilization_Status__c, Start_Date_With_Extra__c, End_Date_With_Extra_Time__c,' +
                '        (SELECT Id, Name, Date_on_Site__c, Mobilization__c, Contact__c, Contact__r.Name, Contact__r.FirstName, Contact__r.LastName, Contact__r.User__c ' +
                '           FROM Mobilization_Members__r ' +
                '          WHERE ((Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\')  OR (Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Contact__r.Can_Log_In_Out__c = TRUE)) ' +
                '       ORDER BY Contact__r.Name) ' +
                '   FROM Mobilization__c ' +
                '  WHERE (day_only(Start_Date__c)  = :arg4 OR day_only(Start_Date__c) = :arg5 OR day_only(wfrecon__Start_Date_With_Extra__c) = : arg4) AND (day_only(End_Date__c) = :arg7 OR day_only(End_Date__c) = :arg6 OR End_Date_With_Extra_Time__c >= : arg8)' +
                '    AND Job__c =:arg3';
            mobList = Lib_Security.ws().dbQuery(query, new Object[]{startDate,endDate,jobId,startDate.date(),endDate.date()-1,endDate.date()+1,endDate.date(),startDate1});
        }
        else {
            query =
                ' SELECT Id, Name, Job__r.Job_Name__c, Job__c, Mobilization_Name__c, Start_Date__c, End_Date__c, Mobilization_Status__c, ' +
                '        (SELECT Id, Name, Date_on_Site__c, Mobilization__c, Contact__c, Contact__r.Name, Contact__r.FirstName, Contact__r.LastName, Contact__r.User__c ' +
                '           FROM Mobilization_Members__r ' +
                '          WHERE ((Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Employee_WF_Recon\')  OR (Contact__c != null AND Contact__r.RecordType.DeveloperName = \'Sub_Contractor_WF_Recon\' AND Contact__r.Can_Log_In_Out__c = TRUE)) ' +
                '       ORDER BY Contact__r.Name) ' +
                '   FROM Mobilization__c ' +
                '  WHERE (day_only(Start_Date__c)  = :arg4 OR day_only(Start_Date__c) = :arg5) AND (End_Date__c >= :arg7 OR day_only(End_Date__c) = :arg6)' +
                '    AND Job__c =:arg3';
            
            mobList = Lib_Security.ws().dbQuery(query, new Object[]{startDate,endDate,jobId,startDate.date(),endDate.date()-1,endDate.date()+1,Datetime.now()});
        }
        if(mobList.size() > 1 && !mobList.isEmpty()){
            for(Mobilization__c mob : mobList) {
                for(Mobilization_Member__c  mobMember : mob.Mobilization_Members__r) {
                    if(mobMember.Contact__r.User__c == UserInfo.getUserId()){
                        return new List<Mobilization__c>{mob};
                    }
                }                
            }
        }
        
        return mobList.isEmpty() ? new List<Mobilization__c>() : mobList;
    }
    
    public static Set<Contact> getTeamMembers(List<Mobilization__c> mobList) {
        Set<Contact> contactSet = new Set<Contact>();
        for (Mobilization__c m : mobList) {
            for (Mobilization_Member__c mt : m.Mobilization_Members__r) {
                // Check record acess for Clock In - Out
                if (Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess()) {
                    if (mt.Contact__c != null) {
                        contactSet.add(
                            new Contact(
                                Id = mt.Contact__c,
                                FirstName = mt.Contact__r.FirstName,
                                LastName = mt.Contact__r.LastName
                            )
                        );
                    }
                } else {
                    if (mt.Contact__c != null && mt.Contact__c == Util.checkAccess('Mobilization__c').ContactId) {
                        contactSet.add(
                            new Contact(
                                Id = mt.Contact__c,
                                FirstName = mt.Contact__r.FirstName,
                                LastName = mt.Contact__r.LastName
                            )
                        );
                    }
                }
            }
        }
        
        return contactSet;
    }
    
    public static Map<String, TimeSheet> getTimesheetMap(Set<Contact> userSet, String jobId) {
        Date weekStart = System.today().toStartOfWeek();
        Date weekEnd = System.today().toStartOfWeek().addDays(6);
        
        String query =
            ' SELECT Id,' +
            '        Name, ' +
            '        Time_In__c, ' +
            '        Time_Out__c, ' +
            '        Job__c, ' +
            '        Contact__c, ' +
            '        Contact__r.Name, ' +
            '        Time_In_Geolocation__latitude__s, ' +
            '        Time_In_Geolocation__longitude__s, ' +
            '        Time_Out_Geolocation__latitude__s, ' +
            '        Time_Out_Geolocation__longitude__s, ' +
            '        Timesheet_Start_Date__c, ' +
            '        Timesheet_End_Date__c, ' +
            '        CreatedDate ';
        if(checkProfileAccess('Cost_Code__c').ReadFlag){
            query = query + 
                '        ,Cost_Code__c, ' +
                '        Cost_Code__r.Code__c, ' +
                '        Cost_Code__r.Name '; 
        }
        query = query + 'FROM Timesheet__c ' +
            '  WHERE Job__c =:arg1' +
            '    AND Contact__c IN :arg2' +
            '    AND Timesheet_Start_Date__c >= :arg3' +
            '    AND Timesheet_End_Date__c  <= :arg4' +
            ' ORDER BY CreatedDate DESC';
        
        List<Timesheet__c> tsList = Lib_Security.ws().dbQuery(query, new Object[]{jobId,userSet,weekStart,weekEnd});
        return ClockInOutController.getUserLogEntryMap(tsList);
    }
    
    public static Map<String, TimeSheet> getUserLogEntryMap(List<Timesheet__c> logEntryList) {
        Map<String, TimeSheet> userLogMap = new Map<String, TimeSheet>();
        
        for (Timesheet__c l : logEntryList) {
            if (!userLogMap.containsKey(l.Contact__c))
                userLogMap.put(l.Contact__c, new TimeSheet(l));
        }
        return userLogMap;
    }
    
    public class DefaultWrapper {
        @AuraEnabled
        public List<CostCode> codeList;
        @AuraEnabled
        public List<Cost_Code__c> extendedCodeList;
        
        @AuraEnabled
        public Map<String, List<CostCode>> codeMap;
        @AuraEnabled
        public Map<String, List<Cost_Code__c>> extendedCodeMap;
        
        @AuraEnabled
        public List<CrewWrapper> cwList;
    }
    
    public class CrewWrapper {
        @AuraEnabled
        public Contact crewUser;
        @AuraEnabled
        public Boolean isClockedIn;
        @AuraEnabled
        public Timesheet timesheet;
        @AuraEnabled
        public Timesheet timesheetCurrent;
        
        @AuraEnabled
        public List<CostCode> costCodeList;
        
        public CrewWrapper(Contact u, TimeSheet log, List<CostCode> coList, String jobId) {
            this.crewUser = u;
            this.costCodeList = coList;
            
            if (log != null) {
                this.timesheet = log;
                this.isClockedIn = log.timeIn != null && (log.timeOut <= log.timeIn || log.timeOut == null) ? true : false;
                //this.isClockedIn = log.timeIn != null && log.timeOut == null ? true : false;
            } else {
                this.timesheet = new Timesheet(u , jobId);
                this.isClockedIn = false;
            }
            
            this.timesheetCurrent = this.timesheet;
        }
    }
    public class TimeSheet{
        @AuraEnabled
        public String contactId;
        @AuraEnabled
        public String costCodeId;
        @AuraEnabled
        public String jobId;
        @AuraEnabled
        public Date startDate;
        @AuraEnabled
        public Date endDate;
        @AuraEnabled
        public DateTime timeIn;
        @AuraEnabled
        public DateTime timeOut;
        @AuraEnabled
        public String Id;
        @AuraEnabled
        public Double latitude;
        @AuraEnabled
        public Double longitude;
        
        public TimeSheet(Contact con, String jobId){
            this.contactId =con.Id;
            this.Id= '';
            this.timeOut = System.now();
            this.costCodeId = '';
            this.jobId = jobId;
            this.timeIn = System.now();
            this.startDate = System.today().toStartofWeek();
            this.endDate = System.today().toStartofWeek().addDays(6);
            this.latitude = 0;
            this.longitude = 0;
        }
        public TimeSheet(Timesheet__c tSheet){
            this.Id = tSheet.Id;
            this.contactId =tSheet.Contact__c;
            this.costCodeId = checkProfileAccess('Cost_Code__c').ReadFlag ? tSheet.Cost_Code__c : null;
            this.jobId = tSheet.Job__c;
            this.timeOut = tSheet.Time_Out__c;
            this.timeIn = tSheet.Time_In__c;
            this.startDate = tSheet.Timesheet_Start_Date__c;
            this.endDate = tSheet.Timesheet_End_Date__c;
            this.latitude = tSheet.Time_In_Geolocation__latitude__s;
            this.longitude = tSheet.Time_In_Geolocation__longitude__s;
        }
    }
    public class CostCode{
        @AuraEnabled
        public String Id;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public Boolean defaultCostCode;
        @AuraEnabled
        public String code;
        @AuraEnabled
        public Double levelCode;
        @AuraEnabled
        public String classificationType;
        public CostCode(){}
        public CostCode(Cost_Code__c cc){
            this.Id = cc.Id;
            this.name = cc.Name;
            this.levelCode = cc.Level_Code__c;
            this.defaultCostCode = cc.Default_Cost_Code__c;
            this.code = cc.Code__c;
            this.classificationType = cc.Classification_Type__c;
        }
        
        
    }
}