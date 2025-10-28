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
        System.assert(testRecords != null);
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
        List<User> u = [ SELECT Id,Name,Username,TimeZoneSidKey FROM User WHERE Name = :testContact.label ];
        Contact testCon = [ SELECT Id,FirstName,LastName,User__c FROM Contact ][0];
        System.assert(testCon.User__c != null);
    }
    @isTest
    public static void testWithExistingProfile(){
        Profile p = [SELECT Id FROM Profile WHERE Name='Standard User'][0];
        User_License__c standardUserLic = new User_License__c(ProfileId__c = p.Id,Name = 'Standard User');
        INSERT standardUserLic;
        Test.startTest();
            WFEmployeeController.EmployeeDefaults testRecords = WFEmployeeController.fetchProfiles();
        Test.stopTest();
        System.assert(testRecords != null);
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
        List<User> recUsers = [ SELECT Id,Name,Username,TimeZoneSidKey FROM User WHERE Name = :testContact.label ];
        Contact testCon = [ SELECT Id,FirstName,LastName,User__c FROM Contact ][0];
        System.assert(testCon.User__c != null);
    }
    @isTest
    public static void testMultiSelectLookup(){
        Test.startTest();
            List<MultiSelectLookupController.SObjectQueryResult> results = MultiSelectLookupController.retrieveRecords('Contact', 'Id,Name', 'Name', 'T');
        Test.stopTest();
        System.assertEquals('Test Contact-1', results[0].recordName);
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
        System.assert(contactsUsers.size() > 0);
        System.assertEquals('Test Contact-1blue', contactsUsers[0].nameOfContact);
    }
    @isTest
    public static void testUpdateUsersData(){
        Id contactRecordType = Schema.SObjectType.Contact.getRecordTypeInfosByDeveloperName()
            .get('Employee_WF_Recon').getRecordTypeId();
        Contact con = new Contact(FirstName = 'Test',LastName = 'Contact-100Red',RecordTypeId = contactRecordType,Email = 'testcontact1red@testing.com',Is_Visible_On_Scheduler__c = true );
        INSERT con;
        List<WFEmployeeController.ContactUserData> contactsUsers = WFEmployeeController.fetchContactsUsers();
        contactsUsers[0].userTimeZone = 'Pacific/Auckland';
        Test.startTest();
        	System.runAs(new User(Id=UserInfo.getUserId())){
         		WFEmployeeController.updateUsersData(JSON.serialize(contactsUsers));   
        	}
        Test.stopTest();
        User u = [ SELECT Id,Name,TimeZoneSidKey FROM User WHERE Name = 'Test Contact-100Red' ][0];
        System.assertEquals('Pacific/Auckland', u.TimeZoneSidKey);
        
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
        System.assertEquals('Testing890', [SELECT FirstName FROM User WHERE Email = 'testingcontact99029@gmail.com'][0].FirstName);
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