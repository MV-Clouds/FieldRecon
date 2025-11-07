@isTest
private class ShiftEndLogV2ControllerTest {
    
    @testSetup
    static void setupTestData() {
        // Create test Account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Create test Job
        wfrecon__Job__c testJob = new wfrecon__Job__c(
            Name = 'Test Job',
            wfrecon__Account__c = testAccount.Id
        );
        insert testJob;
        
        // Create test Location
        wfrecon__Location__c testLocation = new wfrecon__Location__c(
            Name = 'Test Location',
            wfrecon__Job__c = testJob.Id
        );
        insert testLocation;
        
        // Create test Location Process
        wfrecon__Location_Process__c testProcess = new wfrecon__Location_Process__c(
            Name = 'Test Process',
            wfrecon__Location__c = testLocation.Id,
            wfrecon__Completed_Percentage__c = 50,
            wfrecon__Sequence__c = 1
        );
        insert testProcess;
        
        // Create test Contact/User
        Contact testContact = new Contact(
            FirstName = 'Test',
            LastName = 'User',
            Email = 'testuser@test.com',
            AccountId = testAccount.Id
        );
        insert testContact;
        
        // Create Shift End Log
        wfrecon__Log_Entry__c testLog = new wfrecon__Log_Entry__c(
            wfrecon__Job__c = testJob.Id,
            wfrecon__Log_Type__c = 'Shift End',
            wfrecon__Work_Performed__c = 'Initial work performed',
            wfrecon__Work_Performed_Date__c = Date.today(),
            wfrecon__Plan_for_Tomorrow__c = 'Initial plan',
            wfrecon__Exceptions__c = 'No exceptions',
            wfrecon__Notes_to_Office__c = 'Initial notes'
        );
        insert testLog;
    }
    
    @isTest
    static void testGetShiftEndLogsWithCrewInfo() {
        wfrecon__Job__c job = [SELECT Id FROM wfrecon__Job__c LIMIT 1];
        
        Test.startTest();
        ShiftEndLogV2Controller.ShiftEndLogWithCrewWrapper result = 
            ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo(job.Id);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertNotEquals(null, result.shiftEndLogs, 'Shift end logs should not be null');
        System.assertEquals(1, result.shiftEndLogs.size(), 'Should have 1 shift end log');
    }
    
    @isTest
    static void testUpdateShiftEndLogWithImages() {
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c LIMIT 1];
        log.wfrecon__Work_Performed__c = 'Updated work performed';
        
        Test.startTest();
        ShiftEndLogV2Controller.updateShiftEndLogWithImages(log, new List<String>());
        Test.stopTest();
        
        wfrecon__Log_Entry__c updatedLog = [
            SELECT wfrecon__Work_Performed__c 
            FROM wfrecon__Log_Entry__c 
            WHERE Id = :log.Id
        ];
        
        System.assertEquals('Updated work performed', updatedLog.wfrecon__Work_Performed__c);
    }
    
    @isTest
    static void testDeleteShiftEndLog() {
        wfrecon__Log_Entry__c log = [SELECT Id FROM wfrecon__Log_Entry__c LIMIT 1];
        
        Test.startTest();
        String result = ShiftEndLogV2Controller.deleteShiftEndLog(log.Id);
        Test.stopTest();
        
        List<wfrecon__Log_Entry__c> deletedLogs = [
            SELECT Id 
            FROM wfrecon__Log_Entry__c 
            WHERE Id = :log.Id
        ];
        
        System.assertEquals(0, deletedLogs.size(), 'Log should be deleted');
        System.assert(result.contains('Success'), 'Should return success message');
    }
    
    @isTest
    static void testGetShiftEndLogsWithNullJobId() {
        Test.startTest();
        ShiftEndLogV2Controller.ShiftEndLogWithCrewWrapper result = 
            ShiftEndLogV2Controller.getShiftEndLogsWithCrewInfo(null);
        Test.stopTest();
        
        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.shiftEndLogs.size(), 'Should have no logs for null job ID');
    }
    
    @isTest
    static void testUpdateShiftEndLogWithInvalidData() {
        try {
            Test.startTest();
            ShiftEndLogV2Controller.updateShiftEndLogWithImages(null, null);
            Test.stopTest();
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Invalid'), 'Should throw invalid log entry exception');
        }
    }
}
