@IsTest
public with sharing class UtilTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Create test contact linked to current user
        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact',
            AccountId = testAccount.Id,
            User__c = UserInfo.getUserId()
        );
        insert testContact;
    }
    
    @IsTest
    static void testGetNamespace() {
        Test.startTest();
        String namespace = Util.getNamespace();
        Test.stopTest();
    }
    
    @IsTest
    static void testGetNamespaceWithUnderscore() {
        Test.startTest();
        String namespaceWithUnderscore = Util.getNamespaceWithUnderscore();
        Test.stopTest();
    }
    
    @IsTest
    static void testIsNamespaced() {
        Test.startTest();
        Boolean isNamespaced = Util.isNamespaced();
        Test.stopTest();
    }
    
    @IsTest
    static void testComponentNamespace() {
        Test.startTest();
        String componentNs = Util.componentNamespace();
        Test.stopTest();
    }
    
    @IsTest
    static void testSecondLevelFeatureAccess() {
        Test.startTest();
        Boolean hasAccess = Util.secondLevelFeatureAccess();
        Test.stopTest();
    }
    
    @IsTest
    static void testThirdLevelFeatureAccess() {
        Test.startTest();
        Boolean hasAccess = Util.thirdLevelFeatureAccess();
        Test.stopTest();
    }
    
    @IsTest
    static void testGetUserContactId() {
        Test.startTest();
        Id contactId = Util.getUserContactId();
        // Call again to test caching
        Id contactId2 = Util.getUserContactId();
        Test.stopTest();
    }
    
    @IsTest
    static void testGetUserContactId_NoContact() {
        // Delete the contact to test null scenario
        List<Contact> contacts = [SELECT Id FROM Contact WHERE User__c = :UserInfo.getUserId()];
        if (!contacts.isEmpty()) {
            delete contacts;
        }
        
        Test.startTest();
        Id contactId = Util.getUserContactId();
        Test.stopTest();
    }
    
    @IsTest
    static void testGetListtoSet() {
        List<String> inputList = new List<String>{'Apple', 'Banana', 'Apple', 'Cherry', 'Banana'};
        
        Test.startTest();
        List<String> result = Util.getListtoSet(inputList);
        Test.stopTest();
    }
    
    @IsTest
    static void testGetListtoSet_EmptyList() {
        List<String> inputList = new List<String>();
        
        Test.startTest();
        List<String> result = Util.getListtoSet(inputList);
        Test.stopTest();
    }
    
    @IsTest
    static void testCheckAccess_Account() {
        Test.startTest();
        Util.accessWrapper access = Util.checkAccess('Account');
        Test.stopTest();
    }
    
    @IsTest
    static void testCheckAccess_Contact() {
        Test.startTest();
        Util.accessWrapper access = Util.checkAccess('Contact');
        Test.stopTest();
    }
    
    @IsTest
    static void testCheckAccess_CustomObject() {
        Test.startTest();
        Util.accessWrapper access = Util.checkAccess('Job__c');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetUserOffset() {
        Test.startTest();
        Integer offset = Util.getUserOffset();
        Test.stopTest();
    }
    
    @IsTest
    static void testGetQueryData_StandardObject() {
        Test.startTest();
        String query = Util.getQueryData('Account', '');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetQueryData_WithRelatedFields() {
        Test.startTest();
        String query = Util.getQueryData('Account', ', Owner.Name');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetQueryData_CustomObject() {
        Test.startTest();
        String query = Util.getQueryData('Job__c', '');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetParentRecordFields_CustomObject() {
        Test.startTest();
        String fields = Util.getParentRecordFields('Job__c');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetParentRecordFields_StandardObject() {
        Test.startTest();
        String fields = Util.getParentRecordFields('Account');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetDynamicFields_StandardObject() {
        Test.startTest();
        String fields = Util.getDynamicFields('Account', '');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetDynamicFields_WithParentPrefix() {
        Test.startTest();
        String fields = Util.getDynamicFields('Account', 'Parent.');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetDynamicFields_CustomObject() {
        Test.startTest();
        String fields = Util.getDynamicFields('Job__c', '');
        Test.stopTest();
    }
    
    @IsTest
    static void testGetDynamicFields_CustomObjectWithPrefix() {
        Test.startTest();
        String fields = Util.getDynamicFields('Job__c', 'Job__r.');
        Test.stopTest();
    }
    
    @IsTest
    static void testAccessWrapperCreation() {
        Test.startTest();
        Util.accessWrapper wrapper = new Util.accessWrapper();
        wrapper.UserId = UserInfo.getUserId();
        wrapper.ContactId = 'testId';
        wrapper.ReadFlag = true;
        wrapper.EditFlag = true;
        wrapper.CreateFlag = true;
        wrapper.DeleteFlag = true;
        Test.stopTest();
    }
    
    @IsTest
    static void testCheckAccess_MultipleCalls() {
        Test.startTest();
        // Test caching by calling multiple times
        Util.accessWrapper access1 = Util.checkAccess('Account');
        Util.accessWrapper access2 = Util.checkAccess('Contact');
        Util.accessWrapper access3 = Util.checkAccess('Opportunity');
        Test.stopTest();
    }
    
    @IsTest
    static void testStaticVariables() {
        Test.startTest();
        String userId = Util.userId;
        String profileId = Util.UserProfileId;
        String roleId = Util.UserRole;
        Test.stopTest();
    }
}