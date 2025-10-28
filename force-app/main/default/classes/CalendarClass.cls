public class CalendarClass {
    public static List<Mobilization_Group__c> mobGroups{get;set;}
    public static List<Mobilization_Group__c> mobGroupsListData{get;set;}
    public String status{get;set;}
    public Mobilization__c mobilization{get;set;}
    public  String JobId{get;set;}
    public  String JobIdnew{get;set;}
    public  DateTime StartDateTime{get;set;}
    public  DateTime EndDateTime{get;set;}
    public  String StatusNew{get;set;}
    public  String startDate {get;set;}
    public  String startDateNew {get;set;}
    public  String startDateResize {get;set;}
    public  String EndDateResize {get;set;}
    public String mobId {get;set;}
    public Mobilization_Group__c mobilizationGroup{get;set;}
    
    public String DefaultStartTime {get;set;}
    
    public String StartTimeMinute {get;set;}
    public String StartTimeHour {get;set;}
    public Boolean includeSaturday {get;set;}
    public Boolean includeSunday {get;set;}
    public String EndTimeMinute {get;set;}
    public String EndTimeHour {get;set;}
    public String namespace { get; set; }
    public  String notes {get;set;}
    
    // Constructor
    public  CalendarClass(){
        
        
        setDefaultTime();
        //System.debug('--c--');
        //System.debug(notes);
        
        Calendar_Notes__c newDefault = Calendar_Notes__c.getOrgDefaults();
        if(newDefault.notes__c != null) {
            notes = newDefault.notes__c;
        }
        mobilizationGroup = new Mobilization_Group__c();
        // mobGroups =  getmobList();
        String mobGroupQuery =' SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, toLabel(Mobilization_Status__c) mobStatus, Job__c, Job__r.Job_Name__c, Job__r.Name, Job__r.Address__c '; //Concreate_Status_Color__c
        mobGroupQuery += ' FROM Mobilization_Group__c ';
        mobGroupsListData = Lib_Security.ws().dbQuery(mobGroupQuery, new Object[]{});
        mobGroups =  mobGroupsListData;
        namespace = Util.componentNamespace();
        // Status='Planning';
    }
    
    public void setDefaultTime(){
        List<Job_Default_Times__c> jobDefaultTimes = Job_Default_Times__c.getall().values();
        try{
            Decimal StartTime = Decimal.valueOf((jobDefaultTimes[0].Start_Time__c).substring(0,2));
            StartTimeMinute = String.valueOf((jobDefaultTimes[0].Start_Time__c).substring(3,5));
            
            String TimeValue = (jobDefaultTimes[0].Start_Time__c).substring(6,8);
            
            if(StartTime == 12 && TimeValue == 'AM'){
                StartTimeHour = '00';
            }else{
                StartTimeHour = (jobDefaultTimes[0].Start_Time__c).substring(0,2);
            }
            
            EndTimeHour = String.valueOf(Decimal.valueOf((jobDefaultTimes[0].End_Time__c).substring(0,2))+12);
            EndTimeMinute = String.valueOf((jobDefaultTimes[0].End_Time__c).substring(3,5));
            includeSaturday = jobDefaultTimes[0].Include_Saturday__c;
            includeSunday = jobDefaultTimes[0].Include_Sunday__c;
            
        }catch(Exception e){
            StartTimeHour = '08';
            EndTimeHour = '17';
            StartTimeMinute = '00';
            EndTimeMinute = '00';
            includeSaturday = false;
            includeSunday = false;
        }
    }
    public String sfDomain{
        get{
              if(sfDomain !=  null){return sfDomain;}
              return System.URL.getOrgDomainUrl().toExternalForm() + '/lightning/n/wfrecon__App_Setup';
        }set;
    }
    public Boolean setupComplete {
        get{
            try{
                if(mobGroups != null) {
                    for (Integer i = 0; i < mobGroups.size(); i++) {
                        if(mobGroups[i].wfrecon__Mobilization_Status__c != null){
                            String status = '';
                            status = String.valueOf(wfrecon__Mobilization_Status_Color__c.getInstance((String) mobGroups[i].get('mobStatus')).wfrecon__Background_Color__c);
                            status = String.valueOf(wfrecon__Mobilization_Status_Color__c.getInstance((String) mobGroups[i].get('mobStatus')).wfrecon__Color__c);
                        }
                    }
                }
                return true;
            }catch(Exception e){
                return false;
            }
        }set;
    }
    public Boolean secondLevelAccess {
        get{
            try {
                return Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess();
            } catch (Exception e) {
                return false;
            }
        }
    }
    public String events {
        get {
            try{
                JSONGenerator g = JSON.createGenerator(true);
                Time t = Time.newInstance(0, 0, 0, 0);
                g.writeStartArray();
                for (Integer i = 0; i < mobGroups.size(); i++) {
                    Datetime startDate = mobGroups[i].Start_Date__c;
                    Datetime endDate = mobGroups[i].End_Date__c;
                    g.writeStartObject();
                    g.writeStringField('title',mobGroups[i].Job__r.Job_Name__c + ' -  ' + mobGroups[i].Job__r.Name);
                    g.writeDateTimeField('start', updateDateFromTime(t, startDate));
                    g.writeDateTimeField('end',updateDateFromTime(t, endDate.addDays(1)));
                    g.writeStringField('timeStart', startDate.format('hh:mm a'));
                    g.writeStringField('timeEnd', endDate.format('hh:mm a'));
                    if(mobGroups[i].Job__r?.Address__c != null) {
                        g.writeStringField('jobLocation', mobGroups[i].Job__r.Address__c);
                    }
                    g.writeIdField('id',mobGroups[i].Id);
                    g.writeIdField('jobId',mobGroups[i].Job__c);
                    g.writeBooleanField('allDay', true);
                    
                    if(mobGroups[i].Mobilization_Status__c != null){
                        g.writeStringField('status',mobGroups[i].Mobilization_Status__c);
                        g.writeStringField('status',mobGroups[i].Mobilization_Status__c);
                        g.writeStringField('backgroundColor',String.valueOf(Mobilization_Status_Color__c.getInstance((String) mobGroups[i].get('mobStatus')).Background_Color__c));
                        g.writeStringField('textColor',String.valueOf(Mobilization_Status_Color__c.getInstance((String) mobGroups[i].get('mobStatus')).Color__c));
                    }
                    g.writeEndObject();
                }
                g.writeEndArray();
                return g.getAsString();
            }catch(Exception e){
                return 'Null';
            }
        }
    }
    
    public PageReference getmobList(){
        
        JobIdnew = mobilizationGroup.Job__c;
        String mobGroupQuery = ' SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, Job__c, Job__r.Name, Job__r.Job_Name__c, Job__r.Address__c,toLabel(Mobilization_Status__c) mobStatus '; //Concreate_Status_Color__c
        mobGroupQuery += ' FROM Mobilization_Group__c ';
        
        if( JobIdnew != null &&  StatusNew != null ){
            mobGroupQuery += ' WHERE   Job__c =: arg1 AND Mobilization_Status__c =: arg2 ' ;
        }
        else if(JobIdnew != null &&  StatusNew == null){
             mobGroupQuery += ' WHERE   Job__c =: arg3  ' ;
        }
        else if(JobIdnew == null &&  StatusNew != null){
             mobGroupQuery += ' WHERE   Mobilization_Status__c =: arg4 ' ;
        }
        mobGroups  =  Lib_Security.ws().dbQuery(mobGroupQuery, new Object[]{JobIdnew,StatusNew,JobIdnew,StatusNew});
        mobGroupsListData = Lib_Security.ws().dbQuery(mobGroupQuery, new Object[]{JobIdnew,StatusNew,JobIdnew,StatusNew});
        return null;
    }


     Public List<Selectoption> getselectedmobStatusfields(){
        List<SelectOption> options = new List<SelectOption>();
        Schema.DescribeFieldResult fieldResult =Mobilization_Group__c.Mobilization_Status__c.getDescribe();
        List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
        options.add(new selectOption('', '- None -'));
        for( Schema.PicklistEntry f : ple){
            options.add(new SelectOption(f.getLabel(), f.getValue()));
        }
        return options;
    }
    
    // Public List<Selectoption> getselectedmobjobfields(){
    //         List<Selectoption> JobList = new List<selectoption>();
    //         Set<Selectoption> lstnamesel2 = new Set<selectoption>();
    //         lstnamesel2.add(new selectOption('', '- None -'));
    //         for(Mobilization_Group__c mobi1 :[SELECT Id, Name, End_Date__c, Start_Date__c, Status__c, Job__c, Job__r.Name FROM Mobilization_Group__c ]){
    //             lstnamesel2.add(new selectoption(mobi1.Job__c,mobi1.Job__r.Name));
    //         }
    //         JobList.addAll(lstnamesel2);
            
    //         return JobList; 
    // }
    
    @AuraEnabled
    public static void deleteMobilizationGroup(Id recordId){
        List<Mobilization_Group__c> mobGroups =  Lib_Security.ws().dbQuery('SELECT Id FROM Mobilization_Group__c WHERE Id =: arg1', new Object[]{recordId});
        Lib_Security.ws().dbDelete(mobGroups);
    }   
    public CalendarClass(String JobId, DateTime StartDateTime, DateTime EndDateTime, String Status ){
        mobGroups=  getfilterData( JobId,  StartDateTime,  EndDateTime,  Status);
    } 
    
  
    @AuraEnabled
    public static list<Mobilization_Group__c> getAllEvents(){
        String soql = 'SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, Job__c, Job__r.Job_Name__c,toLabel(Mobilization_Status__c) mobStatus '+
                        ' FROM Mobilization_Group__c WHERE createdById=:arg1';
        return Lib_Security.ws().dbQuery(soql, new Object[]{Userinfo.getUserId()});
    }
    
    // @AuraEnabled
    public PageReference  updateRecords(){
        DateTime startDate1 = DateTime.ValueofGmt(startDate.replace('T', ' '));
        DateTime startDateNew1 = DateTime.ValueofGmt(startDateNew.replace('T', ' ')).addDays(-1);
        
        String soql = 'SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, Job__c, Job__r.Job_Name__c,toLabel(Mobilization_Status__c) mobStatus '+
                    ' FROM Mobilization_Group__c WHERE Id =: arg1';
        mobGroups = Lib_Security.ws().dbQuery(soql, new Object[]{mobId});

        if(!mobGroups.isEmpty()){
            Mobilization_Group__c mobGroup = new Mobilization_Group__c();
            Datetime startDate = mobGroups[0].Start_Date__c;
            Datetime endDate = mobGroups[0].End_Date__c;
            if(startDate != null) {
                // This will prevent resetting the time to 12:00 am
                mobGroup.Start_Date__c = updateDateFromDatetime(startDate, startDate1);
            } else {
                mobGroup.Start_Date__c = startDate1;
            }
            if(endDate != null) {
                // This will prevent resetting the time to 12:00 am
                mobGroup.End_Date__c = updateDateFromDatetime(endDate, startDateNew1);
            } else {
                mobGroup.End_Date__c = startDateNew1;
            }

            mobGroup.Id = mobGroups[0].Id;
            
            Lib_Security.ws().dbUpdate(new Mobilization_Group__c[]{mobGroup});
        }
        return null;
    }
    
    public PageReference updateNotes() {
        System.debug('---');
        System.debug(notes);
        Calendar_Notes__c newDefault = Calendar_Notes__c.getOrgDefaults();
		newDefault.notes__c = notes;
        Database.UpsertResult[] resList = Lib_Security.ws().dbUpsert(new List<Calendar_Notes__c> {newDefault});        
        return null;
    }
     public PageReference  updateRecordsNew(){
        DateTime startDateResize1 = DateTime.ValueofGmt(startDateResize.replace('T', ' '));
        DateTime EndDateResize1 = DateTime.ValueofGmt(EndDateResize.replace('T', ' ')).addDays(-1);
        String soql = 'SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, Job__c, Job__r.Job_Name__c,toLabel(Mobilization_Status__c) mobStatus '+
                    ' FROM Mobilization_Group__c WHERE Id =: arg1';
        mobGroups = Lib_Security.ws().dbQuery(soql, new Object[]{mobId});
        if(!mobGroups.isEmpty()){
            Mobilization_Group__c mobGroup = new Mobilization_Group__c();
            Datetime startDate = mobGroups[0].Start_Date__c;
            Datetime endDate = mobGroups[0].End_Date__c;

            if(startDate != null) {
                // This will prevent resetting the time to 12:00 am
                mobGroup.Start_Date__c = updateDateFromDatetime(startDate, startDateResize1);
            } else {
                mobGroup.Start_Date__c = startDateResize1;
            }
            if(endDate != null) {
                // This will prevent resetting the time to 12:00 am
                mobGroup.End_Date__c = updateDateFromDatetime(endDate, EndDateResize1);
            } else {
                mobGroup.End_Date__c = EndDateResize1;
            }

            mobGroup.Id = mobGroups[0].Id;
            
            Lib_Security.ws().dbUpdate(new Mobilization_Group__c[]{mobGroup});
        }
        return null;
    }

    // Create new instance of datetime with date from source datetime and time from target datetime
    private static Datetime updateDateFromDatetime(Datetime target, Datetime source) {
        Datetime currentDT =  DateTime.newInstance(
            source.year(),
            source.month(),
            source.day(),
            target.hour(),
            target.minute(),
            target.second()
        );
        return currentDT;
        /*Integer offset = UserInfo.getTimezone().getOffset(currentDT);
        Datetime localeCurrentDT = currentDT.addSeconds(offset/1000);
        return localeCurrentDT;*/
    }

    // Create new instance of datetime with date from source datetime and time from target time
    private static Datetime updateDateFromTime(Time target, Datetime source) {
        Datetime currentDT =  DateTime.newInstance(
            source.year(),
            source.month(),
            source.day(),
            target.hour(),
            target.minute(),
            target.second()
        );
        return currentDT;
        /*Integer offset = UserInfo.getTimezone().getOffset(currentDT);
        Datetime localeCurrentDT = currentDT.addSeconds(offset/1000);
        return localeCurrentDT;*/
    }
    
    @AuraEnabled
    public static String SaveJobSchedule(Object mgp) {
        Wrapper.MobilizationGroup mg = (Wrapper.MobilizationGroup) JSON.deserialize(JSON.serialize(mgp),Wrapper.MobilizationGroup.Class);
        Date startDate = Date.newInstance(mg.startDate.year(), mg.startDate.month(), mg.startDate.day());
        Date endDate = Date.newInstance(mg.endDate.year(), mg.endDate.month(), mg.endDate.day());
        Time shiftStart = Time.newInstance(mg.startDate.hour(), mg.startDate.minute(), 0, 0);
        Time shiftEnd = Time.newInstance(mg.endDate.hour(), mg.endDate.minute(), 0, 0);

        Mobilization_Group__c mgObj = mg.getMobilizationGroupSObject();
        mgObj.Start_Date__c = updateDateFromTime(shiftStart, mg.startDate);
        mgObj.End_Date__c = updateDateFromTime(shiftEnd, mg.endDate);
        Lib_Security.ws().dbUpsert(new Mobilization_Group__c[]{mgObj});
        return 'SUCCESS';
    }
    
    @AuraEnabled
    public static List<String> getPickListValues(String ObjName,String FieldName){
        return Util.getPickListValues(ObjName, FieldName);
    }
    
    // Returns list of picklist values.
    // @AuraEnabled
    // 
    // public static List<String> getPickList(String ObjName,String FieldName){
    //     String[] values = new String[]{};
    //     String[] types = new String[]{ObjName};
    //     Schema.DescribeSobjectResult[] results = Schema.describeSObjects(types);
        
    //     // values.add('--None--');
    //     for(Schema.DescribeSobjectResult res : results) {
    //         for (Schema.PicklistEntry entry : res.fields.getMap().get(FieldName).getDescribe().getPicklistValues()) {
    //             if (entry.isActive()) {values.add(entry.getValue());}
    //         }
    //     }
    //     return values;
    // }
    // @AuraEnabled
    // public static void filterCalenderData(String JobId, DateTime StartDateTime, DateTime EndDateTime, String Status){
        
    //     CalenderClass cc = new CalenderClass(JobId, StartDateTime, EndDateTime, Status);
    // }
    
    @AuraEnabled
    public static List<Mobilization_Group__c> getfilterData(String JobId, DateTime StartDateTime, DateTime EndDateTime, String Status){
        
        String mobGroupQuery =' SELECT Id, Name, End_Date__c, Start_Date__c, Mobilization_Status__c, toLabel(Mobilization_Status__c) mobStatusLabel, Job__c, Job__r.Job_Name__c';
        mobGroupQuery += ' FROM Mobilization_Group__c ';
        mobGroupQuery += ' WHERE  ';
        if(JobId != null && StartDateTime != null && EndDateTime != null && Status != null){
            mobGroupQuery += ' Job__c =:arg1 AND Start_Date__c >=: arg2 AND End_Date__c <=: arg3 AND Mobilization_Status__c =: arg4 ';
        }
        else if(JobId != null && StartDateTime == null && EndDateTime == null && Status != null){
             mobGroupQuery += ' Job__c =: arg5 AND Mobilization_Status__c =: arg6 ';
        }
        mobGroupsListData =  Lib_Security.ws().dbQuery(mobGroupQuery,new Object[]{JobId,StartDateTime,EndDateTime,Status,JobId,Status});
        
        return mobGroupsListData;
    } 

    /**
     * Get Mobilization Group
     * @param recordId (Id) : Id of the mobilization group record
     * @return MobilizationGroup object
     */
    @AuraEnabled
    public static Wrapper.MobilizationGroup getMobilizationGroup(Id recordId){
        String soql = 'SELECT Id, Description__c,Name, Job__c,Job__r.Job_Name__c,Job__r.Name, Include_Saturday__c, Include_Sunday__c, Start_Date__c, End_Date__c, Mobilization_Status__c,toLabel(Mobilization_Status__c) mobStatus '+
            ' FROM Mobilization_Group__c WHERE Id = :arg1 LIMIT 1';
        List<Mobilization_Group__c> mobiGroups = Lib_Security.ws().dbQuery(soql,new Object[]{recordId});
        return new Wrapper.MobilizationGroup(mobiGroups[0]);
    }   
}