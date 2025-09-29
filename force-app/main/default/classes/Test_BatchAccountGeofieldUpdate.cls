@isTest
public class Test_BatchAccountGeofieldUpdate {
    @isTest
    public static void method1() {
        List<Job__c> lstJob = new List<Job__c>();

        Job__c j = new Job__c();
        j.Job_Name__c = 'MV Cloud Test';
        j.Street__c = 'Near, D-404 The First Synthesis B/H Keshav Baugh Party Plot, Shivalik High-Street';
        j.State__c = 'Gujarat';
        j.City__c = 'Ahmedabad';
        j.Zip_Code__c = '380015';
        j.Country__c = 'IN';

        lstJob.add(j);

        insert lstJob;

        Test.startTest();
        System.assert(lstJob.size() == 1, 'Fail to create job');
        Test.setMock(HttpCalloutMock.class, new AccountGeofieldUpdateCalloutMock());
        batchAccountGeofieldUpdate bacc = new batchAccountGeofieldUpdate();
        DataBase.executeBatch(bacc, 60);
        Test.stopTest();
    }
}