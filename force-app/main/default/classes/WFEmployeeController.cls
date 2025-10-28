public with sharing class WFEmployeeController {
    @AuraEnabled
    public static EmployeeDefaults fetchProfiles(){
        try {
            List<UserLicenseWrapper> userProfiles = new List<UserLicenseWrapper>();
            Object[] arguments = new Object[]{'Salesforce','Salesforce Platform','Chatter Free'};
            List<User_License__c> customRecords = User_License__c.getall().values();
            List<Profile> listOfUserProfiles =  Lib_Security.ws().dbQuery(getUserProfileQuery(), arguments);
            for(Profile prof : listOfUserProfiles) {
                UserLicenseWrapper ulw = new UserLicenseWrapper();
                ulw.licenseId = prof.Id;
                ulw.licenseName = prof.Name;
                if(!customRecords.isEmpty() && customRecords[0]?.ProfileId__c == ulw.licenseId){
                    ulw.recordId = customRecords[0].Id;
                }
                userProfiles.add(ulw); 
            }
            UserRecordsWrapper urw = getUserFieldsDefaults();
            EmployeeDefaults ed = new EmployeeDefaults();
            ed.userLicenses = userProfiles;
            ed.userFieldsDefaults = urw;
            return ed;
        } catch (Exception e) {
            throw new HandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static void updateUsersAndContacts(String listOfContacts){
        try {
            if(String.isEmpty(listOfContacts)) {
                throw new HandledException('Please select some contacts');
            }
            EmployeeWrapper wrappedObjects = (EmployeeWrapper) JSON.deserialize(listOfContacts,EmployeeWrapper.class);
            System.debug(wrappedObjects);
            if(wrappedObjects.userLicenseData != null){
                createUserLicenseRecord(wrappedObjects.userLicenseData);
            }
            if(wrappedObjects.userRecords != null ){
                createUserRecordsFields(wrappedObjects.userRecords);
            }
            if(wrappedObjects.contactsData != null){
                updateContactsWithUsers(wrappedObjects.contactsData,wrappedObjects.contactLogData);
            }
        } catch (Exception e) {
            throw new HandledException(generateException(e.getMessage()));
        }
    }
    @AuraEnabled
    public static List<ContactUserData> fetchContactsUsers(){
        try {
            List<ContactUserData> resultsList = new List<ContactUserData>();
            List<Contact> listOfContactsWithUsers =  Lib_Security.ws().dbQuery(getContactsWithUsersQuery(), new List<Object>{});
            for(Contact con : listOfContactsWithUsers){
                ContactUserData cud = new ContactUserData();
                cud.recordId = con.User__c;
                cud.nameOfContact = con.Name;
                cud.userTimeZone = con.User__r.TimeZoneSidKey;
                cud.recordUrl = '/' + con.Id;
                resultsList.add(cud);
            }
            return resultsList;
        } catch (Exception e) {
            throw new HandledException(e.getMessage());
        }
    }
    @AuraEnabled
    public static void updateUsersData(String userData){
        try {
            if(String.isEmpty(userData)){
                throw new HandledException('Invalid data');
            }
            List<ContactUserData> updatedData = (List<ContactUserData>) JSON.deserialize(userData, List<ContactUserData>.class);
            updateUser(updatedData);
        } catch (Exception e) {
            throw new HandledException(generateException(e.getMessage()));
        }
    }
    @AuraEnabled
    public static void saveEmployeeContact(String newConData){
        try {
            if(String.isEmpty(newConData)){
                throw new HandledException('Invalid data');
            }
            ContactData cd = (ContactData) JSON.deserialize(newConData,ContactData.class);
            if(cd.prof != NULL){
                UserLicenseWrapper ulc = new UserLicenseWrapper();
                ulc.licenseId = cd.licenseId;
                ulc.licenseName = cd.licenseName;
                ulc.recordId = cd.recordId;
                createUserLicenseRecord(ulc);
                return;
            }
            Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
                      .get('Employee_WF_Recon').getRecordTypeId();
            Contact newCon = new Contact(FirstName = cd.firstName,LastName = cd.lastName,Email = cd.email,Can_Log_In_Out__c = cd.canLogInOut,Is_Visible_On_Scheduler__c = cd.schd,Phone = cd.tel,RecordTypeId = contactRecordType);
            List<Database.SaveResult> results = Lib_Security.ws().dbInsert(new List<Contact>{newCon});

        } catch (Exception e) {
            System.debug(e.getMessage());
            throw new HandledException(generateException(e.getMessage()));
        }
    }
    private static void createUserLicenseRecord(UserLicenseWrapper userLicense){
        User_License__c userRecord = new User_License__c(Name = userLicense.licenseName,ProfileId__c = userLicense.licenseId);
        if(userLicense.recordId != null) {
            userRecord.Id = userLicense.recordId;
        }
        List<Database.UpsertResult> results = Lib_Security.ws().dbUpsert(new List<User_License__c>{userRecord});
        for(Database.UpsertResult res : results) {
            if(res.isSuccess()) { continue;}
            throw new HandledException(res.getErrors()[0].getMessage());
        }
    }
    private static void updateContactsWithUsers(List<ContactsWrapper> contactsList,ContactLog userRec){
        List<Id> contactsId = new List<Id>();
        for(ContactsWrapper conWrap : contactsList) {
            contactsId.add(conWrap.value);
        }
        Object[] arguments = new Object[]{contactsId};
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
                      .get('Employee_WF_Recon').getRecordTypeId();
        List<Contact> toUpdateContacts = Lib_Security.ws().dbQuery(getContactsQuery(), arguments);
        for(Contact con : toUpdateContacts) {
            con.recordTypeId = contactRecordType;
            con.Is_Visible_On_Scheduler__c = userRec.onScheduler;
            con.Can_Log_In_Out__c = userRec.canLogIn;
        }
        List<Database.SaveResult> contactsResults = Lib_Security.ws().dbUpdate(toUpdateContacts);
        for(Integer i=0;i<contactsResults.size();i++) {
            if(!contactsResults[i].isSuccess()) {
                throw new DmlException(contactsResults[i].getErrors()[0].getMessage());
            }
        }
    }
    private static UserRecordsWrapper getUserFieldsDefaults(){
        List<Company_Settings__c> defaultUserFields = Company_Settings__c.getall().values();
        UserRecordsWrapper userFields = new UserRecordsWrapper();
        if(defaultUserFields.isEmpty()){
            userFields.userTimeZone = UserInfo.getTimeZone().getID();
        }
        else {
            userFields.userDomain = defaultUserFields[0].Domain_Name__c;
            userFields.userTimeZone = defaultUserFields[0].Time_Zone_For_User__c;
            userFields.recordId = defaultUserFields[0].Id;
        }
        return userFields;
    }
    private static void createUserRecordsFields(UserRecordsWrapper recordsValue) {
        Company_Settings__c companySettings = new Company_Settings__c(Name = 'Default User Settings',Domain_Name__c = recordsValue.userDomain,Time_Zone_For_User__c = recordsValue.userTimeZone);
        if(recordsValue.recordId != null){
            companySettings.Id = recordsValue.recordId;
        }
        List<Database.UpsertResult> results = Lib_Security.ws().dbUpsert(new List<Company_Settings__c>{companySettings});
        for(Database.UpsertResult res : results) {
            if(res.isSuccess()) { continue;}
            throw new DmlException(res.getErrors()[0].getMessage());
        }

    }
    private static void updateUser(List<ContactUserData> cud){
        List<Id> usersId = new List<Id>();
        Map<Id,ContactUserData> usersMap = new Map<Id,ContactUserData>();
        for(ContactUserData c : cud){
            usersId.add(c.recordId);
            usersMap.put(c.recordId, c);
        }
        List<User> userToUpdate =  Lib_Security.ws().dbQuery(getUserQuery(), new List<Object>{usersId});
        if(userToUpdate.isEmpty()) {
            throw new DmlException('Invalid User Id passed');
        }
        for(User u : userToUpdate){
            u.TimeZoneSidKey = usersMap.get(u.Id).userTimeZone;
        }
        Lib_Security.ws().dbUpdate(userToUpdate);
    }
    public static String generateException(String errMsg){
        if(errMsg.contains(Constants.LICENSE_EXCEEDED_ERROR) || errMsg.contains(Constants.MSG_LICENSE_EXCEEDED)){
            return Constants.MSG_LICENSE_EXCEEDED;
        }
        else if(errMsg.contains(Constants.REQ_FIELDS_MISSING) || errMsg.contains(Constants.MSG_REQ_FIELDS_MISSING)){
            return Constants.MSG_REQ_FIELDS_MISSING;
        }
        else if(errMsg.contains(Constants.FIELD_INTEGRITY) || errMsg.contains(Constants.MSG_FIELD_INTEGRITY)){
            return Constants.MSG_FIELD_INTEGRITY;
        }
        else if(errMsg.contains(Constants.NO_EMAIL_ON_CONTACTS) || errMsg.contains(Constants.MSG_NO_EMAIL_ON_CONTACTS)){
            return Constants.MSG_NO_EMAIL_ON_CONTACTS;
        }
        else if(errMsg.contains(Constants.DUPLICATE_USERNAME) || errMsg.contains(Constants.MSG_DUPLICATE_USERNAME)){
            return Constants.MSG_DUPLICATE_USERNAME;
        }
        else if(errMsg.contains(Constants.INVALID_EMAIL) || errMsg.contains(Constants.MSG_INVALID_EMAIL)){
            return Constants.MSG_INVALID_EMAIL;
        }
        else if(errMsg.contains(Constants.USER_OBJECT_MISSING) || errMsg.contains(Constants.MSG_USER_MISSING)){
            return Constants.MSG_USER_MISSING;
        }
        else{
            return errMsg;
        }
    }
    private static String getContactsWithUsersQuery(){
        return 'SELECT ' +
                'Id,Name,User__c,User__r.TimeZoneSidKey ' +
                'FROM Contact ' + 
                'WHERE User__c != NULL';
    }
    private static String getContactsQuery() {
        return 'SELECT ' +
                'Id,RecordTypeId,RecordType.DeveloperName,FirstName,LastName,Email,User__c ' +
                'FROM Contact '+
                'WHERE User__c = NULL '+
                'AND Id IN :arg1';
    }
    private static String getUserProfileQuery() {
        return 'SELECT ' + 
                'Id,Name,UserLicenseId,UserLicense.Name ' + 
                'FROM Profile ' + 
                'WHERE UserLicense.Name = :arg1 OR UserLicense.Name = :arg2 OR UserLicense.Name = :arg3 ';
    }
    private static String getUserQuery(){
        return 'SELECT ' + 
               'Id,TimeZoneSidKey ' +
               'FROM User ' +
               'WHERE Id in :arg1';
    }
    public class ContactsWrapper{
        @AuraEnabled
        public Id value;
        @AuraEnabled
        public String label;
        public ContactsWrapper(Id  recordId,String name) {
            this.value = recordId;
            this.label = name;
        }
    }
    public class EmployeeWrapper{
        @AuraEnabled
        public List<ContactsWrapper> contactsData;
        @AuraEnabled
        public UserLicenseWrapper userLicenseData;
        @AuraEnabled
        public UserRecordsWrapper userRecords;
        @AuraEnabled
        public ContactLog contactLogData;
        
    }
    public class UserLicenseWrapper{
        @AuraEnabled
        public String licenseName;
        @AuraEnabled
        public String licenseId;
        @AuraEnabled
        public Id recordId;
    }
    public class UserRecordsWrapper{
        @AuraEnabled
        public String userTimeZone;
        @AuraEnabled
        public String userDomain;
        @AuraEnabled
        public Id recordId;
    }
    public class EmployeeDefaults{
        @AuraEnabled
        public List<UserLicenseWrapper> userLicenses;
        @AuraEnabled
        public UserRecordsWrapper userFieldsDefaults;
    }
    public class ContactUserData{
        @AuraEnabled
        public Id recordId;
        @AuraEnabled
        public String nameOfContact;
        @AuraEnabled
        public String userTimeZone;
        @AuraEnabled
        public String recordUrl;
    }
    public class ContactLog{
        @AuraEnabled
        public Boolean canLogIn;
        @AuraEnabled
        public Boolean onScheduler;
    }
    public class ContactData{
        @AuraEnabled
        public String firstName;
        @AuraEnabled
        public String lastName;
        @AuraEnabled
        public String email;
        @AuraEnabled
        public String tel;
        @AuraEnabled
        public Boolean canLogInOut;
        @AuraEnabled
        public Boolean schd;
        @AuraEnabled
        public String prof;
        @AuraEnabled
        public String licenseId;
        @AuraEnabled
        public String licenseName;
        @AuraEnabled
        public Id recordId;

    }
}