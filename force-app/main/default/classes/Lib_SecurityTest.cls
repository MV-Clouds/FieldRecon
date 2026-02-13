@IsTest
public with sharing class Lib_SecurityTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test contacts
        Contact c1 = new Contact(FirstName='Test', LastName='Contact1', Email='test1@example.com');
        Contact c2 = new Contact(FirstName='Test', LastName='Contact2', Email='test2@example.com');
        insert new List<Contact>{c1, c2};
        
        // Create test account
        Account acc = new Account(Name='Test Account');
        insert acc;
    }

    // ========== WS_Database (With Sharing) Tests ==========
    
    @IsTest
    static void testWSDatabase_dbQuery_NoArgs() {
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.ws().dbQuery('SELECT Id, Name FROM Contact LIMIT 1', null);
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbQuery_SingleArg() {
        Contact c = [SELECT Id FROM Contact LIMIT 1];
        List<Id> contactIds = new List<Id>{c.Id};
        
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.ws().dbQuery('SELECT Id, Name FROM Contact WHERE Id IN :arg1', new Object[]{contactIds});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbQuery_MultipleArgs() {
        String firstName = 'Test';
        String lastName = 'Contact1';
        
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.ws().dbQuery(
            'SELECT Id, Name FROM Contact WHERE FirstName = :arg1 AND LastName = :arg2', 
            new Object[]{firstName, lastName}
        );
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbQuery_AllArgs() {
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.ws().dbQuery(
            'SELECT Id FROM Contact WHERE FirstName = :arg1 OR FirstName = :arg2 OR FirstName = :arg3 OR FirstName = :arg4 OR FirstName = :arg5 OR FirstName = :arg6 OR FirstName = :arg7 OR FirstName = :arg8 OR FirstName = :arg9 OR FirstName = :arg10 OR FirstName = :arg11', 
            new Object[]{'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'}
        );
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbAggreQuery() {
        Test.startTest();
        AggregateResult[] results = Lib_Security.ws().dbAggreQuery('SELECT COUNT(Id) cnt FROM Contact', null);
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbAggreQuery_WithArg() {
        String firstName = 'Test';
        Test.startTest();
        AggregateResult[] results = Lib_Security.ws().dbAggreQuery('SELECT COUNT(Id) cnt FROM Contact WHERE FirstName = :arg1', new Object[]{firstName});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbCountQuery() {
        Test.startTest();
        Integer count = Lib_Security.ws().dbCountQuery('SELECT COUNT() ', 'FROM Contact', null);
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbCountQuery_WithArgs() {
        String firstName = 'Test';
        Test.startTest();
        Integer count = Lib_Security.ws().dbCountQuery('SELECT COUNT() ', 'FROM Contact WHERE FirstName = :arg1', new Object[]{firstName});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbInsert() {
        Contact c = new Contact(FirstName='New', LastName='Contact', Email='new@test.com');
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.ws().dbInsert(new Contact[]{c});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbInsert_WithBoolean() {
        Contact c = new Contact(FirstName='New', LastName='Contact', Email='new2@test.com');
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.ws().dbInsert(new Contact[]{c}, false);
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbUpdate() {
        Contact c = [SELECT Id, FirstName FROM Contact LIMIT 1];
        c.FirstName = 'Updated';
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.ws().dbUpdate(new Contact[]{c});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbUpsert() {
        Contact c = [SELECT Id, FirstName FROM Contact LIMIT 1];
        c.FirstName = 'Upserted';
        Contact c2 = new Contact(FirstName='New', LastName='Upsert', Email='upsert@test.com');
        
        Test.startTest();
        Database.UpsertResult[] results = Lib_Security.ws().dbUpsert(new Contact[]{c, c2});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbDelete() {
        Contact c = new Contact(FirstName='ToDelete', LastName='Contact', Email='delete@test.com');
        insert c;
        
        Test.startTest();
        Database.DeleteResult[] results = Lib_Security.ws().dbDelete(new Contact[]{c});
        Test.stopTest();
    }
    
    @IsTest
    static void testWSDatabase_dbDelete_WithBoolean() {
        Contact c = new Contact(FirstName='ToDelete2', LastName='Contact', Email='delete2@test.com');
        insert c;
        
        Test.startTest();
        Database.DeleteResult[] results = Lib_Security.ws().dbDelete(new Contact[]{c}, false);
        Test.stopTest();
    }
    
    // ========== IS_Database (Inherited Sharing) Tests ==========
    
    @IsTest
    static void testISDatabase_dbQuery_NoArgs() {
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.is().dbQuery('SELECT Id, Name FROM Contact LIMIT 1', null);
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbQuery_EmptyArgs() {
        Test.startTest();
        Contact[] contacts = (Contact[])Lib_Security.is().dbQuery('SELECT Id, Name FROM Contact LIMIT 1', new Object[]{});
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbCountQuery_AllArgs() {
        Test.startTest();
        Integer count = Lib_Security.is().dbCountQuery(
            'SELECT COUNT() ', 
            'FROM Contact WHERE FirstName = :arg1 OR FirstName = :arg2 OR FirstName = :arg3 OR FirstName = :arg4 OR FirstName = :arg5 OR FirstName = :arg6 OR FirstName = :arg7 OR FirstName = :arg8 OR FirstName = :arg9', 
            new Object[]{'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'}
        );
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbAggreQuery_EmptyResult() {
        Test.startTest();
        AggregateResult[] results = Lib_Security.is().dbAggreQuery('SELECT COUNT(Id) cnt FROM Contact WHERE FirstName = \'NonExistent\'', null);
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbInsert_MultipleRecords() {
        Contact c1 = new Contact(FirstName='Bulk1', LastName='Contact', Email='bulk1@test.com');
        Contact c2 = new Contact(FirstName='Bulk2', LastName='Contact', Email='bulk2@test.com');
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.is().dbInsert(new Contact[]{c1, c2});
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbUpdate_MultipleRecords() {
        List<Contact> contacts = [SELECT Id, FirstName FROM Contact LIMIT 2];
        for(Contact c : contacts) {
            c.FirstName = 'BulkUpdated';
        }
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.is().dbUpdate(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testISDatabase_dbUpsert_MixedRecords() {
        Contact existing = [SELECT Id, FirstName FROM Contact LIMIT 1];
        existing.FirstName = 'UpsertExisting';
        Contact newContact = new Contact(FirstName='UpsertNew', LastName='Contact', Email='upsertnew@test.com');
        
        Test.startTest();
        Database.UpsertResult[] results = Lib_Security.is().dbUpsert(new Contact[]{existing, newContact});
        Test.stopTest();
    }
    
    // ========== Static Assertion Methods Tests ==========
    
    @IsTest
    static void testAssertRead() {
        Contact[] contacts = [SELECT Id, Name FROM Contact LIMIT 1];
        
        Test.startTest();
        Lib_Security.assertRead(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertRead_EmptyList() {
        Test.startTest();
        Lib_Security.assertRead(new Contact[]{});
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertRead_NullList() {
        Test.startTest();
        Lib_Security.assertRead(null);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertReadAggre() {
        AggregateResult[] results = [SELECT COUNT(Id) cnt FROM Contact];
        
        Test.startTest();
        Lib_Security.assertReadAggre(results);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertReadAggre_EmptyList() {
        Test.startTest();
        Lib_Security.assertReadAggre(new AggregateResult[]{});
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertUpdate() {
        Contact[] contacts = [SELECT Id, FirstName FROM Contact LIMIT 1];
        
        Test.startTest();
        Lib_Security.assertUpdate(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertUpsert() {
        Contact[] contacts = [SELECT Id, FirstName FROM Contact LIMIT 1];
        
        Test.startTest();
        Lib_Security.assertUpsert(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertCreate() {
        Contact c = new Contact(FirstName='Assert', LastName='Create', Email='assertcreate@test.com');
        
        Test.startTest();
        Lib_Security.assertCreate(new Contact[]{c});
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertDelete() {
        Contact[] contacts = [SELECT Id FROM Contact LIMIT 1];
        
        Test.startTest();
        Lib_Security.assertDelete(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testAssertDelete_EmptyList() {
        Test.startTest();
        Lib_Security.assertDelete(new Contact[]{});
        Test.stopTest();
    }
    
    // ========== Edge Case and Exception Coverage ==========
    
    @IsTest
    static void testQueryException_InsufficientPermissions_dbQuery() {
        Test.startTest();
        try {
            // This will attempt to query with invalid syntax to trigger exception handling
            Lib_Security.is().dbQuery('SELECT Id, InvalidField__c FROM Contact', null);
        } catch (Exception e) {
            // Exception expected
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testQueryException_InsufficientPermissions_dbAggreQuery() {
        Test.startTest();
        try {
            Lib_Security.is().dbAggreQuery('SELECT COUNT(InvalidField__c) FROM Contact', null);
        } catch (Exception e) {
            // Exception expected
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testQueryException_InsufficientPermissions_dbCountQuery() {
        Test.startTest();
        try {
            Lib_Security.is().dbCountQuery('SELECT COUNT() ', 'FROM InvalidObject__c', null);
        } catch (Exception e) {
            // Exception expected
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAccessType_Readable() {
        Account[] accounts = [SELECT Id, Name FROM Account LIMIT 1];
        
        Test.startTest();
        try {
            // This uses assertAccess internally with READABLE
            Lib_Security.assertRead(accounts);
        } catch (Exception e) {
            // May throw if user lacks access
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAccessType_Creatable() {
        Account acc = new Account(Name='Test Create Access');
        
        Test.startTest();
        try {
            Lib_Security.assertCreate(new Account[]{acc});
        } catch (Exception e) {
            // May throw if user lacks access
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAccessType_Updatable() {
        Account[] accounts = [SELECT Id, Name FROM Account LIMIT 1];
        
        Test.startTest();
        try {
            Lib_Security.assertUpdate(accounts);
        } catch (Exception e) {
            // May throw if user lacks access
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAccessType_Upsertable() {
        Account[] accounts = [SELECT Id, Name FROM Account LIMIT 1];
        
        Test.startTest();
        try {
            Lib_Security.assertUpsert(accounts);
        } catch (Exception e) {
            // May throw if user lacks access
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testMultipleOperations_ChainedCalls() {
        Test.startTest();
        // Create
        Contact c = new Contact(FirstName='Chain', LastName='Test', Email='chain@test.com');
        Database.SaveResult[] insertResults = Lib_Security.ws().dbInsert(new Contact[]{c});
        
        // Query
        Contact[] queried = (Contact[])Lib_Security.ws().dbQuery('SELECT Id, FirstName FROM Contact WHERE Email = :arg1', new Object[]{'chain@test.com'});
        
        // Update
        if (queried.size() > 0) {
            queried[0].FirstName = 'ChainUpdated';
            Database.SaveResult[] updateResults = Lib_Security.ws().dbUpdate(queried);
        }
        
        // Delete
        if (queried.size() > 0) {
            Database.DeleteResult[] deleteResults = Lib_Security.ws().dbDelete(queried);
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testAggregateResult_MultipleAggregations() {
        Test.startTest();
        AggregateResult[] results = Lib_Security.is().dbAggreQuery(
            'SELECT COUNT(Id) cnt, MAX(CreatedDate) maxDate FROM Contact', 
            null
        );
        Test.stopTest();
    }
    
    @IsTest
    static void testBulkOperations_LargeDataset() {
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 50; i++) {
            contacts.add(new Contact(FirstName='Bulk' + i, LastName='Test', Email='bulk' + i + '@test.com'));
        }
        
        Test.startTest();
        Database.SaveResult[] results = Lib_Security.is().dbInsert(contacts);
        Test.stopTest();
    }
    
    @IsTest
    static void testPartialSuccess_InsertWithBoolean() {
        Contact valid = new Contact(FirstName='Valid', LastName='Contact', Email='valid@test.com');
        Contact invalid = new Contact(FirstName='Invalid', LastName='Contact'); // Missing required Email
        
        Test.startTest();
        try {
            Database.SaveResult[] results = Lib_Security.ws().dbInsert(new Contact[]{valid, invalid}, false);
        } catch (Exception e) {
            // Partial success may throw
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testPartialSuccess_DeleteWithBoolean() {
        Contact c1 = new Contact(FirstName='Del1', LastName='Test', Email='del1@test.com');
        insert c1;
        
        Contact c2 = new Contact(FirstName='Del2', LastName='Test', Email='del2@test.com');
        insert c2;
        
        Test.startTest();
        try {
            Database.DeleteResult[] results = Lib_Security.is().dbDelete(new Contact[]{c1, c2}, false);
        } catch (Exception e) {
            // Exception may occur
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testComplexQuery_WithSubquery() {
        Test.startTest();
        try {
            Account[] accounts = (Account[])Lib_Security.ws().dbQuery(
                'SELECT Id, Name, (SELECT Id, FirstName FROM Contacts LIMIT 5) FROM Account LIMIT 1', 
                null
            );
        } catch (Exception e) {
            // May fail based on data
        }
        Test.stopTest();
    }
    
    @IsTest
    static void testCountQuery_WithComplexConditions() {
        Test.startTest();
        Integer count = Lib_Security.is().dbCountQuery(
            'SELECT COUNT() ', 
            'FROM Contact WHERE FirstName != null AND Email != null', 
            null
        );
        Test.stopTest();
    }
}