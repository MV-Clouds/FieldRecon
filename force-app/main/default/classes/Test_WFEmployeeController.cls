@isTest
public with sharing class Test_WFEmployeeController {
    
    @TestSetup
    static void makeData(){
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User']; 
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
            .get('Customer_WF_Recon').getRecordTypeId();
        Contact testCon = new Contact(FirstName = 'Test',LastName = 'Contact-1',Email = 'testContact@testing.com',RecordTypeId = contactRecordType);
        INSERT testCon;
    }

    @isTest
    public static void testFetchProfiles(){
        Test.startTest();
            WFEmployeeController.EmployeeDefaults testRecords = WFEmployeeController.fetchProfiles();
        Test.stopTest();
    }

    @isTest
    public static void testUpdateUsers(){
        WFEmployeeController.EmployeeWrapper testObj = new WFEmployeeController.EmployeeWrapper();
        WFEmployeeController.UserLicenseWrapper testLicense = new WFEmployeeController.UserLicenseWrapper();
        WFEmployeeController.UserRecordsWrapper testRecordsValues = new WFEmployeeController.UserRecordsWrapper();
        WFEmployeeController.ContactLog testContactLog = new  WFEmployeeController.ContactLog();
        Contact con = [ SELECT Id,FirstName,LastName,Email FROM Contact ][0];
        WFEmployeeController.ContactsWrapper testContact = new WFEmployeeController.ContactsWrapper(con.Id,con.FirstName + ' ' +con.LastName);
        Profile p = [SELECT Id,Name,UserLicenseId,UserLicense.Name FROM Profile WHERE Name='Standard User'][0]; 
        testObj.contactsData = new List< WFEmployeeController.ContactsWrapper> {testContact};
        testLicense.licenseName = p.Name;
        testLicense.licenseId = p.Id;
        testObj.userLicenseData = testLicense;
        testRecordsValues.userDomain = 'testing.com';
        testRecordsValues.userTimeZone = 'GMT';
        testContactLog.canLogIn = true;
        testContactLog.onScheduler = true;
        testObj.userRecords = testRecordsValues;
        testObj.contactLogData = testContactLog;
        String str = JSON.serialize(testObj);
        Test.startTest();
            WFEmployeeController.updateUsersAndContacts(str);
        Test.stopTest();
    }

    @isTest
    public static void testWithExistingProfile(){
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'][0];
        User_License__c standardUserLic = new User_License__c(ProfileId__c = p.Id,Name = 'Standard User');
        INSERT standardUserLic;
        Test.startTest();
            WFEmployeeController.EmployeeDefaults testRecords = WFEmployeeController.fetchProfiles();
        Test.stopTest();
    }

    @isTest
    public static void updateUserProfies(){
        Profile customP = [SELECT Id FROM Profile WHERE Name='Custom: Support Profile']; 
        User u = new User(Alias = 'standt', Email='testContact@testing.com', 
            EmailEncodingKey='UTF-8', FirstName = 'Test',LastName = 'Contact-1', LanguageLocaleKey='en_US', 
            LocaleSidKey='en_US', ProfileId = customP.Id, 
            TimeZoneSidKey='America/Los_Angeles',UserName = 'testing1231798@testing.com');
        INSERT u;
        WFEmployeeController.EmployeeWrapper testObj = new WFEmployeeController.EmployeeWrapper();
        WFEmployeeController.UserLicenseWrapper testLicense = new WFEmployeeController.UserLicenseWrapper();
        WFEmployeeController.UserRecordsWrapper testRecordsValues = new WFEmployeeController.UserRecordsWrapper();
        WFEmployeeController.ContactLog testContactLog = new  WFEmployeeController.ContactLog();
        Contact con = [ SELECT Id,FirstName,LastName FROM Contact ][0];
        WFEmployeeController.ContactsWrapper testContact = new WFEmployeeController.ContactsWrapper(con.Id,con.FirstName + ' ' +con.LastName);
        Profile p = [SELECT Id,Name,UserLicenseId,UserLicense.Name FROM Profile WHERE Name='Standard User'][0]; 
        testObj.contactsData = new List< WFEmployeeController.ContactsWrapper> {testContact};
        testLicense.licenseName = p.Name;
        testLicense.licenseId = p.Id;
        testObj.userLicenseData = testLicense;
        testRecordsValues.userDomain = 'testing.com';
        testRecordsValues.userTimeZone = 'GMT';
        testObj.userRecords = testRecordsValues;
        testContactLog.canLogIn = true;
        testContactLog.onScheduler = true;
        testObj.contactLogData = testContactLog;
        String str = JSON.serialize(testObj);
        Test.startTest();
            WFEmployeeController.updateUsersAndContacts(str);
        Test.stopTest();
    }

    @isTest
    public static void testMultiSelectLookup(){
        Test.startTest();
            List<MultiSelectLookupController.SObjectQueryResult> results = MultiSelectLookupController.retrieveRecords('Contact', 'Id,Name', 'Name', 'T');
        Test.stopTest();
    }

    @isTest
    public static void testfetchContactsUsers(){
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
            .get('Employee_WF_Recon').getRecordTypeId();
        Contact con = [ SELECT Id,FirstName,LastName,RecordTypeId,Email,Is_Visible_On_Scheduler__c FROM Contact ][0];
        con.LastName = 'Contact-1blue';
        UPDATE con;
        con.RecordTypeId = contactRecordType;
        con.Is_Visible_On_Scheduler__c = true;
        UPDATE con;
        Test.startTest();
            List<WFEmployeeController.ContactUserData> contactsUsers = WFEmployeeController.fetchContactsUsers();
        Test.stopTest();
    }

    @isTest
    public static void testUpdateUsersData(){
        User u = new User(Id=UserInfo.getUserId());
        WFEmployeeController.ContactUserData cud = new WFEmployeeController.ContactUserData();
        cud.recordId = u.Id;
        cud.userTimeZone = 'America/Los_Angeles';
        
        List<WFEmployeeController.ContactUserData> listCud = new List<WFEmployeeController.ContactUserData>{cud};
        
        Test.startTest();
            WFEmployeeController.updateUsersData(JSON.serialize(listCud));
        Test.stopTest();
    }

    @isTest
    public static void testGenerateException() {
        Test.startTest();
        WFEmployeeController.generateException('Random Error');
        WFEmployeeController.generateException(Constants.LICENSE_EXCEEDED_ERROR);
        WFEmployeeController.generateException(Constants.REQ_FIELDS_MISSING);
        WFEmployeeController.generateException(Constants.FIELD_INTEGRITY);
        WFEmployeeController.generateException(Constants.NO_EMAIL_ON_CONTACTS);
        WFEmployeeController.generateException(Constants.DUPLICATE_USERNAME);
        WFEmployeeController.generateException(Constants.INVALID_EMAIL);
        WFEmployeeController.generateException(Constants.USER_OBJECT_MISSING);
        Test.stopTest();
    }

    @isTest
    public static void testNewContact(){
        Test.startTest();
        	WFEmployeeController.ContactData newCon = new WFEmployeeController.ContactData();
        	newCon.firstName = 'Testing890';
        	newCon.lastName = 'Contact 990';
        	newCon.email = 'testingcontact99029@gmail.com';
        	newCon.tel = '8001000';
        	newCon.schd = true;
        	newCon.canLogInOut = false;
			WFEmployeeController.saveEmployeeContact(JSON.serialize(newCon));
        Test.stopTest();
    }

    @isTest
    public static void testCatchException(){
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
            .get('Employee_WF_Recon').getRecordTypeId();
        Contact con = new Contact(FirstName = 'Test',LastName = 'Contact-100Red',RecordTypeId = contactRecordType,Is_Visible_On_Scheduler__c = true );
        try{
            INSERT con;
        }
        catch(Exception e) {
            String errorMsg =  e.getMessage();
            System.assertEquals(true , errorMsg.contains(Constants.MSG_NO_EMAIL_ON_CONTACTS));
        }
    }
}