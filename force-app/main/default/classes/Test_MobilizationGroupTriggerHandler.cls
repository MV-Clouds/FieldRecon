@isTest
public with sharing class Test_MobilizationGroupTriggerHandler {
    @TestSetup
    static void makeData(){
        PermissionSet ps = [ SELECT Id FROM PermissionSet WHERE Name = 'WF_Recon_App_Admin'];
        PermissionSetAssignment psa = new PermissionSetAssignment(AssigneeId = UserInfo.getUserId(),PermissionSetId = ps.Id);
        INSERT psa;
        System.runAs(new User(Id = UserInfo.getUserId())){
            List<Mobilization_Group__c> mobGroups = new List<Mobilization_Group__c>();
            Job__c job = new Job__c();
            INSERT job;
            for(Integer i = 0 ;i<5;i++){
                mobGroups.add(new Mobilization_Group__c(Job__c=job.Id,Start_Date__c=System.now(),
                        End_Date__c=System.now().addDays(4),Mobilization_Status__c='Confirmed',Include_Saturday__c=true,
                        Include_Sunday__c=true));
            }
            INSERT mobGroups;
        }
    }
    @isTest
    static void testAfterUpdate(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Mobilization_Group__c mobGroup = [Select Id,Start_Date__c,End_Date__c,Include_Sunday__c,Include_Saturday__c From Mobilization_Group__c Limit 1];
            System.assertEquals(5, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
            mobGroup.End_Date__c = System.now().addDays(6);
            UPDATE mobGroup;
            System.assertEquals(7, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
            mobGroup.End_Date__c = System.now().addDays(3);
            UPDATE mobGroup;
            System.assertEquals(4, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
            mobGroup.Start_Date__c = System.now().addDays(-6);
            UPDATE mobGroup;
            System.assertEquals(10, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
            mobGroup.Start_Date__c = System.now().addDays(1);
            UPDATE mobGroup;
            System.assertEquals(3, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
        }
    }
    @isTest
    static void testBeforeUpdate(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Mobilization_Group__c mobGroup = [Select Id,Start_Date__c,End_Date__c From Mobilization_Group__c Limit 1];
            System.assertNotEquals(0, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
            DELETE mobGroup;
            System.assertEquals(0, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());
        }
    }
    @isTest
    static void testMobilizationTrigger(){
        System.runAs(new User(Id = UserInfo.getUserId())){
            Test.startTest();
            Mobilization_Group__c mobGroup = [Select Id,Start_Date__c,End_Date__c,AddAssetUser__c From Mobilization_Group__c][2];
            List<Mobilization__c> mobs = [SELECT Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id];
            Contact con = new Contact(LastName = 'Test');
            INSERT con;
            Equipment__c equip = new Equipment__c();
            INSERT equip;
            List<Mobilization_Member__c> insertMobMembers = new List<Mobilization_Member__c>();
   		    List<Mobilization_Asset__c> insertMobAssets = new List<Mobilization_Asset__c>();
            for(Mobilization__c mob : mobs){
                insertMobMembers.add(new Mobilization_Member__c(Mobilization__c = mob.Id, Contact__c = con.Id));
                insertMobAssets.add(new Mobilization_Asset__c(Mobilization__c = mob.Id,Active__c = true,Equipment__c = equip.Id));
            }
            UPSERT insertMobMembers;
            UPSERT insertMobAssets;
            mobGroup.AddAssetUser__c = true;
            UPDATE mobGroup;
            mobGroup.Start_Date__c = System.now().addDays(-4);
            UPDATE mobGroup;
            System.assertNotEquals(0, [Select Id From Mobilization__c Where Mobilization_Group__c = :mobGroup.Id].size());

            Test.stopTest();
        }
    }
}