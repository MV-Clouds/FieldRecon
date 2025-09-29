@isTest
public with sharing class Test_ShiftEndLogController {
    @TestSetup
    static void makeData(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
    }
    @isTest
    public static void testShiftEndLogController() {
        System.runAs(new User(Id = UserInfo.getUserId())){
            Test.startTest();
            TestDataFactory.jobdata(1);
            String jsonData = '{"processUpdated":true,"materialUsage":false,"timeEntries":true,"travelLog":false,"workPerformed":"Did end-to-end testing","workPerformedDate":"2021-10-07","tomorrowsPlan":"Will do functional testing"}';
            ShiftEndLogController.initialShiftEndLog([SELECT Id FROM wfrecon__Job__c][0].id, jsonData);
            Test.stopTest();
            wfrecon__Log_Entry__c logEntry = [SELECT Id,wfrecon__Log_Type__c,wfrecon__Processes_Updated__c FROM wfrecon__Log_Entry__c][0];
            System.assertNotEquals(null, logEntry, 'The Log entry is empty for the job');
            System.assertEquals('Shift End', logEntry.wfrecon__Log_Type__c, 'The Log entry type is not equal to the Shift End');
		    System.assertEquals(true, logEntry.wfrecon__Processes_Updated__c, 'Process updated is false');
        }
    }
}