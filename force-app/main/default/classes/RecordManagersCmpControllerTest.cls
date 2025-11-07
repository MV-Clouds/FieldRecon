@IsTest
public class RecordManagersCmpControllerTest {
    
    @IsTest
    static void testGetListingFieldsParent() {
        Test.startTest();
        
        // Call the getListingFieldsParent method
        List<RecordManagersCmpController.FieldDetails> result = RecordManagersCmpController.getObjectFieldsParent('Account');
        
        // Assertions
        System.assertNotEquals(null, result, 'The result should not be null.');
        System.assertNotEquals(0, result.size(), 'There should be some fields returned.');
        
        Test.stopTest();
    }
    
    @IsTest
    static void testSaveMappingsForScopeEntry() {
        Test.startTest();
        
        String checklistData = 'Test Checklist Data';
        Integer totalPages = 5;
        RecordManagersCmpController.saveMappings(checklistData, totalPages, 'wfrecon__Scope_Entry__c', 'ScopeEntry');
        
        Test.stopTest();

        List<wfrecon__ScopeEntryConfigration__mdt> metaData = [SELECT Id, MasterLabel FROM wfrecon__ScopeEntryConfigration__mdt LIMIT 1];
        System.AssertNotEquals(0, metaData.size(), 'At least one metadata should be created.');
    }

        
    @IsTest
    static void testSaveMappingsForLocationEntry() {
        Test.startTest();
        
        String checklistData = 'Test Checklist Data';
        Integer totalPages = 5;
        RecordManagersCmpController.saveMappings(checklistData, totalPages, 'wfrecon__Location__c', 'LocationEntry');
        
        Test.stopTest();

        List<wfrecon__LocationConfigration__mdt> metaData = [SELECT Id, MasterLabel FROM wfrecon__LocationConfigration__mdt LIMIT 1];
        System.AssertNotEquals(0, metaData.size(), 'At least one metadata should be created.');
    }

    @IsTest
    static void testGetObjectFields() {
        Test.startTest();
        RecordManagersCmpController.RecordManagerData results = RecordManagersCmpController.getObjectFields('wfrecon__Scope_Entry__c' , 'ScopeEntry');
        Test.stopTest();

        System.assertNotEquals(null, results, 'The result should not be null.');
    }


}