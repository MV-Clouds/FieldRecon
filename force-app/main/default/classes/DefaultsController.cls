public with sharing class DefaultsController {
    @AuraEnabled
    public static Boolean secondLevelAccess(){
        try {
            return Util.secondLevelFeatureAccess() || Util.thirdLevelFeatureAccess();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static Integer fetchCustomSettings(){
        try {
            List<Job_Default_Times__c> jobsCustomSettings = Job_Default_Times__c.getAll().values();
            return jobsCustomSettings.size();
            
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static Boolean getUserProfileData(){
        List<Object> args = new List<Object>{Userinfo.getProfileId()};
        List<Profile> currentProf = Lib_Security.ws().dbQuery(createProfileQuery(),args);
        if(currentProf.size() == 1){
            return true;
        }
        return false;
    }

    @AuraEnabled
    public static Boolean checkMetaDataAccess(){
        List<Object> args = new List<Object>{Userinfo.getProfileId()};
        List<Profile> currentProf = Lib_Security.ws().dbQuery(createMetadataQuery(),args);
        if(currentProf.size() == 1){
            return true;
        }
        List<PermissionSetAssignment> usersAssigned = Lib_Security.ws().dbQuery(createPermissionSetAssignQuery(),new List<Object>{Userinfo.getUserId()});
        if(usersAssigned.size() == 1){
            return true;
        }
        return false;
    }

    @AuraEnabled
    public static List<ColorDefaults> fetchPicklistValues(){
        try {
            //return Global_Picklist.fetchValues('Mobilization_Status');
            String picklistapiname = Util.getNamespaceWithUnderscore() +'Mobilization_Status';
            List<Mobilization_Status_Color__c> jobMobilizations = Mobilization_Status_Color__c.getAll().values();
            MetadataService.GlobalValueSet customField = getPicklistValues(picklistapiname);
            List<ColorDefaults> pickListVals = new List<ColorDefaults>();
            if(jobMobilizations.isEmpty()) {
                for(MetadataService.CustomValue objCustomValue : customField.customValue) {
                    if(objCustomValue.isActive == false) { continue; }
                    pickListVals.add(new ColorDefaults(objCustomValue.label,objCustomValue.fullName,'#000000','#FFFFFF'));
                }
            }
            else{
                Map<String,String> listApiValues = new Map<String,String>();
                Map<String,String> presentApiValues = new Map<String,String>();
                for(MetadataService.CustomValue objCustomValue : customField.customValue) {
                    if(objCustomValue.isActive == false) { continue; }
                    listApiValues.put(objCustomValue.label,objCustomValue.fullName);
                }
                for(Mobilization_Status_Color__c msc : jobMobilizations) {
                    pickListVals.add(new ColorDefaults(msc.Id,msc.Name,listApiValues.get(msc.Name),msc.Color__c,msc.Background_Color__c));
                    presentApiValues.put(msc.Name, listApiValues.get(msc.Name));
                }
                if(presentApiValues.size() == listApiValues.size()) {  return pickListVals; }
                for(String pickName : listApiValues.keySet()){
                    if(presentApiValues.containsKey(pickName)){ continue; }
                    pickListVals.add(new ColorDefaults(pickName,listApiValues.get(pickName),'#000000','#FFFFFF'));
                }
            }
            return pickListVals;
        } catch (Exception e) {
            System.debug(e.getMessage());
            System.debug(e.getStackTraceString());
            System.debug(e.getLineNumber());
            throw new AuraHandledException(e.getMessage());
        }
    }

    private static MetadataService.GlobalValueSet getPicklistValues(String pickListName) {
        MetadataService.MetadataPort service = new MetadataService.MetadataPort();  
        service.SessionHeader = new MetadataService.SessionHeader_element();
        if(Test.isRunningTest()) {
            service.SessionHeader.sessionId = UserInfo.getSessionId();
        }
        else{
            service.SessionHeader.sessionId = Page.UsersSessionId.getContent().toString();
        }
        MetadataService.GlobalValueSet customField = (MetadataService.GlobalValueSet) service.readMetadata('GlobalValueSet', new String[] { pickListName}).getRecords()[0];
        return customField;
    }

    @AuraEnabled
    public static JobDefaults fetchJobsData(){
        try {
            List<Job_Default_Times__c> jobsData = Job_Default_Times__c.getAll().values();
            //Job_Days__c timesData  = Job_Days__c.getOrgDefaults();
            if(jobsData.isEmpty()) { return new JobDefaults(); }
            return new JobDefaults(jobsData[0].Start_Time__c,jobsData[0].End_Time__c,jobsData[0].Max_allow_distance__c,jobsData[0].Include_Saturday__c,jobsData[0].Include_Sunday__c,
                                jobsData[0].Id);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updatePicklist(String newPickListValues){
        try {
            if(newPickListValues == null) {
                throw new AuraHandledException('Please provide Values for Setup');
            }
            List<ColorDefaults> wrappedObjects = (List<ColorDefaults>) JSON.deserialize(newPickListValues, List<ColorDefaults>.class);
            upsertPickListValues(wrappedObjects);
            createColorDefaults(wrappedObjects);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    public static Boolean upsertPickListValues(List<ColorDefaults> newPickListValues){
        try {
            String picklistapiname = getPickListName();
            Boolean namesUpdate = false;
            MetadataService.MetadataPort service = new MetadataService.MetadataPort();  
            service.SessionHeader = new MetadataService.SessionHeader_element();
            if(Test.isRunningTest()) {
                service.SessionHeader.sessionId = UserInfo.getSessionId();
            }
            else{
                service.SessionHeader.sessionId = Page.UsersSessionId.getContent().toString();
            }
            MetadataService.GlobalValueSet customField = getPicklistValues(picklistapiname);
            Map<String,String> pickListApiNames = new Map<String,String>();
            for(ColorDefaults cd : newPickListValues) {
            	for(MetadataService.CustomValue objCustomValue : customField.customValue){
                    if((objCustomValue.label == cd.statusName) && (cd.apiName == null) ) {
                        namesUpdate = true;
                        objCustomValue.isActive = true;
                        break;
                    }
                    else if((cd.apiName != null) && (cd.apiName == objCustomValue.fullName )){
                        objCustomValue.label = cd.statusName;
                        namesUpdate = true;
                    }
                }
                if(!namesUpdate && cd.apiName == null) {
                    MetadataService.CustomValue newValues = new MetadataService.CustomValue();
                    newValues.fullName = cd.statusName;
                    newValues.default_x = false;
                    customField.customValue.add(newValues);
                    namesUpdate = true;
                }
            }
            /*for(ColorDefaults cd : newPickListValues) {
                if(cd.apiName == null) { 
                    MetadataService.CustomValue newValues = new MetadataService.CustomValue();
                    newValues.fullName = cd.statusName;
                    newValues.default_x = false;
                    customField.customValue.add(newValues);
                    namesUpdate = true;
                    System.debug(newValues);
                    System.debug(newValues.fullName);
                }
                else  {
                    pickListApiNames.put(cd.apiName, cd.statusName);
                }
            }
            for(MetadataService.CustomValue objCustomValue : customField.customValue){
                if(!pickListApiNames.containsKey(objCustomValue.fullName)) {  continue; }
                else if(pickListApiNames.get(objCustomValue.fullName) != objCustomValue.label){
                    objCustomValue.label = pickListApiNames.get(objCustomValue.fullName);
                    namesUpdate = true;
                }
            }*/
            if(!namesUpdate) {  return true;}
            List<MetadataService.SaveResult> lstResults = service.updateMetadata( new MetadataService.Metadata[] { customField });
            for (MetadataService.SaveResult objResult : lstResults) {
                if (objResult.success) {
                    System.debug('Successfully updated');
                }
                else {
                    System.debug(objResult.errors);                     
                    if(objResult.errors.size() > 0){
                        System.debug('eror : ' + objResult.errors[0].message);
                        throw new HandledException(objResult.errors[0].message);
                    }
                }
            }
            return true;
        } catch (Exception e) {
            System.debug(e.getMessage());
            System.debug(e.getLineNumber());
            System.debug(e.getStackTraceString());
            throw new HandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Boolean setDefaults(String defaults){
        try {
            if(defaults == null) {
                throw new AuraHandledException('Please provide Default Values for Setup');
            }
            System.debug(defaults);
            JobDefaults jbDefaults = (JobDefaults)JSON.deserialize(defaults,JobDefaults.class);
            return createDefaults(jbDefaults);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static CompanyData fetchCompanyData(){
        try {
            List<Organization> orgList = Lib_Security.ws().dbQuery(createOrgQuery(),new List<Object>());
            Organization currentOrg = orgList[0];
            CompanyData cd = new CompanyData();
            cd.orgName = currentOrg.Name;
            cd.streetName = currentOrg.Street;
            cd.cityName = currentOrg.City;
            cd.stateName = currentOrg.State;
            cd.countryName = currentOrg.Country;
            cd.postalCode = currentOrg.PostalCode;
            cd.recordId = currentOrg.Id;
            return cd;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateCompanyData(String companyString){
        try{
            if(String.isEmpty(companyString)){
                throw new AuraHandledException('Empty input provided');
            }
            CompanyData cd = (CompanyData) JSON.deserialize(companyString, CompanyData.class);
            if(cd.recordId == null) { throw new AuraHandledException('Invalid record! Please contact your admin'); }
            updateOrgSettings(cd);
        }
        catch(Exception e){
            System.debug(e.getMessage());
            System.debug(e.getLineNumber());
            System.debug(e.getStackTraceString());
            throw new HandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deletePicklistValues(String valueToDelete){
        try {
            if(String.isEmpty(valueToDelete)){
                throw new HandledException('Please provide a value to delete');
            }
            ColorDefaults cd = (ColorDefaults) JSON.deserialize(valueToDelete, ColorDefaults.class);
            handleDeletePicklistValues(cd);
        } catch (Exception e) {
            System.debug(e.getLineNumber());
            System.debug(e.getStackTraceString());
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static boolean getClockInDefault(){
        try {
            Job_Clock_In_Check__c defaultData = Job_Clock_In_Check__c.getOrgDefaults(); 
            return defaultData.Can_Clock_Out_After__c;
            
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
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
    public static void updateClockInDefault(boolean updatedValue){
        try {
            Job_Clock_In_Check__c newDefault = Job_Clock_In_Check__c.getOrgDefaults();
            newDefault.Can_Clock_Out_After__c = updatedValue;
            Database.UpsertResult[] resList = Lib_Security.ws().dbUpsert(new List<Job_Clock_In_Check__c> {newDefault});

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateLocationDefault(boolean updatedValue){
        try {
            Location_Needed__c newDefault = Location_Needed__c.getOrgDefaults();
            newDefault.Need_Location__c = updatedValue;
            Database.UpsertResult[] resList = Lib_Security.ws().dbUpsert(new List<Location_Needed__c> {newDefault});

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    private static void handleDeletePicklistValues(ColorDefaults cd){
        deleteGlobalPickListValues(cd);
        if(cd.idOfRecord != null){
            deleteMobRecord(cd);
        }
    }

    private static void deleteMobRecord(ColorDefaults cd){
        wfrecon__Mobilization_Status_Color__c valToDelete = wfrecon__Mobilization_Status_Color__c.getValues(cd.statusName);
        Lib_Security.ws().dbDelete(new List<wfrecon__Mobilization_Status_Color__c> {valToDelete});
    }

    public static void deleteGlobalPickListValues(ColorDefaults valueToDelete){
        String picklistapiname = getPickListName();
        MetadataService.MetadataPort service = new MetadataService.MetadataPort();  
        service.SessionHeader = new MetadataService.SessionHeader_element();
        if(Test.isRunningTest()) {
            service.SessionHeader.sessionId = UserInfo.getSessionId();
        }
        else{
            service.SessionHeader.sessionId = Page.UsersSessionId.getContent().toString();
        }
        MetadataService.GlobalValueSet customField = getPicklistValues(picklistapiname);
        for(MetadataService.CustomValue objCustomValue : customField.customValue) {
            if(objCustomValue.fullName == valueToDelete.apiName){
                objCustomValue.isActive = false;
            }
        }
        List<MetadataService.SaveResult> lstResults = service.updateMetadata( new MetadataService.Metadata[] { customField });
        for (MetadataService.SaveResult objResult : lstResults) {
            if (objResult.success) {
                System.debug('Successfully updated');
            }
            else {
                System.debug(objResult.errors);                     
                if(objResult.errors.size() > 0){
                    System.debug('eror : ' + objResult.errors[0].message);
                    throw new DmlException(objResult.errors[0].message);
                }
            }
        }
    }

    private static void updateOrgSettings(CompanyData cd){
        String orgURL = URL.getSalesforceBaseUrl().toExternalForm();
        String apiURL = orgURL + '/services/data/v53.0/sobjects/Organization/' + cd.recordId;
        HttpRequest httpRequest = new HttpRequest();
        httpRequest.setHeader('Content-Type','application/json; charset=UTF-8'); 
        httpRequest.setMethod('PATCH');
        if(Test.isRunningTest()) {
            httpRequest.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        }
        else{
            httpRequest.setHeader('Authorization', 'Bearer ' + Page.UsersSessionId.getContent().toString());
        }
        httpRequest.setBody(JSON.serialize(createJSONBody(cd)));  
        httpRequest.setEndpoint(apiURL);
        Http http = new Http();  
        HttpResponse httpResponse = http.send(httpRequest); 
        if(httpResponse.getStatusCode() >= 400){
            throw new AuraHandledException(httpResponse.getBody());
        }
    }

    private static Map<String,String> createJSONBody(CompanyData cd) {
        Map<String,String> JSONBody = new Map<String,String>();
        JSONBody.put('Name', cd.orgName);
        JSONBody.put('City', cd.cityName);
        JSONBody.put('Street', cd.streetName);
        JSONBody.put('State', cd.stateName);
        JSONBody.put('PostalCode', cd.postalCode);
        return JSONBody;
    }

    public static Boolean createDefaults(JobDefaults defaults) {
        if(addJobData(defaults)) { return true; }
        return false;
    }

    public static Boolean addJobData(JobDefaults defaults) {
        System.debug(defaults);
        Job_Default_Times__c newDefaults = new Job_Default_Times__c(Name = 'Default Times',Start_Time__c = defaults.startTime,End_Time__c = defaults.endTime,
                                                                    Max_allow_distance__c = defaults.maxDistance,Include_Saturday__c = defaults.saturdayData
                                                                    ,Include_Sunday__c = defaults.sundayData);
        //newJobDefaults.add(newDefaults);
        if(defaults.jobId != null) {
            newDefaults.Id = defaults.jobId;
        }
        Database.UpsertResult[] resList = Lib_Security.ws().dbUpsert(new List<Job_Default_Times__c> {newDefaults});
        for(Database.UpsertResult res : resList) {
            if(!res.success) {
                //throw new AuraHandledException(res.getErrors());
                return false;
            }
        }
        return true;
    }

    public static Boolean createColorDefaults(List<ColorDefaults> colors) {
        List<Mobilization_Status_Color__c> newStatus = new List<Mobilization_Status_Color__c>();
        for(ColorDefaults clr : colors) {
            Mobilization_Status_Color__c msc =new Mobilization_Status_Color__c(Name = clr.statusName,Background_Color__c = clr.bkColor , Color__c = clr.color);
            if(clr.idOfRecord != null) {
                msc.Id = clr.idOfRecord;
            }
            newStatus.add(msc);
        }
        Database.UpsertResult[] resList = Lib_Security.ws().dbUpsert(newStatus);
        for(Database.UpsertResult res : resList) {
            if(!res.success) {
                //throw new AuraHandledException(res.getErrors());
                return false;
            }
        }
        return true;
    }

    private static String getPickListName(){
        return Util.getNamespaceWithUnderscore() +'Mobilization_Status';
    }

    private static String createProfileQuery(){
        return 'SELECT ' + 
        'Id,Name,PermissionsModifyAllData ' + 
        'FROM Profile WHERE ' +
        'Id = :arg1 AND PermissionsModifyAllData = true';
    }

    private static String createMetadataQuery(){
        return 'SELECT ' + 
        'Id,Name,PermissionsModifyMetadata ' + 
        'FROM Profile WHERE ' +
        'Id = :arg1 AND PermissionsModifyMetadata = true';
    }

    private static String createPermissionSetAssignQuery(){
        return 'SELECT ' + 
        'Id ' + 
        'FROM PermissionSetAssignment WHERE ' + 
        'AssigneeId = :arg1 AND (PermissionSet.Name = \'WF_Recon_Level_3\' OR PermissionSet.Name = \'WF_Recon_Level_2\') ';
    }
    
    private static String createOrgQuery(){
        return 'SELECT ' + 
        'Id,Name,Street,City,State,PostalCode,Country ' + 
        'FROM Organization LIMIT 1';
    }

    public class JobDefaults{
        @AuraEnabled
        public String startTime; 
        @AuraEnabled
        public String endTime; 
        @AuraEnabled
        public Decimal maxDistance;
        @AuraEnabled
        public Boolean saturdayData; 
        @AuraEnabled
        public Boolean sundayData;
        @AuraEnabled
        public Id jobId;
        public JobDefaults() {}
        public JobDefaults(String startTime,String endTime,Decimal dist,Boolean sat,Boolean sun) {
            this.startTime = startTime;
            this.endTime = endTime;
            this.maxDistance = dist;
            this.saturdayData = sat;
            this.sundayData = sun;
        } 
        public JobDefaults(String startTime,String endTime,Decimal dist,Boolean sat,Boolean sun,Id jobId) {
            this.startTime = startTime;
            this.endTime = endTime;
            this.maxDistance = dist;
            this.saturdayData = sat;
            this.sundayData = sun;
            this.jobId = jobId;
        }   
    }
    public class ColorDefaults{
        @AuraEnabled
        public String statusName; 
        @AuraEnabled
        public String bkColor; 
        @AuraEnabled
        public String color;
        @AuraEnabled
        public String apiName;
        @AuraEnabled
        public Id idOfRecord;
        public ColorDefaults() {  }
        public ColorDefaults(String name,String apiName,String fclr,String bkclr) {
            this.statusName = name;
            this.apiName = apiName;
            this.color = fclr;
            this.bkColor = bkclr;
        }
        public ColorDefaults(String idRec,String name,String apiName,String fclr,String bkclr) {
            this.idOfRecord = idRec;
            this.statusName = name;
            this.apiName = apiName;
            this.color = fclr;
            this.bkColor = bkclr;
        }
    }
    public class CompanyData{
        @AuraEnabled
        public String recordId;
        @AuraEnabled
        public String orgName;
        @AuraEnabled
        public String streetName;
        @AuraEnabled
        public String cityName;
        @AuraEnabled
        public String countryName;
        @AuraEnabled
        public String stateName;
        @AuraEnabled
        public String postalCode;
    }
}